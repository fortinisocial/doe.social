// Behavior shared by every ambassador page (public/<slug>/index.html): gallery placement,
// the phone "Doar todo mês" bar and the photo lightbox. Compiled to public/js/ambassador.js and
// loaded with <script type="module">, so nothing here leaks into the page's globals.
export {};

/** The element the page's markup promises; a missing one is a broken page, so fail loudly. */
function must<T extends Element>(selector: string, type: { new (): T }, root: ParentNode = document): T {
	const element = root.querySelector(selector);
	if (!(element instanceof type)) throw new Error(`ambassador page: missing ${selector}`);
	return element;
}

// Phones keep the gallery in the text flow, under the invitation; desktop moves it to the right column.
const wide = matchMedia("(min-width: 1024px)");
const gallery = must("#gallery", HTMLElement);
const invite = must(".invite", HTMLElement);
const visuals = must("#visuals", HTMLElement);
function placeGallery(): void {
	if (wide.matches) visuals.append(gallery);
	else invite.after(gallery);
}
placeGallery();
wide.addEventListener("change", placeGallery);

// The "Doar todo mês" bar shows once the lead sits fully above it, and hides while the amounts are on screen.
const sticky = must("#sticky", HTMLElement);
const lead = must(".lead", HTMLElement);
const amounts = must("#valores", HTMLElement);
let amountsInView = false;
function placeSticky(): void {
	const leadRead = lead.getBoundingClientRect().bottom <= innerHeight - sticky.offsetHeight;
	sticky.toggleAttribute("data-hidden", !leadRead || amountsInView);
}
new IntersectionObserver(
	(entries) => {
		amountsInView = entries.some((entry) => entry.isIntersecting);
		placeSticky();
	},
	{ threshold: 0.2 },
).observe(amounts);
addEventListener("scroll", placeSticky, { passive: true });
addEventListener("resize", placeSticky);
must("a", HTMLAnchorElement, sticky).addEventListener("click", (event) => {
	event.preventDefault();
	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	amounts.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
});

// Attribution: every Stripe link carries `client_reference_id=<slug>_<source>`, which Stripe stores on the
// Checkout Session, so each donation can be traced to the channel that brought the visitor. UTMs on a
// payment link would do nothing: Stripe only forwards them to a post-payment redirect, which we don't use.
// The source is the link's own tag (`?src=whatsapp` or `?utm_source=…`), else the referring site, else "direct".
// Stripe accepts letters, digits, `-` and `_`, up to 200 characters; anything else is dropped here.
const reference = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
const params = new URLSearchParams(location.search);
const referrer = document.referrer ? new URL(document.referrer).hostname.replace(/^(www|l|lm|m)\./, "") : "";
const source = reference(params.get("src") ?? params.get("utm_source") ?? referrer) || "direct";
const slug = reference(location.pathname.split("/").find(Boolean) ?? "");
for (const link of document.querySelectorAll("a[href^='https://donate.stripe.com/']")) {
	if (!(link instanceof HTMLAnchorElement)) continue;
	const url = new URL(link.href);
	url.searchParams.set("client_reference_id", `${slug}_${source}`);
	link.href = url.toString();
}

// Lightbox over the gallery: the main photo first, then the thumbnails. Each shows its own caption.
// Checked with instanceof, not `querySelectorAll<HTMLAnchorElement>`, which would only claim the type.
const photos = (): HTMLAnchorElement[] =>
	[...document.querySelectorAll("a.photo")].filter((element) => element instanceof HTMLAnchorElement);
const box = must(".lightbox", HTMLDialogElement);
const big = must("img", HTMLImageElement, box);
const caption = must(".lb-caption", HTMLElement, box);
const count = must(".lb-count", HTMLElement, box);
let current = 0;
function show(index: number): void {
	const list = photos();
	current = (index + list.length) % list.length;
	const link = list[current];
	if (!link) return;
	big.src = link.href;
	big.alt = link.querySelector("img")?.alt ?? "";
	caption.textContent = link.closest("figure")?.querySelector("figcaption")?.textContent ?? "";
	count.textContent = `${current + 1} / ${list.length}`;
}
for (const link of photos()) {
	link.addEventListener("click", (event) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		show(photos().indexOf(link));
		box.showModal();
	});
}
must(".lb-close", HTMLButtonElement, box).addEventListener("click", () => box.close());
must(".lb-prev", HTMLButtonElement, box).addEventListener("click", () => show(current - 1));
must(".lb-next", HTMLButtonElement, box).addEventListener("click", () => show(current + 1));
box.addEventListener("click", (event) => {
	if (event.target === box) box.close();
});
box.addEventListener("keydown", (event) => {
	if (event.key === "ArrowLeft") show(current - 1);
	if (event.key === "ArrowRight") show(current + 1);
});
