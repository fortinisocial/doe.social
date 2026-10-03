---
name: ambassador-page
description: Create a donation page for a Fortini ambassador (or ambassador group) on doe.social — Stripe product and payment links, the static page under public/<slug>/ with logo, photos and lightbox, and the campaign that powers /<slug>/painel. Use when someone says "new ambassador", "página de embaixador", "embaixadora", or asks for a page like doe.social/loucas-por-tennis.
---

# Ambassador donation page

An ambassador visits the projects, photos are taken, and they get their own donation page to share. Each one has:

- **A donation page** at `doe.social/<slug>`: a static page in `public/<slug>/`. It has logos, the Fortini project text, four photos with a lightbox, and one button per amount.
- **A campaign** in KV under the same slug, holding every payment link, the cadence and the goal. It powers the panel at `doe.social/<slug>/painel`. The panel is the same view as event pages (see `DECISIONS.md` D6). Because the donation page exists, its QR code and "Doar agora" button lead to that page.

The reference is `public/loucas-por-tennis/`. Copy it and adapt it; don't start from scratch. Read `DECISIONS.md` first, because it may have moved on since this skill was written.

## 1. Gather

Ask for whatever isn't given:

- **Name** as it should appear, for example "Embaixadoras Loucas por Tennis". Also the **slug** (lowercase, hyphens), the Instagram or site to link, and whether there's a **logo** or only the name.
- **Cadence:** monthly (the default) or one-time. A campaign is never both (D7).
- **Amounts:** monthly defaults are R$ 50 / 100 / 200 / 400. One-time could follow fortini-astro: R$ 25 / 50 / 100 / 200.
- **Goal:** in R$/mês for monthly campaigns (D4), or a total for one-time ones.
- **Photos:** usually WhatsApp exports in `~/Downloads`. Pick 4.

## 2. Stripe product and payment links

The goal is for `/admin` to create these (D8). Until it can, they're made in the Stripe dashboard. If you create them yourself with the Stripe CLI, confirm with the user first, because it writes to live Stripe.

Find the links for a product (read-only):

```bash
stripe prices list --product <prod_id> --live
stripe payment_links list --limit 50 --live -d "expand[]=data.line_items" > pl.json   # then filter line_items by product
```

Write down each link's `plink_…` ID and `https://donate.stripe.com/…` URL, along with its amount.

## 3. Campaign (powers /painel)

`/admin` still creates single-link, one-time pages only. Until it handles several links and monthly campaigns, write the campaign to KV. **Production KV: confirm with the user first.**

```json
{"slug":"<slug>","title":"<name>","cadence":"monthly","goalCents":100000,
 "paymentLinkId":"<first plink>","paymentUrl":"<first url>",
 "paymentLinkIds":["<plink 1>","<plink 2>","<plink 3>","<plink 4>"],
 "createdAt":"<ISO now>"}
```

```bash
wrangler kv key put --binding PAGES --local  <slug> --path campaign.json   # local preview
wrangler kv key put --binding PAGES --remote <slug> --path campaign.json   # production, after OK
```

Monthly panels need **Subscriptions read** on the read-only Stripe key (D3).

## 4. The page

Copy `public/loucas-por-tennis/` to `public/<slug>/`, then change:

- `<title>` and `og:title`: "Fortini Social + <name>". Also `og:url` and `og:image` (absolute URLs under `/<slug>/`).
- **Header row:** the Fortini 10-anos logo, a hand-drawn "+", then the ambassador.
  - **With a logo:** remove its background with `scripts/lift.swift`, cropping out frames first. Export at 288px tall as WebP with alpha (`cwebp -alpha_q 100 -exact -resize 0 288`). Link it to their Instagram, with alt "<name> no Instagram" and title "<name>".
  - **Name only:** use the name as text in Neris 600, in the same row and at a matching height. Ask before inventing another treatment.
  - The "+" is Covered By Your Grace (only that glyph is loaded, via `text=%2B`) in dark gray (`--text`), not teal. Teal blends into the Fortini logo.
- **Buttons:** one per payment link with its own URL. The heading is "Doação mensal" for monthly campaigns, and the note reads "Você pode cancelar a qualquer momento." For one-time campaigns, change the heading (for example "Faça sua doação") and remove the cancel note.
- **Lead under the headline:** "Você pode ajudar a transformar vidas através de doações recorrentes para a Fortini Social." For a one-time campaign, drop "recorrentes".
- **"Por que doar para a Fortini?" section** (it was "Projetos sociais" before the copy was rewritten): keep the heading and the three paragraphs as they are. They cover the reach (1,000+ kids in 6 municipalities; check the numbers are still current), then the transparency point (incentive-law money can't maintain the institution), then what a donation sustains (headquarters, accountability, new projects). For a one-time campaign, "Sua doação mensal" becomes "Sua doação".
- **Photo alt text** describes what's in the picture. Don't name people unless the user does.

## 5. Photos

Feedback from the first page. Treat it as the bar to meet.

- **Choose** 4 photos that vary: a group shot, the ambassadors with kids, an activity. The ambassadors should appear in at least two.
- **Thumbnails are tight square crops on the people.** Cut away empty sky, floor and sand; faces should be large. Use `cwebp -crop x y side side -resize 1000 1000 -q 78`. Work out the crop from a downscaled preview, then multiply back to full size.
- **Never cut one person at the edge** while everyone else fits. If a group is wider than the square, center the crop on the group and trim feet or shoes, not a person's side. Re-check the corners after cropping.
- **Faces in shadow** (caps, backlight): run `scripts/shadows.swift <in> <out.png> 0.5 1.0 12`. 1.0 was too bright. Compare a close crop of the face before and after.
- **The full image opens in the lightbox.** Export it uncropped, 1600px on the long side, q 80, to `img/full/<name>.webp`. Thumbnails go in `img/<name>.webp`.
- WhatsApp JPEGs come out upright. If a photo looks rotated, check its EXIF orientation, because cwebp ignores it.

## 6. Check locally

- Run `wrangler dev`. In a worktree use `../../../node_modules/.bin/wrangler`, because pnpm scripts fail there.
- Check at 390, 820, 1100 and 1400px wide. Photos must stay inside the margins (no bleed that cuts people), and the logo row must fit on one line at 360px.
- Tab through the page: every logo, photo and button should show the soft focus ring.
- Open the lightbox: arrows, Esc, clicking the backdrop, and the counter.
- Open `/<slug>/painel` and `/<slug>/demo` with the local KV campaign. The demo shows monthly-sized amounts.
- The user tests locally before anything is committed.

## 7. Ship (after the user's OK)

- Stage explicit paths only. Use one-line semantic commit subjects in English. Push to `main`.
- Run `wrangler deploy` (deploys are manual).
- **Request every new asset on doe.social and expect 200.** Once, one image returned 500 in production while working locally; re-encoding it fixed it.
- Check `doe.social/<slug>` and `/<slug>/painel` in a browser.
