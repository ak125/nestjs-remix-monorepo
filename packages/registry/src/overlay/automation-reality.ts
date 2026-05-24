import { z } from "zod";
import { SchemaVersionSchema } from "../shared/schema-version";
import { DomainIdSchema } from "../shared/domain";
import { RiskSchema } from "../shared/risk";

/**
 * Layer 2 — Automation Reality overlay (manuel).
 *
 * Lives in `.spec/00-canon/repository-registry/automation-reality.yaml`.
 *
 * First registry in the monorepo that formalises the distinction between
 * an automation that is CABLED (design — workflow / script / migration exists)
 * and one that is REALLY RUNNING (runtime — trigger fired, output written,
 * consumer observed). See plan
 * `/home/deploy/.claude/plans/utiliser-superpower-oui-frolicking-bengio.md`
 * for the full rationale + 6-round design review.
 *
 * Anti-pattern explicitly fought : "présence de code ≠ automation réelle".
 * Cron tourne → table remplie → personne ne lit = SCRIPT_ONLY (not ACTIVE).
 */

// ── Modes ────────────────────────────────────────────────────────────────────

/**
 * All observable modes on the field — `actual_mode` can be any of these.
 */
export const AutomationModeEnum = z.enum([
  "ACTIVE",
  "INTENDED_PHASED",
  "OBSERVE_ONLY",
  "MANUAL",
  "SCRIPT_ONLY",
  "DRAFTED",
  "MISSING_EXECUTOR",
  "WARN_ONLY_DEGRADED",
]);
export type AutomationMode = z.infer<typeof AutomationModeEnum>;

/**
 * Valid INTENTION modes — strict subset.
 *
 * Excludes the transient/failure states (DRAFTED, MISSING_EXECUTOR,
 * WARN_ONLY_DEGRADED) which describe a failure, not a goal. A system that
 * is intentionally MANUAL or OBSERVE_ONLY is a valid design, NOT incomplete
 * automation.
 */
export const IntendedModeEnum = z.enum([
  "ACTIVE",
  "INTENDED_PHASED",
  "OBSERVE_ONLY",
  "MANUAL",
  "SCRIPT_ONLY",
]);
export type IntendedMode = z.infer<typeof IntendedModeEnum>;

// ── Executor ─────────────────────────────────────────────────────────────────

export const AutomationExecutorEnum = z.enum([
  "github-actions",
  "github-actions-schedule",
  "dependabot",
  "renovate",
  "cron-vps",
  "pg_cron",
  "bullmq",
  "supabase-cron",
  "none",
  "human-only",
]);
export type AutomationExecutor = z.infer<typeof AutomationExecutorEnum>;

// ── Evidence ─────────────────────────────────────────────────────────────────

/**
 * DESIGN evidence — proves the system is CABLED (workflow, script, migration).
 *
 * `excerpt` is REQUIRED when `line` is present : if someone edits the file
 * and the referenced line becomes something else, the validator detects the
 * drift (anti-silent-drift). Without excerpt, references rot silently.
 */
export const EvidenceRefSchema = z
  .object({
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    excerpt: z.string().min(1).max(120).optional(),
    note: z.string().max(140).optional(),
  })
  .refine((r) => r.line === undefined || r.excerpt !== undefined, {
    message:
      "evidence with `line:` requires `excerpt:` (substring matched at the line) — anti-drift",
  });
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

/**
 * RUNTIME evidence — proves the system IS RUNNING (logs, rows, runs, metrics).
 *
 * `observed_at` ≤30j gate is enforced by the freshness workflow, not Zod
 * (validation must remain pure / no clock dependency).
 */
export const RuntimeEvidenceItemSchema = z.object({
  kind: z.enum(["log", "db_row", "metric", "github_run", "file_mtime"]),
  source: z.string().min(1),
  observed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  query_or_url: z.string().optional(),
});
export type RuntimeEvidenceItem = z.infer<typeof RuntimeEvidenceItemSchema>;

/**
 * The 3 signals required for an entry to claim `actual_mode: ACTIVE` :
 * trigger fired, output produced, consumer observed (or explicit
 * "no-consumer-by-design" for audit-only systems).
 */
export const RuntimeEvidenceSchema = z.object({
  trigger: RuntimeEvidenceItemSchema,
  output: RuntimeEvidenceItemSchema,
  consumer: z.union([
    RuntimeEvidenceItemSchema,
    z.literal("no-consumer-by-design"),
  ]),
});
export type RuntimeEvidence = z.infer<typeof RuntimeEvidenceSchema>;

// ── Verification method ──────────────────────────────────────────────────────

export const LastVerifiedMethodEnum = z.enum([
  "manual-inspection",
  "runtime-probe",
  "incident-postmortem",
  "seed-from-plan-review",
]);
export type LastVerifiedMethod = z.infer<typeof LastVerifiedMethodEnum>;

// ── Entry ────────────────────────────────────────────────────────────────────

export const AutomationEntrySchema = z
  .object({
    automation_id: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{2,63}$/, {
        message:
          "automation_id must be kebab-case ASCII, 3-64 chars, starting with [a-z0-9]",
      }),
    domain: DomainIdSchema,
    intended_mode: IntendedModeEnum,
    actual_mode: AutomationModeEnum,
    executor: AutomationExecutorEnum,
    evidence: z.array(EvidenceRefSchema).min(1, {
      message: "at least one design evidence reference required",
    }),
    runtime_evidence: RuntimeEvidenceSchema.optional(),
    last_verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    last_verified_by: z
      .string()
      .min(1)
      .regex(/^(@[a-zA-Z0-9_-]+|seed:[a-zA-Z0-9_-]+)$/, {
        message:
          "last_verified_by must be `@github-handle` or `seed:<owner>` (seed only for V1 initial)",
      }),
    last_verified_method: LastVerifiedMethodEnum,
    missing_step: z.string().max(200).optional(),
    risk: RiskSchema,
    owner_action: z.string().max(200).optional(),
    related_pr: z.array(z.number().int().positive()).optional(),
    drift_note: z.string().max(200).optional(),
  })
  .refine((e) => e.actual_mode !== "ACTIVE" || e.runtime_evidence !== undefined, {
    message:
      "actual_mode=ACTIVE requires runtime_evidence (trigger+output+consumer proof)",
    path: ["runtime_evidence"],
  })
  .refine((e) => e.intended_mode === e.actual_mode || e.missing_step !== undefined, {
    message:
      "gap (intended_mode ≠ actual_mode) requires `missing_step` describing convergence path",
    path: ["missing_step"],
  })
  .refine(
    (e) =>
      e.actual_mode !== "WARN_ONLY_DEGRADED" ||
      e.evidence.some((r) => r.note?.toLowerCase().includes("regression")),
    {
      message:
        "actual_mode=WARN_ONLY_DEGRADED requires evidence with a note containing 'regression' (proven gate regression, not catch-all bucket)",
      path: ["evidence"],
    },
  );

export type AutomationEntry = z.infer<typeof AutomationEntrySchema>;

// ── Registry ─────────────────────────────────────────────────────────────────

export const AutomationRealitySchema = z.object({
  schemaVersion: SchemaVersionSchema,
  entries: z.array(AutomationEntrySchema).default([]),
});
export type AutomationReality = z.infer<typeof AutomationRealitySchema>;
