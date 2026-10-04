import { vi } from "vitest";
import type { AssetStore, Background, Bindings, PageStore } from "../src/bindings";
import type { PageConfig } from "../src/pages";

/**
 * Replaces the global `fetch` (and, with `caches`, the Workers cache) until the
 * returned handle is disposed: `using _network = stubNetwork(…)`.
 */
export function stubNetwork(
	fetch: (input: string, init?: RequestInit) => Promise<Response>,
	caches?: {
		default: {
			match(request: Request): Promise<Response | undefined>;
			put(request: Request, response: Response): Promise<void>;
		};
	},
): Disposable {
	vi.stubGlobal("fetch", fetch);
	if (caches) vi.stubGlobal("caches", caches);
	return { [Symbol.dispose]: () => vi.unstubAllGlobals() };
}

/** The Workers cache, always missing: every request reaches the stubbed network. */
export const noCache = { default: { match: async () => undefined, put: async () => {} } };

/** Keeps the Worker's expected `console.log` events out of the test output until disposed. */
export function silenceLogs(): Disposable {
	const spy = vi.spyOn(console, "log").mockImplementation(() => {});
	return { [Symbol.dispose]: () => spy.mockRestore() };
}

/** KV holding the pages given, plus its raw store so a test can read what the Worker wrote. */
export function createKv(pages: PageConfig[] = []): PageStore & { store: Map<string, string> } {
	const store = new Map(pages.map((page) => [page.slug, JSON.stringify(page)]));
	return {
		store,
		get: async (key) => {
			const value = store.get(key);
			const parsed: unknown = value === undefined ? null : JSON.parse(value);
			return parsed;
		},
		put: async (key, value) => {
			store.set(key, value);
		},
		delete: async (key) => {
			store.delete(key);
		},
		list: async () => ({ keys: [...store.keys()].map((name) => ({ name })) }),
	};
}

/** Static files in public/: only the slugs given have their own donation page. */
export function createAssets(donationPages: string[] = []): AssetStore {
	return {
		fetch: async (request) =>
			new Response(null, {
				status: donationPages.some((slug) => new URL(request.url).pathname === `/${slug}/`) ? 200 : 404,
			}),
	};
}

/** Bindings that work out of the box; a test overrides what it exercises. */
export function createBindings(overrides: Partial<Bindings> = {}): Bindings {
	return {
		PAGES: createKv(),
		ASSETS: createAssets(),
		STRIPE_API_KEY: "rk_test",
		DUB_API_KEY: "dub_test",
		DUB_DOMAIN: "dub.sh",
		ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
		ACCESS_AUD: "aud-doe-social",
		...overrides,
	};
}

/** `ctx.waitUntil` that drops the work: nothing a test checks runs in the background. */
export function createBackground(): Background {
	return { waitUntil: () => {} };
}
