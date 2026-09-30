/**
 * Cloudflare Access puts a signed JWT on every request it lets through. We
 * verify it ourselves so /admin stays closed even if the Access app is
 * deleted or its path rule drifts — without it, anyone could create pages
 * and Dub links.
 */

interface Jwk extends JsonWebKey {
	kid: string;
}

let cachedKeys: { team: string; keys: Jwk[]; at: number } | undefined;

async function accessKeys(team: string): Promise<Jwk[]> {
	if (cachedKeys && cachedKeys.team === team && Date.now() - cachedKeys.at < 3_600_000) {
		return cachedKeys.keys;
	}
	const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
	if (!response.ok) throw new Error(`access certs ${response.status}`);
	const { keys } = (await response.json()) as { keys: Jwk[] };
	cachedKeys = { team, keys, at: Date.now() };
	return keys;
}

function base64UrlDecode(input: string): Uint8Array {
	const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function decodeJson(part: string): Record<string, unknown> {
	return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
}

/** The authenticated email, or undefined when the request is not allowed. */
export async function accessUser(request: Request, env: Env): Promise<string | undefined> {
	if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return undefined;
	const token = request.headers.get("Cf-Access-Jwt-Assertion");
	const [header, payload, signature] = token?.split(".") ?? [];
	if (!header || !payload || !signature) return undefined;

	try {
		const { kid, alg } = decodeJson(header);
		if (alg !== "RS256") return undefined;
		const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === kid);
		if (!jwk) return undefined;

		const key = await crypto.subtle.importKey(
			"jwk",
			jwk,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["verify"],
		);
		const valid = await crypto.subtle.verify(
			"RSASSA-PKCS1-v1_5",
			key,
			base64UrlDecode(signature),
			new TextEncoder().encode(`${header}.${payload}`),
		);
		if (!valid) return undefined;

		const claims = decodeJson(payload);
		const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
		const now = Date.now() / 1000;
		if (!aud.includes(env.ACCESS_AUD)) return undefined;
		if (typeof claims.exp !== "number" || claims.exp < now) return undefined;
		if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return undefined;
		return typeof claims.email === "string" ? claims.email : "unknown";
	} catch {
		return undefined;
	}
}
