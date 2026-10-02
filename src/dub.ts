/**
 * Short link + QR code via Dub. The QR points at the short link, so scans
 * show up as clicks in Dub's analytics.
 */

const API = "https://api.dub.co";

export interface DubLink {
	id: string;
	key: string;
	url: string;
	shortLink: string;
}

async function dub<T>(
	apiKey: string,
	path: string,
	init?: RequestInit,
): Promise<{ status: number; body: T | undefined }> {
	const response = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
	});
	const body = response.ok ? ((await response.json()) as T) : undefined;
	return { status: response.status, body };
}

/** The existing short link, if any, for a pasted dub URL. */
export async function getDubLink(
	apiKey: string,
	domain: string,
	key: string,
): Promise<DubLink | undefined> {
	const params = new URLSearchParams({ domain, key });
	const { status, body } = await dub<DubLink>(apiKey, `/links/info?${params}`);
	if (status === 404) return undefined;
	if (!body) throw new Error(`dub links/info ${status}`);
	return body;
}

/**
 * A short link already pointing at this payment link. Matching on the code
 * catches links created with either buy.stripe.com or donate.stripe.com.
 */
export async function findDubLinkFor(
	apiKey: string,
	paymentCode: string,
): Promise<DubLink | undefined> {
	return (await findDubLinksFor(apiKey, paymentCode))[0];
}

/** Every short link pointing at this payment link. */
export async function findDubLinksFor(apiKey: string, paymentCode: string): Promise<DubLink[]> {
	const params = new URLSearchParams({ search: paymentCode, pageSize: "100" });
	const { status, body } = await dub<DubLink[]>(apiKey, `/links?${params}`);
	if (!body) throw new Error(`dub links ${status}`);
	return body.filter((link) => link.url.includes(paymentCode));
}

export type CreateResult =
	| { ok: true; link: DubLink }
	| { ok: false; reason: "taken" | "error"; status: number };

export async function createDubLink(
	apiKey: string,
	domain: string,
	key: string,
	url: string,
): Promise<CreateResult> {
	const { status, body } = await dub<DubLink>(apiKey, "/links", {
		method: "POST",
		body: JSON.stringify({ domain, key, url }),
	});
	if (body) return { ok: true, link: body };
	return { ok: false, reason: status === 409 ? "taken" : "error", status };
}

/** Deletes a short link for good; anything still pointing at it (printed QRs) stops working. */
export async function deleteDubLink(apiKey: string, id: string): Promise<void> {
	const { status } = await dub<unknown>(apiKey, `/links/${encodeURIComponent(id)}`, { method: "DELETE" });
	if (status !== 200 && status !== 404) throw new Error(`dub delete ${status}`);
}

/** Dub's public QR renderer — no API key, so the page can load it directly. */
export function qrImageUrl(target: string): string {
	const params = new URLSearchParams({
		url: target,
		size: "800",
		level: "Q",
		fgColor: "#373636",
		hideLogo: "true",
		margin: "0",
	});
	return `${API}/qr?${params}`;
}
