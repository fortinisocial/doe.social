import * as v from "valibot";
import { expect, test } from "vitest";
import { handle } from "../src/index";
import { SummarySchema, type PageConfig } from "../src/pages";
import { createAssets, createBackground, createBindings, createKv, noCache, silenceLogs, stubNetwork } from "./fakes";

function subscription(status: string, unitAmount: number, interval: "month" | "year" = "month") {
	return {
		status,
		items: { data: [{ quantity: 1, price: { unit_amount: unitAmount, recurring: { interval, interval_count: 1 } } }] },
	};
}

/** A completed monthly checkout, shaped as Stripe returns it with `expand[]=data.subscription`. */
function monthlySession(id: string, created: number, sub: ReturnType<typeof subscription>) {
	const amount = sub.items.data[0]?.price.unit_amount ?? 0;
	return {
		id,
		mode: "subscription",
		created,
		amount_total: amount,
		payment_status: "paid",
		payment_intent: null,
		subscription: sub,
	};
}

/** Stripe's checkout sessions endpoint, answering per payment link, until disposed. `asked` lists each call. */
function stubStripe(sessionsByLink: Record<string, object[]>): Disposable & { asked: string[] } {
	const asked: string[] = [];
	const network = stubNetwork(async (input) => {
		const url = new URL(input);
		if (url.hostname !== "api.stripe.com" || url.pathname !== "/v1/checkout/sessions")
			throw new Error(`unexpected fetch ${input}`);
		const link = url.searchParams.get("payment_link") ?? "";
		asked.push(`${link} ${url.searchParams.get("expand[]") ?? ""}`);
		return Response.json({ data: sessionsByLink[link] ?? [], has_more: false });
	}, noCache);
	return { asked, [Symbol.dispose]: () => network[Symbol.dispose]() };
}

test("a monthly campaign counts only donors still giving, across all its links, on a panel kept out of search", async () => {
	const campaign: PageConfig = {
		slug: "loucas",
		title: "Loucas",
		cadence: "monthly",
		goalCents: 100_000,
		paymentLinkId: "plink_50",
		paymentUrl: "https://donate.stripe.com/code50",
		paymentLinkIds: ["plink_50", "plink_200"],
		createdAt: "2026-10-03T12:00:00Z",
	};
	using stripe = stubStripe({
		plink_50: [
			monthlySession("cs_1", 1000, subscription("active", 5_000)),
			monthlySession("cs_2", 2000, subscription("canceled", 10_000)),
			// Billed yearly: counts for what it brings in per month.
			monthlySession("cs_3", 3000, subscription("active", 120_000, "year")),
		],
		plink_200: [
			monthlySession("cs_4", 4000, subscription("active", 20_000)),
			monthlySession("cs_5", 5000, subscription("past_due", 20_000)),
		],
	});
	const env = createBindings({ PAGES: createKv([campaign]), ASSETS: createAssets(["loucas"]) });
	const get = (path: string) => handle(new Request(`https://doe.social${path}`), env, createBackground());

	const data = await get("/loucas/dados");
	expect(data.headers.get("X-Robots-Tag")).toContain("noindex");
	const summary = v.parse(SummarySchema, await data.json());
	expect(summary.count).toBe(3);
	expect(summary.totalCents).toBe(5_000 + 10_000 + 20_000);
	expect(summary.recent.map((r) => r.amountCents)).toEqual([20_000, 10_000, 5_000]);
	expect(stripe.asked).toEqual(["plink_50 data.subscription", "plink_200 data.subscription"]);

	const panel = await get("/loucas/painel");
	expect(panel.status).toBe(200);
	expect(panel.headers.get("X-Robots-Tag")).toContain("noindex");
	// It has its own donation page, so "Doar agora" leads there rather than to one Stripe amount.
	expect(await panel.text()).toContain('href="https://doe.social/loucas"');

	expect((await get("/loucas/qualquer-coisa")).headers.get("Location")).toBe("https://doe.social/loucas");
});

test("a page created before campaigns had several links still totals its one-time gifts and sends donors to Stripe", async () => {
	const page: PageConfig = {
		slug: "festa",
		title: "Festa",
		paymentLinkId: "plink_festa",
		paymentUrl: "https://donate.stripe.com/codeFesta",
		shortLink: "https://dub.sh/festa",
		createdAt: "2026-09-01T12:00:00Z",
	};
	using stripe = stubStripe({
		plink_festa: [
			{
				id: "cs_1",
				mode: "payment",
				created: 1000,
				amount_total: 45_000,
				payment_status: "paid",
				payment_intent: { created: 1060 },
			},
			// A boleto issued but not paid yet.
			{
				id: "cs_2",
				mode: "payment",
				created: 2000,
				amount_total: 30_000,
				payment_status: "unpaid",
				payment_intent: null,
			},
		],
	});
	const env = createBindings({ PAGES: createKv([page]) });
	const get = (path: string) => handle(new Request(`https://doe.social${path}`), env, createBackground());

	const summary = v.parse(SummarySchema, await (await get("/festa/dados")).json());
	expect(summary).toEqual({ totalCents: 45_000, count: 1, recent: [{ amountCents: 45_000, paidAt: 1020 }] });
	expect(stripe.asked).toEqual(["plink_festa data.payment_intent"]);

	// /festa and /festa/painel are the same panel; with no donation page, "Doar agora" goes to the short link.
	for (const path of ["/festa", "/festa/painel"]) {
		const panel = await get(path);
		expect(panel.status).toBe(200);
		expect(await panel.text()).toContain('href="https://dub.sh/festa"');
	}
});

test("a Stripe response missing a field the panel relies on fails as unavailable, not as a wrong total", async () => {
	const page: PageConfig = {
		slug: "festa",
		title: "Festa",
		paymentLinkId: "plink_festa",
		paymentUrl: "https://donate.stripe.com/codeFesta",
		createdAt: "2026-09-01T12:00:00Z",
	};
	// No `payment_status`: Stripe changed shape, or something in between did.
	using _stripe = stubStripe({
		plink_festa: [{ id: "cs_1", mode: "payment", created: 1000, amount_total: 45_000, payment_intent: null }],
	});
	using _logs = silenceLogs();
	const env = createBindings({ PAGES: createKv([page]) });

	const data = await handle(new Request("https://doe.social/festa/dados"), env, createBackground());
	expect(data.status).toBe(502);
	expect(await data.json()).toEqual({ error: "unavailable" });
});
