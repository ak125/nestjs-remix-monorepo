#!/usr/bin/env node
/**
 * scripts/registry/check-new-files.js — Phase 2 gate logic.
 *
 * Used by CI (`.github/workflows/registry-new-file-gate.yml`) and by
 * pre-push hook. For each newly-added file (since the PR base or last push),
 * verifies BOTH conditions per ADR-058 §PR-G :
 *
 *   1. **Owner resolved** : file path matches ≥ 1 glob in ownership.yaml
 *   2. **Domain resolved** : either the matched ownership entry carries
 *      a `domain` field (D1..D15) OR a domains.yaml glob matches
 *      independently.
 *
 * Emits 4 verdicts per file :
 *   - `ok`            — both checks pass
 *   - `missing_owner` — no ownership glob matches
 *   - `missing_domain`— ownership glob matches but no domain (and domains.yaml
 *                       fallback also empty)
 *   - `missing_both`  — neither
 *
 * Exception paths (never gated, always `ok`) :
 *   - audit/registry/...     (Layer 1 + Layer 3 generated outputs)
 *   - any *.test.ts          (test files)
 *   - any *.spec.ts          (spec files)
 *   - .changeset/...         (changeset metadata)
 *   - any __tests__ folder   (test fixtures dir)
 *
 * Usage :
 *   node scripts/registry/check-new-files.js [--base <ref>] [--quiet] [--json]
 *
 *   --base <ref>  : git ref to diff against (default: origin/main)
 *   --json        : emit JSON report on stdout instead of human summary
 *   --quiet       : suppress per-file log lines
 *
 * Exit codes :
 *   0 — all new files pass
 *   1 — at least one new file failed gate
 *   2 — internal error (missing overlay, git failure)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// Validate git ref name : prevent command-injection via argv `--base` (CodeQL).
// Allows alphanumerics, slash, dot, dash, underscore, tilde — covers
// `origin/main`, `main~5`, `refs/heads/foo-bar`, sha hex, etc. Rejects
// spaces, shell metachars, control chars.
const GIT_REF_RE = /^[A-Za-z0-9_./~^-]+$/;
function validateRef(ref) {
  if (typeof ref !== "string" || !GIT_REF_RE.test(ref) || ref.length > 200) {
    throw new Error(
      `Invalid git ref "${ref}" — must match ${GIT_REF_RE} (≤ 200 chars)`
    );
  }
  return ref;
}
const yaml = require("js-yaml");
const micromatch = require("micromatch");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const OVERLAY_DIR = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry"
);

const EXCEPTION_GLOBS = [
  "audit/registry/**",
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/__tests__/**",
  ".changeset/**",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { base: "origin/main", json: false, quiet: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base") out.base = args[++i];
    else if (args[i] === "--json") out.json = true;
    else if (args[i] === "--quiet") out.quiet = true;
  }
  return out;
}

function loadOverlay() {
  const ownership = yaml.load(
    fs.readFileSync(path.join(OVERLAY_DIR, "ownership.yaml"), "utf8")
  );
  const domains = yaml.load(
    fs.readFileSync(path.join(OVERLAY_DIR, "domains.yaml"), "utf8")
  );
  return {
    ownership: ownership.entries || [],
    domains: domains.entries || [],
  };
}

function findOwnershipMatch(filePath, ownershipEntries) {
  // Longest glob wins (most specific)
  let best = null;
  let bestLen = -1;
  for (const entry of ownershipEntries) {
    if (micromatch.isMatch(filePath, entry.glob)) {
      if (entry.glob.length > bestLen) {
        best = entry;
        bestLen = entry.glob.length;
      }
    }
  }
  return best;
}

function findDomainMatch(filePath, domainEntries) {
  for (const d of domainEntries) {
    for (const g of d.globs || []) {
      if (micromatch.isMatch(filePath, g)) return d;
    }
  }
  return null;
}

function isExceptionPath(filePath) {
  return micromatch.isMatch(filePath, EXCEPTION_GLOBS);
}

function classify(filePath, overlay) {
  if (isExceptionPath(filePath)) {
    return { verdict: "ok", reason: "exception path" };
  }

  const own = findOwnershipMatch(filePath, overlay.ownership);
  const dom = findDomainMatch(filePath, overlay.domains);

  const hasOwner = own != null;
  // domain resolved if : (a) ownership glob carries domain, or (b) domains.yaml glob matches
  const hasDomain = (own && own.domain && own.domain !== "UNKNOWN") || (dom != null);

  if (hasOwner && hasDomain) {
    const resolvedDomain = own.domain && own.domain !== "UNKNOWN" ? own.domain : dom.id;
    return {
      verdict: "ok",
      ownerGlob: own.glob,
      owner: own.owner,
      domain: resolvedDomain,
    };
  }
  if (!hasOwner && !hasDomain) {
    return { verdict: "missing_both" };
  }
  if (!hasOwner) {
    // domain resolved via domains.yaml but no ownership entry
    return { verdict: "missing_owner", domain: dom ? dom.id : "UNKNOWN" };
  }
  // owner found but domain UNKNOWN (or ownership glob has no domain field)
  return {
    verdict: "missing_domain",
    ownerGlob: own.glob,
    owner: own.owner,
  };
}

function getNewFiles(baseRef) {
  // Validate argv input BEFORE passing to child process — CodeQL command-injection guard
  const safeRef = validateRef(baseRef);

  // execFileSync uses arg array (no shell), so even if validation slips,
  // the ref would be a literal argv not a shell-interpreted string.
  try {
    const out = execFileSync(
      "git",
      ["diff", "--diff-filter=A", "--name-only", `${safeRef}..HEAD`],
      { encoding: "utf8", cwd: MONOREPO_ROOT }
    );
    return out.split("\n").filter(Boolean);
  } catch (err) {
    // Fallback : if baseRef inaccessible, try a merge-base
    try {
      const mb = execFileSync(
        "git",
        ["merge-base", "HEAD", safeRef],
        { encoding: "utf8", cwd: MONOREPO_ROOT }
      ).trim();
      const out = execFileSync(
        "git",
        ["diff", "--diff-filter=A", "--name-only", `${mb}..HEAD`],
        { encoding: "utf8", cwd: MONOREPO_ROOT }
      );
      return out.split("\n").filter(Boolean);
    } catch (err2) {
      throw new Error(
        `Cannot compute new files diff vs ${safeRef}: ${err.message}`
      );
    }
  }
}

function main() {
  const args = parseArgs();
  const log = args.quiet ? () => {} : (m) => process.stderr.write(`[check-new-files] ${m}\n`);

  const overlay = loadOverlay();
  const newFiles = getNewFiles(args.base);
  log(`evaluating ${newFiles.length} new files (added since ${args.base})`);

  const results = newFiles.map((f) => ({ path: f, ...classify(f, overlay) }));

  const failures = results.filter((r) => r.verdict !== "ok");
  const successes = results.filter((r) => r.verdict === "ok");

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          base: args.base,
          totalNew: newFiles.length,
          ok: successes.length,
          missing_owner: failures.filter((r) => r.verdict === "missing_owner").length,
          missing_domain: failures.filter((r) => r.verdict === "missing_domain").length,
          missing_both: failures.filter((r) => r.verdict === "missing_both").length,
          results,
        },
        null,
        2
      ) + "\n"
    );
  } else {
    log(`new files: ${newFiles.length} (${successes.length} ok, ${failures.length} failures)`);
    if (failures.length === 0) {
      log(`✓ All new files pass owner+domain gate`);
    } else {
      process.stderr.write(`\n[check-new-files] ${failures.length} failure(s) :\n`);
      for (const f of failures) {
        process.stderr.write(`  [${f.verdict.toUpperCase()}] ${f.path}\n`);
      }
      process.stderr.write(`\nFix : add a glob in .spec/00-canon/repository-registry/ownership.yaml\n`);
      process.stderr.write(`covering these paths, OR mark the path as an exception if appropriate.\n`);
      process.stderr.write(`Reference : ADR-058 §PR-G + CLAUDE.md "Registry Lookup First".\n`);
    }
  }

  return failures.length === 0 ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    process.stderr.write(`[check-new-files] FAILED: ${err.message}\n`);
    process.exit(2);
  }
}

module.exports = { classify, findOwnershipMatch, findDomainMatch, isExceptionPath };
