#!/usr/bin/env tsx
/**
 * attribution-write-gap — deterministic runtime-truth runner (Trust Ledger PR-B0a).
 *
 * Detects attribution / tracking columns declared in the schema but never written
 * by runtime code (incident #695: `___order_lines.orl_website_url` written by 0
 * services). Faithful deterministic port of
 * `.claude/skills/runtime-truth-audit/checks/attribution-write-gap.md` (the skill
 * is the source of logic; this is SQL + targeted grep, NOT the LLM skill in CI).
 *
 * Two signals, intersected:
 *   1. Candidate columns + table write-traffic (n_tup_ins/n_tup_upd) via the
 *      governed read-only RPC `__gov_m11_attribution_columns()` (extends `__gov_*`).
 *   2. Per-column writer detection via a targeted grep of backend/src: a column
 *      counts as "written" only when a file that calls .insert/.update/.upsert ALSO
 *      keys that column — so pure type declarations and .select() reads never mask
 *      a real gap.
 *
 * Classification is PURE (testable without a live DB). Report-only: emits a
 * contract JSON, writes nothing to the DB. RPC absent (migration not yet applied)
 * ⇒ health UNKNOWN, never a crash.
 */
import { join } from "node:path";
import { execFileSync } from "node:child_process";
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

export const CHECK_NAME = "attribution-write-gap";
const GOV_RPC = "__gov_m11_attribution_columns";

/** One row of `__gov_m11_attribution_columns()`. */
export interface AttrColumnRow {
  table_name: string;
  column_name: string;
  n_tup_ins: number;
  n_tup_upd: number;
}

/**
 * PURE: classify RPC rows + per-column writer counts → findings + evidence.
 * Deterministic (sorted by table.column). A column with ≥1 writer is not a gap.
 * Gap with table traffic (n_tup_ins>0) ⇒ `unknown_writer` (medium: trigger /
 * extension / dynamic payload may write it). Gap with no traffic ⇒
 * `no_runtime_writer` (high: the #695 orphan class).
 */
export function classifyAttributionGaps(
  rows: AttrColumnRow[],
  writerCounts: Record<string, number>,
): { findings: RuntimeTruthFinding[]; evidence: Record<string, unknown> } {
  const gaps = rows
    .filter((r) => (writerCounts[r.column_name] ?? 0) === 0)
    .slice()
    .sort((a, b) =>
      `${a.table_name}.${a.column_name}`.localeCompare(`${b.table_name}.${b.column_name}`),
    );

  let noWriter = 0;
  let unknownWriter = 0;
  const findings: RuntimeTruthFinding[] = gaps.map((r) => {
    if (r.n_tup_ins > 0) {
      unknownWriter++;
      return {
        id: `attr-unknown-writer:${r.table_name}.${r.column_name}`,
        severity: "medium" as const,
        title: `${r.table_name}.${r.column_name} — attribution column receives inserts (n_tup_ins=${r.n_tup_ins}) but no backend writer keys it`,
        detail: {
          table: r.table_name,
          column: r.column_name,
          category: "unknown_writer",
          grep_count: 0,
          n_tup_ins: r.n_tup_ins,
          n_tup_upd: r.n_tup_upd,
        },
        fix_hint: `Rows arrive but no backend/src writer references it — confirm a DB trigger / extension / dynamic payload writes it, else wire an explicit writer.`,
      };
    }
    noWriter++;
    return {
      id: `attr-no-writer:${r.table_name}.${r.column_name}`,
      severity: "high" as const,
      title: `${r.table_name}.${r.column_name} — attribution column with no runtime writer (grep=0, n_tup_ins=0)`,
      detail: {
        table: r.table_name,
        column: r.column_name,
        category: "no_runtime_writer",
        grep_count: 0,
        n_tup_ins: 0,
        n_tup_upd: r.n_tup_upd,
      },
      fix_hint: `Wire the write (#695 class) or DROP COLUMN if the signal is no longer collected.`,
    };
  });

  return {
    findings,
    evidence: { candidates: rows.length, no_writer: noWriter, unknown_writer: unknownWriter },
  };
}

/** Impure: files under `dir` (recursive, *.ts) matching an ERE pattern. */
function grepFiles(dir: string, pattern: string): Set<string> {
  try {
    const out = execFileSync("grep", ["-rlE", "--include=*.ts", pattern, dir], {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    return new Set(out.split("\n").filter(Boolean));
  } catch {
    return new Set(); // grep exit 1 = no match (or dir absent)
  }
}

/**
 * Impure: per-column writer count over backend/src. A column is "written" iff a
 * file that calls .insert/.update/.upsert ALSO uses it as an object-literal key
 * (`col:` / `"col":` / `'col':`). Intersecting write-call files with key files
 * ignores pure type declarations and .select() reads → conservative, low-FP.
 */
export function grepWriterCounts(repoRoot: string, columnNames: string[]): Record<string, number> {
  const dir = join(repoRoot, "backend/src");
  const writeFiles = grepFiles(dir, "\\.(insert|update|upsert)\\(");
  const counts: Record<string, number> = {};
  for (const col of [...new Set(columnNames)]) {
    if (writeFiles.size === 0) {
      counts[col] = 0;
      continue;
    }
    const keyFiles = grepFiles(dir, `(^|[^A-Za-z0-9_])${col}['"]?[[:space:]]*:`);
    let n = 0;
    for (const f of keyFiles) if (writeFiles.has(f)) n++;
    counts[col] = n;
  }
  return counts;
}

export interface RunOpts {
  repoRoot?: string;
  nowIso?: string;
  /** Inject for tests; default = env-gated live service client. */
  client?: RpcClient | null;
  sourceCommit?: string;
  /** Inject for tests; default = real backend/src grep. */
  writerCounts?: (columnNames: string[]) => Record<string, number>;
}

export async function runAttributionWriteGap(
  opts: RunOpts = {},
): Promise<{ result: RuntimeTruthResult } | { skipped: "no-creds" }> {
  const repoRoot = opts.repoRoot ?? process.env.REPO_ROOT ?? process.cwd();
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const sourceCommit = opts.sourceCommit ?? gitSourceCommit(repoRoot);
  const client = opts.client === undefined ? await getServiceClient() : opts.client;

  if (!client) return { skipped: "no-creds" };

  const { data, error } = await client.rpc(GOV_RPC);
  if (error) {
    // RPC absent (migration not yet applied) or transient — emit UNKNOWN, never crash.
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

  const rows = (Array.isArray(data) ? data : []) as AttrColumnRow[];
  const countFn = opts.writerCounts ?? ((cols: string[]) => grepWriterCounts(repoRoot, cols));
  const writerCounts = countFn(rows.map((r) => r.column_name));
  const { findings, evidence } = classifyAttributionGaps(rows, writerCounts);
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
  runAttributionWriteGap()
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
