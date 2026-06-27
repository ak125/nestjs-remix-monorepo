#!/usr/bin/env node
/**
 * Gate: reserved-namespace-zero (DT-2 of the Tailwind-4 chantier).
 *
 * Tailwind v4 owns a set of CSS custom-property namespaces (`--color-*`,
 * `--spacing-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--container-*`,
 * `--breakpoint-*`). If `@fafa/design-tokens` declares vars in those namespaces,
 * an un-layered `:root{}` declaration would silently shadow / collide with v4's
 * `@theme` once we swap engines (TW-2). DT-2b prefixed every scale var with
 * `--am-*`; only the bare shadcn role vars and explicitly non-reserved customs
 * (grid / line-height / letter-spacing / max-width / z / transition) stay un-prefixed.
 *
 * This asserts `src/styles/tokens.css` declares ZERO bare reserved-namespace vars.
 * Run via `npm run check:reserved-namespaces`; wired into the Design-tokens CI gate.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PKG = dirname(dirname(fileURLToPath(import.meta.url)));
const TOKENS_CSS = join(PKG, "src/styles/tokens.css");
const css = readFileSync(TOKENS_CSS, "utf8");

// Tailwind v4 reserved theme namespaces. A declared `--<ns>-<x>` (NOT --am- prefixed)
// is a violation. The bare role `--radius` (== ns, no trailing `-`) is allowed.
const RESERVED = ["color", "spacing", "container", "breakpoint", "font", "shadow", "radius"];

const declRe = /^[ \t]*--([a-zA-Z0-9-]+)[ \t]*:/gm;
const violations = [];
let amCount = 0;
let m;
while ((m = declRe.exec(css))) {
  const name = m[1];
  if (name.startsWith("am-")) {
    amCount++;
    continue; // migrated → OK
  }
  for (const ns of RESERVED) {
    if (name.startsWith(ns + "-")) {
      violations.push(`--${name}`);
      break;
    }
  }
}

if (amCount === 0) {
  console.error("❌ reserved-namespace gate: no --am-* vars found — build looks broken.");
  process.exit(1);
}

if (violations.length > 0) {
  const uniq = [...new Set(violations)];
  console.error(
    `❌ reserved-namespace-zero VIOLATED: ${uniq.length} bare reserved-namespace var(s) in tokens.css:`,
  );
  for (const v of uniq) console.error(`   ${v}`);
  console.error(
    "\n   Fix: prefix the scale with --am-* in scripts/build-tokens.mjs renderTokensCss(), then rebuild.",
  );
  process.exit(1);
}

console.log(
  `✅ reserved-namespace-zero: tokens.css declares ${amCount} --am-* vars + bare shadcn roles, ` +
    `0 reserved-namespace (${RESERVED.map((r) => `--${r}-*`).join(", ")}).`,
);
