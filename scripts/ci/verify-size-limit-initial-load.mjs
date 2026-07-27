#!/usr/bin/env node
// scripts/ci/verify-size-limit-initial-load.mjs
//
// Guards `frontend/.size-limit.json` against the two ways a bundle budget can go
// green while measuring the wrong thing.
//
//   (A) EMPTY GLOB. A pattern that matches no file contributes 0 bytes. size-limit
//       does not complain, so the budget silently shrinks. This is not theoretical:
//       `radix-vendor-*.js` survived the Vite 8 / Rolldown migration in the config
//       long after Rolldown stopped emitting that chunk (it is folded into
//       `app-ui-primitives`), and its bytes went uncounted.
//
//   (B) CONFIG DRIFT FROM THE REAL GRAPH. The "Initial load" entry is a hand-written
//       list. When the bundler re-chunks, the list stops describing what a browser
//       actually downloads first. So we do not trust the list: we recompute the
//       initial-load set from the built artifacts — the transitive closure of static
//       imports from `entry.client-*` and `root-*` — and require the configured
//       globs to match exactly that set.
//
// Runs before size-limit in `frontend/package.json` -> "size", so both CI call sites
// (ci.yml "Bundle size gate" and perf-gates.yml) are covered without touching either
// workflow.
//
// Read-only. Exits non-zero with an actionable diff on failure.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FRONTEND = path.join(REPO_ROOT, "frontend");
// Overridable so the self-test can point at fixtures. Unset in CI and locally.
const CONFIG = process.env.SIZE_LIMIT_CONFIG ?? path.join(FRONTEND, ".size-limit.json");
const ASSETS =
  process.env.SIZE_LIMIT_ASSETS ?? path.join(FRONTEND, "build", "client", "assets");

/** The entry points a browser is guaranteed to fetch on any first paint. */
const ROOT_CHUNK_PATTERN = /^(entry\.client|root)-/;

/** `build/client/assets/react-vendor-*.js` -> /^react-vendor-.*\.js$/ */
function globToRegExp(glob) {
  const base = path.basename(glob);
  return new RegExp("^" + base.split("*").map(escapeRe).join(".*") + "$");
}
const escapeRe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

function fail(lines) {
  console.error("size-limit path verification FAILED\n");
  for (const l of lines) console.error(l);
  process.exit(1);
}

if (!fs.existsSync(ASSETS)) {
  fail([
    `  Build output not found: ${path.relative(REPO_ROOT, ASSETS)}`,
    "  Run `npm run build` (or `npm run -w @fafa/frontend build`) first.",
  ]);
}

const assetFiles = fs.readdirSync(ASSETS);
const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const problems = [];

// --- (A) every glob in every entry must match at least one file ----------------

for (const entry of config) {
  const globs = Array.isArray(entry.path) ? entry.path : [entry.path];
  for (const glob of globs) {
    const re = globToRegExp(glob);
    if (!assetFiles.some((f) => re.test(f))) {
      problems.push(
        `  [empty glob] "${entry.name}"\n` +
          `      pattern : ${glob}\n` +
          `      matches : 0 files — it contributes 0 bytes and silently shrinks this budget.\n` +
          `      Fix the pattern or remove it; do not leave a dead pattern in place.`,
      );
    }
  }
}

// --- (B) the initial-load entry must equal the real static-import closure -------

const initialEntry = config.find((e) => /^Initial load/i.test(e.name));
if (!initialEntry) {
  problems.push('  No entry whose name starts with "Initial load" — cannot verify the graph.');
} else {
  const roots = assetFiles.filter((f) => f.endsWith(".js") && ROOT_CHUNK_PATTERN.test(f));
  if (roots.length === 0) {
    problems.push("  No entry.client-*/root-* chunk found; cannot compute the initial-load closure.");
  } else {
    // Static imports only. A dynamic import() is a separate network request and is
    // deliberately out of the initial-load budget.
    const STATIC_IMPORT = /(?:^|[;\s}])import\s*(?:[^"';]*?\s*from\s*)?["'](\.\/[^"']+)["']/g;
    const closure = new Set();
    const stack = [...roots];
    while (stack.length) {
      const file = stack.pop();
      if (closure.has(file)) continue;
      const abs = path.join(ASSETS, file);
      if (!fs.existsSync(abs)) continue;
      closure.add(file);
      const src = fs.readFileSync(abs, "utf8");
      for (const m of src.matchAll(STATIC_IMPORT)) {
        const target = path.basename(m[1]);
        if (!closure.has(target)) stack.push(target);
      }
    }

    const configured = new Set();
    for (const glob of initialEntry.path) {
      const re = globToRegExp(glob);
      for (const f of assetFiles) if (re.test(f)) configured.add(f);
    }

    const missing = [...closure].filter((f) => !configured.has(f)).sort();
    const extra = [...configured].filter((f) => !closure.has(f)).sort();

    if (missing.length || extra.length) {
      const lines = [
        `  [graph drift] "${initialEntry.name}"`,
        `      The configured patterns no longer describe what the browser fetches first.`,
        `      Real initial-load closure: ${closure.size} chunks (static imports of ${roots.join(", ")}).`,
      ];
      if (missing.length) {
        lines.push(
          `      NOT COUNTED but in the initial graph (${missing.length}):`,
          ...missing.map((f) => `        + ${f}`),
        );
      }
      if (extra.length) {
        lines.push(
          `      COUNTED but not in the initial graph (${extra.length}):`,
          ...extra.map((f) => `        - ${f}`),
        );
      }
      lines.push(
        `      Update the "path" list in frontend/.size-limit.json to cover exactly the closure.`,
      );
      problems.push(lines.join("\n"));
    }
  }
}

if (problems.length) fail(problems);

console.log(
  `size-limit paths verified: every pattern matches ≥1 file, and the initial-load entry ` +
    `matches the real static-import closure.`,
);
