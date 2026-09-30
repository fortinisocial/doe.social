import { RECENT_LIMIT, type PageConfig, type Summary } from "../pages";
import { escapeHtml, FONT_FACES, formatReais, HEAD_COMMON, TOKENS } from "./shared";

// Canonical Fortini hexagon (DESIGN.md → hexagon-geometry).
const HEX_VIEWBOX = "-1 2.868 175.205 194.264";
const HEX_PATH =
	"M 74.103 7.217 A 25 25 0 0 1 99.103 7.217 L 160.705 42.783 A 25 25 0 0 1 173.205 64.434 L 173.205 135.566 A 25 25 0 0 1 160.705 157.217 L 99.103 192.783 A 25 25 0 0 1 74.103 192.783 L 12.5 157.217 A 25 25 0 0 1 0 135.566 L 0 64.434 A 25 25 0 0 1 12.5 42.783 Z";

// Brand texture (DESIGN.md → decorative hexagon texture): pointy-top outline
// hexagons tiled edge to edge. Each new donation lights one cell in a hexagon
// palette colour (#sparks, filled by the page script). Tiling pitch: one
// hexagon wide, ¾ tall.
const HEX_W = 173.205;
const HEX_ROW = 150;
const LATTICE_SCALE = 0.34;
const LATTICE = `<svg class="lattice" aria-hidden="true">
	<defs>
		<path id="hx" d="${HEX_PATH}"/>
		<pattern id="hexes" width="${HEX_W}" height="${HEX_ROW * 2}" patternUnits="userSpaceOnUse" patternTransform="scale(${LATTICE_SCALE})">
			<g fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="5" stroke-linejoin="round">
				<use href="#hx"/>
				<use href="#hx" x="${HEX_W / 2}" y="${-HEX_ROW}"/>
				<use href="#hx" x="${-HEX_W / 2}" y="${-HEX_ROW}"/>
				<use href="#hx" x="${HEX_W / 2}" y="${HEX_ROW}"/>
				<use href="#hx" x="${-HEX_W / 2}" y="${HEX_ROW}"/>
			</g>
		</pattern>
		<!-- Lattice fades out toward the QR so it never competes with it; sparks stay solid. -->
		<radialGradient id="fade" cx="0.5" cy="0.42" r="0.6">
			<stop offset="0.35" stop-color="#000"/>
			<stop offset="0.9" stop-color="#FFF"/>
		</radialGradient>
		<mask id="edges"><rect width="100%" height="100%" fill="url(#fade)"/></mask>
	</defs>
	<rect width="100%" height="100%" fill="url(#hexes)" mask="url(#edges)"/>
	<g id="sparks" transform="scale(${LATTICE_SCALE})"></g>
</svg>`;

interface LiveView {
	page: PageConfig;
	summary: Summary;
	donateUrl: string;
	qrUrl: string;
	/** Simulated donations in the browser, with a control panel. Never touches Stripe. */
	demo?: boolean;
}

function countLabel(count: number): string {
	return count === 1 ? "1 doação" : `${count.toLocaleString("pt-BR")} doações`;
}

function goalBlock(page: PageConfig, totalCents: number): string {
	// Always rendered so the demo panel can switch a goal on; hidden when unset.
	const goal = page.goalCents ?? 0;
	const pct = goal ? Math.min(100, (totalCents / goal) * 100) : 0;
	return `
<div class="goal" id="goal"${goal ? "" : " hidden"}>
	<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(pct)}" aria-label="Progresso da meta">
		<div class="fill" id="fill" style="--pct:${pct}%"></div>
	</div>
	<p class="goal-text"><strong id="pct">${Math.floor(pct)}%</strong> da meta de <span id="goal-amount">${formatReais(goal)}</span></p>
</div>`;
}

// Demo only: fake donations generated in the browser, nothing reaches Stripe.
const DEMO_PANEL = `
<style>
.demo {
	position: fixed; right: 16px; bottom: 16px; z-index: 10;
	width: min(320px, calc(100vw - 32px));
	background: var(--branco-puro); color: var(--cinza);
	border-radius: 22px; /* 6px controls + 16px padding */
	box-shadow: 0 0 0 1px rgb(55 54 54 / 0.08), 0 2px 4px rgb(55 54 54 / 0.06), 0 12px 32px rgb(30 115 135 / 0.16);
	font: 300 15px/1.3 var(--font);
}
.demo summary {
	display: flex; justify-content: space-between; align-items: center;
	min-height: 48px; padding: 0 16px; cursor: pointer; font-weight: 600; list-style: none;
}
.demo summary::-webkit-details-marker { display: none; }
.demo summary kbd { padding: 2px 7px; border-radius: 6px; background: var(--track); color: var(--cinza-muted); font: 600 12px var(--font); }
.demo .body { display: grid; gap: 14px; padding: 0 16px 16px; }
.demo label { display: grid; gap: 4px; font-weight: 600; font-size: 13px; }
.demo label small { font-weight: 300; color: var(--cinza-muted); }
.demo input[type=text], .demo input[type=number] {
	font: 300 15px var(--font); padding: 8px 10px; border: 1px solid #B3B8BA; border-radius: 6px; width: 100%;
}
.demo input[type=range] { width: 100%; accent-color: var(--teal); }
.demo .row { display: flex; gap: 8px; flex-wrap: wrap; }
.demo button {
	flex: 1; min-height: 40px; padding: 0 10px; border: 1px solid var(--teal); border-radius: 6px;
	background: var(--branco-puro); color: var(--teal); font: 600 14px var(--font); cursor: pointer;
	transition: scale 160ms var(--ease-out);
}
.demo button.primary { background: var(--teal); color: #fff; }
.demo button:active { scale: 0.96; }
@media (max-width: 800px), (orientation: portrait) and (max-width: 1000px) {
	.demo { bottom: calc(96px + env(safe-area-inset-bottom)); }
}
.demo-badge {
	position: fixed; top: 12px; right: 12px; z-index: 10;
	padding: 4px 12px; border-radius: 999px; background: var(--doadores-strong); color: #fff;
	font: 600 13px var(--font);
}
</style>
<span class="demo-badge">Demonstração — valores fictícios</span>
<details class="demo" id="demo" open>
	<summary>Controles da demo <kbd>D</kbd></summary>
	<div class="body">
		<label>Meta em R$ <small>vazio = sem meta</small>
			<input type="number" id="d-goal" min="0" step="100" placeholder="30000">
		</label>
		<label>Nova doação a cada <span id="d-every-label"></span>
			<input type="range" id="d-every" min="1" max="30" value="4">
		</label>
		<label>Valores sorteados <small>separados por vírgula</small>
			<input type="text" id="d-amounts" value="450, 450, 450, 900, 1350">
		</label>
		<div class="row">
			<button type="button" class="primary" id="d-toggle">Pausar</button>
			<button type="button" id="d-one">+1 doação</button>
			<button type="button" id="d-burst">+5 juntas</button>
		</div>
		<div class="row">
			<button type="button" id="d-zero">Começar do zero</button>
			<button type="button" id="d-real">Voltar ao real</button>
		</div>
	</div>
</details>
<script>
(() => {
	const real = structuredClone(state.summary);
	const realGoal = state.goalCents;
	let timer = null;

	const amounts = () => {
		const list = $("d-amounts").value.split(",")
			.map((v) => Math.round(parseFloat(v.replace(/\\./g, "").replace(",", ".")) * 100))
			.filter((c) => c > 0);
		return list.length ? list : [45000];
	};

	function donate(n = 1) {
		const pool = amounts();
		const s = state.summary;
		const fresh = Array.from({ length: n }, () => ({
			amountCents: pool[Math.floor(Math.random() * pool.length)],
			paidAt: Math.floor(Date.now() / 60000) * 60,
		}));
		render({
			totalCents: s.totalCents + fresh.reduce((a, r) => a + r.amountCents, 0),
			count: s.count + n,
			recent: [...fresh, ...s.recent].slice(0, ${RECENT_LIMIT}),
		});
	}

	function schedule() {
		clearInterval(timer);
		const every = Number($("d-every").value);
		$("d-every-label").textContent = every === 1 ? "1 segundo" : every + " segundos";
		if ($("d-toggle").dataset.paused !== "1") timer = setInterval(() => donate(), every * 1000);
	}

	function setGoal(cents) {
		state.goalCents = cents || null;
		$("d-goal").value = cents ? cents / 100 : "";
		renderGoal(state.summary.totalCents);
	}

	// Jump straight to a state without animating the difference.
	function jump(summary) {
		state.summary = structuredClone(summary);
		setTotal(summary.totalCents);
		render(summary);
	}

	$("d-goal").addEventListener("input", (e) => setGoal(Math.round(Number(e.target.value) * 100)));
	$("d-every").addEventListener("input", schedule);
	$("d-one").addEventListener("click", () => donate(1));
	$("d-burst").addEventListener("click", () => donate(5));
	$("d-toggle").addEventListener("click", (e) => {
		const paused = e.target.dataset.paused === "1";
		e.target.dataset.paused = paused ? "" : "1";
		e.target.textContent = paused ? "Pausar" : "Continuar";
		schedule();
	});
	$("d-zero").addEventListener("click", () => jump({ totalCents: 0, count: 0, recent: [] }));
	$("d-real").addEventListener("click", () => { setGoal(realGoal); jump(real); });
	document.addEventListener("keydown", (e) => {
		if (e.key.toLowerCase() === "d" && !e.target.closest("input")) $("demo").open = !$("demo").open;
	});

	setGoal(realGoal);
	schedule();
})();
</script>`;

export function renderLive({ page, summary, donateUrl, qrUrl, demo = false }: LiveView): string {
	const title = escapeHtml(page.title);
	const shortLabel = escapeHtml(donateUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, ""));
	const bootstrap = JSON.stringify({
		slug: page.slug,
		goalCents: page.goalCents ?? null,
		summary,
	}).replace(/</g, "\\u003c");

	return `<!doctype html>
<html lang="pt-BR">
<head>
${HEAD_COMMON}
<title>${demo ? "Demo · " : ""}${title} · Fortini</title>
${demo ? '<meta name="robots" content="noindex">' : ""}
<meta name="theme-color" content="#24DBDD">
<style>
${FONT_FACES}
${TOKENS}
html, body { height: 100%; }
[hidden] { display: none !important; }
body { overflow: hidden; }

.stage {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(320px, 36vw);
	height: 100dvh;
}

/* ── Left: the number ─────────────────────────────── */
.board {
	display: grid;
	grid-template-rows: auto auto 1fr;
	gap: clamp(16px, 3vh, 40px);
	padding: clamp(24px, 5vh, 64px) clamp(24px, 5vw, 80px);
	min-width: 0;
}
.masthead { display: flex; align-items: center; gap: 20px; }
.masthead img { height: clamp(28px, 4vh, 44px); width: auto; }
.masthead h1 {
	margin: 0;
	padding-left: 20px;
	border-left: 1px solid var(--divider);
	font-weight: 600;
	font-size: clamp(18px, 2.4vh, 28px);
	line-height: 1.2;
	color: var(--teal);
	text-wrap: balance;
}

.total-block { display: grid; gap: clamp(8px, 1.5vh, 16px); }
.total {
	margin: 0;
	font-weight: 900;
	font-size: clamp(64px, min(15vw, 22vh), 280px);
	line-height: 0.9;
	letter-spacing: -0.03em;
	color: var(--cinza);
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}
.total .cur { font-size: 0.4em; letter-spacing: 0; margin-right: 0.12em; color: var(--teal); vertical-align: 0.9em; }
.count { margin: 0; font-variant-numeric: tabular-nums; font-size: clamp(18px, 3vh, 36px); color: var(--cinza-muted); }
.count strong { font-weight: 600; color: var(--cinza); }

.goal { display: grid; gap: 10px; max-width: 64rem; margin-top: clamp(4px, 1vh, 12px); }
.track { height: clamp(14px, 2.2vh, 24px); border-radius: 999px; background: var(--track); overflow: hidden; }
.fill {
	/* Full-width bar slid into place: transform stays on the GPU, and the track's
	   overflow keeps both ends rounded at any percentage. */
	height: 100%;
	border-radius: inherit;
	background: var(--turquesa);
	transform: translateX(calc(var(--pct) - 100%));
	transition: transform 0.9s var(--ease-in-out);
}
.goal-text { margin: 0; font-variant-numeric: tabular-nums; font-size: clamp(16px, 2.4vh, 26px); }
.goal-text strong { font-weight: 900; color: var(--teal); }

/* ── Recent donations ─────────────────────────────── */
.recent { margin-inline: -12px; min-height: 0; overflow: hidden; display: grid; align-content: start; gap: 12px; }
.recent h2 { margin: 0; padding-left: 12px; font-size: clamp(14px, 1.8vh, 18px); font-weight: 600; color: var(--cinza-muted); }
.recent ol {
	list-style: none; margin: 0; padding: 0;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
	column-gap: clamp(16px, 3vw, 48px);
}
.recent li {
	display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
	position: relative;
	padding: clamp(8px, 1.3vh, 14px) 12px;
	border-radius: 8px;
	font-size: clamp(18px, 2.6vh, 30px);
}
.recent li::after { content: ""; position: absolute; inset: auto 12px 0; height: 1px; background: var(--track); }
.recent .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
.recent time { font-variant-numeric: tabular-nums; color: var(--cinza-muted); }
.recent li.new {
	/* A quick drop-in, then a slow glow so the eye finds it across the room.
	   Several at once cascade 60ms apart. */
	--delay: calc(var(--i, 0) * 60ms);
	animation:
		arrive 320ms var(--ease-out) var(--delay) backwards,
		glow 2.4s ease-out var(--delay) backwards;
}
@keyframes arrive { from { opacity: 0; transform: translateY(-8px); } }
@keyframes glow {
	0%, 35% { background: var(--turquesa-tint); }
	100% { background: transparent; }
}
.empty { margin: 0; padding-left: 12px; text-wrap: pretty; font-size: clamp(18px, 2.6vh, 28px); color: var(--cinza-muted); }

/* ── Right: the invitation ────────────────────────── */
.invite {
	display: grid;
	place-content: center;
	justify-items: center;
	gap: clamp(16px, 3vh, 32px);
	padding: clamp(24px, 4vh, 56px);
	position: relative;
	isolation: isolate;
	overflow: hidden;
	background: var(--turquesa);
	color: var(--cinza); /* 7.0:1 on turquoise — white would be 1.7:1 */
	text-align: center;
}
.lattice {
	position: absolute; inset: 0; z-index: -1;
	width: 100%; height: 100%;
}
.hex { position: relative; width: min(28vw, 58vh); aspect-ratio: 175.205 / 194.264; }
.hex svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.hex img {
	position: absolute;
	/* Largest square that clears the rounded corners of the hexagon. */
	width: 62%; height: auto; aspect-ratio: 1; left: 19%; top: 50%; translate: 0 -50%;
	image-rendering: pixelated;
}
.caption {
	/* Solid plate: no lattice line may cross the text. */
	display: grid; gap: clamp(8px, 1.5vh, 16px);
	padding: clamp(12px, 2vh, 20px) clamp(16px, 2vw, 28px);
	border-radius: 20px;
	background: var(--turquesa);
}
.invite p { margin: 0; text-wrap: balance; font-size: clamp(20px, 3vh, 34px); font-weight: 600; line-height: 1.2; }
.invite .link { font-weight: 600; font-size: clamp(15px, 2vh, 22px); color: var(--turquesa-deep); word-break: break-all; }
.invite .donate { display: none; }

.total, .recent { transition: opacity 0.4s var(--ease); }
.stale .total, .stale .recent { opacity: 0.55; }

/* Phones: someone opened the link — no QR to scan, just a button. */
@media (max-width: 800px), (orientation: portrait) and (max-width: 1000px) {
	body { overflow: auto; }
	.stage { grid-template-columns: 1fr; grid-template-rows: 1fr auto; height: auto; min-height: 100dvh; }
	.board { padding: 24px 20px; gap: 24px; }
	.masthead { flex-direction: column; align-items: flex-start; gap: 12px; }
	.masthead h1 { padding-left: 0; border-left: 0; }
	.total { font-size: clamp(56px, 20vw, 120px); }
	.recent ol { grid-template-columns: 1fr; }
	.invite {
		position: sticky; bottom: 0; padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
		place-content: stretch; justify-items: stretch;
		background: var(--branco-puro);
		box-shadow: 0 -1px 0 rgb(55 54 54 / 0.08), 0 -8px 24px rgb(30 115 135 / 0.08);
	}
	.invite .hex, .caption, .lattice { display: none; }
	.invite .donate {
		display: block; padding: 18px; border-radius: 12px; text-align: center;
		background: var(--turquesa); color: var(--cinza);
		font: 900 20px/1 var(--font); text-decoration: none;
		transition: scale 160ms var(--ease-out);
	}
	.invite .donate:active { scale: 0.96; }
}

@media (prefers-reduced-motion: reduce) {
	.fill { transition: none; }
	/* No movement, but keep the colour cue: it is how a new donation is noticed. */
	.recent li.new { animation: glow 2.4s ease-out backwards; }
}
</style>
</head>
<body>
<main class="stage" id="stage">
	<section class="board">
		<header class="masthead">
			<img src="/img/fortini-wordmark.svg" alt="Fortini" width="161" height="51">
			<h1>${title}</h1>
		</header>

		<div class="total-block">
			<p class="total" aria-live="polite"><span class="cur">R$</span><span id="total">${formatReais(summary.totalCents).replace(/^R\$\s*/, "")}</span></p>
			<p class="count"><strong id="count">${countLabel(summary.count)}</strong></p>
			${goalBlock(page, summary.totalCents)}
		</div>

		<section class="recent" aria-label="Últimas doações">
			<h2>Últimas doações</h2>
			<ol id="recent"></ol>
			${summary.count === 0 ? `<p class="empty" id="empty">A primeira doação aparece aqui assim que chegar.</p>` : ""}
		</section>
	</section>

	<aside class="invite">
		${LATTICE}
		<div class="hex">
			<svg viewBox="${HEX_VIEWBOX}" aria-hidden="true"><path d="${HEX_PATH}" fill="#FBFBFB"/></svg>
			<img src="${escapeHtml(qrUrl)}" alt="QR code para doar" width="800" height="800">
		</div>
		<div class="caption">
			<p>Aponte a câmera e doe</p>
			<span class="link">${shortLabel}</span>
		</div>
		<a class="donate" href="${escapeHtml(donateUrl)}">Doar agora</a>
	</aside>
</main>

<script>
const state = ${bootstrap};
const POLL_MS = 5000;
const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const reais = (c) => c % 100 === 0
	? "R$ " + number.format(c / 100)
	: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
const TZ = "America/Sao_Paulo";
const clock = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
// Today: "22:05". Yesterday: "ontem, 22:05". Older: "29/09, 22:05".
function when(paidAt) {
	const at = new Date(paidAt * 1000);
	const day = dayKey.format(at);
	const now = Date.now();
	if (day === dayKey.format(now)) return clock.format(at);
	if (day === dayKey.format(now - 86400000)) return "ontem, " + clock.format(at);
	return dayMonth.format(at) + ", " + clock.format(at);
}
const countLabel = (n) => n === 1 ? "1 doação" : number.format(n) + " doações";

// The total counts up from whatever is on screen, so a donation landing
// mid-count retargets smoothly instead of jumping back.
let shownCents = state.summary.totalCents;
let countFrame = 0;
function setTotal(cents) {
	cancelAnimationFrame(countFrame);
	shownCents = cents;
	$("total").textContent = number.format(Math.round(cents / 100));
}
function countUp(to) {
	if (reduced || shownCents === to) return setTotal(to);
	cancelAnimationFrame(countFrame);
	const from = shownCents, start = performance.now(), dur = 1200;
	const tick = (now) => {
		const t = Math.min(1, (now - start) / dur);
		shownCents = from + (to - from) * (1 - Math.pow(1 - t, 4));
		$("total").textContent = number.format(Math.round(shownCents / 100));
		countFrame = t < 1 ? requestAnimationFrame(tick) : 0;
	};
	countFrame = requestAnimationFrame(tick);
}

function renderGoal(totalCents) {
	$("goal").hidden = !state.goalCents;
	if (!state.goalCents) return;
	const pct = Math.min(100, totalCents / state.goalCents * 100);
	$("fill").style.setProperty("--pct", pct + "%");
	$("pct").textContent = Math.floor(pct) + "%";
	$("goal-amount").textContent = reais(state.goalCents);
	document.querySelector("[role=progressbar]").setAttribute("aria-valuenow", Math.floor(pct));
}

// A new donation lights a random lattice cell in one of the six hexagon
// palette colours, away from the QR and the caption, then lets it fade.
const PALETTE = ["#76B837", "#F9B114", "#EC6730", "#0095DB", "#6859A3", "#E62A4A"];
const HEX = { w: ${HEX_W}, row: ${HEX_ROW}, h: 200, scale: ${LATTICE_SCALE} };
// Shuffled bag: a burst never repeats a colour until all six were used.
let bag = [];
function nextColour() {
	if (!bag.length) bag = [...PALETTE].sort(() => Math.random() - 0.5);
	return bag.pop();
}
function spark(delay) {
	const svg = document.querySelector(".lattice");
	if (!svg || getComputedStyle(svg).display === "none") return;
	const box = svg.getBoundingClientRect();
	const cell = HEX.w * HEX.scale;
	const keepClear = [...document.querySelectorAll(".invite .hex, .caption")]
		.map((el) => el.getBoundingClientRect());
	for (let tries = 0; tries < 40; tries++) {
		const rowIdx = Math.floor(Math.random() * (box.height / (HEX.row * HEX.scale) + 1));
		const colIdx = Math.floor(Math.random() * (box.width / cell + 1));
		const x = colIdx * HEX.w + (rowIdx % 2 ? HEX.w / 2 : 0);
		const y = rowIdx * HEX.row;
		const cx = box.left + (x + HEX.w / 2) * HEX.scale;
		const cy = box.top + (y + HEX.h / 2) * HEX.scale;
		const halfH = (HEX.h / 2) * HEX.scale;
		const inside = cx > box.left + cell / 2 && cx < box.right - cell / 2 &&
			cy > box.top + halfH && cy < box.bottom - halfH;
		const blocked = keepClear.some((r) =>
			cx > r.left - cell / 2 && cx < r.right + cell / 2 && cy > r.top - cell / 2 && cy < r.bottom + cell / 2);
		if (!inside || blocked) continue;

		const hex = document.createElementNS("http://www.w3.org/2000/svg", "use");
		hex.setAttribute("href", "#hx");
		hex.setAttribute("x", x);
		hex.setAttribute("y", y);
		hex.setAttribute("fill", nextColour());
		hex.style.transformBox = "fill-box";
		hex.style.transformOrigin = "center";
		$("sparks").append(hex);
		const pop = "cubic-bezier(0.23, 1, 0.32, 1)";
		const frames = reduced
			? [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }]
			: [
				{ opacity: 0, transform: "scale(0.6)", easing: pop },
				{ opacity: 1, transform: "scale(1)", offset: 0.12 },
				{ opacity: 1, transform: "scale(1)", offset: 0.55, easing: "ease-in-out" },
				{ opacity: 0, transform: "scale(1)" },
			];
		hex.animate(frames, { duration: 3200, delay, fill: "backwards" }).onfinish = () => hex.remove();
		return;
	}
}

function row(r, freshIndex) {
	const li = document.createElement("li");
	if (freshIndex !== undefined) {
		li.className = "new";
		li.style.setProperty("--i", freshIndex);
	}
	li.innerHTML = '<span class="amount">' + reais(r.amountCents) + '</span><time datetime="' +
		new Date(r.paidAt * 1000).toISOString() + '">' + when(r.paidAt) + '</time>';
	return li;
}

const sameRow = (a, b) => a.amountCents === b.amountCents && a.paidAt === b.paidAt;

// Newest first, so whatever arrived since the last poll sits on top. When the
// update is a clean prepend, existing rows keep their DOM nodes: a glow still
// running is not cut short by the next poll.
function renderRecent(prev, next) {
	const ol = $("recent");
	const newCount = Math.max(0, next.count - prev.count);
	for (let i = 0; i < Math.min(newCount, 6); i++) spark(i * 120);
	const kept = next.recent.slice(newCount);
	const isPrepend = newCount > 0 && ol.children.length === prev.recent.length &&
		kept.every((r, j) => prev.recent[j] && sameRow(r, prev.recent[j]));

	if (isPrepend) {
		ol.prepend(...next.recent.slice(0, newCount).map((r, i) => row(r, i)));
		while (ol.children.length > next.recent.length) ol.lastElementChild.remove();
		// Day labels roll over at midnight even when nothing new arrives.
		next.recent.forEach((r, i) => { ol.children[i].querySelector("time").textContent = when(r.paidAt); });
		return;
	}
	ol.replaceChildren(...next.recent.map((r, i) => row(r, i < newCount ? i : undefined)));
}

function render(next) {
	const prev = state.summary;
	if (next.totalCents !== prev.totalCents) countUp(next.totalCents);
	$("count").textContent = countLabel(next.count);

	renderGoal(next.totalCents);

	renderRecent(prev, next);
	if (next.count > 0) $("empty")?.remove();

	state.summary = next;
}

async function poll() {
	try {
		const res = await fetch("/" + state.slug + "/dados", { cache: "no-store" });
		if (!res.ok) throw new Error(res.status);
		render(await res.json());
		$("stage").classList.remove("stale");
	} catch {
		// Keep the last numbers on screen; dim them so a frozen feed is visible.
		$("stage").classList.add("stale");
	}
}

// First paint of the list: the day labels depend on the viewer's today.
render(state.summary);

if (!${demo}) {
	setInterval(() => { if (!document.hidden) poll(); }, POLL_MS);
	document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
}

// A telão should not dim or sleep mid-event.
async function keepAwake() {
	try { await navigator.wakeLock?.request("screen"); } catch {}
}
keepAwake();
document.addEventListener("visibilitychange", () => { if (!document.hidden) keepAwake(); });
</script>
${demo ? DEMO_PANEL : ""}
</body>
</html>`;
}
