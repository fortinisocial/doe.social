/**
 * Read-only Stripe access. The restricted key needs Checkout Sessions,
 * Payment Intents, Payment Links and Subscriptions read — nothing else.
 *
 * Every response is checked against a schema of just the fields used here, so
 * a change on Stripe's side fails loudly at the edge instead of deep inside.
 */
import * as v from "valibot";

const PaymentLinkSchema = v.object({ id: v.string(), url: v.string() });
export type PaymentLink = v.InferOutput<typeof PaymentLinkSchema>;

/** A paid donation, stripped of anything that identifies the donor. */
export interface Donation {
	amountCents: number;
	/** Unix seconds — when the donor confirmed the payment. */
	paidAt: number;
}

/** Stripe's list envelope around any object. */
function listOf<TItem extends v.GenericSchema>(item: TItem) {
	return v.object({ data: v.array(item), has_more: v.boolean() });
}

const IntervalSchema = v.picklist(["day", "week", "month", "year"]);

const SubscriptionSchema = v.object({
	// A plain string: a status Stripe adds later must not break the whole list. Only "active" counts.
	status: v.string(),
	items: v.object({
		data: v.array(
			v.object({
				quantity: v.nullish(v.number()),
				price: v.object({
					unit_amount: v.nullable(v.number()),
					recurring: v.nullable(v.object({ interval: IntervalSchema, interval_count: v.number() })),
				}),
			}),
		),
	}),
});
type Subscription = v.InferOutput<typeof SubscriptionSchema>;

const CheckoutSessionSchema = v.object({
	id: v.string(),
	amount_total: v.nullable(v.number()),
	created: v.number(),
	mode: v.string(),
	payment_status: v.string(),
	// Expanded into an object when asked for (`expand[]`), a bare id otherwise.
	payment_intent: v.nullish(v.union([v.object({ created: v.number() }), v.string()])),
	subscription: v.nullish(v.union([SubscriptionSchema, v.string()])),
});
type CheckoutSession = v.InferOutput<typeof CheckoutSessionSchema>;

async function stripeGet<TSchema extends v.GenericSchema>(
	key: string,
	path: string,
	params: URLSearchParams,
	schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
	const response = await fetch(`https://api.stripe.com/v1/${path}?${params.toString()}`, {
		headers: { Authorization: `Bearer ${key}` },
	});
	if (!response.ok) {
		throw new Error(`stripe ${path} ${response.status}`);
	}
	return v.parse(schema, await response.json());
}

/**
 * The code at the end of a payment link URL. The same link is reachable from
 * buy.stripe.com and donate.stripe.com, so the code is what identifies it.
 */
export function paymentLinkCode(url: string): string | undefined {
	try {
		const { hostname, pathname } = new URL(url);
		if (!hostname.endsWith("stripe.com")) return undefined;
		return pathname.split("/").filter(Boolean).at(-1);
	} catch {
		return undefined;
	}
}

/** Stripe has no lookup by URL, so walk the links and match the code. */
export async function findPaymentLink(key: string, code: string): Promise<PaymentLink | undefined> {
	let startingAfter: string | undefined;
	for (;;) {
		const params = new URLSearchParams({ limit: "100" });
		if (startingAfter) params.set("starting_after", startingAfter);
		const page = await stripeGet(key, "payment_links", params, listOf(PaymentLinkSchema));
		const match = page.data.find((link) => paymentLinkCode(link.url) === code);
		if (match) return { id: match.id, url: match.url };
		if (!page.has_more) return undefined;
		startingAfter = page.data.at(-1)?.id;
	}
}

async function listCompletedSessions(key: string, paymentLinkId: string, expand: string): Promise<CheckoutSession[]> {
	const sessions: CheckoutSession[] = [];
	let startingAfter: string | undefined;
	for (;;) {
		const params = new URLSearchParams({
			payment_link: paymentLinkId,
			status: "complete",
			limit: "100",
			"expand[]": expand,
		});
		if (startingAfter) params.set("starting_after", startingAfter);
		const page = await stripeGet(key, "checkout/sessions", params, listOf(CheckoutSessionSchema));
		sessions.push(...page.data);
		if (!page.has_more) return sessions;
		startingAfter = page.data.at(-1)?.id;
	}
}

/**
 * Every paid checkout of a payment link. `payment_status === "paid"` drops
 * boletos that were issued but not yet paid. The payment intent's creation
 * time is when the donor confirmed — the session's own `created` is when
 * they opened the page, which can be minutes earlier.
 */
export async function listDonations(key: string, paymentLinkId: string): Promise<Donation[]> {
	const donations: Donation[] = [];
	for (const session of await listCompletedSessions(key, paymentLinkId, "data.payment_intent")) {
		if (session.payment_status !== "paid" || !session.amount_total) continue;
		const intent = session.payment_intent;
		donations.push({
			amountCents: session.amount_total,
			paidAt: typeof intent === "object" && intent ? intent.created : session.created,
		});
	}
	return donations.sort((a, b) => b.paidAt - a.paidAt);
}

// How many of each billing interval fit in a month.
const PER_MONTH = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 } satisfies Record<
	v.InferOutput<typeof IntervalSchema>,
	number
>;

/** What a subscription brings in per month, whatever its billing interval. */
function monthlyCents(subscription: Subscription): number {
	let cents = 0;
	for (const item of subscription.items.data) {
		const recurring = item.price.recurring;
		if (!recurring || !item.price.unit_amount) continue;
		cents += (item.price.unit_amount * (item.quantity ?? 1) * PER_MONTH[recurring.interval]) / recurring.interval_count;
	}
	return Math.round(cents);
}

/**
 * Monthly donors who signed up through a payment link and still give: one
 * entry per subscription that is active today, so a cancellation drops out.
 * `amountCents` is what it brings in per month; `paidAt` is when they signed up.
 * Needs Subscriptions read on the key (the subscription is expanded).
 */
export async function listMonthlyDonors(key: string, paymentLinkId: string): Promise<Donation[]> {
	const donors: Donation[] = [];
	for (const session of await listCompletedSessions(key, paymentLinkId, "data.subscription")) {
		const subscription = session.subscription;
		if (session.mode !== "subscription" || typeof subscription !== "object" || subscription === null) continue;
		if (subscription.status !== "active") continue;
		const amountCents = monthlyCents(subscription);
		if (amountCents) donors.push({ amountCents, paidAt: session.created });
	}
	return donors.sort((a, b) => b.paidAt - a.paidAt);
}
