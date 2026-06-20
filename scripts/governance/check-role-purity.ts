#!/usr/bin/env tsx
/**
 * check-role-purity.ts — Detect role-vocabulary contamination in source comments.
 *
 * Consumes the canonical SoT exported by `@repo/seo-roles/forbidden-overlap`
 * (function `getForbiddenOverlap(role)`). Each comment in source code that
 * names a canonical role and ALSO contains a term forbidden for that role is
 * reported as a contamination — the comment has drifted into another role's
 * territory.
 *
 * Doctrine references :
 *   - SoT (TS) : packages/seo-roles/src/forbidden-overlap.ts
 *   - Canon (prose) : .spec/00-canon/role-matrix.md
 *
 * Complementary to scripts/governance/check-cart-conversion-r-role.sh
 * (which scans .md files for R8 + cart/conversion vocabulary). This script
 * covers source code (.ts/.tsx) comments instead.
 *
 * Usage :
 *   tsx scripts/governance/check-role-purity.ts                # full scan (manual audit)
 *   tsx scripts/governance/check-role-purity.ts --staged       # only git-staged (pre-commit)
 *   tsx scripts/governance/check-role-purity.ts --changed-since=<ref>  # diff vs ref (CI on PR)
 *   tsx scripts/governance/check-role-purity.ts <files...>     # explicit list
 *
 * Per-file opt-out : add `// @role-purity-skip` anywhere in the file.
 * SoT file itself (forbidden-overlap.ts) is skipped via SKIP_PATTERNS — it
 * legitimately documents the forbidden vocabulary of every role.
 *
 * Default CI mode is `--changed-since=origin/main` so that the rule enforces
 * on net-new contaminations only — the existing codebase has a non-zero
 * baseline of legitimate cross-role documentation that we accept as-is.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import * as ts from "typescript";
import {
  getForbiddenOverlap,
  normalizeRoleId,
  normalizePhrase,
  type RoleId,
} from "@repo/seo-roles";

const REPO_ROOT = path.resolve(__dirname, "../..");

const DEFAULT_SCAN_ROOTS = ["frontend/app", "backend/src", "packages"];

// Matches `R0` to `R9`, optionally followed by an uppercase suffix (e.g. R8_VEHICLE).
// Captures the short form and the optional suffix separately.
const ROLE_MENTION_REGEX = /\b(R[0-9])(?:_([A-Z_]+))?\b/g;

// Skip the SoT files themselves and other surfaces that legitimately document
// or test the forbidden vocabulary across roles. Test files are skipped because
// they routinely reference both a role and its forbidden vocabulary as fixtures.
const SKIP_PATTERNS: readonly RegExp[] = [
  /^packages\/seo-roles\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)__tests__\//,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\.d\.ts$/,
  /^scripts\/governance\/check-role-purity\.ts$/,
];

// Admin operator dashboards (back-office) orchestrate / observe MULTIPLE R-roles
// by design — e.g. the SEO HUB layout and content-validation cockpits whose
// headers legitimately legend "R4 References et R5 Diagnostics". They render no
// public, role-bound SEO surface, so cross-role vocabulary in their comments is
// documentation, not contamination. Exempt them (the rule protects public
// content surfaces; `admin.*` routes are never one). Same intent as the existing
// SKIP_PATTERNS — kept as a distinct, named constant for review clarity.
const CROSS_ROLE_OPERATOR_SURFACES: readonly RegExp[] = [
  /^frontend\/app\/routes\/admin\./,
];

const OPT_OUT_DIRECTIVE = /\/\/\s*@role-purity-skip\b/;

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly role: RoleId;
  readonly term: string;
  readonly commentSnippet: string;
}

export function isSkipped(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  return (
    SKIP_PATTERNS.some((p) => p.test(normalized)) ||
    CROSS_ROLE_OPERATOR_SURFACES.some((p) => p.test(normalized))
  );
}

// Escape a string for safe interpolation into a RegExp source.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match a forbidden term at a WORD START (left boundary) instead of as a raw
// substring. `normalizePhrase` yields lowercased, accent-stripped,
// space-separated tokens, so the left edge of a token is `^` or whitespace.
// This prevents a short term being matched mid-word — e.g. "use" (usé/usure,
// R5 wear vocab) inside "car·ouse·l" or "be·cause" — while leaving the right
// edge unanchored so inflections still match ("diagnostic" in "diagnostics")
// and multi-word phrases ("guide d achat") match as before.
const TERM_REGEX_CACHE = new Map<string, RegExp>();

function commentContainsTerm(
  normalizedComment: string,
  normalizedTerm: string,
): boolean {
  if (normalizedTerm.length === 0) return false;
  let re = TERM_REGEX_CACHE.get(normalizedTerm);
  if (!re) {
    // Non-global → stateless `.test()`, safe to memoize and reuse.
    re = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedTerm)}`);
    TERM_REGEX_CACHE.set(normalizedTerm, re);
  }
  return re.test(normalizedComment);
}

function collectFilesRecursive(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === ".next" ||
        entry.name === "__tests__"
      ) {
        continue;
      }
      collectFilesRecursive(full, out);
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(d\.ts|test\.tsx?|spec\.tsx?)$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
}

// Conservative git-ref validation : alphanumerics, `/`, `_`, `-`, `.` (1..255 chars).
// Stricter than `git check-ref-format` on purpose — refuses leading dashes,
// double-dots, `@{`, and any shell metacharacter. Defence-in-depth against
// argv injection ; combined with spawnSync (no shell), this neutralises
// CodeQL's "Indirect uncontrolled command line" finding.
const SAFE_GIT_REF = /^(?!-)[A-Za-z0-9_./-]{1,255}$/;

function gitDiffNames(args: readonly string[]): string[] {
  // spawnSync with explicit `shell: false` (default) — argv is passed as an
  // array, never concatenated into a shell command line. No injection surface.
  const result = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0 || typeof result.stdout !== "string") return [];
  return result.stdout.split("\n").filter(Boolean);
}

function resolveCandidateFiles(argv: string[]): string[] {
  if (argv.includes("--staged")) {
    return gitDiffNames([
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMR",
      "--",
      "*.ts",
      "*.tsx",
    ]);
  }

  const changedSinceFlag = argv.find((a) => a.startsWith("--changed-since="));
  if (changedSinceFlag) {
    const base = changedSinceFlag.slice("--changed-since=".length);
    if (!SAFE_GIT_REF.test(base)) {
      console.error(
        `check-role-purity: --changed-since=<ref> rejected — '${base}' does not match safe git ref pattern (${SAFE_GIT_REF}).`,
      );
      process.exit(2);
    }
    return gitDiffNames([
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      `${base}...HEAD`,
      "--",
      "*.ts",
      "*.tsx",
    ]);
  }

  const explicit = argv.filter((a) => !a.startsWith("--"));
  if (explicit.length > 0) return explicit;

  const collected: string[] = [];
  for (const root of DEFAULT_SCAN_ROOTS) {
    collectFilesRecursive(path.join(REPO_ROOT, root), collected);
  }
  return collected.map((f) => path.relative(REPO_ROOT, f));
}

function extractComments(
  source: string,
): Array<{ text: string; pos: number }> {
  const comments: Array<{ text: string; pos: number }> = [];
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.JSX,
    source,
  );
  let kind: ts.SyntaxKind;
  while ((kind = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (
      kind === ts.SyntaxKind.SingleLineCommentTrivia ||
      kind === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      comments.push({
        text: scanner.getTokenText(),
        pos: scanner.getTokenStart(),
      });
    }
  }
  return comments;
}

function lineColumnFromPos(
  source: string,
  pos: number,
): { line: number; column: number } {
  const before = source.slice(0, pos);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function checkSource(filePath: string, source: string): Violation[] {
  if (OPT_OUT_DIRECTIVE.test(source)) return [];

  const violations: Violation[] = [];
  const comments = extractComments(source);

  for (const comment of comments) {
    const text = comment.text;
    const normalizedComment = normalizePhrase(text);

    const roleIdsInComment = new Set<RoleId>();
    ROLE_MENTION_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ROLE_MENTION_REGEX.exec(text)) !== null) {
      const short = match[1];
      const suffix = match[2];
      const candidate = suffix ? `${short}_${suffix}` : short;
      const role = normalizeRoleId(candidate);
      if (role) roleIdsInComment.add(role);
    }

    // Heuristic : a comment that names 3+ distinct roles is a multi-role
    // documentation block (architecture overview, dispatch table, link matrix,
    // validator that handles every role). It legitimately mentions cross-role
    // vocabulary while describing the system. Skip the cross-check for these —
    // single-role contamination (1-2 roles) is where the signal lives.
    if (roleIdsInComment.size >= 3) continue;

    for (const role of roleIdsInComment) {
      const forbidden = getForbiddenOverlap(role);
      for (const term of forbidden) {
        const normalizedTerm = normalizePhrase(term);
        if (normalizedTerm.length === 0) continue;
        if (commentContainsTerm(normalizedComment, normalizedTerm)) {
          const { line, column } = lineColumnFromPos(source, comment.pos);
          violations.push({
            file: filePath,
            line,
            column,
            role,
            term,
            commentSnippet: text.split("\n")[0].slice(0, 120),
          });
          break;
        }
      }
    }
  }

  return violations;
}

function main(): void {
  const argv = process.argv.slice(2);
  const candidates = resolveCandidateFiles(argv);
  const files = candidates.filter((f) => !isSkipped(f));

  if (files.length === 0) {
    console.log("check-role-purity: no candidate files to scan.");
    process.exit(0);
  }

  let totalViolations = 0;
  for (const file of files) {
    const absPath = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
    let source: string;
    try {
      source = fs.readFileSync(absPath, "utf8");
    } catch {
      continue;
    }
    const violations = checkSource(file, source);
    for (const v of violations) {
      console.error(
        `${v.file}:${v.line}:${v.column} — role '${v.role}' comment contains forbidden term '${v.term}'`,
      );
      console.error(`    comment : ${v.commentSnippet}`);
    }
    totalViolations += violations.length;
  }

  if (totalViolations > 0) {
    console.error("");
    console.error(
      `❌ ${totalViolations} role-vocabulary contamination(s) detected in source comments.`,
    );
    console.error(
      "Canon : @repo/seo-roles forbidden-overlap.ts — see .spec/00-canon/role-matrix.md.",
    );
    console.error(
      "Opt-out (use sparingly) : add `// @role-purity-skip` to the file.",
    );
    process.exit(1);
  }

  console.log(
    `✓ check-role-purity: ${files.length} file(s) scanned, no contamination detected.`,
  );
}

if (require.main === module) {
  main();
}
