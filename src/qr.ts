import { renderSVG } from "uqr";

/**
 * The donate QR as inline SVG, drawn here rather than fetched: Dub's public QR
 * renderer stamps its logo in the middle unless the workspace is on a paid plan.
 * Q error correction survives a glare or a smudge on a TV; no quiet zone, because
 * the white hexagon around it is the margin.
 */
export function qrSvg(target: string): string {
	return renderSVG(target, { ecc: "Q", border: 0, blackColor: "#373636", whiteColor: "#FBFBFB" }).replace(
		"<svg ",
		'<svg class="qr" role="img" aria-label="QR code para doar" shape-rendering="crispEdges" ',
	);
}
