#!/usr/bin/env node
// scripts/audit/codemod-gray-on-color.mjs
//
// Impeccable cascade — gray-on-color anti-pattern remover.
//
// impeccable's `gray-on-color` detection fires when `text-(gray|slate)-{300..600}`
// is used on an element whose background is a saturated color family
// (`bg-{red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|
// violet|purple|fuchsia|pink|rose}-{shade}`). Gray text washes out on those
// backgrounds — contrast drops well below WCAG AA on saturated bolds.
//
// Strategy :
//   - bg shade 50/100/200 (light wash) → `text-{family}-900` (darker shade
//     of the SAME family — keeps brand color, restores contrast)
//   - bg shade 300..900 (bold) → `text-white` (high contrast on bold)
//   - bg gray/slate/zinc/neutral/stone → NO CHANGE (not an anti-pattern)
//   - no bg-{saturated-family}-* on the same element → NO CHANGE
//
// Uses the shared AST-grade `transformClassNames` helper, so the transform
// is robust against :
//   - JSX object string keys (won't match)
//   - cn(...) / clsx(...) split sources (context unifies all tokens)
//   - Comments / unrelated strings
//
// Usage :
//   node scripts/audit/codemod-gray-on-color.mjs           # dry-run
//   node scripts/audit/codemod-gray-on-color.mjs --apply
//   node scripts/audit/codemod-gray-on-color.mjs --include-routes --apply
//   node scripts/audit/codemod-gray-on-color.mjs --files <f1> <f2> --apply

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { argv, exit, stderr, stdout } from "node:process";
import { execSync, spawnSync } from "node:child_process";
import { resolve, relative, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { transformClassNames } from "./lib/jsx-classlist.mjs";

const SATURATED_FAMILIES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];
// Optional Tailwind variant prefix (hover:, focus:, active:, group-hover:, dark:, …).
const VARIANT_PREFIX = "(?:[a-z][a-z0-9-]*:)*";
const SATURATED_RE = new RegExp(`^${VARIANT_PREFIX}bg-(${SATURATED_FAMILIES.join("|")})-(\\d+)$`);
const GRAY_TEXT_RE = /^text-(gray|slate)-(\d+)$/;
const LIGHT_BG_SHADES = new Set(["50", "100", "200"]);
// Threshold widened to 300..900 to match impeccable's empirical detection
// (slate-800 / gray-900 on bg-yellow-200 etc. are flagged).
const GRAY_SHADE_MIN = 300;
const GRAY_SHADE_MAX = 900;

export function transformGrayOnColor(source) {
  return transformClassNames(source, (tokens, ctx) => {
    // Identify the bg saturated family/shade (first hit) from the merged context.
    const bg = findSaturatedBg(ctx.allClassNames);
    if (!bg) return null;

    let changed = false;
    const next = tokens.map((tok) => {
      const m = tok.match(GRAY_TEXT_RE);
      if (!m) return tok;
      const shadeNum = Number(m[2]);
      if (!Number.isFinite(shadeNum) || shadeNum < GRAY_SHADE_MIN || shadeNum > GRAY_SHADE_MAX) return tok;
      changed = true;
      if (LIGHT_BG_SHADES.has(bg.shade)) return `text-${bg.family}-900`;
      return "text-white";
    });
    return changed ? next : null;
  });
}

function findSaturatedBg(tokens) {
  for (const t of tokens) {
    const m = t.match(SATURATED_RE);
    if (m) return { family: m[1], shade: m[2] };
  }
  return null;
}

// ---- CLI ----

function parseArgs(args) {
  const out = { apply: false, files: [], includeRoutes: false, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") out.apply = true;
    else if (args[i] === "--include-routes") out.includeRoutes = true;
    else if (args[i] === "--files") {
      while (args[i + 1] && !args[i + 1].startsWith("--")) out.files.push(args[++i]);
    } else if (args[i] === "-h" || args[i] === "--help") out.help = true;
  }
  return out;
}

function discoverFromGit(includeRoutes) {
  const exclude = includeRoutes ? "" : "| grep -v '^frontend/app/routes/'";
  const cmd =
    "git ls-files 'frontend/app/**/*.tsx' " +
    `${exclude} | xargs -P 4 grep -lE '\\btext-(gray|slate)-(300|400|500|600|700)\\b' 2>/dev/null`;
  try {
    return execSync(cmd, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function unifiedDiff(originalPath, modifiedSource, originalSource) {
  const dir = mkdtempSync(join(tmpdir(), "codemod-diff-"));
  const a = join(dir, "a");
  const b = join(dir, "b");
  try {
    writeFileSync(a, originalSource);
    writeFileSync(b, modifiedSource);
    const r = spawnSync("diff", ["-u", "--label", `a/${originalPath}`, "--label", `b/${originalPath}`, a, b], {
      encoding: "utf8",
    });
    return r.stdout ?? "";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function processFile(path, apply) {
  const raw = readFileSync(path, "utf8");
  const { source: next, count } = transformGrayOnColor(raw);
  if (count === 0) return { path, count: 0, diff: "" };
  const diff = unifiedDiff(path, next, raw);
  if (apply) writeFileSync(path, next);
  return { path, count, diff };
}

function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    stdout.write(`Usage: node scripts/audit/codemod-gray-on-color.mjs [options]

Removes the impeccable \`gray-on-color\` anti-pattern :
  text-(gray|slate)-{300..700} on bg-{saturated-family}-{shade} →
    light bg (50/100/200) : text-{family}-900
    bold bg (300..900)    : text-white

Options:
  --apply             Write changes (default: dry-run)
  --include-routes    Include frontend/app/routes/**/*.tsx (default: excluded)
  --files <f1> <f2>   Process explicit file list (overrides git discovery)
  -h, --help          Show this help
`);
    return 0;
  }

  const files = args.files.length > 0 ? args.files : discoverFromGit(args.includeRoutes);
  if (files.length === 0) {
    stdout.write("No candidate files.\n");
    return 0;
  }

  let totalCount = 0;
  let touched = 0;
  for (const f of files) {
    const rel = relative(process.cwd(), resolve(f));
    const res = processFile(rel, args.apply);
    if (res.count > 0) {
      touched++;
      totalCount += res.count;
      stdout.write(`# ${rel} (${res.count} edits)\n`);
      if (!args.apply) stdout.write(res.diff + "\n");
    }
  }
  stdout.write(`\n${args.apply ? "Applied" : "Would apply"} ${totalCount} edits across ${touched} files.\n`);
  if (!args.apply && totalCount > 0) stdout.write("Re-run with --apply to write changes.\n");
  return 0;
}

const isMain = fileURLToPath(import.meta.url) === resolve(argv[1] ?? "");
if (isMain) exit(main());
