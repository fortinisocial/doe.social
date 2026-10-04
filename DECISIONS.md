# Decisions

Append-only. Newest at the bottom. Each entry: date, decision, why, rejected alternatives, commits.

## D1 · 2026-10-03 · Ambassador donation pages are static pages under `public/<slug>/`

The first one is `doe.social/loucas-por-tennis`: logos, the Fortini project text, four photos with a lightbox, and one button per payment link. The slug is reserved in `src/pages.ts` so `/admin` can't create a page it would shadow.

- **Why:** the first page needed hand-tuned copy, photo crops and logos; a static file in `public/` is served before the Worker with no new code.
- **Rejected:** rendering it from the Worker (no second page yet to justify a template).
- **Commits:** 95adb1b, 5b79fe6, 242d1dd, ae99cf6.

## D2 · 2026-10-03 · A campaign's progress view lives at `/<slug>/painel`

- **Why:** "painel" is the everyday pt-BR word for a dashboard; it sits with the existing `/dados` and `/demo` sub-paths.
- **Rejected:** `/ao-vivo` (implies the event TV), `/insights` (implies analytics), `/resultados` (implies the campaign ended), `/stats`.

## D3 · 2026-10-03 · Monthly campaigns count active monthly donors

The panel shows "N doadores mensais · R$ X/mês" from subscriptions that are still active, so a cancellation lowers it.

- **Why:** counting first payments only would never reflect cancellations or renewals, and the panel would overstate the campaign.
- **Needs:** Subscriptions read on the restricted Stripe key (Checkout Sessions are listed with `expand[]=data.subscription`).
- **Rejected:** first payments only (works with today's key but drifts from reality); also total collected including renewals (would need Invoices read; can be added later).

## D4 · 2026-10-03 · Monthly goals are in R$ per month

- **Why:** same money-based goal as event pages, so the goal bar works the same way.
- **Rejected:** goal as a number of donors; no goal.

## D5 · 2026-10-03 · The ambassador-page skill lives in this repo

At `.claude/skills/ambassador-page/`, versioned with the image scripts (Vision background removal, shadow lift) and the page it copies from.

- **Rejected:** a personal skill in `~/.claude/skills/` (not shared, drifts from the repo).

## D6 · 2026-10-03 · One campaign model and one panel for events and ambassadors

No ambassador-specific panel. The existing live page grows to handle several payment links per campaign and monthly donations, and ambassadors use the same feature. Aim: something that could serve other nonprofits, not a Fortini one-off.

- **Why:** avoid two panels drifting apart; a campaign is a campaign whatever brings the donors in.
- **Rejected:** a separate ambassador panel; per-ambassador config hard-coded in `src/`.

## D7 · 2026-10-03 · A campaign is either one-time or monthly, never both

- **Why:** keeps the panel to one headline figure and one goal unit; no mixed campaign is needed yet.
- **Rejected for now:** mixed campaigns showing "R$ X arrecadados · R$ Y/mês".

## D8 · 2026-10-03 · Admin creates the Stripe product and payment links

Goal: a campaign is set up end to end in `/admin`, with no trip to the Stripe dashboard. Needs a second restricted key with write access to Products, Prices and Payment Links only, used only by `/admin`; public pages keep the read-only key.

- **Why:** the target is a product other nonprofits could use; pasting links made in Stripe doesn't scale.
- **Rejected:** pasting payment links; pasting a product ID (both still need the Stripe dashboard).
- **Pending:** confirm the write key (changes "doe.social never writes to Stripe").

## D9 · 2026-10-03 · Loucas por Tennis goal: R$ 1.000/mês

## D10 · 2026-10-03 · Panels are never indexed; access control is still open

Every Worker-rendered page sends `X-Robots-Tag: noindex, nofollow, noarchive` plus a matching meta tag, and `robots.txt` blocks AI crawlers from them. Whether panels need a password (or a secret link) is undecided.

- **Rejected:** fully public, indexable panels.

## D11 · 2026-10-03 · The admin write key is a separate secret, `STRIPE_ADMIN_KEY`

Resolves D8's pending point. A new restricted key with write on Products, Prices and Payment Links, stored as the Worker secret `STRIPE_ADMIN_KEY`, read only by the `/admin` handlers. The read-only `STRIPE_API_KEY` (now with Subscriptions read) stays the only key public pages use.

- **Why:** a leak or bug in a public panel can't create or change anything in Stripe.
- **Rejected:** adding write permissions to the existing read-only key.

## D12 · 2026-10-03 · Loucas por Tennis campaign live; no "Outro valor" or suggested amount yet

Deployed as version 6da65d4e; the `loucas-por-tennis` campaign is in production KV (4 links, monthly, R$ 1.000/mês). The page subtitle no longer repeats "transformar vidas".

- **Rejected for now:** an "Outro valor" button (Payment Links can't take a custom amount on recurring prices; the workaround is an R$ 10/mês link with adjustable quantity, to revisit once admin creates links); a "mais escolhido" badge (no donors yet, so it would be false).

## D13 · 2026-10-03 · Ambassador page layout: A/B pending between two external suggestions

Local picker at `public/_prototypes/loucas-ab/` (ignored on deploy via `.assetsignore`):
- **A · Convite**: an "Um convite das …" line, the main photo first, a cause-led headline, transparency before the buttons, R$ 50/100/200/400 with "sugerido" on R$ 50, a one-time exit, a trust line, a footer with the CNPJ, and a sticky "Doar todo mês" bar on phones.
- **B · Causa**: the current page tightened. The name is visible next to the logos, the subtitle is about the cause, the transparency text is shorter, photos sit in a swipe strip on phones, and buttons read "Doar R$ 50/mês". Nothing new is added.

The skill took the points both agree on (copy rules, agreement-safe name fields, WhatsApp card, attribution, checkout check). The layout itself waits on the user's pick.

## D14 · 2026-10-03 · Ambassador pages follow variant A ("Convite"), adjusted

`public/loucas-por-tennis/` is now A, with three changes from the user: the headline is just "Ajude a transformar vidas"; the main photo is the tennis class on the court in Belo Horizonte; and the "Por que doar para a Fortini?" text says what the money really pays for (incentive laws and grants pay the workshops and the team; monthly gifts pay the office: energy, internet, maintenance). The amounts are R$ 50/100/200/400 with "sugerido" on R$ 50. The page's facts were checked against `fortini-astro/src/data/fortini.json`. The A/B stays at `public/_prototypes/loucas-ab/` ("No ar", the original A, B) for further comparison, excluded from deploys by `.assetsignore`.

- **Rejected:** B ("Causa"). It's leaner, but the invitation from someone you know and the photo up front carry more weight on a link shared over WhatsApp.

## D15 · 2026-10-03 · Recurring donations are card only

The page says "Cartão de crédito". The four Loucas links currently offer card, boleto and Apple Pay (Apple Pay counts as card); restricting them to card is a live Stripe change waiting on the user's OK.

## D16 · 2026-10-03 · Hotfix: the live subtitle leads with the cause

Deployed as version 7f15b6cc, commit a9974f9 (not pushed). Before the A page ships, the live page's subtitle "Com uma doação mensal, você ajuda a manter a Fortini Social de portas abertas" became "Há 10 anos, a Fortini leva educação integral, esporte e cultura a crianças e adolescentes de escolas públicas da Grande BH." It has no numbers, because the paragraph below already says "mais de mil… 6 municípios".

- **Why:** "portas abertas" pitched the institution's survival rather than the cause.
- **"Finalista do Prêmio Melhores ONGs 2025" stays:** Fortini passed the first phase and competed in the second, final one.

## D17 · 2026-10-03 · Panels stay on a public link, hidden from bots

Anyone with `doe.social/<slug>/painel` can open it; no password or secret link. Search engines and AI crawlers stay out through what D10 already shipped: `X-Robots-Tag: noindex, nofollow, noarchive` plus the meta tag on every Worker page, `Disallow: /*/painel` and `/*/dados` for all agents, and a site-wide `Disallow: /` for the AI crawlers in `robots.txt`. Checked in production: `/loucas-por-tennis/painel` sends the header.

- **Why:** ambassadors share the panel themselves; a password adds friction and protects numbers that aren't sensitive.
- **Rejected:** password per campaign; secret link per campaign (for now).
- **Later:** a dynamic OG image for each panel that shows the current total, so a shared link previews progress. Not started.

## D18 · 2026-10-03 · "Finalista do Prêmio Melhores ONGs 2025" links to the MG first-phase result

The trust line now links to https://premiomelhores.org/resultado-minas-gerais, the only public proof found. It lists "Fortini Investimento Social" among the MG organizations "que seguem para a segunda fase"; per D16, the second phase is the final one. The page itself never says "finalista".

## D19 · 2026-10-03 · Campaign progress is for ambassadors, not donors

The ambassador page shows no donor count or progress toward the monthly goal; that lives on `/<slug>/painel`, which the ambassadors follow (D17). The critique suggested a live "N doadores mensais · R$ X de R$ 1.000/mês" line near the amounts.

- **Rejected:** a live progress line on the donation page; a "Acompanhe a meta" link to the panel.

## D20 · 2026-10-03 · The phone "Doar todo mês" bar waits for the lead

From the critique: at 360×640 the bar covered the H1, asking for a monthly gift before the page said what for. It now starts hidden and shows once the lead sits fully above it, still hiding while the amounts are on screen. Its button is capped at the text column (it spanned 780px over a 536px column at 820px).

- **Rejected:** smaller thumbnails to fit the lead in the first 640px. With the bar gone, the H1 already fits.
- **Note on D15:** its text still says the card-only switch was waiting on the user's OK; it was done. The 4 links are `card` only with `submit_type: donate` (checked in Stripe live, 2026-10-03).

## D21 · 2026-10-03 · One-time gifts on an ambassador page use the campaign's own link

"Prefere doar uma vez?" now goes to a one-time payment link on the Loucas product instead of `fortini.org.br/doe?ref=loucas-por-tennis`, so the gift stays attributed to the ambassador in Stripe. Price `price_1UMavDGOg3j34iS8uJoeDqA6`: one-time, donor-chosen amount, minimum and preset R$ 50. Link `plink_1UMavHGOg3j34iS88Cm8sAlV` (https://donate.stripe.com/cNi14n4ZRgaLbwi8BZe7m0M): Stripe's default payment methods (Pix, card, boleto, Apple Pay), `submit_type: donate`, name and phone required, `metadata` `ambassador=loucas-por-tennis`, `cadence=one-time`. The copy is "Quer fazer uma doação única? Clique aqui e escolha o valor" (the user's wording); "qualquer valor" stopped being true with the minimum, and the minimum shows on the checkout.

- **Why:** the fortini.org.br page only carried `?ref=`, which Stripe doesn't record on the payment.
- **D7 still holds:** the link isn't in the campaign's `paymentLinkIds`, so the monthly panel doesn't count one-time gifts.
- **Rejected:** a separate one-time product (the user wanted it on the same product); card only (that rule is for recurring links).
- **Product renamed** from "Doação mensal" to "Doação para a Fortini Social": Stripe shows the product name on every checkout, and the one-time one said "Doação mensal". Monthly checkouts still say "por mês". Rejected: "Doação · Loucas por Tennis" (reads as a gift to the ambassador, not to Fortini).

## D22 · 2026-10-03 · Open: Astro migration and link tracking (findings, nothing decided)

Parked by the user, to revisit. Nothing changed in code because of this.

**Astro.** The project is about 2,400 lines (`src/views/live.ts` alone is 955), and its only runtime dependency is `uqr`. Leaning: no migration now. When a second ambassador page arrives, use Astro for the static pages only, built into `public/`, and have them import `fortini-astro/src/data/fortini.json` instead of copying facts by hand. The Worker keeps the panels, `/admin` and Stripe. If `src/index.ts` grows, a router such as Hono fits the Worker better than Astro.

**Link tracking without Dub** (the doc "Link tracking without Dub", https://claude.ai/code/artifact/2da8f7ab-d935-43a7-aa2e-e87f2385b8d5). Everything it adds is Worker work: page-view logging, a `/d/<slug>` redirect that passes a click id to Stripe, reading Checkout Sessions, QR codes from `uqr`, and a funnel view in `/admin` backed by D1. Astro doesn't help any of it. Findings that touch ambassador pages:

- **Static pages skip the Worker** (D1), so the doc's view logging misses them. To count their views, use `run_worker_first` for those paths in `wrangler.jsonc`, or a beacon.
- **`/d/` is only needed where we don't control the click:** QR codes and printed links. An ambassador page can add `client_reference_id` to the Stripe link itself, with a few lines of JS, e.g. `loucas-por-tennis_whatsapp`, taken from the inbound `src`/`utm_source`, with `_direct` when there's none. It's stored on the Checkout Session, which the Worker already reads ([Stripe: Track a payment link](https://docs.stripe.com/payment-links/url-parameters)).
- **UTMs on Stripe links do nothing for us.** Stripe only forwards them to the post-payment redirect URL, and our links use the hosted confirmation. Each amount already has its own link, so they add nothing there either. The 5 Stripe links on the Loucas page still carry them; the other 7 outbound links' UTMs are fine.
- **WhatsApp strips the referrer,** so each channel needs its own tagged link (`?src=whatsapp`, `?src=insta`).

**Open questions:**
- Replace the Stripe-link UTMs with `client_reference_id` now, or wait for the tracking plan?
- Is city-level location acceptable under LGPD, or only state?
- Short links on `doe.social/d/…`, or a separate short domain?
- Which Dub plan is Fortini paying for today?

## D23 · 2026-10-03 · Tooling direction: Vite+ for checks, Hono later; no framework migration

Research findings, with the user's go-ahead to try Vite+. Nothing is installed yet.

- **No framework migration.** The code already follows web standards: `fetch`/`Request`/`Response`, `crypto.subtle`, `Intl`. TypeScript is strict with `noUncheckedIndexedAccess`. 8 Vitest tests pass and `tsc` is clean. Rejected: Effect (a new programming model for about 750 lines of logic), Octane (beta, and there's no React here), a full-stack Astro or Next migration (it would rewrite the working panel).
- **Gaps to fix, in order:**
  1. No linter or formatter, and no CI.
  2. About 400 lines of the panel's browser JS sit inside a template string (`src/views/live.ts`, from line 534), with no type checking or linting.
  3. HTML is built from template strings with manual escaping; `notice` in `views/admin.ts` is injected raw, so every caller must escape.
  4. The router in `index.ts` is hand-rolled.
- **Linting, formatting and tests: Vite+ (`vite-plus` 1.0.0), not Biome.** It bundles `vitest` 5.0.1 (the repo's version), Oxlint with type-aware rules on TS 7 (`oxlint-tsgolint`; the repo is on TypeScript 7), and Oxfmt. Cloudflare owns VoidZero since June 2026, and Astro since January 2026. Risks: 1.0 is from 2026-09-28; `oxfmt` is pre-1.0; the docs don't cover a "checks only" setup where wrangler still builds the Worker.
  - **Trial, blocked until 2026-10-05 05:37 UTC** by `minimumReleaseAge` (7 days) in `pnpm-workspace.yaml`. Steps: `pnpm add -D vite-plus`, then `vp test`, `vp lint` (type-aware) and `vp fmt --check`; confirm `wrangler dev` and `wrangler deploy --dry-run` are unaffected. Fallback: `oxlint` + `oxfmt` directly, then Biome.
- **Then:** move the panel's JS into `public/js/live.js` with `// @ts-check`; add CI running `tsc` + tests + lint; then Hono 4.13 with `hono/jsx` (escaping by default), one route at a time, `/admin` first.
- **Not now:** Cloudflare's `@cloudflare/vitest-plugin` 1.3.6 (tests inside the Workers runtime) requires Vitest `^4.1`; the repo is on 5. The in-memory fakes are enough for now.

## D24 · 2026-10-03 · Vite+ adopted for the checks; browser code is TypeScript

**The trial passed, so the user's go-ahead stands and Vite+ is in.** The user asked to bypass the 7-day quarantine for it. `pnpm-workspace.yaml` exempts only `vite-plus` and `@voidzero-dev/vite-plus-*` (the core and its platform binaries, all published 2026-09-28) via `minimumReleaseAgeExclude`; the rest stays under quarantine. Remove the exemption after 2026-10-05.

- **Results:** `vp test` runs the same 8 tests on Vitest 5.0.1. `wrangler deploy --dry-run` builds the Worker unchanged (97 KiB) and ignores `vite.config.ts`.
  - **Format:** `useTabs` and `printWidth` 120, chosen as the width that rewraps the fewest lines (183 at 120 vs 347 at 100). JSON uses 2 spaces, as pnpm writes `package.json`, and `.jsonc` has no trailing commas. `public/`, Markdown and generated types are left alone.
- **Type-aware lint found 9 issues; all fixed.**
  - A real bug: admin form fields went through `String(data.get(...))`, so a file posted in their place became "[object File]". `field()` in `src/index.ts` now takes only strings.
  - The others: `URLSearchParams` stringified implicitly, and a test spread an untyped JWK.
- **Browser code is TypeScript.**
  - **Where:** `src/client/` has its own `tsconfig.json` (DOM types) and compiles with the TS 7 already installed (`tsc -p src/client`) into `public/js/`, which is gitignored. Wrangler runs that compile through `build.command` before `dev` and `deploy`. No new dependency and no bundler.
  - **Moved so far:** the ambassador page's inline script, now `src/client/ambassador.ts`, shared by every ambassador page and loaded as an ES module. It throws if a markup hook is missing.
  - **Next:** the panel's script in `src/views/live.ts`.
  - **Rejected:** bundling with esbuild or Vite now. One file with no imports doesn't need it, and Vite+ can take over the build later.
- **Next steps** are written up in `README.md`: the panel script, CI, Hono, Astro.

## D25 · 2026-10-03 · Types come from checks: Valibot at the edges, no assertions

The user flagged `as X` and similar practices. External data used to be typed by assertion and never checked: Stripe (`stripeGet<T>` returned `response.json()` as `T`), Dub (`as T`), Cloudflare Access certs and JWTs (`as { keys }`, `JSON.parse`), page configs (`kv.get<PageConfig>`) and the cached summary. The tests used `as unknown as Env`, `{} as ExecutionContext` and `!`.

- **Validation:** Valibot 1.5.0 (user's choice).
  - **Stripe** responses keep only the fields the code uses. A `status` Stripe adds later stays a plain string, so it can't break the whole list.
  - **Dub** links are checked.
  - **Access:** only RSA keys are kept from the certs (other key types are skipped, not fatal), and the JWT header and claims are checked.
  - **KV:** a config that fails the schema is logged (`page_invalid`) and treated as missing.
  - **Cache:** the cached summary is re-checked.
  - **Types:** `PageConfig` and `Summary` are now derived from their schemas.
  - **Checked:** the 3 production KV configs pass the schema.
  - **Cost:** the Worker grows from 31 to 35 KiB gzipped.
- **Narrow bindings:** `src/bindings.ts` (`PageStore`, `AssetStore`, `Bindings`, `Background`). `handle()` is exported for tests, and the default export only adapts `Env` to it. `test/fakes.ts` fakes those interfaces exactly.
  - **New test:** a Stripe response missing `payment_status` returns 502 "unavailable" instead of a wrong total.
- **Stricter compiler flags:** `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- **Lint rules** (Oxlint, type-aware), all errors: `consistent-type-assertions` (never; `as const` allowed), `no-non-null-assertion`, `no-explicit-any`, and `no-unsafe-assignment`/`-return`/`-member-access`/`-argument`/`-call`.
- **Also fixed:** an admin notice escaped only `<` (now `escapeHtml`); `querySelectorAll<HTMLAnchorElement>` in the browser code became an `instanceof` filter; `listPages` no longer hand-writes a type predicate.
- **Rejected:** installing the community "typescript-expert" skill (skills.sh). It's generic, mostly about monorepos and bundlers, and partly outdated (it says Biome has no type-aware linting); its useful parts are the flags and rules above. Zod 4, for its bigger bundle. Hand-written guards, because types and checks drift apart.
- **Not covered yet:** the panel's browser script inside `src/views/live.ts`. It's still JavaScript in a string (README next step 1).

## D26 · 2026-10-03 · Modern ECMAScript pass: `using` in tests; the rest waits on runtimes

Audited the code against the modern-ECMAScript patterns (ES2023–ES2026).

- **Adopted: `using` for test cleanup.** Every test used `try { … } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }`. `test/fakes.ts` now has disposable helpers (`stubNetwork`, `silenceLogs`, and `stubStripe` in the campaigns test), so a test writes `using _network = stubNetwork(…)` and cleanup can't be forgotten.
  - **Why it works:** Vite+ compiles `using` for Node 22 (checked with a throwaway test), and Node 22 has `Symbol.dispose`.
  - **Types:** `tsconfig.json` adds the `esnext.disposable` lib (types only).
  - **Why not Vitest's own disposal:** its spies are disposable at runtime, but `@vitest/spy` 5.0.1 doesn't declare it in its types, so `silenceLogs()` wraps one.
- **Kept on purpose:**
  - **`.sort()` in `stripe.ts`, `pages.ts`, `index.ts`:** each sorts an array it just built (`filter`/`flat`/`push`), so nothing shared is mutated. `toSorted()` would only add a copy.
  - **`reduce` sum in `summarize`:** integer cents, so `Math.sumPrecise` (ES2026) adds nothing.
  - **`atob`/`charCodeAt` in `access.ts` and `btoa(String.fromCharCode(…))` in the tests:** the replacements are `Uint8Array.fromBase64(…, { alphabet: "base64url" })` and `toBase64()`. Node 22.18, which runs the tests, doesn't have them (it checks `undefined`). Revisit when tests run in workerd (`@cloudflare/vitest-plugin`) or on Node with V8 ≥ 14.
  - **`new Promise` in `loadConfetti`:** a real executor wiring `onload`/`onerror`, not resolver hoisting, so `Promise.withResolvers()` doesn't apply.
- **For README next step 1 (the panel's script to TypeScript):** `nextColour()` shuffles with `[...PALETTE].sort(() => Math.random() - 0.5)`. That's a biased shuffle (a random comparator isn't a valid sort), so it should become Fisher–Yates. Use nothing newer than ES2022 in the panel's browser code until we know which TV browsers it runs on; `toSorted`, Set methods and iterator helpers need recent engines.
