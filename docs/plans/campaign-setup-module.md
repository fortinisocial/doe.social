# Plan: a campaign setup module behind /admin

Status: decided, not started. Decision: `DECISIONS.md` D28. Origin: candidate 01 of the architecture review from 2026-10-03.

## Why

`handleAdmin` in `src/index.ts` (lines 123–336) does two jobs: HTTP (Access, Origin, the form, rendering) and the campaign lifecycle (validation, resolving a pasted link, short link rules, KV writes, staff-facing notes). Testing any Dub or Stripe rule means forging an Access JWT first. `dub.ts` is shallow: five exports, each one HTTP call. The short link rules sit in four functions in `index.ts`, each with its own error policy. D8 (admin creates Stripe links, `docs/plans/admin-creates-stripe-links.md`) would grow `handleAdmin` further. This refactor gives D8 a place to go.

## Decisions (2026-10-06)

1. **Pure refactor first.** Behavior stays the same, including every Portuguese message staff see. D8 comes later, as a second mode inside the module.
2. **Typed outcome.** The module returns facts, such as `{ kind: "created", slug, shortLink: { kind: "reused", url } }` or `{ kind: "invalid", field: "goal" }`. `views/admin.ts` turns them into Portuguese text and escapes them. That ends the raw `notice` HTML.
3. **Fetch stubs stay.** The module takes narrow `Bindings` (KV, keys, Dub domain). Tests keep `stubNetwork`, so the Valibot edge (D25) is still exercised. Injecting ports (review candidate 06) gets revisited with D8.
4. **`dub.ts` is deepened in place into the short link module.** It owns the rules: resolve a pasted dub.sh link, reuse or create one, refresh on save, release on delete (only a link that points at this campaign's payment link code and that no other campaign shows). The Dub HTTP calls become private. Campaign setup calls it.
5. **The module takes raw form strings.** It owns `validSlug` and `parseReais` and returns `invalid` with the field that failed.
6. **Names:** `src/campaign-setup.ts` and `test/campaign-setup.test.ts`. `test/campaigns.test.ts` stays as it is; it tests the panel summary.

## Steps

1. **Pin today's behavior with tests first.** Create has no test today. Add tests, still going through `handle`, for: a pasted Stripe link, a pasted dub.sh link, a short link that already exists and is reused, a slug already taken in Dub, Dub down, an unknown payment link, an invalid slug/title/goal, and a slug that already exists. Assert the KV config written and the exact notice and error text. Run `pnpm check`; it should pass with no source change.
2. **Deepen `dub.ts`.** Move `resolveLink`'s Dub branch, `ensureShortLink`, `currentShortLink` and the Dub part of `handleDelete` into it. `findDubLinkFor` goes away.
3. **Add `src/campaign-setup.ts`** with create, edit and delete. It returns typed outcomes and holds validation and KV writes.
4. **Thin `/admin`.** `handleAdmin` keeps Access, the Origin check, form reading and `renderAdmin`. `views/admin.ts` gets the outcome-to-text mapping, with the same strings as today.
5. **Split the tests.** `test/admin.test.ts` keeps the HTTP concerns (403 without Access, 403 for a foreign Origin, one happy path). The lifecycle tests move to `test/campaign-setup.test.ts` and call the module directly, without a JWT.
6. **Verify.** Run `pnpm check`, then `wrangler dev` and try create, edit and delete in `/admin` in the browser. Bruno tests it locally before any commit.

## Open questions

1. If deleting the Dub link fails, should the page still not be deleted (today's behavior)? Leaning: keep it.
2. Is it OK to start steps 1–3 without another check-in?
