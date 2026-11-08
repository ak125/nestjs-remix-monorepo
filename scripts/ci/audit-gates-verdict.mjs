#!/usr/bin/env node
// audit-gates-verdict — scope + verdict decisions for .github/workflows/audit.yml.
//
// The workflow runs on EVERY pull_request (no workflow-level `paths:` filter,
// which would leave out-of-scope PRs with no check at all). Three jobs:
//
//   changes  → dorny/paths-filter@v4 computes `in_scope` (the historical path
//              list, unchanged) and a catch-all `all` count; `scope` mode below
//              turns those step outputs into the job output `in_scope`.
//   audit    → "🛡️ Deterministic gates", unchanged, runs only when in scope.
//              Its steps also run audit-gates-verdict.test.mjs after `npm ci`.
//   verdict  → always runs; `verdict` mode below aggregates needs.*.result into
//              ONE stable final check (builtins only: no setup-node, no npm ci). Out of scope = explicit success labelled
//              "HORS PÉRIMÈTRE — AUDIT NON EXÉCUTÉ", never an executed audit.
//
// Fail-closed rules (zero false green):
//   - detection step not `success`               → fail
//   - `in_scope` not exactly "true" / "false"     → fail
//   - counts missing / malformed / unsafe integer → fail
//   - listing incomplete (seen < changed_files)   → forced IN scope (audit runs)
//   - changed_files ≥ 3000 (GitHub listing cap)   → forced IN scope (audit runs)
//   - in scope and audit result != success        → fail (failure/cancelled/skipped)
//   - out of scope and audit result != skipped    → fail (inconsistent)
//   - changes job result != success               → fail
//   - any unknown job result                      → fail
//
// This script never reads PR data from argv or a shell string: every input
// arrives through environment variables set in `env:` by the workflow.
//
// Usage (CI):
//   node scripts/ci/audit-gates-verdict.mjs scope    # env FILTER_OUTCOME, FILTER_IN_SCOPE,
//                                                     #     FILTER_ALL_COUNT, PR_CHANGED_FILES,
//                                                     #     GITHUB_OUTPUT
//   node scripts/ci/audit-gates-verdict.mjs verdict  # env CHANGES_RESULT, IN_SCOPE, AUDIT_RESULT,
//                                                     #     GITHUB_STEP_SUMMARY (optional)
// Builtins only (no npm install needed for these two modes).

import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BOOL = new Set(["true", "false"]);
const JOB_RESULTS = new Set(["success", "failure", "cancelled", "skipped"]);

// GitHub's "List pull request files" endpoint: "Responses include a maximum of
// 3000 files" (https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files;
// github/rest-api-description@2f8f80e47ea4). dorny/paths-filter v4 (tag v4 =
// v4.0.3, commit ceb8a2b8f2d8) pages through that endpoint (src/main.ts:208-220),
// lists a rename as the new path `added` plus the old path `deleted`
// (src/main.ts:230-240), counts `<filter>_count` over that expanded list
// (src/main.ts:274) and matches with picomatch `dot: true` (src/filter.ts:16), so
// `all: '**'` also counts dotfiles. At or above the cap, `all_count` can reach
// `changed_files` through rename double-counting while files are missing, so the
// `seen < changed` test alone cannot prove a complete listing.
export const GITHUB_PR_FILES_LISTING_CAP = 3000;

/**
 * Strict non-negative integer parse; anything else → null. Long digit strings
 * that Number() turns into an unsafe integer or Infinity are rejected too.
 */
function count(value) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Decide whether the PR is in the Deterministic gates scope.
 * @returns {{ok: true, inScope: boolean, reason: string} | {ok: false, reason: string}}
 */
export function decideScope({
  filterOutcome,
  filterInScope,
  filterAllCount,
  prChangedFiles,
}) {
  if (filterOutcome !== "success") {
    return {
      ok: false,
      reason: `path detection did not succeed (outcome=${JSON.stringify(filterOutcome ?? null)})`,
    };
  }
  if (!BOOL.has(filterInScope)) {
    return {
      ok: false,
      reason: `malformed in_scope output (${JSON.stringify(filterInScope ?? null)})`,
    };
  }
  const seen = count(filterAllCount);
  if (seen === null) {
    return {
      ok: false,
      reason: `malformed all_count output (${JSON.stringify(filterAllCount ?? null)})`,
    };
  }
  const changed = count(prChangedFiles);
  if (changed === null) {
    return {
      ok: false,
      reason: `malformed pull_request.changed_files (${JSON.stringify(prChangedFiles ?? null)})`,
    };
  }
  if (seen < changed) {
    return {
      ok: true,
      inScope: true,
      reason: `path listing incomplete (seen ${seen} < changed ${changed}) — treated as in scope`,
    };
  }
  if (changed >= GITHUB_PR_FILES_LISTING_CAP) {
    return {
      ok: true,
      inScope: true,
      reason: `changed ${changed} ≥ ${GITHUB_PR_FILES_LISTING_CAP} (GitHub file-listing cap; rename double-counting can hide truncation) — treated as in scope`,
    };
  }
  if (filterInScope === "true") {
    return {
      ok: true,
      inScope: true,
      reason: `in-scope path(s) among ${changed} changed file(s)`,
    };
  }
  return {
    ok: true,
    inScope: false,
    reason: `no in-scope path among ${changed} changed file(s)`,
  };
}

/**
 * Aggregate the job results into the final verdict.
 * @returns {{ok: true, ran: boolean, reason: string} | {ok: false, reason: string}}
 */
export function decideVerdict({ changesResult, inScope, auditResult }) {
  if (changesResult !== "success") {
    return {
      ok: false,
      reason: `scope job did not succeed (result=${JSON.stringify(changesResult ?? null)})`,
    };
  }
  if (!BOOL.has(inScope)) {
    return {
      ok: false,
      reason: `malformed in_scope job output (${JSON.stringify(inScope ?? null)})`,
    };
  }
  if (!JOB_RESULTS.has(auditResult)) {
    return {
      ok: false,
      reason: `unknown audit job result (${JSON.stringify(auditResult ?? null)})`,
    };
  }
  if (inScope === "true") {
    if (auditResult === "success") {
      return {
        ok: true,
        ran: true,
        reason: "Deterministic gates executed and green",
      };
    }
    return {
      ok: false,
      reason: `in scope but Deterministic gates result=${auditResult}`,
    };
  }
  if (auditResult === "skipped") {
    return {
      ok: true,
      ran: false,
      reason: "OUT OF SCOPE — Deterministic gates NOT executed",
    };
  }
  return {
    ok: false,
    reason: `inconsistent: out of scope but Deterministic gates result=${auditResult}`,
  };
}

/** CI entry point. Returns the process exit code. */
export function main(mode, env) {
  if (mode === "scope") {
    if (!env.GITHUB_OUTPUT) {
      console.log("::error::GITHUB_OUTPUT is not set — cannot publish in_scope");
      return 1;
    }
    const d = decideScope({
      filterOutcome: env.FILTER_OUTCOME,
      filterInScope: env.FILTER_IN_SCOPE,
      filterAllCount: env.FILTER_ALL_COUNT,
      prChangedFiles: env.PR_CHANGED_FILES,
    });
    if (!d.ok) {
      console.log(`::error::Deterministic gates scope: ${d.reason}`);
      return 1;
    }
    appendFileSync(env.GITHUB_OUTPUT, `in_scope=${d.inScope}\n`);
    console.log(
      `::notice::Deterministic gates scope: in_scope=${d.inScope} — ${d.reason}`,
    );
    return 0;
  }
  if (mode === "verdict") {
    const d = decideVerdict({
      changesResult: env.CHANGES_RESULT,
      inScope: env.IN_SCOPE,
      auditResult: env.AUDIT_RESULT,
    });
    let line;
    if (!d.ok) line = `❌ Deterministic gates — échec : ${d.reason}`;
    else if (d.ran) line = "✅ Deterministic gates exécutées et vertes";
    else
      line =
        "⚪ HORS PÉRIMÈTRE — AUDIT NON EXÉCUTÉ (aucun chemin du périmètre Deterministic gates modifié)";
    if (env.GITHUB_STEP_SUMMARY) {
      appendFileSync(env.GITHUB_STEP_SUMMARY, `### ${line}\n\n${d.reason}\n`);
    }
    if (!d.ok) {
      console.log(`::error::${line}`);
      return 1;
    }
    console.log(`::notice::${line}`);
    return 0;
  }
  console.log(
    `::error::unknown mode ${JSON.stringify(mode ?? null)} (expected scope|verdict)`,
  );
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv[2], process.env);
}
