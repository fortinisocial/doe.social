import { defineConfig } from "vite-plus";

// Vite+ runs the checks only (lint, format, test). Wrangler still builds and
// deploys the Worker; nothing here is part of that build.
export default defineConfig({
	lint: {
		ignorePatterns: ["public/**", "worker-configuration.d.ts", ".impeccable/**"],
		options: {
			// Rules that use the TypeScript 7 checker: unhandled promises, `[object File]` strings…
			typeAware: true,
		},
		rules: {
			// Types come from checks, never from claims: no `as X` (`as const` is fine) and no `x!`.
			// Data from outside (Stripe, Dub, Access, KV) goes through a Valibot schema instead.
			"typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
			"typescript/no-non-null-assertion": "error",
			// `any` is an assertion in disguise (JSON.parse, response.json()): keep it from spreading.
			"typescript/no-explicit-any": "error",
			"typescript/no-unsafe-assignment": "error",
			"typescript/no-unsafe-return": "error",
			"typescript/no-unsafe-member-access": "error",
			"typescript/no-unsafe-argument": "error",
			"typescript/no-unsafe-call": "error",
		},
	},
	fmt: {
		useTabs: true,
		printWidth: 120,
		// pnpm rewrites package.json with 2 spaces; JSON follows it so the two never fight.
		overrides: [
			{ files: ["*.json"], options: { useTabs: false } },
			// No trailing commas in wrangler.jsonc: not every JSONC reader accepts them.
			{ files: ["*.jsonc"], options: { trailingComma: "none" } },
		],
		// Hand-tuned HTML and vendored files in public/, generated types, and prose docs stay as written.
		ignorePatterns: ["public/**", "worker-configuration.d.ts", ".impeccable/**", "**/*.md", "pnpm-lock.yaml"],
	},
});
