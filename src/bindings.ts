/**
 * What the Worker uses from its bindings. Handlers take these narrow shapes
 * rather than the whole generated `Env`: the real bindings satisfy them, and
 * tests can fake exactly what is used, with no casts.
 */

/** The KV namespace holding one page config per slug (`PAGES`). */
export interface PageStore {
	get(key: string, type: "json"): Promise<unknown>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
	list(): Promise<{ keys: { name: string }[] }>;
}

/** The static files in public/ (`ASSETS`). */
export interface AssetStore {
	fetch(request: Request): Promise<Response>;
}

export interface Bindings {
	PAGES: PageStore;
	ASSETS?: AssetStore;
	STRIPE_API_KEY: string;
	DUB_API_KEY: string;
	DUB_DOMAIN: string;
	ACCESS_TEAM_DOMAIN: string;
	ACCESS_AUD: string;
}

/** The part of the Workers `ExecutionContext` the Worker uses. */
export interface Background {
	waitUntil(promise: Promise<unknown>): void;
}
