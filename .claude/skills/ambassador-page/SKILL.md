---
name: ambassador-page
description: Create a donation page for a Fortini ambassador (or ambassador group) on doe.social — Stripe product and payment links, the static page under public/<slug>/ with logo, photos and lightbox, and the campaign that powers /<slug>/painel. Use when someone says "new ambassador", "página de embaixador", "embaixadora", or asks for a page like doe.social/loucas-por-tennis.
---

# Ambassador donation page

An ambassador visits the projects, photos are taken, and they get their own donation page to share. Each one has:

- **A donation page** at `doe.social/<slug>`: a static page in `public/<slug>/`, built as an invitation from the ambassador (D14). It has logos, the main photo, the cause and where the money goes, one button per amount, and three more photos, all with a lightbox.
- **A campaign** in KV under the same slug, holding every payment link, the cadence and the goal. It powers the panel at `doe.social/<slug>/painel`. The panel is the same view as event pages (see `DECISIONS.md` D6). Because the donation page exists, its QR code and "Doar agora" button lead to that page.

The reference is `public/loucas-por-tennis/`. Copy it and adapt it; don't start from scratch. Read `DECISIONS.md` first, because it may have moved on since this skill was written.

**Facts come from the Fortini site:** `~/www/fortini-astro/src/data/fortini.json` has the legal name, CNPJ, founding year, children served, cities, modalities, awards and certifications. Check every number and claim on the page against it before shipping, and update the page when it changes.

## 1. Gather

Ask for whatever isn't given:

- **The ambassador**, as these fields:
  - `nome_exibicao`: how their friends know them ("Bia", "Loucas por Tennis"), never the full registered name.
  - `nome_com_artigo`: the name with its preposition already contracted ("da Bia", "do Pedro", "das Loucas por Tennis"). Templates use it instead of guessing agreement.
  - `tipo`: `pessoa` or `grupo`, which drives singular or plural ("Minha visita" or "Nossa visita").
  - `slug` (lowercase, hyphens), the Instagram or site to link, and an optional **logo**.
  - The **workshop visited** (modality and city), for photo captions.
- **Agreement rule:** no template sentence may conjugate a verb with the ambassador as its subject. "Um convite das Loucas por Tennis" works for any name; "As Loucas convidam…" breaks for "Bia".
- **Cadence:** monthly (the default) or one-time. A campaign is never both (D7).
- **Amounts:** monthly defaults are R$ 50 / 100 / 200 / 400. One-time could follow fortini-astro: R$ 25 / 50 / 100 / 200.
- **Goal:** in R$/mês for monthly campaigns (D4), or a total for one-time ones.
- **Photos:** usually WhatsApp exports in `~/Downloads`. Pick 4. Photo 1 is the **main photo**: the ambassador with the kids at the activity (for Loucas por Tennis, the tennis class on the court).

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

Sections, top to bottom on a phone. On desktop, the text and buttons sit on the left and the photos on the right, in the same order.

1. **Header row:** the Fortini 10-anos logo, a hand-drawn "+", then the ambassador's logo.
   - **With a logo:** remove its background with `scripts/lift.swift`, cropping out frames first. Export at 288px tall as WebP with alpha (`cwebp -alpha_q 100 -exact -resize 0 288`). Link it to their Instagram, with alt "<nome_exibicao> no Instagram" and title "<nome_exibicao>".
   - **No logo** (a person, or a group without one): only the Fortini logo. The name appears in the invitation line below.
   - The "+" is Covered By Your Grace (only that glyph is loaded, via `text=%2B`) in dark gray (`--text`), not teal. Teal blends into the Fortini logo.
2. **Invitation line:** "Um convite <nome_com_artigo>", in teal, smaller than the headline.
3. **Gallery:** the main photo, wide (4:3), with the caption "<nome_exibicao> na oficina de <modalidade> em <cidade>", then the other three photos as square thumbnails in a row right under it. It's one block (`#gallery`): in the text flow on phones and tablets, so the photos never end up at the bottom of the page, and moved to the right column on desktop. Every photo opens in the lightbox, main photo first.
4. **Headline:** "Ajude a transformar vidas". Keep it short; the subtitle carries the cause.
5. **Subtitle:** "Há 10 anos, a Fortini leva educação integral, esporte e cultura a crianças e adolescentes de escolas públicas. Hoje são mais de mil, em 6 cidades da Grande BH." The years, the count and the cities come from `fortini.json` (`foundingYear`, `impact`, `cities`).
6. **"Por que doar para a Fortini?"**, always before the buttons: "As oficinas e a equipe são pagas por leis de incentivo e editais, mas esses recursos não podem cobrir as despesas da sede. Sua doação mensal paga o dia a dia da Fortini, como energia, internet e manutenção, para que cada oficina continue acontecendo." This is what the money really pays for: the office costs, not the staff and not the workshops.
7. **Amounts,** a 2×2 grid: "R$ 50/mês", "R$ 100/mês", "R$ 200/mês" and "R$ 400/mês", with no ",00". The lowest is filled and carries a "sugerido" badge; the others are outlined. Every button is a real payment link: never a placeholder or disabled button, and never an amount without a link.
8. **Microcopy:** "Cartão de crédito · pagamento seguro via Stripe · cancele quando quiser". Recurring links accept card only (D15); if a link offers anything else, fix the link, not the text.
9. **One-time exit,** a text link: "Prefere doar uma vez? Escolha qualquer valor →" to `https://fortini.org.br/doe?ref=<slug>`.
10. **Trust line:** "10 anos · Selo Doar · 1º lugar no Prêmio do Esporte Mineiro 2024 · Finalista do Prêmio Melhores ONGs 2025", each item in a no-wrap `<span>`. Link the proof where it exists: Selo Doar to https://selodoar.org/certificado-fortini-investimento-social/ and the Esporte Mineiro prize to the O Tempo article (https://www.otempo.com.br/sports/especializados/2024/12/16/ong-e-destaque-no-premio-do-esporte-mineiro-2024-saiba-os-detalhes), and Melhores ONGs to the MG first-phase result that lists Fortini among those going on to the second phase (https://premiomelhores.org/resultado-minas-gerais), from `fortini.json` (`certifications`, `awards`). Pick the most recent and recognizable ones; keep it to one line. "Finalista" means Fortini passed the first phase and competed in the second, final phase (the 100 winners come out of it); see premiomelhores.org, "Entenda como as ONGs são avaliadas".
11. **Footer:** "<legalName> · CNPJ <cnpj> · fortini.org.br · @fortinisocial", from `fortini.json`.

Phones also get a **"Doar todo mês" bar** fixed at the bottom. It scrolls to the amounts and hides while they're on screen.

**Head and sharing:**

- `<title>`: "Fortini Social + Embaixadoras <nome_exibicao>" (or the ambassador's own name for a person). `og:title`: "Um convite <nome_com_artigo> · Fortini". `og:description`: the subtitle.
- **WhatsApp preview:** most visits come from a shared link, so the card matters. `og:image` is `img/og.webp`, a 1200×630 crop of the main photo with the whole group in frame (`cwebp -crop … -resize 1200 630`), with `og:image:width` and `og:image:height` set.
- **Attribution:** each campaign has its own payment links, so Stripe already attributes every donation to its ambassador. Links that leave for another donation page carry `?ref=<slug>`.
- **Photo alt text** describes what's in the picture. Don't name people unless the user does.
- **For a one-time campaign:** drop "/mês", "mensal" and the cancel note, and skip the "Doar todo mês" bar label (use "Doar agora").

### Copy rules (from the October 2026 review of the first page)

Two external reviews agreed on these (D13); the layout above is the one chosen (D14):

- **Lead with the cause, then be transparent.** The headline and subtitle sell the cause (education, sport and culture changing kids' lives). Keeping the institution open is the honest explanation, so it goes in the body, not the headline.
- **The transparency text comes before the buttons.** Incentive laws and grants pay the workshops and the team; monthly gifts pay the office. Never suggest the donation pays for the workshops or the kids directly. Avoid absolute promises ("garante").
- **The ambassador's name is visible as text** (the invitation line). A `title` attribute alone doesn't count. With no logo, nothing leaves an empty slot.
- **Buttons say the recurrence:** "R$ 50/mês", or with the verb, "Doar R$ 50/mês". Drop ",00".
- **Never invent numbers, awards, testimonials or expense examples.** Anything unconfirmed ships as a visible `[confirmar]` and is listed for the user before the page goes live.
- **No "mais escolhido" badge without data.** "Sugerido" is honest; "mais escolhido" needs real numbers behind it.
- **Mobile first, checked at 375px.** The path to the amounts stays short; photos must not push them two screens down.

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
- **Check the Stripe checkout from Brazil:** Portuguese, BRL, and that "cancelar a qualquer momento" matches how a donor actually cancels. Don't change Stripe settings because of how checkout looks from a browser set up abroad.
- **Request every new asset on doe.social and expect 200.** Once, one image returned 500 in production while working locally; re-encoding it fixed it.
- Check `doe.social/<slug>` and `/<slug>/painel` in a browser.
