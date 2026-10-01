import { RECENT_LIMIT, type PageConfig, type Summary } from "../pages";
import { escapeHtml, FONT_FACES, formatReais, HEAD_COMMON, TOKENS } from "./shared";

// Canonical Fortini hexagon (DESIGN.md → hexagon-geometry).
const HEX_VIEWBOX = "-1 2.868 175.205 194.264";
const HEX_PATH =
	"M 74.103 7.217 A 25 25 0 0 1 99.103 7.217 L 160.705 42.783 A 25 25 0 0 1 173.205 64.434 L 173.205 135.566 A 25 25 0 0 1 160.705 157.217 L 99.103 192.783 A 25 25 0 0 1 74.103 192.783 L 12.5 157.217 A 25 25 0 0 1 0 135.566 L 0 64.434 A 25 25 0 0 1 12.5 42.783 Z";

// Brand texture (DESIGN.md → decorative hexagon texture): pointy-top outline
// hexagons tiled edge to edge. The cells are real elements (built by the page
// script to fit the panel), so a donation can fill one in place. Tiling pitch:
// one hexagon wide, ¾ tall.
const HEX_W = 173.205;
const HEX_ROW = 150;
const LATTICE_SCALE = 0.34;
const LATTICE = `<svg class="lattice" aria-hidden="true">
	<defs><path id="hx" d="${HEX_PATH}"/></defs>
	<g id="cells" transform="scale(${LATTICE_SCALE})"></g>
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
	// The text tells the real percentage past the goal; only the bar stops at 100%.
	const pct = goal ? Math.floor((totalCents / goal) * 100) : 0;
	const reached = goal > 0 && totalCents >= goal;
	const remaining = reached ? "Meta batida!" : `faltam <strong>${formatReais(goal - totalCents)}</strong>`;
	return `
<div class="goal${reached ? " reached" : ""}" id="goal"${goal ? "" : " hidden"}>
	<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, pct)}" aria-valuetext="${pct}% da meta" aria-label="Progresso da meta">
		<div class="fill" id="fill" style="--pct:${Math.min(100, pct)}%"></div>
	</div>
	<p class="goal-text"><span><strong id="pct">${pct}%</strong> da meta de <span id="goal-amount">${formatReais(goal)}</span></span><span class="remaining" id="remaining">${goal ? remaining : ""}</span></p>
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
.demo summary .title { display: flex; align-items: center; gap: 8px; }
.demo .gear { width: 18px; height: 18px; flex: none; color: var(--teal); }
/* Neris sits low in its line box; trimming to cap height centers the gear on the letters. */
.demo summary .label { text-box: trim-both cap alphabetic; }
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
/* Phones: closed, the panel is a gear you can drag out of the way. */
@media (max-width: 800px), (orientation: portrait) and (max-width: 1000px) {
	.demo { bottom: calc(96px + env(safe-area-inset-bottom)); }
	.demo summary kbd { display: none; }
	.demo:not([open]) {
		width: 56px; height: 56px; border-radius: 50%;
		translate: var(--dx, 0px) var(--dy, 0px);
		touch-action: none;
		transition: scale 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
	}
	.demo:not([open]) summary { height: 100%; min-height: 0; padding: 0; justify-content: center; cursor: grab; }
	.demo:not([open]) .gear { width: 26px; height: 26px; }
	.demo:not([open]) .label {
		position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
	}
	.demo.dragging {
		scale: 1.08;
		box-shadow: 0 0 0 1px rgb(55 54 54 / 0.08), 0 16px 40px rgb(30 115 135 / 0.28);
	}
	.demo.dragging summary { cursor: grabbing; }
}
.demo-badge {
	position: fixed; top: 12px; right: 12px; z-index: 10;
	padding: 4px 12px; border-radius: 999px; background: var(--doadores-strong); color: #fff;
	font: 600 13px var(--font);
}
</style>
<span class="demo-badge">Demonstração — valores fictícios</span>
<details class="demo" id="demo" open>
	<summary><span class="title"><svg class="gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg><span class="label">Ajustes</span></span><kbd>D</kbd></summary>
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
	// Phones start with the panel folded into the gear, which drags anywhere on
	// screen; a drag shorter than a few pixels still counts as a tap.
	const demo = $("demo");
	const summary = demo.querySelector("summary");
	const phone = matchMedia("(max-width: 800px), (orientation: portrait) and (max-width: 1000px)");
	if (phone.matches) demo.open = false;
	let drag = null, moved = false, dx = 0, dy = 0;
	summary.addEventListener("pointerdown", (e) => {
		if (demo.open || !phone.matches) return;
		const r = demo.getBoundingClientRect();
		drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, size: r.width, dx, dy };
		moved = false;
		summary.setPointerCapture(e.pointerId);
	});
	summary.addEventListener("pointermove", (e) => {
		if (!drag) return;
		const mx = e.clientX - drag.x, my = e.clientY - drag.y;
		if (!moved && Math.hypot(mx, my) < 6) return;
		moved = true;
		demo.classList.add("dragging");
		const left = Math.min(Math.max(8, drag.left + mx), innerWidth - drag.size - 8);
		const top = Math.min(Math.max(8, drag.top + my), innerHeight - drag.size - 8);
		dx = drag.dx + left - drag.left;
		dy = drag.dy + top - drag.top;
		demo.style.setProperty("--dx", dx + "px");
		demo.style.setProperty("--dy", dy + "px");
	});
	const endDrag = () => { drag = null; demo.classList.remove("dragging"); };
	summary.addEventListener("pointerup", endDrag);
	summary.addEventListener("pointercancel", endDrag);
	summary.addEventListener("click", (e) => {
		if (moved) e.preventDefault();
		moved = false;
	});

	document.addEventListener("keydown", (e) => {
		if (e.key.toLowerCase() === "d" && !e.target.closest("input")) demo.open = !demo.open;
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
	grid-template-rows: minmax(0, 1fr);
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
.masthead img { height: clamp(36px, 6.5vh, 88px); width: auto; }
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

/* minmax(0, …): fitTotal() measures this row with the number at full size; an
   auto column would widen to that number and report room the row doesn't have. */
.total-block { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(8px, 1.5vh, 16px); }
.total {
	margin: 0;
	font-weight: 900;
	font-size: clamp(64px, min(15vw, 22vh), 280px); /* the ceiling; fitTotal() shrinks it to fit */
	line-height: 0.9;
	letter-spacing: -0.03em;
	color: var(--cinza);
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}
.total .cur { font-size: 0.4em; letter-spacing: 0; margin-right: 0.12em; color: var(--teal); vertical-align: 0.9em; }
/* The count reads as part of the figure — "R$ 17.550  32 doações" — sharing
   its baseline, and drops below only when the number needs the whole row. */
.figure { position: relative; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: clamp(16px, 2vw, 32px); row-gap: 8px; }
/* A gift lands on the number the room is watching: "+R$ 450" in that gift's
   palette colour, the same colour its hexagons light up in. Placed by showGain(). */
.gain {
	position: absolute; left: 0; top: 0;
	padding: 0.1em 0.38em 0.14em;
	border-radius: 0.28em;
	background: var(--c); color: var(--on);
	font-weight: 900; line-height: 1.1; /* size set by showGain(), relative to the total */
	font-variant-numeric: tabular-nums; white-space: nowrap;
	translate: var(--x, 0) var(--y, 0);
	opacity: 0; pointer-events: none;
}
.gain.show { animation: gain 2.8s var(--ease-out) both; }
@keyframes gain {
	0% { opacity: 0; transform: translateY(0.4em) scale(0.85); }
	12%, 82% { opacity: 1; transform: none; }
	100% { opacity: 0; transform: translateY(-0.25em); }
}
.count { margin: 0; white-space: nowrap; font-variant-numeric: tabular-nums; font-size: clamp(18px, 3vh, 36px); color: var(--cinza-muted); }
.count strong { font-weight: 600; color: var(--cinza); }

.goal { display: grid; gap: 10px; max-width: 64rem; margin-top: clamp(4px, 1vh, 12px); }
/* Brand blue on a mid-light gray track: the track reads against the page on TVs
   (1.5:1, the old 1.2:1 vanished) and the fill still stands out from it (2.2:1). */
.track { height: clamp(14px, 2.2vh, 24px); border-radius: 999px; background: var(--divider); overflow: hidden; }
.fill {
	/* Full-width bar slid into place: transform stays on the GPU, and the track's
	   overflow keeps both ends rounded at any percentage. */
	height: 100%;
	border-radius: inherit;
	background: #0095DB;
	transform: translateX(calc(var(--pct) - 100%));
	transition: transform 0.9s var(--ease-in-out);
}
.goal-text {
	display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; column-gap: 24px; row-gap: 4px;
	margin: 0; font-variant-numeric: tabular-nums; font-size: clamp(16px, 2.4vh, 26px);
}
.goal-text strong { font-weight: 900; color: var(--teal); }
/* Past the goal the bar turns teal with the total, and the line says so. */
.goal.reached .fill { background: var(--teal); }
.goal.reached .remaining { font-weight: 900; color: var(--teal); }
/* Goal beaten: the total joins "R$" and "Meta batida!" in teal (5.3:1). */
.total { transition: color 0.6s var(--ease); }
.total-block.reached .total { color: var(--teal); }

/* ── Recent donations ─────────────────────────────── */
/* Its own block: well clear of the goal above, heading tight to the rows it
   names (inter-group space ~3x intra-group), so it never reads as a caption. */
.recent { margin-inline: -12px; margin-top: clamp(16px, 4vh, 48px); min-height: 0; overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: clamp(8px, 1vh, 12px); }
.recent h2 {
	margin: 0; padding-left: 12px;
	font-size: clamp(16px, 2.2vh, 24px); font-weight: 600; color: var(--cinza);
}
.recent ol {
	list-style: none; margin: 0; padding: 0;
	/* Columns read top to bottom, newest first. Balanced when everything fits;
	   on a short screen the oldest spill into a column past the edge, clipped.
	   Width in em so a column grows with the text: "R$ 1.350  ontem, 22:06". */
	columns: 12em 3; /* at most 3: a wide screen gets taller columns, not a 4×3 strip */
	column-gap: clamp(16px, 3vw, 48px);
	font-size: clamp(18px, 2.6vh, 30px);
}
.recent li {
	display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
	position: relative;
	break-inside: avoid;
	padding: clamp(8px, 1.3vh, 14px) 12px;
	border-radius: 8px;
	white-space: nowrap;
}
/* 2px at 1.9:1: a 1px line in the track grey (1.2:1) disappeared on TVs. */
.recent li::after { content: ""; position: absolute; inset: auto 12px 0; height: 2px; background: #B3B8BA; }
.recent .amount { font-weight: 600; font-variant-numeric: tabular-nums; }
.recent time { font-variant-numeric: tabular-nums; color: var(--cinza-muted); }
.recent li.new {
	/* A quick drop-in, then a soft tint of its gift's palette colour that fades
	   out; the chip by the total carries the loud part. Several cascade 60ms apart. */
	--delay: calc(var(--i, 0) * 60ms);
	animation:
		arrive 320ms var(--ease-out) var(--delay) backwards,
		flash 2.8s ease-out var(--delay) backwards;
}
@keyframes arrive { from { opacity: 0; transform: translateY(-8px); } }
@keyframes flash {
	0%, 35% { background: color-mix(in oklab, var(--c) 28%, transparent); }
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
.lattice use {
	fill: transparent;
	stroke: #FFFFFF; stroke-opacity: 0.45; stroke-width: 5; stroke-linejoin: round;
	/* Leaving is quick: a palette colour half-faded over turquoise reads muddy. */
	transition: fill 450ms var(--ease-out);
}
.lattice use.lit {
	fill: var(--lit);
	transition-duration: 220ms;
}
/* The goal sweep pops cells on and off: hundreds of palette colours fading
   through turquoise at once read muddy. */
.lattice use.pop { transition: none; }

.lattice {
	/* The lattice dissolves around the caption, so no line crosses the text; the
	   white hexagon already covers it behind the QR. Position set by clearCaption(). */
	mask-image: radial-gradient(ellipse var(--rx, 0) var(--ry, 0) at var(--cx, 50%) var(--cy, 85%), transparent 55%, #000 100%);
}
.hex { position: relative; width: min(28vw, 58vh); aspect-ratio: 175.205 / 194.264; }
.hex svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.hex img {
	position: absolute;
	/* Largest square that clears the rounded corners of the hexagon. */
	width: 62%; height: auto; aspect-ratio: 1; left: 19%; top: 50%; translate: 0 -50%;
	image-rendering: pixelated;
}
.caption { display: grid; gap: clamp(8px, 1.5vh, 16px); }
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
	.recent ol { columns: 1; }
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
	/* No movement, but keep the colour cues: they are how a new donation is noticed. */
	.recent li.new { animation: flash 2.8s ease-out backwards; }
	.gain.show { animation-name: gain-fade; }
	@keyframes gain-fade { 0%, 100% { opacity: 0; } 8%, 85% { opacity: 1; } }
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

		<div class="total-block${page.goalCents && summary.totalCents >= page.goalCents ? " reached" : ""}">
			<div class="figure">
				<p class="total" id="total-line" aria-live="polite"><span class="cur">R$</span><span id="total">${formatReais(summary.totalCents).replace(/^R\$\s*/, "")}</span></p>
				<p class="count" id="count-line"><strong id="count">${countLabel(summary.count)}</strong></p>
				<span class="gain" id="gain" aria-hidden="true"></span>
			</div>
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

// The number is as big as the row allows: the CSS size is the ceiling, and
// long totals shrink to fit — beside the count when there is room, alone on
// the row when there is not. Fitted to the target so a count-up never overflows.
function fitTotal(cents) {
	const line = $("total-line"), digits = $("total"), count = $("count-line");
	const shown = digits.textContent;
	digits.textContent = number.format(Math.round(cents / 100));
	line.style.removeProperty("font-size");
	const ceiling = parseFloat(getComputedStyle(line).fontSize);
	const perPx = line.offsetWidth / ceiling;
	const row = line.parentElement.clientWidth;
	const gap = parseFloat(getComputedStyle(line.parentElement).columnGap) || 0;
	const beside = (row - count.offsetWidth - gap) / perPx;
	// Keep the count beside the number unless that costs more than a third of its size.
	const size = beside >= ceiling * 0.66 ? Math.min(ceiling, beside) : Math.min(ceiling, row / perPx);
	line.style.fontSize = Math.floor(size) + "px";
	digits.textContent = shown;
}
// Where the lattice dissolves around the caption (page coordinates); a lit cell
// there would come out half-faded.
let clearZone = null;
function clearCaption() {
	const panel = document.querySelector(".invite").getBoundingClientRect();
	const caption = document.querySelector(".caption").getBoundingClientRect();
	const lattice = document.querySelector(".lattice");
	if (!caption.width) return;
	lattice.style.setProperty("--cx", caption.left - panel.left + caption.width / 2 + "px");
	lattice.style.setProperty("--cy", caption.top - panel.top + caption.height / 2 + "px");
	// Ellipse radii: fully clear over the text (55%), back to full texture ~45% further out.
	const rx = caption.width / 2 / 0.55 * 1.15;
	const ry = caption.height / 2 / 0.55 * 1.6;
	lattice.style.setProperty("--rx", rx + "px");
	lattice.style.setProperty("--ry", ry + "px");
	clearZone = { cx: caption.left + caption.width / 2, cy: caption.top + caption.height / 2, rx, ry };
}
clearCaption();

// Metrics change once Neris replaces the fallback font.
document.fonts?.ready.then(() => { fitTotal(state.summary.totalCents); clearCaption(); });
let resizeFrame = 0;
addEventListener("resize", () => {
	cancelAnimationFrame(resizeFrame);
	resizeFrame = requestAnimationFrame(() => { fitTotal(state.summary.totalCents); buildLattice(); clearCaption(); });
});

// prevCents is the total before this update; crossing the goal live (not on
// load, not by editing the goal) is the night's big moment.
function renderGoal(totalCents, prevCents) {
	const goal = $("goal"), target = state.goalCents;
	goal.hidden = !target;
	if (!target) return goal.parentElement.classList.remove("reached");
	const pct = Math.floor(totalCents / target * 100);
	const reached = totalCents >= target;
	$("fill").style.setProperty("--pct", Math.min(100, pct) + "%");
	$("pct").textContent = number.format(pct) + "%";
	$("goal-amount").textContent = reais(target);
	$("remaining").innerHTML = reached ? "Meta batida!" : "faltam <strong>" + reais(target - totalCents) + "</strong>";
	const bar = goal.querySelector("[role=progressbar]");
	bar.setAttribute("aria-valuenow", Math.min(100, pct));
	bar.setAttribute("aria-valuetext", pct + "% da meta");
	if (reached && prevCents !== undefined && prevCents < target && !goal.classList.contains("reached")) {
		// Let the bar finish filling, then switch it to the palette and light the lattice.
		loadConfetti().catch(() => {}); // fetch while the bar fills
		setTimeout(() => {
			goal.classList.add("reached");
			goal.parentElement.classList.add("reached");
			celebrateGoal();
			fireConfetti();
		}, reduced ? 0 : 900);
	} else {
		goal.classList.toggle("reached", reached);
		goal.parentElement.classList.toggle("reached", reached);
	}
}

// A new donation fills one lattice cell with a hexagon palette colour for a
// moment — the cell itself, in place — away from the QR, the caption and the
// demo controls.
// The hexagon palette with teal in place of red: red reads as a warning, not a
// celebration. "on": the text colour that reads on it (large bold text, all ≥3.6:1).
const PALETTE = [
	{ c: "#76B837", on: "#373636" }, { c: "#F9B114", on: "#373636" }, { c: "#EC6730", on: "#373636" },
	{ c: "#0095DB", on: "#373636" }, { c: "#6859A3", on: "#FFFFFF" }, { c: "#1E7387", on: "#FFFFFF" },
];
const HEX = { w: ${HEX_W}, row: ${HEX_ROW} };
const LIT_MS = 2400;

function buildLattice() {
	const svg = document.querySelector(".lattice");
	if (getComputedStyle(svg).display === "none") return;
	const { width, height } = svg.getBoundingClientRect();
	const rows = Math.ceil(height / (HEX.row * ${LATTICE_SCALE})) + 1;
	const cols = Math.ceil(width / (HEX.w * ${LATTICE_SCALE})) + 1;
	const cells = [];
	for (let r = 0; r < rows; r++) {
		for (let c = -1; c < cols; c++) {
			const cell = document.createElementNS("http://www.w3.org/2000/svg", "use");
			cell.setAttribute("href", "#hx");
			cell.setAttribute("x", c * HEX.w + (r % 2 ? HEX.w / 2 : 0));
			cell.setAttribute("y", r * HEX.row);
			cells.push(cell);
		}
	}
	$("cells").replaceChildren(...cells);
}

// Shuffled bag: a burst never repeats a colour until all six were used.
let bag = [];
function nextColour() {
	if (!bag.length) bag = [...PALETTE].sort(() => Math.random() - 0.5);
	return bag.pop();
}

// Pointy-top hexagon test: inside when within the flat sides and under the
// sloped edges. Used for the QR's white hexagon, whose bounding box would
// otherwise block the lattice corners around it.
function inHexagon(x, y, r, margin) {
	const w = r.width / 2 + margin, h = r.height / 2 + margin;
	const dx = Math.abs(x - (r.left + r.width / 2)), dy = Math.abs(y - (r.top + r.height / 2));
	return dx <= w && dy <= h - (h / 2) * (dx / w);
}
// The six vertices of a lattice cell, from its bounding box.
function vertices(r) {
	const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
	return [[cx, r.top], [cx, r.bottom], [r.left, cy - r.height / 4], [r.right, cy - r.height / 4],
		[r.left, cy + r.height / 4], [r.right, cy + r.height / 4]];
}
const recentSparks = [];

// Bigger gifts light more cells: a small cluster around one spot.
const cellsFor = (cents) => cents >= 1000000 ? 7 : cents >= 500000 ? 5 : cents >= 100000 ? 3 : 1;

function spark(delay, colour, size = 1) {
	const svg = document.querySelector(".lattice");
	if (getComputedStyle(svg).display === "none") return;
	const box = svg.getBoundingClientRect();
	const qr = document.querySelector(".invite .hex").getBoundingClientRect();
	const keepClear = [...document.querySelectorAll("#demo, .demo-badge")].map((el) => el.getBoundingClientRect());
	// List every free cell, instead of guessing: guessing could give up on a
	// crowded panel and a donation went by with no highlight.
	const free = [...$("cells").children].flatMap((cell) => {
		if (cell.classList.contains("lit") || cell.dataset.pending) return [];
		const r = cell.getBoundingClientRect();
		const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
		// Cells cut by the panel edge are fine as long as most of the cell shows.
		if (cx <= box.left || cx >= box.right || cy <= box.top || cy >= box.bottom) return [];
		const points = vertices(r);
		if (points.some(([x, y]) => inHexagon(x, y, qr, 6))) return [];
		// Where the lattice dissolves around the caption a lit cell would come out half-faded.
		if (clearZone && points.some(([x, y]) =>
			((x - clearZone.cx) / clearZone.rx) ** 2 + ((y - clearZone.cy) / clearZone.ry) ** 2 < 1)) return [];
		if (keepClear.some((k) => r.right > k.left && r.left < k.right && r.bottom > k.top && r.top < k.bottom)) return [];
		return [{ cell, x: cx - box.left, y: cy - box.top }];
	});
	if (!free.length) return;

	// Best of a few random candidates: the one farthest from recent highlights,
	// so they spread over the whole panel instead of clumping.
	let pick = null, best = -1;
	for (let i = 0; i < 10; i++) {
		const c = free[Math.floor(Math.random() * free.length)];
		const gap = recentSparks.length
			? Math.min(...recentSparks.map((p) => Math.hypot(p.x - c.x, p.y - c.y)))
			: Math.random();
		if (gap > best) { best = gap; pick = c; }
	}
	recentSparks.push({ x: pick.x, y: pick.y });
	if (recentSparks.length > 8) recentSparks.shift();

	// The seed plus its nearest free neighbours.
	const cluster = free
		.map((c) => ({ ...c, d: Math.hypot(c.x - pick.x, c.y - pick.y) }))
		.sort((a, b) => a.d - b.d)
		.slice(0, size);
	cluster.forEach(({ cell }, i) => {
		cell.dataset.pending = "1";
		setTimeout(() => {
			delete cell.dataset.pending;
			cell.style.setProperty("--lit", colour.c);
			cell.classList.add("lit");
			setTimeout(() => cell.classList.remove("lit"), LIT_MS);
		}, delay + (reduced ? 0 : i * 70));
	});
}

// The goal is crossed: every cell lights in a palette colour, sweeping from
// the top-left corner across the panel.
function celebrateGoal() {
	const svg = document.querySelector(".lattice");
	if (getComputedStyle(svg).display === "none") return;
	const box = svg.getBoundingClientRect();
	[...$("cells").children].forEach((cell) => {
		if (cell.classList.contains("lit") || cell.dataset.pending) return;
		const r = cell.getBoundingClientRect();
		const along = (r.left - box.left + r.top - box.top) / (box.width + box.height);
		cell.dataset.pending = "1";
		setTimeout(() => {
			delete cell.dataset.pending;
			cell.style.setProperty("--lit", PALETTE[Math.floor(Math.random() * PALETTE.length)].c);
			cell.classList.add("pop", "lit");
			setTimeout(() => cell.classList.remove("lit"), 1600);
			setTimeout(() => cell.classList.remove("pop"), 1650);
		}, reduced ? 0 : along * 1400);
	});
}

// Goal crossed: confetti explosions all over the board for a few seconds, in
// palette hexagons. The library is self-hosted and loads only at this moment,
// so a normal night never downloads it and venue wifi can't block it.
const CONFETTI_MS = 10000;
let confettiLib = null;
function loadConfetti() {
	confettiLib ??= new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "/vendor/tsparticles-confetti-4.4.0.min.js";
		script.onload = () => resolve(globalThis.confetti);
		script.onerror = () => { confettiLib = null; reject(new Error("confetti")); };
		document.head.append(script);
	});
	return confettiLib;
}
async function fireConfetti() {
	if (reduced) return;
	try {
		const confetti = await loadConfetti();
		const board = document.querySelector(".board").getBoundingClientRect();
		const between = (a, b) => a + Math.random() * (b - a);
		const colors = PALETTE.map((p) => p.c);
		const start = performance.now();
		// A burst every 250ms at a random spot over the board, thinning out toward the end.
		const timer = setInterval(() => {
			const left = 1 - (performance.now() - start) / CONFETTI_MS;
			if (left <= 0) return clearInterval(timer);
			confetti({
				count: Math.round(70 * left) + 20,
				spread: 360,
				startVelocity: 35,
				ticks: 220,
				gravity: 0.9,
				scalar: 2.2,
				zIndex: 20,
				colors,
				shapes: ["polygon", "square"],
				shapeOptions: { polygon: { sides: 6 } },
				position: {
					x: between(board.left + board.width * 0.1, board.right - board.width * 0.1) / innerWidth * 100,
					y: between(10, 55),
				},
			});
		}, 250);
	} catch {
		// No confetti is fine: the lattice sweep and "Meta batida!" still mark the moment.
	}
}

// "+R$ 450" rides just above the number's last digits, in the space under the
// masthead; it drops onto the digits' top edge only when the title is in the way.
function showGain(cents, colour) {
	const gain = $("gain"), fig = gain.parentElement, line = $("total-line");
	gain.textContent = "+" + reais(cents);
	gain.style.setProperty("--c", colour.c);
	gain.style.setProperty("--on", colour.on);
	// In proportion to the total on every screen; R$ 5.000+ gifts get a bigger chip.
	const totalSize = parseFloat(getComputedStyle(line).fontSize);
	gain.style.fontSize = Math.max(20, Math.min(110, totalSize * (cents >= 500000 ? 0.4 : 0.28))) + "px";
	const f = fig.getBoundingClientRect(), l = line.getBoundingClientRect();
	const w = gain.offsetWidth, h = gain.offsetHeight;
	// The digits' ink starts ~0.08em below the line box (line-height 0.9).
	const inkTop = l.top + totalSize * 0.08;
	const x = Math.max(0, Math.min(l.right - f.left - w, f.width - w));
	let y = inkTop - f.top - h - 6;
	const title = document.querySelector(".masthead h1").getBoundingClientRect();
	const top = f.top + y, left = f.left + x;
	if (top < title.bottom && left < title.right && left + w > title.left) y = inkTop - f.top - h * 0.5;
	gain.style.setProperty("--x", x + "px");
	gain.style.setProperty("--y", y + "px");
	gain.classList.remove("show");
	void gain.offsetWidth; // restart the animation when gifts land back to back
	gain.classList.add("show");
}

function row(r, freshIndex, colour) {
	const li = document.createElement("li");
	if (freshIndex !== undefined) {
		li.className = "new";
		li.style.setProperty("--i", freshIndex);
		li.style.setProperty("--c", colour.c);
	}
	li.innerHTML = '<span class="amount">' + reais(r.amountCents) + '</span><time datetime="' +
		new Date(r.paidAt * 1000).toISOString() + '">' + when(r.paidAt) + '</time>';
	return li;
}

const sameRow = (a, b) => a.amountCents === b.amountCents && a.paidAt === b.paidAt;

// Newest first, so whatever arrived since the last poll sits on top. When the
// update is a clean prepend, existing rows keep their DOM nodes: a highlight still
// running is not cut short by the next poll.
function renderRecent(prev, next, newCount, colours) {
	const ol = $("recent");
	for (let i = 0; i < Math.min(newCount, 6); i++) {
		spark(i * 120, colours[i], cellsFor(next.recent[i]?.amountCents ?? 0));
	}
	const kept = next.recent.slice(newCount);
	const isPrepend = newCount > 0 && ol.children.length === prev.recent.length &&
		kept.every((r, j) => prev.recent[j] && sameRow(r, prev.recent[j]));

	if (isPrepend) {
		ol.prepend(...next.recent.slice(0, newCount).map((r, i) => row(r, i, colours[i])));
		while (ol.children.length > next.recent.length) ol.lastElementChild.remove();
		// Day labels roll over at midnight even when nothing new arrives.
		next.recent.forEach((r, i) => { ol.children[i].querySelector("time").textContent = when(r.paidAt); });
		return;
	}
	ol.replaceChildren(...next.recent.map((r, i) => row(r, i < newCount ? i : undefined, colours[i])));
}

function render(next) {
	const prev = state.summary;
	$("count").textContent = countLabel(next.count);
	fitTotal(Math.max(next.totalCents, shownCents));
	if (next.totalCents !== prev.totalCents) countUp(next.totalCents);

	// Each new gift gets one palette colour, shared by its row, its hexagons and the chip.
	const newCount = Math.max(0, next.count - prev.count);
	const colours = Array.from({ length: Math.min(newCount, next.recent.length) }, nextColour);
	if (newCount > 0 && next.totalCents > prev.totalCents) showGain(next.totalCents - prev.totalCents, colours[0]);

	renderGoal(next.totalCents, prev.totalCents);

	renderRecent(prev, next, newCount, colours);
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

buildLattice();

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
