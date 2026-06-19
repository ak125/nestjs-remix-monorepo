#!/usr/bin/env tsx
/**
 * partition-cron-gap — deterministic runtime-truth runner (Trust Ledger PR-B0a).
 *
 * Detects RANGE-partitioned tables about to exhaust their pre-made partitions
 * (→ "no partition found for row", incidents #697/#698). Faithful deterministic
 * port of `.claude/skills/runtime-truth-audit/checks/partition-cron-gap.md`.
 *
 * Catalog access via the governed read-only RPC `__gov_m8_partition_coverage()`
 * (extends `__gov_*`) through the existing supabase-js layer. Report-only.
 * Classification is PURE (testable without a live DB). Low-false-positive: a
 * DEFAULT partition is a safety net (no "not found" possible), and a table with
 * comfortable margin + a rotation cron is healthy.
 */
import {
  getServiceClient,
  gitSourceCommit,
  makeResult,
  writeResult,
  type RpcClient,
} from "./runner.ts";
import {
  healthFromFindings,
  type RuntimeTruthFinding,
  type RuntimeTruthResult,
} from "./contract.ts";

export const CHECK_NAME = "partition-cron-gap";
const GOV_RPC = "__gov_m8_partition_coverage";

/** Imminent exhaustion (no safety net) ⇒ critical. */
const CRITICAL_DAYS = 2;
/** Low margin AND no rotation cron at all ⇒ high. */
const HIGH_DAYS = 7;

/** One row of `__gov_m8_partition_coverage()`. */
export interface PartitionRow {
  parent_table: string;
  n_partitions: number;
  has_default: boolean;
  max_upper_bound: string | null;
  days_remaining: number | null;
  has_rotation_cron: boolean;
}

/** PURE: classify RPC rows → findings + evidence. Deterministic (sorted). */
export function classifyPartitionGaps(rows: PartitionRow[]): {
  findings: RuntimeTruthFinding[];
  evidence: Record<string, unknown>;
} {
  const findings: RuntimeTruthFinding[] = [];
  for (const r of rows) {
    if (r.has_default) continue; // default partition = safety net, cannot 404-on-insert
    const days = r.days_remaining;
    if (days === null) continue; // unparseable bound — skip (don't guess)
    if (days < CRITICAL_DAYS) {
      findings.push({
        id: `partition-imminent:${r.parent_table}`,
        severity: "critical",
        title: `${r.parent_table}: only ${days}d of partitions left, no DEFAULT — imminent "no partition found"`,
        detail: { table: r.parent_table, days_remaining: days, max_upper_bound: r.max_upper_bound, has_rotation_cron: r.has_rotation_cron },
        fix_hint: `pre-make partitions now + verify the rotation cron for ${r.parent_table}`,
      });
    } else if (days < HIGH_DAYS && !r.has_rotation_cron) {
      findings.push({
        id: `partition-no-cron:${r.parent_table}`,
        severity: "high",
        title: `${r.parent_table}: ${days}d left, no DEFAULT and no partition-maintenance cron found`,
        detail: { table: r.parent_table, days_remaining: days, max_upper_bound: r.max_upper_bound },
        fix_hint: `schedule a pg_cron rotation job (maintain_*/ensure_next_*) for ${r.parent_table}`,
      });
    }
  }
  findings.sort((a, b) => a.id.localeCompare(b.id));
  return {
    findings,
    evidence: {
      scanned: rows.length,
      at_risk: findings.length,
      with_default: rows.filter((r) => r.has_default).length,
      tightest_no_default_days: rows
        .filter((r) => !r.has_default && r.days_remaining !== null)
        .reduce<number | null>((m, r) => (m === null ? r.days_remaining! : Math.min(m, r.days_remaining!)), null),
    },
  };
}

export interface RunOpts {
  repoRoot?: string;
  nowIso?: string;
  client?: RpcClient | null;
  sourceCommit?: string;
}

export async function runPartitionCronGap(
  opts: RunOpts = {},
): Promise<{ result: RuntimeTruthResult } | { skipped: "no-creds" }> {
  const repoRoot = opts.repoRoot ?? process.env.REPO_ROOT ?? process.cwd();
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const sourceCommit = opts.sourceCommit ?? gitSourceCommit(repoRoot);
  const client = opts.client === undefined ? await getServiceClient() : opts.client;

  if (!client) return { skipped: "no-creds" };

  const { data, error } = await client.rpc(GOV_RPC);
  if (error) {
    return {
      result: makeResult({
        check_name: CHECK_NAME,
        generated_at: nowIso,
        source_commit: sourceCommit,
        coverage_status: "RECURRING",
        health_status: "UNKNOWN",
        findings: [],
        freshness: "live",
        evidence: { error: error.message, hint: `apply migration adding ${GOV_RPC}()` },
      }),
    };
  }

  const rows = (Array.isArray(data) ? data : []) as PartitionRow[];
  const { findings, evidence } = classifyPartitionGaps(rows);
  return {
    result: makeResult({
      check_name: CHECK_NAME,
      generated_at: nowIso,
      source_commit: sourceCommit,
      coverage_status: "RECURRING",
      health_status: healthFromFindings(findings),
      findings,
      freshness: "live",
      evidence,
    }),
  };
}

// ── CLI entry ──────────────────────────────────────────────────────────────
const isMain =
  typeof process.argv[1] === "string" && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runPartitionCronGap()
    .then((r) => {
      if ("skipped" in r) {
        console.error(`::warning::${CHECK_NAME} skipped (${r.skipped}) — no SUPABASE creds`);
        process.exit(0);
      }
      const path = writeResult(process.env.REPO_ROOT ?? process.cwd(), r.result);
      console.log(
        `✓ ${CHECK_NAME}: health=${r.result.health_status} findings=${r.result.findings.length} → ${path}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(`::warning::${CHECK_NAME} caught: ${err?.message}`);
      process.exit(0);
    });
}
