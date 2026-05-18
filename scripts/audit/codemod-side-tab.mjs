#!/usr/bin/env node
// scripts/audit/codemod-side-tab.mjs
//
// PR 2 of the impeccable cascade — remove `side-tab` anti-pattern occurrences.
//
// impeccable's `side-tab` detection fires on JSX `className` strings containing
// `border-l-{2,4}` (and `border-r-X` variants) — the "thick colored side
// accent" cliché of AI-scaffolded admin UIs.
//
// Strategy (mechanical, reviewable):
//   1. Find every TSX file with at least one className containing `border-l-{2,4}`
//      or `border-r-{2,4}`.
//   2. In each className string, remove the `border-{l,r}-{2,4}` token AND any
//      immediately adjacent `border-{color}-{shade}` token (heuristic for the
//      paired color class — common pattern).
//   3. Collapse double spaces. Preserve the rest verbatim.
//   4. Print a unified diff per modified file. Apply only with `--apply`.
//
// Safety:
//   - Only removes tokens, never adds. Reverts are simple `git checkout`.
//   - Skips files outside `frontend/app/**/*.tsx`.
//   - Does NOT touch CSS-in-JS / inline `style={{borderLeft: ...}}` — those
//     are a different impeccable category and require separate handling.
//
// Usage:
//   node scripts/audit/codemod-side-tab.mjs            # dry-run (default)
//   node scripts/audit/codemod-side-tab.mjs --apply    # write changes
//   node scripts/audit/codemod-side-tab.mjs --files <file1> <file2> --apply

import { readFileSync, writeFileSync } from "node:fs";
import { argv, exit, stderr, stdout } from "node:process";
import { execSync } from "node:child_process";
import { resolve, relative } from "node:path";

const SIDE_BORDER_RE = /\bborder-(?:l|r)-(?:2|4|8)\b/g;
const TAILWIND_COLOR_SHADE_RE =
  /\bborder-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g;

function parseArgs(args) {
  const out = { apply: false, files: [], help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") out.apply = true;
    else if (args[i] === "--files") {
      while (args[i + 1] && !args[i + 1].startsWith("--")) {
        out.files.push(args[++i]);
      }
    } else if (args[i] === "-h" || args[i] === "--help") out.help = true;
  }
  return out;
}

function discoverFromGit() {
  // Find candidate TSX files under frontend/app that mention the offending tokens.
  // grep through git ls-files is fast and respects .gitignore.
  const cmd =
    "git ls-files 'frontend/app/**/*.tsx' | xargs -P 4 grep -lE 'border-(l|r)-(2|4|8)' 2>/dev/null";
  try {
    const out = execSync(cmd, { encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// Strip side-border + adjacent paired color from a single className string.
// Returns { next, changed }.
function stripFromClassName(value) {
  let s = value;
  let changed = false;

  // Remove side borders.
  s = s.replace(SIDE_BORDER_RE, (m) => {
    changed = true;
    return "";
  });

  // Remove orphan color shades that only made sense alongside the side border.
  // Heuristic: if the file now has a `border-{color}-{shade}` BUT no `border-{n}`
  // or `border` left in the same className AND no `border-{t,b,x,y}-{n}`, it's
  // an orphan — remove. (We don't want to remove colors used for other sides
  // or full borders.)
  const hasSurvivingBorder = /\bborder(?:-(?:t|b|x|y|2|4|8))?\b/.test(
    s.replace(TAILWIND_COLOR_SHADE_RE, ""),
  );
  if (!hasSurvivingBorder) {
    s = s.replace(TAILWIND_COLOR_SHADE_RE, (m) => {
      changed = true;
      return "";
    });
  }

  // Collapse multiple spaces and trim.
  s = s.replace(/\s+/g, " ").trim();
  return { next: s, changed };
}

// Heuristic: does a quoted string look like a Tailwind class list?
// Cheap check: has a space AND no characters that wouldn't appear in Tailwind.
function looksLikeClassList(s) {
  if (!s.includes(" ")) return false;
  if (/[<>;=()\n]/.test(s)) return false;
  return true;
}

// Process a single file. Returns { content, count, diff }.
function processFile(path) {
  const raw = readFileSync(path, "utf8");
  // Match className="..." and className={"..."} (single/double quotes, template literals
  // are not handled — flag them separately).
  // We capture the value between the opening and closing quote.
  const classNameRe =
    /(\bclassName\s*=\s*)(?:(["'])([^"']*?)\2|\{`([^`]*?)`\}|\{(["'])([^"']*?)\5\})/g;

  let count = 0;
  let next = raw.replace(classNameRe, (...m) => {
    const prefix = m[1];
    const dquote = m[2];
    const dvalue = m[3];
    const tvalue = m[4];
    const bquote = m[5];
    const bvalue = m[6];
    const oldValue = dvalue ?? tvalue ?? bvalue ?? "";
    const { next: newValue, changed } = stripFromClassName(oldValue);
    if (!changed) return m[0];
    count++;
    if (dvalue !== undefined) return `${prefix}${dquote}${newValue}${dquote}`;
    if (tvalue !== undefined) return `${prefix}\{\`${newValue}\`\}`;
    return `${prefix}\{${bquote}${newValue}${bquote}\}`;
  });

  // Second pass: standalone quoted string literals that look like Tailwind
  // class lists and contain a side-border token. Catches helper functions like
  // `return "border-l-4 border-green-500 pl-4"`.
  const standaloneRe = /(["'])((?:(?!\1).)*?\bborder-(?:l|r)-(?:2|4|8)\b(?:(?!\1).)*?)\1/g;
  next = next.replace(standaloneRe, (full, quote, value) => {
    if (!looksLikeClassList(value)) return full;
    const { next: newValue, changed } = stripFromClassName(value);
    if (!changed) return full;
    count++;
    return `${quote}${newValue}${quote}`;
  });

  return { content: next, count, changed: count > 0 };
}

function unifiedDiff(before, after, path) {
  // Use the system `diff -u` since we have it and don't want a JS diff library.
  const tmp1 = `/tmp/cm-side-tab-before-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tmp2 = `${tmp1}-after`;
  try {
    writeFileSync(tmp1, before);
    writeFileSync(tmp2, after);
    return execSync(
      `diff -u "${tmp1}" "${tmp2}" --label "a/${path}" --label "b/${path}" || true`,
      { encoding: "utf8" },
    );
  } finally {
    try {
      execSync(`rm -f "${tmp1}" "${tmp2}"`);
    } catch {}
  }
}

function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    stdout.write(
      "Usage: codemod-side-tab.mjs [--apply] [--files <file1> <file2>...]\n",
    );
    exit(0);
  }
  const files = args.files.length ? args.files : discoverFromGit();
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
