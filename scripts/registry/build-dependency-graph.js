#!/usr/bin/env node
/**
 * scripts/registry/build-dependency-graph.js — Layer 1 projection (PR-stack DAG).
 *
 * Quantifies WIP stack saturation for Etape 3 (target maxStackDepth <= 2).
 * Derived PURELY from audit/registry/planning.json (headRef/baseRef) — no extra
 * `gh` fetch.
 *
 * Anti-duplication (V1): the module import graph already lives in files.json
 * (imports/importedBy) and module cycle detection is owned by `npm run
 * audit:madge`. This builder does NOT recompute either. The PR↔module/domain
 * join (needs per-PR changed files) is a documented follow-up.
 *
 * Like planning.json this is a TIME-VARYING snapshot: kept OUT of the
 * determinism-gated `registry:build` group, gitignored, carries meta.generatedAt.
 * Degrades gracefully (V1-3) when planning.json is absent/degraded.
 *
 * Usage: node scripts/registry/build-dependency-graph.js [--quiet]
 * Output: audit/registry/dependency-graph.json
 */
"use strict";

const path = require("path");
const {
  REGISTRY_DIR,
  SCHEMA_VERSION,
  writeDeterministicJson,
  readJsonSafe,
  sortById,
  makeLogger,
} = require("./lib/utils");

const log = makeLogger("dep-graph");

const TRUNK_BRANCHES = new Set(["main", "dev"]);
const MAX_DEPTH_GUARD = 50; // defensive cap against malformed cycles

/**
 * Pure transform: planning doc (or null) + snapshot ts → dependency graph.
 * Exported for fixture-based testing.
 */
function buildGraph(planning, nowMs) {
  const degraded =
    !planning || planning.meta?.degraded || !Array.isArray(planning.entries);
  const prs = degraded ? [] : planning.entries;

  // Index PRs by their head branch to resolve stack parents.
  const byHead = new Map();
  for (const pr of prs) {
    if (pr.headRef) byHead.set(pr.headRef, pr);
  }

  const parentOf = (pr) => {
    if (!pr.baseRef || TRUNK_BRANCHES.has(pr.baseRef)) return null;
    const parent = byHead.get(pr.baseRef);
    return parent && parent.number !== pr.number ? parent : null;
  };

  // Depth = stack height (1 = directly on a trunk branch). Guarded against cycles.
  const depthCache = new Map();
  const computeDepth = (pr) => {
    if (depthCache.has(pr.number)) return depthCache.get(pr.number);
    let depth = 1;
    const seen = new Set([pr.number]);
    let cur = parentOf(pr);
    while (cur && !seen.has(cur.number) && depth < MAX_DEPTH_GUARD) {
      depth += 1;
      seen.add(cur.number);
      cur = parentOf(cur);
    }
    depthCache.set(pr.number, depth);
    return depth;
  };

  const nodes = prs.map((pr) => ({
    id: `pr:${pr.number}`,
    number: pr.number,
    headRef: pr.headRef || "",
    baseRef: pr.baseRef || "",
    status: pr.status || "",
    workType: pr.workType ?? null,
    depth: computeDepth(pr),
  }));

  const edges = [];
  for (const pr of prs) {
    const parent = parentOf(pr);
    if (parent) {
      edges.push({ from: `pr:${pr.number}`, to: `pr:${parent.number}`, kind: "stacks-on" });
    }
  }

  const stackCount = edges.length; // each stacked PR contributes one parent edge
  const maxStackDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-dependency-graph.js",
    meta: {
      generatedAt: new Date(nowMs).toISOString(),
      source: "planning.json",
      degraded,
      prCount: nodes.length,
    },
    nodes: sortById(nodes),
    edges: edges.sort((a, b) =>
      a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : 1,
    ),
    metrics: { prCount: nodes.length, stackCount, maxStackDepth },
    invariants: { maxStackDepth },
  };
}

function main() {
  const planning = readJsonSafe(path.join(REGISTRY_DIR, "planning.json"));
  if (!planning) {
    log("⚠️  planning.json absent — degraded empty graph (run registry:build:planning first)");
  }
  const output = buildGraph(planning, Date.now());
  const outPath = path.join(REGISTRY_DIR, "dependency-graph.json");
  const sha = writeDeterministicJson(outPath, output);
  log(
    `wrote ${outPath} (${output.metrics.prCount} PRs, ${output.metrics.stackCount} stacked, maxDepth=${output.metrics.maxStackDepth}, degraded=${output.meta.degraded}, sha256:${sha.slice(0, 12)})`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/dep-graph] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main, buildGraph };
