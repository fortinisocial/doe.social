import { accessUser } from "./access";
import { createDubLink, findDubLinkFor, getDubLink, qrImageUrl } from "./dub";
import {
	getPage,
	listPages,
	parseReais,
	summarize,
	validSlug,
	type PageConfig,
	type Summary,
} from "./pages";
import { findPaymentLink, listDonations, paymentLinkCode } from "./stripe";
import { renderAdmin } from "./views/admin";
import { renderLive } from "./views/live";

const HOME = "https://fortini.org.br/doe";
// Many screens can watch one page; Stripe is asked at most once per window per colo.
const SUMMARY_TTL_SECONDS = 5;

function log(event: string, fields: Record<string, unknown> = {}): void {
	console.log(JSON.stringify({ event, ...fields }));
}

function html(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Frame-Options": "DENY",
			"Referrer-Policy": "strict-origin-when-cross-origin",
			"Strict-Transport-Security": "max-age=31536000",
		},
	});
}

async function cachedSummary(
	env: Env,
	ctx: ExecutionContext,
	page: PageConfig,
): Promise<Summary> {
	const cache = caches.default;
	const cacheKey = new Request(`https://doe.social/__summary/${page.paymentLinkId}`);
	const hit = await cache.match(cacheKey);
	if (hit) return hit.json();

	const summary = summarize(await listDonations(env.STRIPE_API_KEY, page.paymentLinkId));
	ctx.waitUntil(
		cache.put(
			cacheKey,
			Response.json(summary, {
				headers: { "Cache-Control": `max-age=${SUMMARY_TTL_SECONDS}` },
			}),
		),
	);
	return summary;
}

function qrTarget(page: PageConfig): string {
	// `?qr=1` makes Dub count the visit as a QR scan rather than a click.
	return page.shortLink ? `${page.shortLink}?qr=1` : page.paymentUrl;
}

async function handleLive(
	env: Env,
	ctx: ExecutionContext,
	slug: string,
	sub: string | undefined,
): Promise<Response> {
	const page = await getPage(env.PAGES, slug);
	if (!page) return Response.redirect(HOME, 302);

	if (sub === "dados") {
		try {
			return Response.json(await cachedSummary(env, ctx, page), {
				headers: { "Cache-Control": "no-store" },
			});
		} catch (error) {
			log("summary_failed", { slug, error: String(error) });
			return Response.json({ error: "unavailable" }, { status: 502 });
		}
	}
	if (sub !== undefined && sub !== "demo") return Response.redirect(`https://doe.social/${slug}`, 302);

	let summary: Summary;
	try {
		summary = await cachedSummary(env, ctx, page);
	} catch (error) {
		// The page still renders; the client keeps polling and fills in.
		log("summary_failed", { slug, error: String(error) });
		summary = { totalCents: 0, count: 0, recent: [] };
	}
	return html(
		renderLive({
			page,
			summary,
			donateUrl: page.shortLink ?? page.paymentUrl,
			qrUrl: qrImageUrl(qrTarget(page)),
			demo: sub === "demo",
		}),
	);
}

type Resolved =
	| { ok: true; paymentLinkId: string; paymentUrl: string; code: string; shortLink?: string }
	| { ok: false; error: string };

/** A pasted link — Stripe or dub.sh — down to the Stripe payment link behind it. */
async function resolveLink(env: Env, raw: string): Promise<Resolved> {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return { ok: false, error: "Isso não parece um link. Cole o endereço completo, com https://." };
	}

	let target = url.toString();
	let shortLink: string | undefined;
	if (url.hostname === env.DUB_DOMAIN) {
		const key = url.pathname.replace(/^\//, "");
		const link = await getDubLink(env.DUB_API_KEY, env.DUB_DOMAIN, key);
		if (!link) return { ok: false, error: `Não achei ${url.hostname}/${key} no Dub.` };
		target = link.url;
		shortLink = link.shortLink;
	}

	const code = paymentLinkCode(target);
	if (!code) {
		return { ok: false, error: "O link precisa ser de pagamento do Stripe (buy.stripe.com ou donate.stripe.com)." };
	}
	const link = await findPaymentLink(env.STRIPE_API_KEY, code);
	if (!link) return { ok: false, error: "Esse link de pagamento não existe na conta Stripe da Fortini." };
	return { ok: true, paymentLinkId: link.id, paymentUrl: link.url, code, shortLink };
}

/** Reuse a short link already pointing at the payment; otherwise create dub.sh/<slug>. */
async function ensureShortLink(
	env: Env,
	slug: string,
	resolved: Extract<Resolved, { ok: true }>,
): Promise<{ shortLink?: string; note?: string }> {
	if (resolved.shortLink) return { shortLink: resolved.shortLink };
	try {
		const existing = await findDubLinkFor(env.DUB_API_KEY, resolved.code);
		if (existing) return { shortLink: existing.shortLink, note: `Usando o link que já existia: ${existing.shortLink}` };

		const created = await createDubLink(env.DUB_API_KEY, env.DUB_DOMAIN, slug, resolved.paymentUrl);
		if (created.ok) return { shortLink: created.link.shortLink, note: `Link criado: ${created.link.shortLink}` };
		if (created.reason === "taken") {
			return { note: `${env.DUB_DOMAIN}/${slug} já é usado por outro link, então o QR aponta direto para o Stripe.` };
		}
		log("dub_create_failed", { slug, status: created.status });
	} catch (error) {
		log("dub_failed", { slug, error: String(error) });
	}
	return { note: "O Dub não respondeu, então o QR aponta direto para o Stripe." };
}

async function handleAdmin(request: Request, env: Env): Promise<Response> {
	const user = await accessUser(request, env);
	if (!user) return new Response("Acesso restrito.", { status: 403 });

	const url = new URL(request.url);
	if (request.method === "GET") {
		const editing = url.searchParams.get("editar");
		const page = editing ? await getPage(env.PAGES, editing) : null;
		return html(
			renderAdmin({
				user,
				pages: await listPages(env.PAGES),
				form: page
					? {
							link: page.paymentUrl,
							slug: page.slug,
							title: page.title,
							goal: page.goalCents ? String(page.goalCents / 100) : "",
							editing: true,
						}
					: undefined,
			}),
		);
	}
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

	// Access cookies ride along on cross-site POSTs; only accept our own form.
	if (request.headers.get("Origin") !== url.origin) {
		return new Response("Origem inválida.", { status: 403 });
	}

	const data = await request.formData();
	const form = {
		link: String(data.get("link") ?? ""),
		slug: String(data.get("slug") ?? "").trim().toLowerCase(),
		title: String(data.get("title") ?? "").trim(),
		goal: String(data.get("goal") ?? "").trim(),
		editing: data.get("editing") === "1",
	};
	const fail = async (error: string, status = 400) =>
		html(renderAdmin({ user, pages: await listPages(env.PAGES), form, error }), status);

	if (!validSlug(form.slug)) return fail("Endereço inválido: use letras minúsculas, números e hífen, ou esse nome é reservado.");
	if (!form.title) return fail("Dê um título para a página.");
	const goalCents = form.goal ? parseReais(form.goal) : undefined;
	if (form.goal && goalCents === undefined) return fail("Meta inválida. Use só números, como 30.000.");

	const existing = await getPage(env.PAGES, form.slug);
	if (form.editing) {
		if (!existing) return fail("Essa página não existe mais.");
		const updated: PageConfig = { ...existing, title: form.title, goalCents };
		await env.PAGES.put(form.slug, JSON.stringify(updated));
		log("page_updated", { slug: form.slug, user });
		return html(
			renderAdmin({
				user,
				pages: await listPages(env.PAGES),
				notice: `Página <a href="/${form.slug}" target="_blank">doe.social/${form.slug}</a> atualizada.`,
			}),
		);
	}
	if (existing) return fail(`doe.social/${form.slug} já existe. Escolha outro endereço ou edite a existente.`);

	let resolved: Resolved;
	try {
		resolved = await resolveLink(env, form.link);
	} catch (error) {
		log("resolve_failed", { error: String(error) });
		return fail("Não consegui consultar o Stripe agora. Tente de novo em instantes.", 502);
	}
	if (!resolved.ok) return fail(resolved.error);

	const { shortLink, note } = await ensureShortLink(env, form.slug, resolved);
	const page: PageConfig = {
		slug: form.slug,
		title: form.title,
		goalCents,
		paymentLinkId: resolved.paymentLinkId,
		paymentUrl: resolved.paymentUrl,
		shortLink,
		createdAt: new Date().toISOString(),
	};
	await env.PAGES.put(form.slug, JSON.stringify(page));
	log("page_created", { slug: form.slug, paymentLinkId: page.paymentLinkId, user });

	return html(
		renderAdmin({
			user,
			pages: await listPages(env.PAGES),
			notice: `Página <a href="/${form.slug}" target="_blank">doe.social/${form.slug}</a> criada.${note ? ` ${note.replace(/</g, "&lt;")}` : ""}`,
		}),
	);
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const [first, second, ...rest] = url.pathname.split("/").filter(Boolean);

		if (!first) return Response.redirect(HOME, 301);
		if (first === "admin" && !second) return handleAdmin(request, env);
		if (rest.length || (request.method !== "GET" && request.method !== "HEAD") || !validSlug(first.toLowerCase())) {
			return Response.redirect(HOME, 302);
		}
		return handleLive(env, ctx, first.toLowerCase(), second);
	},
} satisfies ExportedHandler<Env>;
