#!/usr/bin/env tsx
/**
 * Dependency-Graph Ratchet — block-new CI gate (Étape 2 PR-DG-2).
 *
 * Consumes PR-DG-1's audit/registry/dependency-graph.json + the accepted
 * baseline at audit/baselines/dependency-graph-baseline.json. A "finding" is a
 * PR whose stack depth exceeds MAX_STACK_DEPTH (Étape 3 target = 2). The ratchet:
 *   added   = current_findings − baseline_findings  (must be empty → exit 0)
 *   removed = baseline_findings − current_findings  (informational — linearized)
 *
 * Existing deep stacks are grandfathered in the baseline; only NEW deep stacks
 * block. As Étape 3 linearizes stacks, the maintainer refreshes the baseline
 * downward (eventually to zero findings).
 *
 * Mirrors scripts/audit/check-contract-drift-ratchet.ts (PR-7a) exactly.
 *
 * Exit codes:
 *   0 — no new deep stacks (reductions or no-op OK, or degraded graph)
 *   1 — new deep stack(s) detected
 *   2 — invariant violation (missing files, schema mismatch)
 *
 * Refresh (`--refresh`) is MAINTAINER-ONLY MANUAL — never CI-wired.
 */
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const REPO_ROOT = process.cwd();
const GRAPH_PATH = join(REPO_ROOT, "audit/registry/dependency-graph.json");
const BASELINE_PATH = join(
  REPO_ROOT,
  "audit/baselines/dependency-graph-baseline.json",
);

/** Étape 3 target: stacks deeper than this are violations. */
export const MAX_STACK_DEPTH = 2;

// ── Schemas ──────────────────────────────────────────────────────────────
export const DgFindingSchema = z.object({
  kind: z.literal("stack_too_deep"),
  id: z.string().min(1), // "pr:N"
  depth: z.number().int().positive(),
});
export type DgFinding = z.infer<typeof DgFindingSchema>;

export const DgBaselineSchema = z.object({
  schemaVersion: z.literal("v1"),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdOnCommit: z.string().nullable(),
  sourcePr: z.number().int().positive().nullable(),
  mode: z.literal("block-new-only"),
  maxStackDepthTarget: z.number().int().positive(),
  findings: z.array(DgFindingSchema),
  notes: z.array(z.string()).default([]),
});
export type DgBaseline = z.infer<typeof DgBaselineSchema>;

const GraphNodeSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  depth: z.number().int(),
});
const GraphSchema = z
  .object({
    meta: z.object({ degraded: z.boolean() }).passthrough(),
    nodes: z.array(GraphNodeSchema),
  })
  .passthrough();
export type Graph = z.infer<typeof GraphSchema>;

// ── Pure functions ───────────────────────────────────────────────────────
export function extractFindings(graph: Graph): DgFinding[] {
  return graph.nodes
    .filter((n) => n.depth > MAX_STACK_DEPTH)
    .map((n) => ({ kind: "stack_too_deep" as const, id: n.id, depth: n.depth }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function diffFindings(
  current: DgFinding[],
  baseline: DgFinding[],
): { added: DgFinding[]; removed: DgFinding[] } {
  const baseIds = new Set(baseline.map((f) => f.id));
  const curIds = new Set(current.map((f) => f.id));
  const added = current
    .filter((f) => !baseIds.has(f.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const removed = baseline
    .filter((f) => !curIds.has(f.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { added, removed };
}

export function loadGraph(path: string): Graph {
  if (!existsSync(path)) {
    throw new Error(
      `dependency-graph.json missing at ${path}. Run: npm run registry:build:planning && npm run registry:build:dependency-graph`,
    );
  }
  const parsed = GraphSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) throw new Error(`Graph schema invalid: ${parsed.error.message}`);
  return parsed.data;
}

export function loadBaseline(path: string): DgBaseline {
  if (!existsSync(path)) {
    throw new Error(`Baseline missing at ${path}. Bootstrap via --refresh.`);
  }
  const parsed = DgBaselineSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) throw new Error(`Baseline schema invalid: ${parsed.error.message}`);
  return parsed.data;
}

function writeBaseline(path: string, baseline: DgBaseline): void {
  const json = JSON.stringify(baseline, null, 2) + "\n";
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, json, "utf8");
  renameSync(tmp, path);
}

// ── CLI ──────────────────────────────────────────────────────────────────
function main(): void {
  const refresh = process.argv.includes("--refresh");

  let graph: Graph;
  try {
    graph = loadGraph(GRAPH_PATH);
  } catch (e) {
    process.stderr.write(`::error::${(e as Error).message}\n`);
    process.exit(2);
  }

  // Degraded graph (planning.json unavailable in CI) → cannot assess, pass.
  if (graph.meta.degraded) {
    process.stdout.write(
      "OK: dependency-graph degraded (planning.json absent) — ratchet skipped.\n",
    );
    process.exit(0);
  }

  const current = extractFindings(graph);

  if (refresh) {
    const baseline: DgBaseline = {
      schemaVersion: "v1",
      createdAt: new Date().toISOString().slice(0, 10),
      createdOnCommit: process.env.GITHUB_SHA?.slice(0, 12) ?? null,
      sourcePr: null,
      mode: "block-new-only",
      maxStackDepthTarget: MAX_STACK_DEPTH,
      findings: current,
      notes: [
        "Grandfathers existing deep stacks; only NEW stack_too_deep findings block.",
        "Refresh downward as Étape 3 linearizes stacks (target: zero findings).",
      ],
    };
    writeBaseline(BASELINE_PATH, baseline);
    process.stdout.write(
      `Refreshed baseline: ${current.length} stack_too_deep finding(s) (depth > ${MAX_STACK_DEPTH}).\n`,
    );
    process.exit(0);
  }

  let baseline: DgBaseline;
  try {
    baseline = loadBaseline(BASELINE_PATH);
  } catch (e) {
    process.stderr.write(`::error::${(e as Error).message}\n`);
    process.exit(2);
  }

  const { added, removed } = diffFindings(current, baseline.findings);

  for (const f of removed) {
    process.stdout.write(`  ✓ linearized: ${f.id} (was depth ${f.depth})\n`);
  }

  if (added.length === 0) {
    process.stdout.write(
      `OK: no new deep stacks vs baseline (${current.length} grandfathered, ${removed.length} linearized).\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `::error::Dependency-graph ratchet — ${added.length} NEW stack(s) deeper than ${MAX_STACK_DEPTH}:\n`,
  );
  for (const f of added) {
    process.stderr.write(`  - ${f.id} (depth ${f.depth})\n`);
  }
  process.stderr.write(
    "Linearize the stack (rebase onto main / squash) or refresh the baseline if intentional.\n",
  );
  process.exit(1);
}

// Only run the CLI when invoked directly (not when imported by tests).
const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) main();
