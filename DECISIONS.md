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
