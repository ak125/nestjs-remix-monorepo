#!/usr/bin/env node
// scripts/audit/codemod-pure-black-white.mjs
//
// PR 3 of the impeccable cascade — substitute `pure-black-white` anti-pattern
// occurrences with semantic tokens from @fafa/design-tokens.
//
// impeccable flags `bg-black` (and similar pure #000/#fff Tailwind classes)
// as harsh. The recommended fix is a slightly-tinted dark surface
// (e.g., oklch(12% 0.01 250)). The design-tokens `neutral.900` = #212529
// (≈ slight blue tint) is the canonical substitute — already mapped in
// `frontend/tailwind.config.cjs` as `bg-neutral-{50..950}`.
//
// Mappings applied:
//   `bg-black`     →  `bg-neutral-900`   (tinted dark, design-tokens)
//   `text-white`   →  `text-neutral-50`  (tinted off-white, design-tokens)
//   `bg-white`     →  `bg-neutral-50`    (tinted off-white)
//   `text-black`   →  `text-neutral-900` (tinted dark)
//
// Scope (R-SEO-09 compliance per memory feedback_r_seo_09_blocks_frontend_route_codemods):
//   - `frontend/app/components/**/*.tsx`
//   - `frontend/app/global.css` (if matches)
//   - SKIPPED: `frontend/app/routes/**/*.tsx` (R-SEO-09 hard block).
//     Route fixes are a follow-up PR once R-SEO-09 Phase 2 override exists.
//
// Usage:
//   node scripts/audit/codemod-pure-black-white.mjs            # dry-run
//   node scripts/audit/codemod-pure-black-white.mjs --apply    # write
//   node scripts/audit/codemod-pure-black-white.mjs --include-routes --apply  # opt-in routes

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { argv, exit, stderr, stdout } from "node:process";
import { execSync, spawnSync } from "node:child_process";
import { resolve, relative, join } from "node:path";
import { tmpdir } from "node:os";

// Per-class substitution map. Whole-token replacement (\b boundaries) to avoid
// matching `bg-black-foo` or similar suffixed names.
//
// IMPORTANT: impeccable's `pure-black-white` detector only fires on `bg-black`
// in its current heuristic — bg-white / text-white / text-black are considered
// acceptable in normal Tailwind context (buttons, cards, body text). Empirical
// verification: `jq '.[] | select(.antipattern == "pure-black-white") | .snippet'`
// returns ONLY `bg-black` for all 42 matches at the time of this codemod.
//
// Substituting bg-white / text-white globally would change ~1000+ unrelated
// classes across the app (verified — see commit message). Scoping to bg-black
// keeps the codemod tightly aligned with what the ratchet measures.
const SUBS = [
  [/\bbg-black\b/g, "bg-neutral-900"],
];

function parseArgs(args) {
  const out = { apply: false, files: [], includeRoutes: false, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") out.apply = true;
    else if (args[i] === "--include-routes") out.includeRoutes = true;
    else if (args[i] === "--files") {
      while (args[i + 1] && !args[i + 1].startsWith("--")) {
        out.files.push(args[++i]);
      }
    } else if (args[i] === "-h" || args[i] === "--help") out.help = true;
  }
  return out;
}

function discoverFromGit(includeRoutes) {
  // Find candidate files: TSX under frontend/app and the single CSS that may
  // contain pure-black-white declarations. Skip routes by default (R-SEO-09).
  const exclude = includeRoutes ? "" : "| grep -v '^frontend/app/routes/'";
  const cmd =
    "git ls-files 'frontend/app/**/*.tsx' 'frontend/app/**/*.css' " +
    `${exclude} | xargs -P 4 grep -lE '\\bbg-black\\b' 2>/dev/null`;
  try {
    const out = execSync(cmd, { encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function looksLikeClassList(s) {
  if (!s.includes(" ")) return false;
  if (/[<>;=()\n]/.test(s)) return false;
  return true;
}

function applySubs(value) {
  let next = value;
  let changed = false;
  for (const [re, replacement] of SUBS) {
    const before = next;
    next = next.replace(re, replacement);
    if (next !== before) changed = true;
  }
  return { next, changed };
}

function processFile(path) {
  const raw = readFileSync(path, "utf8");
  let count = 0;

  // JSX className attributes.
  const classNameRe =
    /(\bclassName\s*=\s*)(?:(["'])([^"']*?)\2|\{`([^`]*?)`\}|\{(["'])([^"']*?)\5\})/g;
  let next = raw.replace(classNameRe, (...m) => {
    const prefix = m[1];
    const dquote = m[2];
    const dvalue = m[3];
    const tvalue = m[4];
    const bquote = m[5];
    const bvalue = m[6];
    const oldValue = dvalue ?? tvalue ?? bvalue ?? "";
    const { next: newValue, changed } = applySubs(oldValue);
    if (!changed) return m[0];
    count++;
    if (dvalue !== undefined) return `${prefix}${dquote}${newValue}${dquote}`;
    if (tvalue !== undefined) return `${prefix}\{\`${newValue}\`\}`;
    return `${prefix}\{${bquote}${newValue}${bquote}\}`;
  });

  // Standalone class-list string literals (helper functions).
  const standaloneRe =
    /(["'])((?:(?!\1).)*?\bbg-black\b(?:(?!\1).)*?)\1/g;
  next = next.replace(standaloneRe, (full, quote, value) => {
    if (!looksLikeClassList(value)) return full;
    const { next: newValue, changed } = applySubs(value);
    if (!changed) return full;
    count++;
    return `${quote}${newValue}${quote}`;
  });

  return { content: next, count, changed: count > 0 };
}

function unifiedDiff(before, after, path) {
  const dir = mkdtempSync(join(tmpdir(), "cm-pbw-"));
  const tmp1 = join(dir, "before");
  const tmp2 = join(dir, "after");
  try {
    writeFileSync(tmp1, before);
    writeFileSync(tmp2, after);
    const r = spawnSync(
      "diff",
      ["-u", tmp1, tmp2, "--label", `a/${path}`, "--label", `b/${path}`],
      { encoding: "utf8" },
    );
    return r.stdout ?? "";
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    stdout.write(
      "Usage: codemod-pure-black-white.mjs [--apply] [--include-routes] [--files <f1> <f2>...]\n",
    );
    exit(0);
  }
  const files = args.files.length ? args.files : discoverFromGit(args.includeRoutes);
  if (!files.length) {
    stdout.write("(no candidate files found)\n");
    exit(0);
  }

  let total = 0;
  let touched = 0;
  for (const f of files) {
    const abs = resolve(f);
    const rel = relative(process.cwd(), abs);
    const before = readFileSync(abs, "utf8");
    const { content, count, changed } = processFile(abs);
    if (!changed) continue;
    touched++;
    total += count;
    if (args.apply) {
      writeFileSync(abs, content);
      stdout.write(`✎ ${rel} (${count} className edits)\n`);
    } else {
      stdout.write(unifiedDiff(before, content, rel));
    }
  }
  if (!args.apply) {
    stderr.write(
      `\n# dry-run: ${touched} files would change, ${total} className edits total.\n# re-run with --apply to write.\n`,
    );
  } else {
    stdout.write(
      `\n✓ wrote ${touched} files, ${total} className edits total.\n`,
    );
  }
}

main();
