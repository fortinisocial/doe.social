export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const brl = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
	maximumFractionDigits: 0,
});

/** R$ with cents only when there are cents: "R$ 450", "R$ 12,50". */
export function formatReais(cents: number): string {
	if (cents % 100 === 0) return brl.format(cents / 100);
	return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// Neris ships only 300 / 600 / 900 — no 400 or 700 exist, so never ask for them.
export const FONT_FACES = `
@font-face { font-family: Neris; src: url(/fonts/neris-light.woff2) format("woff2"); font-weight: 300; font-display: swap; }
@font-face { font-family: Neris; src: url(/fonts/neris-semibold.woff2) format("woff2"); font-weight: 600; font-display: swap; }
@font-face { font-family: Neris; src: url(/fonts/neris-black.woff2) format("woff2"); font-weight: 900; font-display: swap; }
`;

export const TOKENS = `
:root {
	--branco: #FBFBFB;
	--branco-puro: #FFFFFF;
	--turquesa: #24DBDD;
	--turquesa-on-light: #008082;
	--turquesa-tint: #C9F4F5;
	--teal: #1E7387;
	--cinza: #373636;
	--cinza-muted: #656A6B;
	--track: #E2E7E9;
	--divider: #CDD2D3;
	--turquesa-deep: #003B3C; /* text on turquoise: 7.25:1 */
	--doadores: #E62A4A;
	--doadores-strong: #E32648; /* white text on red: 4.5:1 */
	--ease: cubic-bezier(0.25, 1, 0.5, 1);
	/* Strong curves: ease-out for things arriving, ease-in-out for things moving on screen. */
	--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
	--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
	--font: Neris, Nunito, "Segoe UI", sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
html { font-synthesis: none; -webkit-font-smoothing: antialiased; }
body { margin: 0; background: var(--branco); color: var(--cinza); font-family: var(--font); font-weight: 300; }
:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
`;

export const HEAD_COMMON = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/neris-black.woff2" as="font" type="font/woff2" crossorigin>
`;
