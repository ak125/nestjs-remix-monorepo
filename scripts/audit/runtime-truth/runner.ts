/**
 * Shared harness for deterministic runtime-truth runners (Trust Ledger PR-B0a).
 *
 * Each runner: queries a governed read-only `__gov_*` introspection RPC via the
 * EXISTING supabase-js layer (no `pg` dep, no new DB secret), classifies the
 * rows with PURE logic (testable without a live DB), and writes a contract JSON.
 * Report-only: never writes to the database.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  validateResult,
  type RuntimeTruthResult,
  type RuntimeTruthFinding,
  type CoverageStatus,
} from "./contract.ts";

export const RUNTIME_TRUTH_DIR = "audit-reports/runtime-truth";

/** Short git SHA the check ran against; "unknown" if git is unavailable. */
export function gitSourceCommit(repoRoot: string = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

/** Minimal shape of the supabase-js client we rely on (keeps the harness testable). */
export interface RpcClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/** Env-gated service-role client. Returns null when creds are absent (PR lane). */
export async function getServiceClient(): Promise<RpcClient | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, key, { auth: { persistSession: false } }) as unknown as RpcClient;
  } catch {
    return null;
  }
}

export interface MakeResultInput {
  check_name: string;
  generated_at: string;
  source_commit: string;
  coverage_status: CoverageStatus;
  health_status: RuntimeTruthResult["health_status"];
  findings: RuntimeTruthFinding[];
  freshness: string;
  evidence: Record<string, unknown>;
}

/** Assemble + self-validate a result. Throws if it does not satisfy the contract. */
export function makeResult(input: MakeResultInput): RuntimeTruthResult {
  const v = validateResult(input);
  if (!v.ok) {
    throw new Error(`runtime-truth result violates contract: ${v.errors.join("; ")}`);
  }
  return v.result;
}

/** Write a validated result to audit-reports/runtime-truth/<check>.json. */
export function writeResult(repoRoot: string, result: RuntimeTruthResult): string {
  const dir = join(repoRoot, RUNTIME_TRUTH_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, `${result.check_name}.json`);
  writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
  return path;
}
