#!/usr/bin/env node
// scripts/audit/codemod-low-priority-sweep.mjs
//
// Impeccable cascade — low-priority anti-pattern sweep (2 JSX categories).
//
// Categories handled (per impeccable empirical snippets) :
//
//   1. border-accent-on-rounded
//      Pattern :    border-{l|r|t|b}-{2|4|8}  (with rounded-{X} on same element)
//      Action  :    drop the border-side-thickness token + any adjacent
//                   `border-{color}-{shade}` token. Round border + thick colored
//                   side accent = AI-scaffolding cliché.
//
//   2. gradient-text
//      Pattern :    bg-clip-text + text-transparent + bg-gradient-to-{dir}
//                   (+ optional from-X / to-X / via-X stops)
//      Action  :    drop ALL of these, append `text-foreground` (flat semantic).
//
// NOT handled here (different surface) :
//   - overused-font (2 cases in `frontend/app/global.css`) — manual CSS edit.
//
// Uses the shared AST-grade `transformClassNames` helper.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { argv, exit, stderr, stdout } from "node:process";
import { execSync, spawnSync } from "node:child_process";
import { resolve, relative, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { transformClassNames } from "./lib/jsx-classlist.mjs";

const BORDER_SIDE_RE = /^border-(?:l|r|t|b)-(?:2|4|8)$/;
const TAILWIND_COLOR_FAMILIES = "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
const BORDER_COLOR_RE = new RegExp(`^border-${TAILWIND_COLOR_FAMILIES}-(?:50|100|200|300|400|500|600|700|800|900|950)$`);
const ROUNDED_RE = /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|t|tl|tr|r|br|b|bl|l))?(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/;
const GRADIENT_STOP_RE = new RegExp(`^(?:from|to|via)-${TAILWIND_COLOR_FAMILIES}-(?:50|100|200|300|400|500|600|700|800|900|950)$`);

export function transformLowPriority(source) {
  return transformClassNames(source, (tokens, ctx) => {
    const all = new Set(ctx.allClassNames);
    const hasRounded = ctx.allClassNames.some((t) => ROUNDED_RE.test(t));
    const hasGradientText = all.has("bg-clip-text") && all.has("text-transparent") &&
      ctx.allClassNames.some((t) => t.startsWith("bg-gradient-to-"));

    if (!hasRounded && !hasGradientText) return null;

    let changed = false;
    const next = [];
    let foregroundAdded = false;

    for (const tok of tokens) {
      // gradient-text pattern : drop bg-clip-text + text-transparent +
      // bg-gradient-to-* + from-/to-/via- stops; append text-foreground once.
      if (hasGradientText) {
        if (
          tok === "bg-clip-text" ||
          tok === "text-transparent" ||
          tok.startsWith("bg-gradient-to-") ||
          GRADIENT_STOP_RE.test(tok)
        ) {
          changed = true;
          if (!foregroundAdded && !ctx.allClassNames.includes("text-foreground")) {
            next.push("text-foreground");
            foregroundAdded = true;
          }
          continue;
        }
      }
      // border-accent-on-rounded : drop the side-thickness token + any
      // border-{color}-{shade} on the same element.
      if (hasRounded && BORDER_SIDE_RE.test(tok)) {
        changed = true;
        continue;
      }
      if (hasRounded && BORDER_COLOR_RE.test(tok) && hasBorderSideOnElement(ctx.allClassNames)) {
        changed = true;
        continue;
      }
      next.push(tok);
    }

    return changed ? next : null;
  });
}

function hasBorderSideOnElement(allTokens) {
  return allTokens.some((t) => BORDER_SIDE_RE.test(t));
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
    `${exclude} | xargs -P 4 grep -lE 'border-(l|r|t|b)-(2|4|8)|bg-clip-text' 2>/dev/null`;
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
  const { source: next, count } = transformLowPriority(raw);
  if (count === 0) return { path, count: 0, diff: "" };
  const diff = unifiedDiff(path, next, raw);
  if (apply) writeFileSync(path, next);
  return { path, count, diff };
}

function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    stdout.write(`Usage: node scripts/audit/codemod-low-priority-sweep.mjs [options]

Handles impeccable low-priority categories :
  - border-accent-on-rounded : drops border-{l|r|t|b}-{2|4|8} + adjacent
    border-{color}-{shade} on rounded elements.
  - gradient-text : drops bg-clip-text + text-transparent + bg-gradient-to-X
    + from-/to-/via- stops, appends text-foreground.

NOT handled : overused-font (CSS surface, manual edit in global.css).

Options:
  --apply             Write changes (default: dry-run)
  --include-routes    Include frontend/app/routes/**/*.tsx (default: excluded)
  --files <f1> <f2>   Process explicit file list
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
