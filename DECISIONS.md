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
