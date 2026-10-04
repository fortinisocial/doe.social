# Plan: /admin creates the Stripe product and payment links

Status: not started. Decisions: `DECISIONS.md` D8 and D11 (why, and the separate write key), D15 (monthly links are card only), D21 (one-time link per campaign), D7 (a campaign is monthly or one-time).

## Goal

Staff set up a campaign end to end in `/admin`, with no trip to the Stripe dashboard. Today `/admin` only accepts a payment link someone pasted. Monthly campaigns, like the Loucas one, are created by hand with the Stripe CLI and written to KV by hand (`.claude/skills/ambassador-page/SKILL.md`, sections 2 and 3).

## What exists

- **`STRIPE_ADMIN_KEY`** is set as a Worker secret and declared in `wrangler.jsonc`: a restricted key with write on Products, Prices and Payment Links. Nothing reads it yet. Public pages must keep using only the read-only `STRIPE_API_KEY` (D11).
- **The create form** in `src/index.ts` (`handleAdmin`), rendered by `src/views/admin.ts`, takes link, slug, title and goal. It resolves the pasted link (`resolveLink`), makes a Dub short link (`ensureShortLink`), and writes a `PageConfig` to KV.
- **`PageConfig`** (`src/pages.ts`, a Valibot schema) already supports `cadence: "monthly"` and `paymentLinkIds: string[]`.
- **The Loucas campaign is the reference setup** for what has to be created, all done by hand on 2026-10-03:
  - **Product:** `prod_VNGOm7VdltMCGS`, named "Doação para a Fortini Social". Never "mensal", and never the ambassador's name, because it shows on every checkout (D21). `metadata.ambassador`.
  - **Monthly prices** in BRL: 5000, 10000, 20000, 40000, `recurring.interval=month`.
  - **Monthly payment links:** `payment_method_types=["card"]`, `submit_type=donate`, `customer_creation=always`, `name_collection.individual.enabled=true`, `phone_number_collection.enabled=true`.
  - **One-time price:** `custom_unit_amount` with minimum and preset 5000.
  - **One-time link:** Stripe's default payment methods (Pix, card, boleto), `submit_type=donate`, the same name and phone collection, `metadata.ambassador=<slug>`, `metadata.cadence=one-time`.

## Steps

1. **A Stripe write client.** Add `src/stripe-admin.ts` with `createProduct`, `createPrice` and `createPaymentLink`. They post form-encoded bodies to `https://api.stripe.com/v1/...` with `STRIPE_ADMIN_KEY` and validate every response with a Valibot schema (the same pattern as `stripeGet` in `src/stripe.ts`). Send an `Idempotency-Key` on every POST, derived from slug + step + amount, so a retried form submit can't create duplicates. Only `/admin` handlers may import this module; add `STRIPE_ADMIN_KEY` to `Bindings` in `src/bindings.ts` as an admin-only field.
2. **A campaign builder.** A function that, for a slug and a list of monthly amounts, creates the product, one price and one payment link per amount, and the one-time price and link. It returns everything needed for KV and for the static page. The order matters: product → prices → links. If a step fails partway, return what was created, so the admin can retry or clean up (Stripe objects can be archived, not deleted).
3. **The form.** Add to `/admin`:
   - a "Criar no Stripe" mode, with the monthly amounts (default 50/100/200/400) and a "doação única" checkbox;
   - the cadence (D7: monthly or one-time, never both on the panel);
   - the goal, already present.
   Keep "paste a link" as the other mode for event pages.
4. **Write the campaign to KV:** `cadence`, `paymentLinkIds` (monthly links only; the one-time link stays out, D7), `paymentLinkId`/`paymentUrl` (the first amount) and `goalCents`. The Dub short link works as today.
5. **Show the result.** After creation, `/admin` lists each amount with its `donate.stripe.com` URL, ready to paste into `public/<slug>/index.html`. The page itself stays static (D1) until Astro builds pages from data (README next step 4).
6. **Tests.** Extend `test/admin.test.ts`. Stub the network with `stubNetwork` from `test/fakes.ts`, answering the Stripe POSTs, and check:
   - the KV config written;
   - the payment-link parameters sent (card only and `submit_type=donate` on monthly links, the product name);
   - a failure partway through reports what was created.
   No live Stripe calls in tests.
7. **Verify live once.** Create a throwaway campaign, check it in the Stripe dashboard (Portuguese, BRL, card only, "Doar"), then archive its prices and links.

## Things to watch

- **`submit_type` can reset:** a `payment_links update` once set it back to `auto`. After creating or updating a link, read it back and assert `submit_type=donate` and the payment methods.
- **Restricted key scope:** if the key lacks a permission, Stripe answers 403. Show it as a clear admin error, not a 502.
- **Live mode only:** the account has no test-mode workflow here, so step 7 creates real (archivable) objects.

## Open questions

- Should `/admin` also generate the static page from a template, or keep pages hand-built until Astro (README next step 4)?
- Can staff choose amounts per campaign, or are 50/100/200/400 fixed?
- Archive or keep the Stripe objects when a page is deleted in `/admin`?
