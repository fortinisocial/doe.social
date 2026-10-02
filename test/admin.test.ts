import { expect, test, vi } from "vitest";
import worker from "../src/index";
import type { PageConfig } from "../src/pages";

const AUD = "aud-doe-social";

function encode(value: object | ArrayBuffer): string {
	const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new TextEncoder().encode(JSON.stringify(value));
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * An Access team with its signing key and a token for `email`, signed the way
 * Access does it. Each test gets its own team: the Worker caches keys per team.
 */
async function createAccess(email: string, team: string) {
	const keys = (await crypto.subtle.generateKey(
		{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "k1" };
	const unsigned = `${encode({ alg: "RS256", kid: "k1" })}.${encode({
		aud: [AUD],
		email,
		iss: `https://${team}`,
		exp: Math.floor(Date.now() / 1000) + 600,
	})}`;
	const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(unsigned));
	return { team, jwk, token: `${unsigned}.${encode(signature)}` };
}

function createKv(pages: PageConfig[]) {
	const store = new Map(pages.map((p) => [p.slug, JSON.stringify(p)]));
	return {
		store,
		get: async (key: string) => (store.has(key) ? JSON.parse(store.get(key)!) : null),
		put: async (key: string, value: string) => void store.set(key, value),
		delete: async (key: string) => void store.delete(key),
		list: async () => ({ keys: [...store.keys()].map((name) => ({ name })) }),
	};
}

function createPage(slug: string, paymentCode: string): PageConfig {
	return {
		slug,
		title: slug,
		paymentLinkId: `plink_${slug}`,
		paymentUrl: `https://donate.stripe.com/${paymentCode}`,
		shortLink: `https://dub.sh/${slug}`,
		createdAt: "2026-10-02T12:00:00Z",
	};
}

test("admin deletes a page with its dub link, and keeps the page when Dub fails", async () => {
	const access = await createAccess("staff@fortini.org.br", "delete.cloudflareaccess.com");
	const kv = createKv([createPage("mesa", "codeMesa"), createPage("festa", "codeFesta")]);
	// Dub knows both short links; deleting `festa`'s fails on their side.
	const dubLinks: Record<string, { id: string; url: string }> = {
		mesa: { id: "link_mesa", url: "https://donate.stripe.com/codeMesa" },
		festa: { id: "link_festa", url: "https://donate.stripe.com/codeFesta" },
	};
	const dubDeletes: string[] = [];
	vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
		const url = new URL(input);
		if (url.pathname === "/cdn-cgi/access/certs") return Response.json({ keys: [access.jwk] });
		if (url.pathname === "/links/info") {
			const link = dubLinks[url.searchParams.get("key")!];
			return link ? Response.json({ ...link, key: url.searchParams.get("key") }) : new Response(null, { status: 404 });
		}
		if (init?.method === "DELETE") {
			const id = url.pathname.split("/").at(-1)!;
			if (id === "link_festa") return new Response(null, { status: 500 });
			dubDeletes.push(id);
			return Response.json({ id });
		}
		throw new Error(`unexpected fetch ${input}`);
	});
	vi.spyOn(console, "log").mockImplementation(() => {});
	const env = { PAGES: kv, ACCESS_TEAM_DOMAIN: access.team, ACCESS_AUD: AUD, DUB_API_KEY: "dub_test" } as unknown as Env;
	const remove = (slug: string, headers: Record<string, string>) =>
		worker.fetch(
			new Request("https://doe.social/admin", {
				method: "POST",
				headers,
				body: new URLSearchParams({ action: "delete", slug, dub: "1" }),
			}),
			env,
			{} as ExecutionContext,
		);
	const signedIn = { Origin: "https://doe.social", "Cf-Access-Jwt-Assertion": access.token };

	try {
		expect((await remove("mesa", { Origin: "https://doe.social" })).status).toBe(403);
		expect((await remove("mesa", { ...signedIn, Origin: "https://evil.example" })).status).toBe(403);
		expect(kv.store.has("mesa")).toBe(true);

		expect((await remove("mesa", signedIn)).status).toBe(200);
		expect(kv.store.has("mesa")).toBe(false);
		expect(dubDeletes).toEqual(["link_mesa"]);

		expect((await remove("festa", signedIn)).status).toBe(502);
		expect(kv.store.has("festa")).toBe(true);
	} finally {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	}
});

test("saving a page picks up a Dub link renamed since the page was created", async () => {
	const access = await createAccess("staff@fortini.org.br", "save.cloudflareaccess.com");
	const kv = createKv([{ ...createPage("festa-2026", "codeMesa"), shortLink: "https://dub.sh/festa-mesa" }]);
	// Renamed in Dub: same link, now dub.sh/festa-2026.
	let dubLinks = [{ id: "link_1", key: "festa-2026", url: "https://donate.stripe.com/codeMesa", shortLink: "https://dub.sh/festa-2026" }];
	vi.stubGlobal("fetch", async (input: string) => {
		const url = new URL(input);
		if (url.pathname === "/cdn-cgi/access/certs") return Response.json({ keys: [access.jwk] });
		if (url.pathname === "/links") return Response.json(dubLinks.filter((l) => l.url.includes(url.searchParams.get("search")!)));
		throw new Error(`unexpected fetch ${input}`);
	});
	vi.spyOn(console, "log").mockImplementation(() => {});
	const env = { PAGES: kv, ACCESS_TEAM_DOMAIN: access.team, ACCESS_AUD: AUD, DUB_API_KEY: "dub_test" } as unknown as Env;
	const save = () =>
		worker.fetch(
			new Request("https://doe.social/admin", {
				method: "POST",
				headers: { Origin: "https://doe.social", "Cf-Access-Jwt-Assertion": access.token },
				body: new URLSearchParams({ slug: "festa-2026", title: "Festa", goal: "31.500", editing: "1" }),
			}),
			env,
			{} as ExecutionContext,
		);
	const stored = () => JSON.parse(kv.store.get("festa-2026")!) as PageConfig;

	try {
		expect((await save()).status).toBe(200);
		expect(stored()).toMatchObject({ shortLink: "https://dub.sh/festa-2026", goalCents: 3_150_000 });

		// Deleted in Dub: the QR falls back to the Stripe link rather than a dead short link.
		dubLinks = [];
		expect((await save()).status).toBe(200);
		expect(stored().shortLink).toBeUndefined();
	} finally {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	}
});
