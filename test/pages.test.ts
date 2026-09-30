import { describe, expect, test } from "vitest";
import { parseReais, summarize, validSlug } from "../src/pages";
import { paymentLinkCode } from "../src/stripe";

describe("public summary", () => {
	test("totals every donation, lists the latest first with São Paulo time and nothing else", () => {
		// 2026-09-30T01:05:24Z is 22:05 in São Paulo.
		const donations = Array.from({ length: 15 }, (_, i) => ({
			amountCents: i === 0 ? 135000 : 45000,
			paidAt: Date.UTC(2026, 8, 30, 1, 5, 24) / 1000 - i * 60,
		}));

		const summary = summarize(donations);

		expect(summary.totalCents).toBe(135000 + 14 * 45000);
		expect(summary.count).toBe(15);
		expect(summary.recent).toHaveLength(12);
		expect(summary.recent[0]).toEqual({ amountCents: 135000, time: "22:05" });
		expect(summary.recent[1]).toEqual({ amountCents: 45000, time: "22:04" });
	});
});

test("goal input accepts Brazilian formats", () => {
	expect(parseReais("30.000")).toBe(3_000_000);
	expect(parseReais("R$ 1.350,50")).toBe(135_050);
	expect(parseReais("500")).toBe(50_000);
	expect(parseReais("abc")).toBeUndefined();
	expect(parseReais("0")).toBeUndefined();
});

test("slugs are url-safe and never shadow reserved paths", () => {
	expect(validSlug("festa-das-criancas")).toBe(true);
	expect(validSlug("admin")).toBe(false);
	expect(validSlug("redesoma")).toBe(false);
	expect(validSlug("-festa")).toBe(false);
	expect(validSlug("Festa")).toBe(false);
});

test("buy and donate hosts resolve to the same payment link code", () => {
	expect(paymentLinkCode("https://donate.stripe.com/14AcN58c3f6Hasef0ne7m0G")).toBe("14AcN58c3f6Hasef0ne7m0G");
	expect(paymentLinkCode("https://buy.stripe.com/14AcN58c3f6Hasef0ne7m0G?x=1")).toBe("14AcN58c3f6Hasef0ne7m0G");
	expect(paymentLinkCode("https://example.com/14AcN58c3f6Hasef0ne7m0G")).toBeUndefined();
});
