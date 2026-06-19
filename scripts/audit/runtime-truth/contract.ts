/**
 * Runtime-Truth check output contract (Trust Ledger PR-B0a).
 *
 * Every deterministic runtime-truth runner emits ONE JSON at
 * `audit-reports/runtime-truth/<check>.json` matching this frozen schema.
 * `scripts/audit/build-trust-ledger.ts` consumes it (coverage MANUAL→RECURRING;
 * health_status carries the real result). A broken/off-contract JSON must FAIL
 * the producing job — never be consumed silently.
 *
 * Two axes (mirrors the ledger): coverage_status (does a recurring check exist)
 * vs health_status (its result). RECURRING ≠ PASS.
 */
import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export const CoverageStatusSchema = z.enum(["RECURRING", "MANUAL", "MISSING", "STALE"]);
export const HealthStatusSchema = z.enum(["PASS", "WARN", "FAIL", "UNKNOWN"]);

export const RuntimeTruthFindingSchema = z
  .object({
    id: z.string().min(1),
    severity: SeveritySchema,
    title: z.string().min(1),
    detail: z.record(z.unknown()),
    fix_hint: z.string().optional(),
  })
  .strict();

export const RuntimeTruthResultSchema = z
  .object({
    check_name: z.string().min(1),
    generated_at: z.string().min(1),
    source_commit: z.string().min(1),
    coverage_status: CoverageStatusSchema,
    health_status: HealthStatusSchema,
    findings: z.array(RuntimeTruthFindingSchema),
    freshness: z.string().min(1),
    evidence: z.record(z.unknown()),
  })
  .strict();

export type Severity = z.infer<typeof SeveritySchema>;
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type RuntimeTruthFinding = z.infer<typeof RuntimeTruthFindingSchema>;
export type RuntimeTruthResult = z.infer<typeof RuntimeTruthResultSchema>;

/** Validate an arbitrary value against the contract. Returns typed result or errors. */
export function validateResult(
  value: unknown,
): { ok: true; result: RuntimeTruthResult } | { ok: false; errors: string[] } {
  const parsed = RuntimeTruthResultSchema.safeParse(value);
  if (parsed.success) return { ok: true, result: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

/** Health derives from findings: any critical/high ⇒ FAIL, any medium/low ⇒ WARN, none ⇒ PASS. */
export function healthFromFindings(findings: RuntimeTruthFinding[]): HealthStatus {
  if (findings.some((f) => f.severity === "critical" || f.severity === "high")) return "FAIL";
  if (findings.some((f) => f.severity === "medium" || f.severity === "low")) return "WARN";
  return "PASS";
}
