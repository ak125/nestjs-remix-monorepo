#!/usr/bin/env node
/**
 * scripts/audit/check-no-auto-bump.js
 *
 * BLOCKING gate : refuses PRs from bot actors that modify `last_verified_at`
 * in `.spec/00-canon/repository-registry/automation-reality.yaml`.
 *
 * Bot actors (heuristic) :
 *   - login ends with `[bot]` (GitHub Apps convention)
 *   - login is in known bot list (dependabot, renovate, github-actions)
 *
 * Fail-safe : if env vars are unavailable, exit 0 (anti-flake — never block
 * a real merge on a missing signal, even at the cost of letting a bot
 * through if CI metadata is incomplete).
 *
 * Required env :
 *   GITHUB_ACTOR — PR author login
 *   BASE_SHA / HEAD_SHA — for git diff (optional ; falls back to staged diff)
 *
 * Usage:
 *   GITHUB_ACTOR=dependabot[bot] BASE_SHA=abc HEAD_SHA=def \
 *     node scripts/audit/check-no-auto-bump.js
 *
 * Exit codes :
 *   0 : not a bot OR no bump OR signal unavailable
 *   1 : bot attempted to bump last_verified_at — block merge
 */
"use strict";

const { execFileSync } = require("child_process");

const actor = process.env.GITHUB_ACTOR || "";
const baseShaRaw = process.env.BASE_SHA || "";
const headShaRaw = process.env.HEAD_SHA || "HEAD";

// Strict allowlist : SHA = 40 hex OR "HEAD" OR "HEAD~N" (N=1..99).
// Prevents command injection via crafted env vars (CodeQL js/shell-command-injection).
const SHA_RE = /^[0-9a-f]{7,40}$/;
const SYMBOLIC_RE = /^HEAD(~\d{1,2})?$/;
function sanitizeRef(ref) {
  if (!ref) return null;
  if (SHA_RE.test(ref) || SYMBOLIC_RE.test(ref)) return ref;
  return null;
}
const baseSha = sanitizeRef(baseShaRaw);
const headSha = sanitizeRef(headShaRaw) || "HEAD";

const KNOWN_BOTS = ["dependabot[bot]", "renovate[bot]", "github-actions[bot]"];
const isBot = actor.endsWith("[bot]") || KNOWN_BOTS.includes(actor);

if (!actor) {
  process.stderr.write("[no-auto-bump] GITHUB_ACTOR unavailable — pass (anti-flake)\n");
  process.exit(0);
}

if (!isBot) {
  process.stderr.write(`[no-auto-bump] actor "${actor}" is not a bot — pass\n`);
  process.exit(0);
}

// Bot actor → check diff for last_verified_at bump
// Use execFileSync with arg array (no shell interpolation) — refs are
// already sanitized via SHA_RE/SYMBOLIC_RE allowlist above.
let diff = "";
try {
  const range = baseSha ? `${baseSha}..${headSha}` : "HEAD~1..HEAD";
  diff = execFileSync(
    "git",
    [
      "diff",
      range,
      "--",
      ".spec/00-canon/repository-registry/automation-reality.yaml",
    ],
    { encoding: "utf8" },
  );
} catch (err) {
  process.stderr.write(
    `[no-auto-bump] git diff failed (${err.message}) — pass (anti-flake)\n`,
  );
  process.exit(0);
}

if (!diff) {
  process.stderr.write(
    "[no-auto-bump] no changes to automation-reality.yaml in diff — pass\n",
  );
  process.exit(0);
}

// Look for added lines (^+) containing last_verified_at:
const addedLines = diff
  .split("\n")
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"));
const bumped = addedLines.some((line) => /last_verified_at\s*:/.test(line));

if (bumped) {
  process.stderr.write(
    `[no-auto-bump] FAIL — bot actor "${actor}" attempted to bump last_verified_at.\n`,
  );
  process.stderr.write(
    "  This field must be set by a human after re-verifying evidence + runtime_evidence.\n",
  );
  process.stderr.write(
    "  Bumping it from CI/bot turns the freshness ratchet into cosmetic noise.\n",
  );
  process.exit(1);
}

process.stderr.write(
  `[no-auto-bump] OK — bot "${actor}" did not bump last_verified_at\n`,
);
process.exit(0);
