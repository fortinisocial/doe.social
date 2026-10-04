/**
 * Cloudflare Access puts a signed JWT on every request it lets through. We
 * verify it ourselves so /admin stays closed even if the Access app is
 * deleted or its path rule drifts — without it, anyone could create pages
 * and Dub links.
 */

import * as v from "valibot";
import type { Bindings } from "./bindings";

/** An RSA signing key from the Access certs endpoint; other key types are skipped. */
const RsaKeySchema = v.object({ kid: v.string(), kty: v.literal("RSA"), n: v.string(), e: v.string() });
type RsaKey = v.InferOutput<typeof RsaKeySchema>;
const CertsSchema = v.object({ keys: v.array(v.unknown()) });

const HeaderSchema = v.object({ alg: v.literal("RS256"), kid: v.string() });
const ClaimsSchema = v.object({
	aud: v.union([v.string(), v.array(v.string())]),
	exp: v.number(),
	iss: v.string(),
	email: v.optional(v.string()),
});

let cachedKeys: { team: string; keys: RsaKey[]; at: number } | undefined;

async function accessKeys(team: string): Promise<RsaKey[]> {
	if (cachedKeys && cachedKeys.team === team && Date.now() - cachedKeys.at < 3_600_000) {
		return cachedKeys.keys;
	}
	const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
	if (!response.ok) throw new Error(`access certs ${response.status}`);
	const certs = v.parse(CertsSchema, await response.json());
	const keys = certs.keys.flatMap((key) => {
		const rsa = v.safeParse(RsaKeySchema, key);
		return rsa.success ? [rsa.output] : [];
	});
	cachedKeys = { team, keys, at: Date.now() };
	return keys;
}

function base64UrlDecode(input: string): Uint8Array {
	const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** A JWT segment decoded to JSON, still unchecked: callers validate it. */
function decodeJson(part: string): unknown {
	return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
}

/** The authenticated email, or undefined when the request is not allowed. */
export async function accessUser(
	request: Request,
	env: Pick<Bindings, "ACCESS_TEAM_DOMAIN" | "ACCESS_AUD">,
): Promise<string | undefined> {
	if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return undefined;
	const token = request.headers.get("Cf-Access-Jwt-Assertion");
	const [header, payload, signature] = token?.split(".") ?? [];
	if (!header || !payload || !signature) return undefined;

	try {
		const head = v.safeParse(HeaderSchema, decodeJson(header));
		if (!head.success) return undefined;
		const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === head.output.kid);
		if (!jwk) return undefined;

		const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
			"verify",
		]);
		const valid = await crypto.subtle.verify(
			"RSASSA-PKCS1-v1_5",
			key,
			base64UrlDecode(signature),
			new TextEncoder().encode(`${header}.${payload}`),
		);
		if (!valid) return undefined;

		const claims = v.safeParse(ClaimsSchema, decodeJson(payload));
		if (!claims.success) return undefined;
		const { aud, exp, iss, email } = claims.output;
		if (!(typeof aud === "string" ? [aud] : aud).includes(env.ACCESS_AUD)) return undefined;
		if (exp < Date.now() / 1000) return undefined;
		if (iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return undefined;
		return email ?? "unknown";
	} catch {
		return undefined;
	}
}
