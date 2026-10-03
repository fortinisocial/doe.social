import { expect, test, vi } from "vitest";
import worker from "../src/index";
import type { PageConfig, Summary } from "../src/pages";

function createKv(pages: PageConfig[]) {
	const store = new Map(pages.map((p) => [p.slug, JSON.stringify(p)]));
	return {
		get: async (key: string) => (store.has(key) ? JSON.parse(store.get(key)!) : null),
		list: async () => ({ keys: [...store.keys()].map((name) => ({ name })) }),
	};
}

/** Static files in public/: only the slugs given have their own donation page. */
function createAssets(donationPages: string[]) {
	return {
		fetch: async (request: Request) =>
			new Response(null, { status: donationPages.some((slug) => new URL(request.url).pathname === `/${slug}/`) ? 200 : 404 }),
	};
}

// The Workers cache, always missing: every request asks the fake Stripe.
const noCache = { default: { match: async () => undefined, put: async () => {} } };
const ctx = { waitUntil: () => {} } as unknown as ExecutionContext;

function subscription(status: string, unitAmount: number, interval: "month" | "year" = "month") {
	return { status, items: { data: [{ quantity: 1, price: { unit_amount: unitAmount, recurring: { interval, interval_count: 1 } } }] } };
}

/** Stripe's checkout sessions endpoint, answering per payment link. */
function stubStripe(sessionsByLink: Record<string, object[]>) {
	const asked: string[] = [];
	vi.stubGlobal("fetch", async (input: string) => {
		const url = new URL(input);
		if (url.hostname !== "api.stripe.com" || url.pathname !== "/v1/checkout/sessions") throw new Error(`unexpected fetch ${input}`);
		asked.push(`${url.searchParams.get("payment_link")} ${url.searchParams.get("expand[]")}`);
		return Response.json({ data: sessionsByLink[url.searchParams.get("payment_link")!] ?? [], has_more: false });
	});
	vi.stubGlobal("caches", noCache);
	return asked;
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
	const asked = stubStripe({
		plink_50: [
			{ id: "cs_1", mode: "subscription", created: 1000, subscription: subscription("active", 5_000) },
			{ id: "cs_2", mode: "subscription", created: 2000, subscription: subscription("canceled", 10_000) },
			// Billed yearly: counts for what it brings in per month.
			{ id: "cs_3", mode: "subscription", created: 3000, subscription: subscription("active", 120_000, "year") },
		],
		plink_200: [
			{ id: "cs_4", mode: "subscription", created: 4000, subscription: subscription("active", 20_000) },
			{ id: "cs_5", mode: "subscription", created: 5000, subscription: subscription("past_due", 20_000) },
		],
	});
	const env = { PAGES: createKv([campaign]), ASSETS: createAssets(["loucas"]), STRIPE_API_KEY: "rk_test" } as unknown as Env;
	const get = (path: string) => worker.fetch(new Request(`https://doe.social${path}`), env, ctx);

	try {
		const data = await get("/loucas/dados");
		expect(data.headers.get("X-Robots-Tag")).toContain("noindex");
		const summary = (await data.json()) as Summary;
		expect(summary.count).toBe(3);
		expect(summary.totalCents).toBe(5_000 + 10_000 + 20_000);
		expect(summary.recent.map((r) => r.amountCents)).toEqual([20_000, 10_000, 5_000]);
		expect(asked).toEqual(["plink_50 data.subscription", "plink_200 data.subscription"]);

		const panel = await get("/loucas/painel");
		expect(panel.status).toBe(200);
		expect(panel.headers.get("X-Robots-Tag")).toContain("noindex");
		// It has its own donation page, so "Doar agora" leads there rather than to one Stripe amount.
		expect(await panel.text()).toContain('href="https://doe.social/loucas"');

		expect((await get("/loucas/qualquer-coisa")).headers.get("Location")).toBe("https://doe.social/loucas");
	} finally {
		vi.unstubAllGlobals();
	}
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
	const asked = stubStripe({
		plink_festa: [
			{ id: "cs_1", mode: "payment", created: 1000, amount_total: 45_000, payment_status: "paid", payment_intent: { created: 1060 } },
			// A boleto issued but not paid yet.
			{ id: "cs_2", mode: "payment", created: 2000, amount_total: 30_000, payment_status: "unpaid", payment_intent: null },
		],
	});
	const env = { PAGES: createKv([page]), ASSETS: createAssets([]), STRIPE_API_KEY: "rk_test" } as unknown as Env;
	const get = (path: string) => worker.fetch(new Request(`https://doe.social${path}`), env, ctx);

	try {
		const summary = (await (await get("/festa/dados")).json()) as Summary;
		expect(summary).toEqual({ totalCents: 45_000, count: 1, recent: [{ amountCents: 45_000, paidAt: 1020 }] });
		expect(asked).toEqual(["plink_festa data.payment_intent"]);

		// /festa and /festa/painel are the same panel; with no donation page, "Doar agora" goes to the short link.
		for (const path of ["/festa", "/festa/painel"]) {
			const panel = await get(path);
			expect(panel.status).toBe(200);
			expect(await panel.text()).toContain('href="https://dub.sh/festa"');
		}
	} finally {
		vi.unstubAllGlobals();
	}
});
