### Doe.social

Live donation pages for Fortini Social campaigns, served by a Cloudflare Worker at `doe.social`. `PRODUCT.md` describes the product, and `DECISIONS.md` logs every decision and its reasons.

## Layout

| Path | What it holds |
| --- | --- |
| `src/` | The Worker: routing (`index.ts`), Stripe, Dub, Cloudflare Access, page configs in KV |
| `src/views/` | HTML for the live panel and `/admin`, rendered on the server |
| `src/client/` | Browser code, in TypeScript. It compiles to `public/js/`, which isn't committed |
| `public/` | Static files served before the Worker: ambassador pages (`public/<slug>/`), fonts, images |
| `test/` | Vitest tests, with in-memory fakes for KV and Access |
| `.claude/skills/ambassador-page/` | How to build an ambassador page, step by step |

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | `wrangler dev`, after compiling `src/client/` |
| `pnpm check` | Format and type-aware lint (`vp check`), both typechecks, and the tests |
| `pnpm test` | Tests only (`vp test`) |
| `pnpm fmt` | Formats the code (Oxfmt, through Vite+) |
| `pnpm run deploy` | `wrangler deploy`, also compiling `src/client/` first. Deploys are manual |

## Conventions

- **TypeScript everywhere,** browser code included: no inline `<script>` with logic in HTML or in template strings. Browser code goes in `src/client/` and is loaded as a module from `/js/…`.
- **Tooling is Vite+** (Oxlint, Oxfmt, Vitest). Wrangler still builds and deploys the Worker; `vite.config.ts` only configures the checks.
- **Types come from checks, never from claims.** Data from outside the program (Stripe, Dub, Cloudflare Access, KV, the cache) goes through a [Valibot](https://valibot.dev) schema where it enters, and its type is derived from that schema. There are no `as X` assertions, `x!` non-null assertions or `any`, and lint rejects them; `as const` and `satisfies` are fine. In the browser, narrow DOM elements with `instanceof` (see `must()` in `src/client/ambassador.ts`).
- **Handlers take narrow bindings** (`src/bindings.ts`), not the generated `Env`, so tests fake exactly what the code uses. The fakes are in `test/fakes.ts`.
- **Strict compiler flags:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns` and `noFallthroughCasesInSwitch`.
- **Run `pnpm check` before committing.**

## Next steps

In order. Each step ships on its own and leaves the site working. The reasoning is in `DECISIONS.md` D22–D23.

1. **Move the panel's browser code to TypeScript.** About 400 lines of polling and animation are still inside a template string in `src/views/live.ts` (the `<script>` from line 534), with no type checking or linting. Move them to `src/client/live.ts`. The server passes its values (`bootstrap`, the hexagon sizes, the demo flag) as JSON in a `<script type="application/json">` tag instead of interpolating them into code. The demo panel's script moves too. This is the most critical code (the panel runs unattended at events), so check it on a real screen after the change. While moving it, replace the biased shuffle in `nextColour()` (`sort(() => Math.random() - 0.5)`) with Fisher–Yates. Compile it with `target: "es2020"` and don't use browser APIs newer than the ones it already uses: event TVs (LG webOS, Samsung Tizen) run old browsers (D27).
2. **CI workflow.** A GitHub Actions job runs `pnpm check` on every push and pull request: format, lint, both typechecks and the tests. Use `pnpm install --frozen-lockfile`; the quarantine in `pnpm-workspace.yaml` applies there too.
3. **Hono for routing and views.** Replace the hand-written router in `src/index.ts` with [Hono](https://hono.dev), and the template-string HTML in `src/views/` with `hono/jsx`, which escapes values by default; raw HTML then needs an explicit `dangerouslySetInnerHTML`. Today safety depends on every caller using `escapeHtml` (`notice` in `views/admin.ts` is injected raw). Go one route at a time, `/admin` first and the panel last. Tests can call `app.request()` directly.
4. **Astro for the static pages, once a second ambassador page exists.** Build the ambassador pages from one [Astro](https://astro.build) template plus a data file per ambassador, output into `public/`. The pages can then import facts from `fortini-astro/src/data/fortini.json` instead of copying them by hand. The Worker keeps the panel, `/admin` and Stripe. Cloudflare owns Astro since January 2026.
5. **`/admin` creates the Stripe product and payment links,** so a campaign needs no trip to the Stripe dashboard. The plan is in `docs/plans/admin-creates-stripe-links.md`.
6. **Housekeeping:**
   - After 2026-10-05, remove the `minimumReleaseAgeExclude` entries for Vite+ in `pnpm-workspace.yaml`; by then the 7-day quarantine covers 1.0.0.
   - Tests in the real Workers runtime (`@cloudflare/vitest-plugin`) wait until it supports Vitest 5.
   - Link tracking without Dub stays open (D22, D27): a `/<slug>/qr` redirect for QR codes, view logging, and a funnel in `/admin`. Dub Pro counts clicks but not donations.
   - Refunds subtracted from totals: waiting to confirm Charges read on the Stripe key.
