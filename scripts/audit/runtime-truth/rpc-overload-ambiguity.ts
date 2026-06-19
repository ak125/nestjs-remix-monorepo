#!/usr/bin/env tsx
/**
 * rpc-overload-ambiguity — deterministic runtime-truth runner (Trust Ledger PR-B0a).
 *
 * Detects PostgREST function-overload ambiguity (PGRST203 "could not choose the
 * best candidate function") — the root-cause class of the 24-day checkout outage
 * (#993: create_order_atomic had two overloads, one a prefix of the other with a
 * defaulted extra arg). Faithful deterministic port of
 * `.claude/skills/runtime-truth-audit/checks/rpc-overload-ambiguity.md`.
 *
 * DB side via the governed read-only RPC `__gov_m10_overload_ambiguity()` —
 * Postgres is the source of truth for signatures (no SQL-text parsing; extension
 * functions excluded). Report-only. Pure classify is testable without a live DB.
 *
 * Severity is `critical`: a single .rpc() call against an ambiguous overload
 * fails 100% with PGRST203 — a silent, total breakage of that surface.
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

export const CHECK_NAME = "rpc-overload-ambiguity";
const GOV_RPC = "__gov_m10_overload_ambiguity";

/** One row returned by __gov_m10_overload_ambiguity(). */
export interface OverloadRow {
  function_name: string;
  ambiguity_kind: string; // 'type_only' | 'subset_default' (or comma-joined)
  overload_count: number;
}

/** PURE: map ambiguous-overload rows → critical findings. Deterministic, sorted. */
export function classifyOverloadAmbiguity(rows: OverloadRow[]): {
  findings: RuntimeTruthFinding[];
  evidence: Record<string, unknown>;
} {
  const sorted = [...rows].sort((a, b) =>
    a.function_name.localeCompare(b.function_name),
  );
  const findings: RuntimeTruthFinding[] = sorted.map((r) => ({
    id: `overload-ambiguity:${r.function_name}`,
    severity: "critical",
    title: `public.${r.function_name} has ${r.overload_count} ambiguous overloads (${r.ambiguity_kind}) — any .rpc('${r.function_name}') call risks PGRST203 "could not choose the best candidate"`,
    detail: {
      function: r.function_name,
      kind: r.ambiguity_kind,
      overloads: r.overload_count,
    },
    fix_hint:
      "verify internal SQL callers, then drop the obsolete overload (or rename params); see checks/rpc-overload-ambiguity.md",
  }));
  return { findings, evidence: { ambiguous_functions: sorted.length } };
}

export interface RunOpts {
  repoRoot?: string;
  nowIso?: string;
  client?: RpcClient | null;
  sourceCommit?: string;
}

export async function runRpcOverloadAmbiguity(
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

  const rows = (Array.isArray(data) ? data : []) as OverloadRow[];
  const { findings, evidence } = classifyOverloadAmbiguity(rows);
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
  runRpcOverloadAmbiguity()
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
