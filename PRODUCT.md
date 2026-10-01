# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **guests and donors at Fortini Social fundraising events** — families, partners and supporters in the room, watching a live donation page on a big screen and deciding whether to scan the QR code and give. The same people, and anyone the link reaches, also open the page **on their phones** after scanning, or **online** when it is shared in messages, social media or a livestream.

Secondary: **Fortini staff** (e.g. the CEO and the team running the event) who create and manage campaign pages in `/admin` before and during an event.

## Product Purpose

doe.social gives each Fortini campaign a live donation page: the running total, the number of donations, progress toward an optional goal, the latest gifts as they land, and a QR code / short link to donate. It exists to turn an event's attention into giving while it happens.

Success is both, equally: **more people donate during the event**, and **the campaign reaches its goal**, with progress made visible and celebrated so the room feels each gift land.

## Positioning

A campaign page that is the event's live scoreboard and its donation entry point at once: what the room watches is exactly what moves when someone gives, and the way to give is always on screen.

## Operating Context

- **Big screen at in-person events:** TVs, monitors and projectors of uneven quality (washed-out color, low contrast), read from across a room, left running unattended for hours. Seen by a crowd, not operated.
- **Phones after scanning the QR:** the same page collapses to a mobile layout with a "Doar agora" button instead of the QR.
- **Shared online / livestream:** the link circulates beyond the room.
- **Before the event:** staff create a page in `/admin` (title, optional goal, Stripe payment link), get a Dub short link and QR, and can rehearse with `/<slug>/demo`, which simulates donations with fictitious values.
- Language: Brazilian Portuguese (pt-BR), BRL amounts.

## Capabilities and Constraints

- Cloudflare Worker serving `doe.social/*`; page configs in KV, one key per slug.
- Donations come from Stripe Payment Links via a read-only restricted key; doe.social never handles payment itself.
- The live page polls `/<slug>/dados` every 5 s; the Worker caches the Stripe summary for 5 s. New donations appear within ~10 s without a reload.
- If updates fail, the last numbers stay on screen, dimmed, so a frozen feed is visible. The page requests a screen wake lock.
- The public page shows **amounts and times only, never who donated**. Latest donations are capped at 12.
- Goal is optional per page.
- `/admin` is behind Cloudflare Access (email one-time PIN, allow-listed Fortini addresses); the Worker re-verifies the Access JWT.
- Short links and QR codes via Dub (`dub.sh`).
- Deploys are manual (`pnpm run deploy`); automatic deploys on push are **undecided** (Cloudflare Workers Builds, as on the Fortini site, is the candidate).

## Brand Commitments

Fortini Social (Contagem/MG) brand: name and wordmark, the turquoise identity and the hexagon palette from the brandbook. Voice from the brandbook's Tom e Voz: empático, alegre, inspirador, profissional — celebrates achievements, never appeals to pity.

## Evidence on Hand

Real donation data (amounts, times, counts) from Stripe for each campaign. No donor names, testimonials or photos are part of this product; never fabricate donors, amounts or messages on live pages — the demo mode is the only place fictitious values appear, and it is labelled as such.

## Product Principles

1. **Readable from the back of the room** — every number, label and the goal gauge must hold up on a poor projector at distance, not just on a good monitor.
2. **Every gift is felt** — a new donation visibly arrives so the room shares the moment, and progress toward the goal is the story of the night.
3. **The way to give is always there** — QR and short link on the big screen, a button on the phone; nothing on screen competes with it.
4. **Honest and private** — show the real, live total and amounts only; never identify donors, and never let a stalled feed pass for live.
5. **Unattended by design** — the page runs for hours without anyone touching it: no reloads, no sleep, no states that need an operator.

## Accessibility & Inclusion

WCAG AA as the floor, with projector contrast as the practical bar (washed-out displays lower effective contrast). Respect `prefers-reduced-motion`: keep the color cue for a new donation, drop the movement.
