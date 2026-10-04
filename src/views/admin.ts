import { cadenceOf, linkIdsOf, type PageConfig } from "../pages";
import { escapeHtml, FONT_FACES, formatReais, HEAD_COMMON, TOKENS } from "./shared";

interface AdminView {
	user: string;
	pages: PageConfig[];
	/** Values to refill the form with — after an error, or when editing. */
	form?:
		| {
				link?: string;
				slug?: string;
				title?: string;
				goal?: string;
				editing?: boolean;
				shortLink?: string | undefined;
				monthly?: boolean;
		  }
		| undefined;
	error?: string;
	/** Trusted HTML: callers escape anything that came from a person or an API. */
	notice?: string;
}

function pageRow(page: PageConfig): string {
	const slug = escapeHtml(page.slug);
	const monthly = cadenceOf(page) === "monthly";
	const links = linkIdsOf(page).length;
	const details = [
		monthly ? "doação mensal" : "",
		links > 1 ? `${links} links de pagamento` : "",
		page.goalCents ? `meta ${formatReais(page.goalCents)}${monthly ? "/mês" : ""}` : "",
	].filter(Boolean);
	return `<li>
	<div>
		<a class="name" href="/${slug}/painel" target="_blank" rel="noopener">${escapeHtml(page.title)}</a>
		<span class="meta">doe.social/${slug}/painel${details.length ? ` · ${details.join(" · ")}` : ""}</span>
		<span class="meta">${page.shortLink ? `QR via ${escapeHtml(page.shortLink.replace(/^https?:\/\//, ""))}` : "QR direto para o Stripe (sem Dub)"}</span>
	</div>
	<a class="edit" href="/admin?editar=${slug}">Editar</a>
</li>`;
}

function deleteForm(slug: string, shortLink?: string): string {
	const short = shortLink ? escapeHtml(shortLink.replace(/^https?:\/\//, "")) : "";
	return `<form class="danger" method="post" action="/admin" onsubmit="return confirm('Excluir doe.social/${escapeHtml(slug)}? Não dá para desfazer.')">
		<h2>Excluir página</h2>
		<p>A página sai do ar e o endereço doe.social/${escapeHtml(slug)} passa a levar para o site da Fortini. As doações continuam no Stripe.</p>
		${short ? `<label class="check"><input type="checkbox" name="dub" value="1"> <span>Apagar também ${short}. QR codes e links já divulgados param de funcionar.</span></label>` : ""}
		<input type="hidden" name="action" value="delete">
		<input type="hidden" name="slug" value="${escapeHtml(slug)}">
		<button type="submit" class="delete">Excluir página</button>
	</form>`;
}

export function renderAdmin({ user, pages, form = {}, error, notice }: AdminView): string {
	const v = (s?: string) => escapeHtml(s ?? "");
	return `<!doctype html>
<html lang="pt-BR">
<head>
${HEAD_COMMON}
<title>Páginas ao vivo · doe.social</title>
<meta name="robots" content="noindex">
<style>
${FONT_FACES}
${TOKENS}
body { padding: 40px 20px 80px; }
.wrap { max-width: 40rem; margin: 0 auto; display: grid; gap: 40px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
header img { height: 32px; width: auto; }
header span { font-size: 14px; color: var(--cinza-muted); }
h1 { text-wrap: balance; margin: 0 0 8px; font-weight: 900; font-size: 32px; line-height: 1.1; color: var(--teal); }
h2 { margin: 0 0 16px; font-weight: 600; font-size: 20px; }
p { margin: 0; line-height: 1.5; text-wrap: pretty; }
form {
	display: grid; gap: 20px; padding: 24px; background: var(--branco-puro);
	border-radius: 32px; /* 8px fields + 24px padding */
	box-shadow: 0 0 0 1px rgb(55 54 54 / 0.08), 0 2px 6px rgb(55 54 54 / 0.05);
}
label { display: grid; gap: 6px; font-weight: 600; font-size: 15px; }
label small { font-weight: 300; font-size: 14px; color: var(--cinza-muted); }
input {
	font: 300 17px/1.3 var(--font); color: var(--cinza);
	padding: 12px 14px; border: 1px solid #B3B8BA; border-radius: 8px; background: var(--branco-puro);
}
input:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; border-color: var(--teal); }
input[readonly] { background: #EFF4F6; color: var(--cinza-muted); }
.prefix { display: flex; align-items: center; border: 1px solid #B3B8BA; border-radius: 8px; background: var(--branco-puro); }
.prefix:focus-within { outline: 2px solid var(--teal); outline-offset: 1px; }
.prefix span { padding-left: 14px; color: var(--cinza-muted); font-size: 17px; }
.prefix input { border: 0; padding-left: 2px; flex: 1; min-width: 0; }
.prefix input:focus-visible { outline: none; }
button {
	justify-self: start; padding: 14px 24px; border: 0; border-radius: 8px;
	background: var(--teal); color: #fff; font: 600 17px/1 var(--font); cursor: pointer;
	transition: scale 160ms var(--ease-out);
}
button:active { scale: 0.96; }
.msg { padding: 14px 16px; border-radius: 8px; line-height: 1.4; }
.msg.error { background: #FBD8DD; color: #5C0A18; }
.msg.notice { background: var(--turquesa-tint); color: #003B3C; }
ul { list-style: none; margin: 0; padding: 0; display: grid; }
li { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--track); }
li div { display: grid; gap: 4px; min-width: 0; }
.name { font-weight: 600; font-size: 17px; color: var(--teal); }
.meta { font-size: 14px; color: var(--cinza-muted); overflow-wrap: anywhere; }
.edit, .cancel { display: inline-flex; align-items: center; min-height: 44px; padding-inline: 8px; margin-inline: -8px; }
.edit { font-size: 15px; font-weight: 600; color: var(--turquesa-on-light); }
.cancel { justify-self: start; font-size: 15px; color: var(--cinza-muted); }
.danger { gap: 16px; }
.danger h2 { margin: 0; }
.check { display: flex; align-items: flex-start; gap: 10px; font-weight: 300; line-height: 1.4; }
.check input { margin: 3px 0 0; width: 18px; height: 18px; accent-color: var(--teal); }
button.delete { background: #A3112B; }
</style>
</head>
<body>
<div class="wrap">
	<header>
		<img src="/img/fortini-wordmark.svg" alt="Fortini" width="161" height="51">
		<span>${escapeHtml(user)}</span>
	</header>

	<section>
		<h1>${form.editing ? "Editar página" : "Nova página ao vivo"}</h1>
		<p>Cole o link de pagamento do Stripe (ou o dub.sh dele). A página mostra o total arrecadado e as últimas doações, sem nenhum dado de quem doou.</p>
	</section>

	${error ? `<p class="msg error" role="alert">${escapeHtml(error)}</p>` : ""}
	${notice ? `<p class="msg notice" role="status">${notice}</p>` : ""}

	<form method="post" action="/admin">
		<label>Link de pagamento
			<input name="link" type="url" required placeholder="https://donate.stripe.com/..." value="${v(form.link)}" ${form.editing ? "readonly" : ""}>
		</label>
		<label>Endereço da página
			<div class="prefix"><span>doe.social/</span><input name="slug" required pattern="[a-z0-9][a-z0-9\\-]*[a-z0-9]" placeholder="festa-das-criancas" value="${v(form.slug)}" ${form.editing ? "readonly" : ""}></div>
			<small>Letras minúsculas, números e hífen. Vira também dub.sh/&lt;endereço&gt; se o link ainda não tiver um.</small>
		</label>
		<label>Título
			<input name="title" required maxlength="80" placeholder="Festa do dia das crianças" value="${v(form.title)}">
		</label>
		<label>Meta <small>opcional${form.monthly ? ", em R$ por mês" : ""}</small>
			<div class="prefix"><span>R$</span><input name="goal" inputmode="decimal" placeholder="30.000" value="${v(form.goal)}"></div>
		</label>
		<input type="hidden" name="editing" value="${form.editing ? "1" : ""}">
		<button type="submit">${form.editing ? "Salvar alterações" : "Criar página"}</button>
		${form.editing ? `<a class="cancel" href="/admin">Cancelar edição</a>` : ""}
	</form>
	${form.editing ? deleteForm(form.slug ?? "", form.shortLink) : ""}

	<section>
		<h2>Páginas</h2>
		${pages.length ? `<ul>${pages.map(pageRow).join("")}</ul>` : "<p>Nenhuma página criada ainda.</p>"}
	</section>
</div>
</body>
</html>`;
}
