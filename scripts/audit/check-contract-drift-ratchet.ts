#!/usr/bin/env tsx
/**
 * Contract Drift Ratchet — block-new CI gate (PR-7a, ADR-058 §23 ratchet step).
 *
 * Consumes PR-6's audit-reports/contract-health.json + the accepted baseline at
 * audit/baselines/contract-drift-baseline.json. Computes:
 *   added   = current_findings − baseline_findings  (must be empty → exit 0)
 *   removed = baseline_findings − current_findings  (informational, exit 0)
 *
 * Exit codes:
 *   0 — no new findings (reductions or no-op OK)
 *   1 — new findings detected
 *   2 — invariant violation (missing files, schema mismatch, etc.)
 *
 * Refresh (`--refresh`) is MAINTAINER-ONLY MANUAL — never CI-wired.
 * Mirrors `scripts/cleanup/audit-compare-baseline.js` canon (PR #267 / #449).
 */
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { z } from "zod";

const REPO_ROOT = process.cwd();
const HEALTH_PATH = join(REPO_ROOT, "audit-reports/contract-health.json");
const BASELINE_PATH = join(
  REPO_ROOT,
  "audit/baselines/contract-drift-baseline.json",
);

// ── Schemas ──────────────────────────────────────────────────────────────
export const FindingKindSchema = z.enum([
  "ownership_gap",
  "contract_invalid",
  "contract_missing",
  "canonical_stale",
]);
export type FindingKind = z.infer<typeof FindingKindSchema>;

export const FindingSchema = z.object({
  kind: FindingKindSchema,
  id: z.string().min(1),
});
export type Finding = z.infer<typeof FindingSchema>;

export const BaselineSchema = z.object({
  schemaVersion: z.literal("v1"),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdOnCommit: z.string().nullable(),
  sourcePr: z.number().int().positive().nullable(),
  mode: z.literal("block-new-only"),
  summary: z.record(FindingKindSchema, z.number().int().nonnegative()),
  findings: z.array(FindingSchema),
  notes: z.array(z.string()).default([]),
});
export type Baseline = z.infer<typeof BaselineSchema>;

const DashboardContractSchema = z.object({
  name: z.string(),
  file: z.string(),
  status: z.enum(["ok", "invalid", "missing"]),
  entries: z.number(),
  sha256: z.string(),
});

const DashboardSchema = z
  .object({
    schemaVersion: z.literal("v1"),
    contracts: z.array(DashboardContractSchema),
    fingerprint: z
      .object({
        canonical: z
          .object({
            stale: z.boolean(),
            staleReason: z.string().nullable().optional(),
          })
          .passthrough(),
      })
      .passthrough(),
    ownership: z.object({
      gapCount: z.number().int(),
      sample: z.array(z.string()),
      orphans: z.array(z.string()), // REQUIRED — landed in PR-6.1 (#544)
    }),
    coverage: z.record(z.unknown()),
  })
  .passthrough();
export type Dashboard = z.infer<typeof DashboardSchema>;

// ── Pure functions ───────────────────────────────────────────────────────
export function extractFindings(dashboard: Dashboard): Finding[] {
  const out: Finding[] = [];

  for (const path of dashboard.ownership.orphans) {
    out.push({ kind: "ownership_gap", id: path });
  }

  for (const c of dashboard.contracts) {
    if (c.status === "invalid") {
      out.push({ kind: "contract_invalid", id: c.name });
    }
    if (c.status === "missing") {
      out.push({ kind: "contract_missing", id: c.name });
    }
  }

  if (dashboard.fingerprint.canonical.stale) {
    out.push({ kind: "canonical_stale", id: "canonical" });
  }

  return out;
}

function keyOf(f: Finding): string {
  return `${f.kind}::${f.id}`;
}

export function diffFindings(
  current: Finding[],
  baseline: Finding[],
): { added: Finding[]; removed: Finding[] } {
  const baselineKeys = new Set(baseline.map(keyOf));
  const currentKeys = new Set(current.map(keyOf));

  const added = current
    .filter((f) => !baselineKeys.has(keyOf(f)))
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  const removed = baseline
    .filter((f) => !currentKeys.has(keyOf(f)))
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)));

  return { added, removed };
}

export function loadBaseline(path: string): Baseline {
  if (!existsSync(path)) {
    throw new Error(
      `Baseline missing at ${path}. Bootstrap via: npm run audit:contract-drift-ratchet:refresh`,
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const parsed = BaselineSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Baseline schema invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function loadDashboard(path: string): Dashboard {
  if (!existsSync(path)) {
    throw new Error(
      `Dashboard missing at ${path}. Run: npm run audit:drift-dashboard first.`,
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const parsed = DashboardSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Dashboard schema unexpected (schema invalid): ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function summarize(findings: Finding[]): Record<FindingKind, number> {
  const out: Record<FindingKind, number> = {
    ownership_gap: 0,
    contract_invalid: 0,
    contract_missing: 0,
    canonical_stale: 0,
  };
  for (const f of findings) out[f.kind]++;
  return out;
}

// ── Refresh (maintainer-only) ────────────────────────────────────────────
export function refresh(path: string, current: Finding[]): Baseline {
  const previous = existsSync(path) ? loadBaseline(path) : null;
  const sorted = [...current].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));

  // Set-based widening guard (catches rotation, not just length growth).
  // Visibility-only: never blocks (manual maintainer intent), but every
  // newly-accepted finding is logged. CI MUST NEVER invoke --refresh.
  if (previous) {
    const previousKeys = new Set(previous.findings.map(keyOf));
    const newlyAccepted = sorted.filter((f) => !previousKeys.has(keyOf(f)));
    if (newlyAccepted.length > 0) {
      process.stderr.write(
        `⚠️  Baseline widening: ${newlyAccepted.length} NEW finding(s) being accepted into the ceiling:\n`,
      );
      for (const f of newlyAccepted.slice(0, 20)) {
        process.stderr.write(`     + ${f.kind}: ${f.id}\n`);
      }
      if (newlyAccepted.length > 20) {
        process.stderr.write(
          `     … and ${newlyAccepted.length - 20} more.\n`,
        );
      }
      process.stderr.write(
        `    This is a maintainer-only manual action; widening requires explicit\n` +
          `    justification in the commit message and PR description.\n`,
      );
    }
  }

  // Idempotency: when the set is unchanged, preserve header fields so a
  // dry-run refresh produces zero diff (no noisy createdAt churn in review).
  const currentKeys = new Set(sorted.map(keyOf));
  const setChanged =
    !previous ||
    previous.findings.length !== currentKeys.size ||
    previous.findings.some((f) => !currentKeys.has(keyOf(f)));

  const next: Baseline = {
    schemaVersion: "v1",
    createdAt: setChanged
      ? new Date().toISOString().slice(0, 10)
      : previous!.createdAt,
    createdOnCommit: setChanged
      ? (process.env.GITHUB_SHA?.slice(0, 12) ??
        previous?.createdOnCommit ??
        null)
      : previous!.createdOnCommit,
    sourcePr: previous?.sourcePr ?? null,
    mode: "block-new-only",
    summary: summarize(sorted),
    findings: sorted,
    notes: previous?.notes ?? [
      "Accepted existing drift ceiling — DO NOT widen without ratchet-down justification.",
      "CI fails iff a NEW finding (current − baseline) appears.",
      "Reductions are always allowed and surfaced as 'resolved' in CI summary.",
      "Refresh via `npm run audit:contract-drift-ratchet:refresh` — MAINTAINER-ONLY MANUAL.",
    ],
  };

  // Atomic write: tmp + rename (mirrors PR #267 audit-compare-baseline.js canon).
  // A concurrent reader never sees a truncated baseline.
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
  return next;
}

// ── CLI ──────────────────────────────────────────────────────────────────
function main(): number {
  const args = new Set(process.argv.slice(2));
  const wantJson = args.has("--json");
  const wantRefresh = args.has("--refresh");

  const dashboard = loadDashboard(HEALTH_PATH);
  const currentFindings = extractFindings(dashboard);

  if (wantRefresh) {
    const next = refresh(BASELINE_PATH, currentFindings);
    process.stderr.write(
      `🔄 Baseline refreshed: ${next.findings.length} findings accepted as ceiling.\n`,
    );
    process.stderr.write(
      `   ⚠️  Maintainer-only manual action. Commit with a clear WHY in the message.\n`,
    );
    return 0;
  }

  const baseline = loadBaseline(BASELINE_PATH);
  const { added, removed } = diffFindings(currentFindings, baseline.findings);

  const report = {
    schemaVersion: "v1" as const,
    mode: baseline.mode,
    baselineCreatedAt: baseline.createdAt,
    counts: {
      baseline: baseline.findings.length,
      current: currentFindings.length,
      added: added.length,
      removed: removed.length,
    },
    added,
    removed,
    summaryByKind: {
      baseline: baseline.summary,
      current: summarize(currentFindings),
    },
  };

  if (wantJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return added.length > 0 ? 1 : 0;
  }

  if (added.length === 0) {
    process.stderr.write(
      `✅ Contract drift ratchet: 0 new findings (${currentFindings.length} current vs ${baseline.findings.length} accepted ceiling).\n`,
    );
    if (removed.length > 0) {
      process.stderr.write(
        `   📉 ${removed.length} historical finding(s) resolved. Consider maintainer refresh-down.\n`,
      );
    }
    return 0;
  }

  process.stderr.write(
    `❌ Contract drift ratchet: ${added.length} NEW finding(s) introduced by this change.\n\n`,
  );
  for (const f of added.slice(0, 50)) {
    process.stderr.write(`   + ${f.kind}: ${f.id}\n`);
  }
  if (added.length > 50) {
    process.stderr.write(`   … and ${added.length - 50} more.\n`);
  }
  process.stderr.write(
    `\n   Baseline created ${baseline.createdAt} (sourcePr=${baseline.sourcePr ?? "n/a"}).\n`,
  );
  process.stderr.write(
    `   Block-new mode: reductions always allowed; new findings are not.\n`,
  );
  process.stderr.write(
    `   Fix the new findings, OR (rarely) refresh the baseline manually:\n`,
  );
  process.stderr.write(`   $ npm run audit:contract-drift-ratchet:refresh\n`);
  return 1;
}

// Safe CLI guard: comparing resolved absolute paths avoids URL-encoding and
// trailing-slash corner cases of naive string templating.
const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    process.exit(main());
  } catch (err) {
    process.stderr.write(`💥 Ratchet aborted: ${(err as Error).message}\n`);
    process.exit(2);
  }
}
