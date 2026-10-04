/**
 * Short link + QR code via Dub. The QR points at the short link, so scans
 * show up as clicks in Dub's analytics.
 */

import * as v from "valibot";

const API = "https://api.dub.co";

const DubLinkSchema = v.object({ id: v.string(), key: v.string(), url: v.string(), shortLink: v.string() });
export type DubLink = v.InferOutput<typeof DubLinkSchema>;

/** A Dub API call; a successful body is checked against `schema` before anyone uses it. */
async function dub<TSchema extends v.GenericSchema>(
	apiKey: string,
	path: string,
	schema: TSchema,
	init: RequestInit = {},
): Promise<{ status: number; body: v.InferOutput<TSchema> | undefined }> {
	const response = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
	});
	const body = response.ok ? v.parse(schema, await response.json()) : undefined;
	return { status: response.status, body };
}

/** The existing short link, if any, for a pasted dub URL. */
export async function getDubLink(apiKey: string, domain: string, key: string): Promise<DubLink | undefined> {
	const params = new URLSearchParams({ domain, key });
	const { status, body } = await dub(apiKey, `/links/info?${params.toString()}`, DubLinkSchema);
	if (status === 404) return undefined;
	if (!body) throw new Error(`dub links/info ${status}`);
	return body;
}

/**
 * A short link already pointing at this payment link. Matching on the code
 * catches links created with either buy.stripe.com or donate.stripe.com.
 */
export async function findDubLinkFor(apiKey: string, paymentCode: string): Promise<DubLink | undefined> {
	return (await findDubLinksFor(apiKey, paymentCode))[0];
}

/** Every short link pointing at this payment link. */
export async function findDubLinksFor(apiKey: string, paymentCode: string): Promise<DubLink[]> {
	const params = new URLSearchParams({ search: paymentCode, pageSize: "100" });
	const { status, body } = await dub(apiKey, `/links?${params.toString()}`, v.array(DubLinkSchema));
	if (!body) throw new Error(`dub links ${status}`);
	return body.filter((link) => link.url.includes(paymentCode));
}

export type CreateResult = { ok: true; link: DubLink } | { ok: false; reason: "taken" | "error"; status: number };

export async function createDubLink(apiKey: string, domain: string, key: string, url: string): Promise<CreateResult> {
	const { status, body } = await dub(apiKey, "/links", DubLinkSchema, {
		method: "POST",
		body: JSON.stringify({ domain, key, url }),
	});
	if (body) return { ok: true, link: body };
	return { ok: false, reason: status === 409 ? "taken" : "error", status };
}

/** Deletes a short link for good; anything still pointing at it (printed QRs) stops working. */
export async function deleteDubLink(apiKey: string, id: string): Promise<void> {
	const { status } = await dub(apiKey, `/links/${encodeURIComponent(id)}`, v.unknown(), { method: "DELETE" });
	if (status !== 200 && status !== 404) throw new Error(`dub delete ${status}`);
}
