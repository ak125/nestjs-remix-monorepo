#!/usr/bin/env node
/**
 * scripts/registry/build-planning-registry.js — Layer 1 projection (PlanningEntry[]).
 *
 * Projects the monorepo's GitHub PRs into a machine-readable planning snapshot
 * consumed by the control-plane dashboard (PR-CP-3) and dependency graph (Etape 2).
 *
 * UNLIKE the 5 code builders (files/db/rpc/deps/runtime), this is a TIME-VARYING
 * external-state snapshot. It is therefore:
 *   - NOT part of the determinism-gated `registry:build` group
 *   - carries `meta.generatedAt`
 *   - degrades gracefully (V1-3): if `gh` is unavailable or unauthenticated,
 *     it writes an empty snapshot with `meta.degraded = true` instead of throwing.
 *
 * SoT note (ADR-053): the canonical chantier/EPIC source is the vault
 * MOC-Planning-Live. This file is a monorepo-local PR projection, subordinate to
 * that SoT (declared in meta.sot). It is NOT a competing chantier tracker.
 *
 * work_type + priority are read from PR labels per the canonical vault schemas
 * (.spec/00-canon/planning/planning-worktype.yml + planning-priority.yml).
 *
 * Usage:
 *   node scripts/registry/build-planning-registry.js [--quiet]
 *
 * Output: audit/registry/planning.json
 */
"use strict";

const path = require("path");
const { execFileSync } = require("child_process");
const {
  REGISTRY_DIR,
  SCHEMA_VERSION,
  writeDeterministicJson,
  sortById,
  makeLogger,
} = require("./lib/utils");

const log = makeLogger("planning");

const REPO = "ak125/nestjs-remix-monorepo";
const SOT_POINTER = "vault:MOC-Planning-Live (ADR-053) — chantier/EPIC SoT; this file is a PR projection";
const FETCH_LIMIT = 200;

const VALID_WORKTYPES = new Set([
  "runtime-critical",
  "emergency",
  "governance",
  "seo-runtime",
  "observability",
  "cleanup",
  "migration",
  "debt",
  "experiment",
]);
const PRIORITY_RE = /^P[0-8]$/;
const MAIN_BRANCHES = new Set(["main", "dev"]);

/**
 * Fetch open PRs via `gh`. Returns null on any failure (no gh, no token, network)
 * so the builder can degrade gracefully (V1-3 — never throw on external state).
 */
function fetchPullRequests() {
  try {
    const stdout = execFileSync(
      "gh",
      [
        "pr",
        "list",
        "--repo",
        REPO,
        "--state",
        "open",
        "--limit",
        String(FETCH_LIMIT),
        "--json",
        "number,title,url,state,isDraft,author,headRefName,baseRefName,createdAt,updatedAt,labels",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return JSON.parse(stdout);
  } catch (_err) {
    return null;
  }
}

/** Map GitHub PR state → canonical planning-status vocabulary. */
function mapStatus(pr) {
  if (pr.state === "MERGED") return "done";
  if (pr.state === "CLOSED") return "cancelled";
  if (pr.isDraft) return "in-progress";
  return "review"; // open + non-draft = awaiting review/merge
}

/** Read first P0..P8 label, default P5 (triage) if none. */
function mapPriority(labels) {
  for (const l of labels) {
    if (PRIORITY_RE.test(l.name)) return l.name;
  }
  return "P5";
}

/** Read first valid work_type label, null if none. */
function mapWorkType(labels) {
  for (const l of labels) {
    if (VALID_WORKTYPES.has(l.name)) return l.name;
  }
  return null;
}

function daysBetween(fromIso, toMs) {
  const fromMs = new Date(fromIso).getTime();
  if (Number.isNaN(fromMs)) return 0;
  return Math.max(0, Math.floor((toMs - fromMs) / 86_400_000));
}

/**
 * Pure deterministic transform: PR list + snapshot timestamp → registry object.
 * Exported for fixture-based testing (no live gh dependency).
 */
function buildRegistry(prs, nowMs) {
  const degraded = prs === null;
  const list = degraded ? [] : prs;

  const entries = list.map((pr) => {
    const labels = Array.isArray(pr.labels) ? pr.labels : [];
    return {
      schemaVersion: SCHEMA_VERSION,
      id: `github:${REPO}:pr:${pr.number}`,
      itemType: "PR",
      number: pr.number,
      title: pr.title || "",
      url: pr.url || "",
      status: mapStatus(pr),
      priority: mapPriority(labels),
      workType: mapWorkType(labels),
      author: (pr.author && pr.author.login) || "unknown",
      headRef: pr.headRefName || "",
      baseRef: pr.baseRefName || "",
      isDraft: Boolean(pr.isDraft),
      isStack: Boolean(pr.baseRefName) && !MAIN_BRANCHES.has(pr.baseRefName),
      createdAt: pr.createdAt || "",
      updatedAt: pr.updatedAt || "",
      ageDays: pr.createdAt ? daysBetween(pr.createdAt, nowMs) : 0,
      stalenessDays: pr.updatedAt ? daysBetween(pr.updatedAt, nowMs) : 0,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-planning-registry.js",
    meta: {
      generatedAt: new Date(nowMs).toISOString(),
      source: "github_pulls",
      sot: SOT_POINTER,
      repo: REPO,
      degraded,
      prCount: entries.length,
    },
    entries: sortById(entries),
  };
}

function main() {
  const prs = fetchPullRequests();
  if (prs === null) {
    log("⚠️  gh unavailable/unauthenticated — writing degraded empty snapshot (V1-3)");
  } else {
    log(`fetched ${prs.length} open PRs from ${REPO}`);
  }

  const output = buildRegistry(prs, Date.now());
  const outPath = path.join(REGISTRY_DIR, "planning.json");
  const sha = writeDeterministicJson(outPath, output);
  log(
    `wrote ${outPath} (${output.meta.prCount} entries, degraded=${output.meta.degraded}, sha256:${sha.slice(0, 12)})`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/planning] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main, buildRegistry, mapStatus, mapPriority, mapWorkType };
