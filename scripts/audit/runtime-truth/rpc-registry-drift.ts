#!/usr/bin/env tsx
/**
 * rpc-registry-drift — deterministic runtime-truth runner (Trust Ledger PR-B0a).
 *
 * Scans backend/src for literal `.rpc('<name>')` calls and flags any whose
 * function does NOT exist in the PostgREST-callable `public` schema — i.e. code
 * calling an RPC that was never created or was dropped (silent feature breakage,
 * e.g. increment_advice_views / execute_sql). Faithful deterministic port of
 * `.claude/skills/runtime-truth-audit/checks/rpc-registry-drift.md`.
 *
 * DB side via the governed read-only RPC `__gov_m9_callable_functions()`.
 * Report-only. Pure logic (extract + classify) is testable without a live DB.
 *
 * Note: only LITERAL `.rpc('x')` calls are statically checkable (dynamic
 * `.rpc(var)` is out of scope). A call routed through `.schema('other')` may be
 * a false positive — flagged at `medium` so a human triages (some sites have an
 * intentional fallback when the RPC is absent).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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

export const CHECK_NAME = "rpc-registry-drift";
const GOV_RPC = "__gov_m9_callable_functions";

const RPC_CALL_RE = /\.rpc\(\s*['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]/g;

/** PURE: extract literal `.rpc('name')` call names from a source string. */
export function extractRpcCalls(source: string): string[] {
  const names: string[] = [];
  let m: RegExpExecArray | null;
  RPC_CALL_RE.lastIndex = 0;
  while ((m = RPC_CALL_RE.exec(source)) !== null) names.push(m[1]);
  return names;
}

export interface RpcCallSite {
  name: string;
  files: string[];
}

/** Walk a directory tree collecting literal `.rpc()` call names → call sites. */
export function scanRpcCalls(rootDir: string): RpcCallSite[] {
  const byName = new Map<string, Set<string>>();
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
      const p = join(dir, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (e.endsWith(".ts") && !e.endsWith(".d.ts") && !e.endsWith(".test.ts") && !e.endsWith(".spec.ts")) {
        for (const name of extractRpcCalls(readFileSync(p, "utf8"))) {
          if (!byName.has(name)) byName.set(name, new Set());
          byName.get(name)!.add(p);
        }
      }
    }
  };
  walk(rootDir);
  return Array.from(byName.entries())
    .map(([name, files]) => ({ name, files: Array.from(files).sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** PURE: flag called RPCs absent from the DB-callable set. Deterministic. */
export function classifyRpcDrift(
  calls: RpcCallSite[],
  dbFunctionNames: string[],
): { findings: RuntimeTruthFinding[]; evidence: Record<string, unknown> } {
  const dbSet = new Set(dbFunctionNames);
  const missing = calls.filter((c) => !dbSet.has(c.name));
  const findings: RuntimeTruthFinding[] = missing.map((c) => ({
    id: `rpc-drift:${c.name}`,
    severity: "medium",
    title: `code calls .rpc('${c.name}') — no such function in the public schema (runtime failure or silent fallback)`,
    detail: { rpc: c.name, call_sites: c.files },
    fix_hint: `create public.${c.name}(...) via a governed migration, or remove/replace the call`,
  }));
  return {
    findings,
    evidence: {
      scanned_calls: calls.length,
      missing: missing.length,
      db_functions: dbFunctionNames.length,
    },
  };
}

export interface RunOpts {
  repoRoot?: string;
  nowIso?: string;
  client?: RpcClient | null;
  sourceCommit?: string;
  /** Inject scan results for tests (skips the file walk). */
  calls?: RpcCallSite[];
}

export async function runRpcRegistryDrift(
  opts: RunOpts = {},
): Promise<{ result: RuntimeTruthResult } | { skipped: "no-creds" }> {
  const repoRoot = opts.repoRoot ?? process.env.REPO_ROOT ?? process.cwd();
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const sourceCommit = opts.sourceCommit ?? gitSourceCommit(repoRoot);
  const client = opts.client === undefined ? await getServiceClient() : opts.client;

  if (!client) return { skipped: "no-creds" };

  const calls = opts.calls ?? scanRpcCalls(join(repoRoot, "backend/src"));

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

  const dbNames = (Array.isArray(data) ? data : []).map(
    (r) => (r as { function_name: string }).function_name,
  );
  const { findings, evidence } = classifyRpcDrift(calls, dbNames);
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
  runRpcRegistryDrift()
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
