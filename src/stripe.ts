/**
 * Read-only Stripe access. The restricted key needs Checkout Sessions,
 * Payment Intents and Payment Links read — nothing else.
 */

export interface PaymentLink {
	id: string;
	url: string;
}

/** A paid donation, stripped of anything that identifies the donor. */
export interface Donation {
	amountCents: number;
	/** Unix seconds — when the donor confirmed the payment. */
	paidAt: number;
}

interface StripeList<T> {
	data: T[];
	has_more: boolean;
}

interface CheckoutSession {
	id: string;
	amount_total: number | null;
	currency: string | null;
	created: number;
	payment_status: "paid" | "unpaid" | "no_payment_required";
	payment_intent: { created: number } | string | null;
}

async function stripeGet<T>(
	key: string,
	path: string,
	params: URLSearchParams,
): Promise<T> {
	const response = await fetch(`https://api.stripe.com/v1/${path}?${params}`, {
		headers: { Authorization: `Bearer ${key}` },
	});
	if (!response.ok) {
		throw new Error(`stripe ${path} ${response.status}`);
	}
	return response.json();
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
export async function findPaymentLink(
	key: string,
	code: string,
): Promise<PaymentLink | undefined> {
	let startingAfter: string | undefined;
	for (;;) {
		const params = new URLSearchParams({ limit: "100" });
		if (startingAfter) params.set("starting_after", startingAfter);
		const page = await stripeGet<StripeList<PaymentLink>>(key, "payment_links", params);
		const match = page.data.find((link) => paymentLinkCode(link.url) === code);
		if (match) return { id: match.id, url: match.url };
		if (!page.has_more) return undefined;
		startingAfter = page.data.at(-1)?.id;
	}
}

/**
 * Every paid checkout of a payment link. `payment_status === "paid"` drops
 * boletos that were issued but not yet paid. The payment intent's creation
 * time is when the donor confirmed — the session's own `created` is when
 * they opened the page, which can be minutes earlier.
 */
export async function listDonations(
	key: string,
	paymentLinkId: string,
): Promise<Donation[]> {
	const donations: Donation[] = [];
	let startingAfter: string | undefined;
	for (;;) {
		const params = new URLSearchParams({
			payment_link: paymentLinkId,
			status: "complete",
			limit: "100",
			"expand[]": "data.payment_intent",
		});
		if (startingAfter) params.set("starting_after", startingAfter);
		const page = await stripeGet<StripeList<CheckoutSession>>(
			key,
			"checkout/sessions",
			params,
		);
		for (const session of page.data) {
			if (session.payment_status !== "paid" || !session.amount_total) continue;
			const intent = session.payment_intent;
			donations.push({
				amountCents: session.amount_total,
				paidAt: typeof intent === "object" && intent ? intent.created : session.created,
			});
		}
		if (!page.has_more) break;
		startingAfter = page.data.at(-1)?.id;
	}
	return donations.sort((a, b) => b.paidAt - a.paidAt);
}
