#!/usr/bin/env tsx
/**
 * pg-stable-write — deterministic runtime-truth runner (Trust Ledger PR-B0a).
 *
 * Detects STABLE/IMMUTABLE Postgres functions whose body writes (INSERT/UPDATE/
 * DELETE/TRUNCATE/COPY). PostgREST runs STABLE/IMMUTABLE in a read-only tx, so a
 * write raises "cannot execute X in a read-only transaction" → silent 5xx
 * (incident #693). Faithful deterministic port of
 * `.claude/skills/runtime-truth-audit/checks/pg-stable-write.md` (the skill is
 * the source of logic; this is SQL/AST, NOT the LLM skill run in CI).
 *
 * Catalog access goes through the governed read-only RPC
 * `__gov_m7_stable_function_volatility()` (extends the `__gov_*` family) via the
 * existing supabase-js layer. Report-only: emits a contract JSON, writes nothing
 * to the DB. Classification is PURE (testable without a live DB).
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

export const CHECK_NAME = "pg-stable-write";
const GOV_RPC = "__gov_m7_stable_function_volatility";

/** One row of `__gov_m7_stable_function_volatility()`. */
export interface StableFnRow {
  function_name: string;
  volatility: string;
  writes: boolean;
  write_ops: string;
}

/** PURE: classify RPC rows → findings + evidence. Deterministic (sorted). */
export function classifyStableWriters(rows: StableFnRow[]): {
  findings: RuntimeTruthFinding[];
  evidence: Record<string, unknown>;
} {
  const violators = rows.filter((r) => r.writes);
  const findings: RuntimeTruthFinding[] = violators
    .slice()
    .sort((a, b) => a.function_name.localeCompare(b.function_name))
    .map((r) => ({
      id: `stable-write:${r.function_name}`,
      severity: "critical" as const,
      title: `${r.volatility} function ${r.function_name}() writes — PostgREST read-only tx ⇒ silent 5xx`,
      detail: {
        function: r.function_name,
        volatility: r.volatility,
        write_ops: r.write_ops,
      },
      fix_hint: `ALTER FUNCTION public.${r.function_name} VOLATILE;  (or extract the write into a separate VOLATILE function)`,
    }));
  return { findings, evidence: { scanned: rows.length, violating: violators.length } };
}

export interface RunOpts {
  repoRoot?: string;
  nowIso?: string;
  /** Inject for tests; default = env-gated live service client. */
  client?: RpcClient | null;
  sourceCommit?: string;
}

export async function runPgStableWrite(
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

  const rows = (Array.isArray(data) ? data : []) as StableFnRow[];
  const { findings, evidence } = classifyStableWriters(rows);
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
  runPgStableWrite()
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
