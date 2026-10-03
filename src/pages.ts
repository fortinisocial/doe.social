import type { Donation } from "./stripe";

export interface PageConfig {
	slug: string;
	title: string;
	/** Goal in cents; absent means no goal. */
	goalCents?: number;
	paymentLinkId: string;
	paymentUrl: string;
	/** Dub short link; absent when Dub was unavailable, then the QR uses paymentUrl. */
	shortLink?: string;
	createdAt: string;
}

/** What the public page receives — amounts and times only, never who. */
export interface Summary {
	totalCents: number;
	count: number;
	/** `paidAt` rounded down to the minute; the browser formats it relative to its own today. */
	recent: { amountCents: number; paidAt: number }[];
}

export const RECENT_LIMIT = 12;

// Paths the Worker or the static assets already own.
const RESERVED = new Set([
	"admin",
	"api",
	"fonts",
	"img",
	"redesoma",
	"loucas-por-tennis",
	"favicon.ico",
	"robots.txt",
	"site.webmanifest",
]);

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

export async function getPage(kv: KVNamespace, slug: string): Promise<PageConfig | null> {
	return kv.get<PageConfig>(slug, "json");
}

export async function listPages(kv: KVNamespace): Promise<PageConfig[]> {
	const { keys } = await kv.list();
	const pages = await Promise.all(keys.map((k) => getPage(kv, k.name)));
	return pages
		.filter((p): p is PageConfig => p !== null)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
