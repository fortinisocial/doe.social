import * as v from "valibot";
import type { PageStore } from "./bindings";
import { log } from "./log";
import type { Donation } from "./stripe";

/** One-time gifts add up to a total; monthly donors add up to R$ per month. */
const CadenceSchema = v.picklist(["once", "monthly"]);
export type Cadence = v.InferOutput<typeof CadenceSchema>;

/** A page config as stored in KV. Read through `getPage`, which checks it against this schema. */
export const PageConfigSchema = v.object({
	slug: v.string(),
	title: v.string(),
	/** Goal in cents (per month for a monthly campaign); absent means no goal. */
	goalCents: v.optional(v.number()),
	/** Absent means "once": pages created before monthly campaigns existed. */
	cadence: v.optional(CadenceSchema),
	/** The link the QR and the button lead to when there is no donation page. */
	paymentLinkId: v.string(),
	paymentUrl: v.string(),
	/** Every payment link whose donations count; absent means just `paymentLinkId`. */
	paymentLinkIds: v.optional(v.array(v.string())),
	/** Dub short link; absent when Dub was unavailable, then the QR uses paymentUrl. */
	shortLink: v.optional(v.string()),
	createdAt: v.string(),
});
export type PageConfig = v.InferOutput<typeof PageConfigSchema>;

/** What the public page receives — amounts and times only, never who. */
export const SummarySchema = v.object({
	totalCents: v.number(),
	count: v.number(),
	/** `paidAt` rounded down to the minute; the browser formats it relative to its own today. */
	recent: v.array(v.object({ amountCents: v.number(), paidAt: v.number() })),
});
export type Summary = v.InferOutput<typeof SummarySchema>;

export const RECENT_LIMIT = 12;

export const cadenceOf = (page: PageConfig): Cadence => page.cadence ?? "once";
export const linkIdsOf = (page: PageConfig): string[] => page.paymentLinkIds ?? [page.paymentLinkId];

// Paths the Worker or the static assets already own. A campaign's own donation
// page (public/<slug>/) is not here: it shares the slug with its campaign, and
// the panel then lives at /<slug>/painel.
const RESERVED = new Set(["admin", "api", "fonts", "img", "redesoma", "favicon.ico", "robots.txt", "site.webmanifest"]);

export function validSlug(slug: string): boolean {
	return /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug) && !RESERVED.has(slug);
}

export function summarize(donations: Donation[]): Summary {
	return {
		totalCents: donations.reduce((sum, d) => sum + d.amountCents, 0),
		count: donations.length,
		recent: donations.slice(0, RECENT_LIMIT).map((d) => ({
			amountCents: d.amountCents,
			paidAt: d.paidAt - (d.paidAt % 60),
		})),
	};
}

/** "R$ 1.350,00" → 135000. Accepts "30000", "30.000", "30.000,50". */
export function parseReais(input: string): number | undefined {
	const cleaned = input.replace(/[R$\s]/g, "");
	if (cleaned === "") return undefined;
	const normalized = cleaned.replace(/\./g, "").replace(",", ".");
	const value = Number(normalized);
	if (!Number.isFinite(value) || value <= 0) return undefined;
	return Math.round(value * 100);
}

/**
 * The page stored under `slug`, or null. A config that doesn't match the schema
 * (hand-written in KV, say) is logged and treated as missing rather than trusted.
 */
export async function getPage(kv: PageStore, slug: string): Promise<PageConfig | null> {
	const stored = await kv.get(slug, "json");
	if (stored === null) return null;
	const page = v.safeParse(PageConfigSchema, stored);
	if (page.success) return page.output;
	log("page_invalid", { slug, issues: v.flatten(page.issues).nested });
	return null;
}

export async function listPages(kv: PageStore): Promise<PageConfig[]> {
	const { keys } = await kv.list();
	const pages = await Promise.all(keys.map((k) => getPage(kv, k.name)));
	return pages.filter((p) => p !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
