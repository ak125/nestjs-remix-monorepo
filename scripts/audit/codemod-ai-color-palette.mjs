#!/usr/bin/env node
// scripts/audit/codemod-ai-color-palette.mjs
//
// PR 5 of the impeccable cascade — eliminate `ai-color-palette` anti-pattern
// occurrences (purple / indigo / violet gradients + heading colors, the most
// recognizable tell of AI-scaffolded UIs).
//
// Strategy (no 1:1 token mapping exists — primary=navy, accent=named flat):
//
//   1. Heading text colors `text-{purple,indigo,violet}-{600..900}` →
//      `text-foreground` (shadcn semantic — adapts to light/dark mode).
//   2. Gradient classes `from-/to-/via-{purple,indigo,violet}-{50..950}` →
//      REMOVED from className. Any orphan `bg-gradient-to-*` left without
//      `from-` / `to-` partners is also removed.
//   3. Background fills `bg-{purple,indigo,violet}-{50..200}` (light washes)
//      → `bg-muted` (shadcn semantic). `bg-{purple,indigo,violet}-{500..900}`
//      (bold) → `bg-primary` (brand navy).
//
// Empirical scoping (from impeccable JSON snippets) :
//   ai-color-palette snippets are exclusively `text-X on heading` and
//   `from-X gradient` over purple/indigo/violet. Codemod tightly targets
//   these three Tailwind color families.
//
// Scope (R-SEO-09 compliance) :
//   - `frontend/app/components/**/*.tsx`
//   - SKIPPED: `frontend/app/routes/**/*.tsx`
//
// Usage:
//   node scripts/audit/codemod-ai-color-palette.mjs           # dry-run
//   node scripts/audit/codemod-ai-color-palette.mjs --apply
//   node scripts/audit/codemod-ai-color-palette.mjs --include-routes --apply

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { argv, exit, stderr, stdout } from "node:process";
import { execSync, spawnSync } from "node:child_process";
import { resolve, relative, join } from "node:path";
import { tmpdir } from "node:os";

const FAMILIES = "(?:purple|indigo|violet)";
const SHADES = "(?:50|100|200|300|400|500|600|700|800|900|950)";

// Heading text colors → semantic foreground.
const TEXT_RE = new RegExp(`\\btext-${FAMILIES}-${SHADES}\\b`, "g");
// Gradient stops → removed.
const GRADIENT_STOP_RE = new RegExp(`\\b(?:from|to|via)-${FAMILIES}-${SHADES}\\b`, "g");
// Light bg fills → muted.
const BG_LIGHT_RE = new RegExp(`\\bbg-${FAMILIES}-(?:50|100|200)\\b`, "g");
// Bold bg fills → primary.
const BG_BOLD_RE = new RegExp(`\\bbg-${FAMILIES}-(?:300|400|500|600|700|800|900|950)\\b`, "g");
// Orphan gradient direction (if no from-/to-/via- partner remains).
const GRADIENT_DIR_RE = /\bbg-gradient-to-(?:t|tr|r|br|b|bl|l|tl)\b/;

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
  const exclude = includeRoutes ? "" : "| grep -v '^frontend/app/routes/'";
  const cmd =
    "git ls-files 'frontend/app/**/*.tsx' " +
    `${exclude} | xargs -P 4 grep -lE '\\b(text|bg|from|to|via)-(purple|indigo|violet)-' 2>/dev/null`;
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

  // 1. Text heading colors → semantic foreground.
  const afterText = next.replace(TEXT_RE, "text-foreground");
  if (afterText !== next) { changed = true; next = afterText; }

  // 2. Light bg fills → muted.
  const afterBgLight = next.replace(BG_LIGHT_RE, "bg-muted");
  if (afterBgLight !== next) { changed = true; next = afterBgLight; }

  // 3. Bold bg fills → primary.
  const afterBgBold = next.replace(BG_BOLD_RE, "bg-primary");
  if (afterBgBold !== next) { changed = true; next = afterBgBold; }

  // 4. Gradient stops removed.
  const afterGradStops = next.replace(GRADIENT_STOP_RE, "");
  if (afterGradStops !== next) { changed = true; next = afterGradStops; }

  // 5. If no from-/to-/via- color remains, drop the gradient direction
  //    (orphan `bg-gradient-to-br` etc.).
  if (changed && !/\b(?:from|to|via)-\S+/.test(next)) {
    const afterDir = next.replace(GRADIENT_DIR_RE, "");
    if (afterDir !== next) next = afterDir;
  }

  // Collapse double spaces.
  next = next.replace(/\s+/g, " ").trim();
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

  // Standalone class-list string literals (helpers).
  const standaloneRe = new RegExp(
    `(["'])((?:(?!\\1).)*?\\b(?:text|bg|from|to|via)-${FAMILIES}-(?:(?!\\1).)*?)\\1`,
    "g",
  );
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
  const dir = mkdtempSync(join(tmpdir(), "cm-aicp-"));
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
      "Usage: codemod-ai-color-palette.mjs [--apply] [--include-routes] [--files <f1>...]\n",
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
