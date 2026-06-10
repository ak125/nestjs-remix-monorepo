/**
 * @repo/registry — Command Center snapshot contract.
 *
 * Shared TypeScript/Zod contract for the admin Command Center cockpit, consumed
 * by the deterministic generator (scripts/governance/build-command-center-snapshot.js,
 * validated against the AJV mirror .spec/00-canon/ai-registry/command-center-snapshot.schema.json),
 * the backend reader, and the Remix frontend.
 *
 * Two shapes:
 *   - CommandCenterSnapshot  = the BAKED file (deterministic, structural truth only,
 *                              NO wall-clock/git/live fields).
 *   - CommandCenterResponse  = what the backend reader returns = snapshot + LIVE
 *                              envelope (generated_at, git_sha, stale_status,
 *                              validation_status, global_status) + per-department
 *                              health_score_current (live caps applied).
 *
 * Reference projection, non-authoritative. The AJV JSON schema is the validation
 * SoT for the generated artifact; this Zod schema is the SoT for TS consumers.
 * A test asserts the real generated snapshot satisfies BOTH (zero drift).
 */
import { z } from "zod";

export const CertificationSchema = z.enum([
  "CERTIFIED",
  "PARTIAL",
  "UNKNOWN",
  "BROKEN",
]);
export type Certification = z.infer<typeof CertificationSchema>;

export const CapabilityStatusSchema = z.enum([
  "live",
  "partial",
  "dormant",
  "broken",
  "duplicate",
]);
export const DepartmentFamilySchema = z.enum([
  "Business",
  "Growth",
  "Operations",
  "AI-Governance",
]);
export const HandoffStateSchema = z.enum(["EXISTS", "PARTIAL", "ASPIRATIONAL"]);

export const CcEvidenceSchema = z
  .object({
    runtime: z.string().optional(),
    adr: z.string().optional(),
    scripts: z.array(z.string()).optional(),
    tables: z.array(z.string()).optional(),
  })
  .strict();

export const CcCapabilitySchema = z
  .object({
    id: z.string(),
    type: z.enum([
      "skill",
      "agent",
      "service",
      "module",
      "engine",
      "pipeline",
      "signal",
    ]),
    owner: z.string(),
    status: CapabilityStatusSchema,
    certification: CertificationSchema,
    reason: z.string().nullable(),
    module: z.string().nullable(),
    has_evidence: z.boolean(),
    evidence: CcEvidenceSchema.nullable(),
  })
  .strict();
export type CcCapability = z.infer<typeof CcCapabilitySchema>;

export const CcDepartmentSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    lead: z.string(),
    priority: z.enum(["P0", "P1", "P2", "P3"]).nullable(),
    kpi_primary: z.string().nullable(),
    state: CapabilityStatusSchema,
    family: DepartmentFamilySchema,
    capabilities: z.array(z.string()),
    certification: CertificationSchema,
    health_score_base: z.number().int().min(0).max(100),
    structural_caps_applied: z.array(z.string()),
  })
  .strict();
export type CcDepartment = z.infer<typeof CcDepartmentSchema>;

export const CcChainSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    contract_ref: z.string().nullable(),
    contract_status: z.enum(["planned", "defined"]).nullable(),
    gate: z.string().nullable(),
    state: HandoffStateSchema,
    incomplete: z.boolean(),
  })
  .strict();
export type CcChain = z.infer<typeof CcChainSchema>;

export const CcAlertCodeSchema = z.enum([
  "BROKEN_EVIDENCE",
  "OVERCLAIM_RISK",
  "P0_NO_KPI",
  "HANDOFF_INCOMPLETE",
]);
export const CcAlertSchema = z
  .object({
    code: CcAlertCodeSchema,
    severity: z.enum(["error", "warn", "info"]),
    target_kind: z.enum(["capability", "department", "handoff", "map"]),
    target_id: z.string(),
    message: z.string().min(1),
  })
  .strict();
export type CcAlert = z.infer<typeof CcAlertSchema>;

export const CcOwnerActionSchema = z
  .object({
    from_alert: CcAlertCodeSchema,
    target_id: z.string(),
    action: z.string().min(1),
    owner: z.string().min(1),
    file: z.string().min(1),
    decision: z.string().min(1),
  })
  .strict();
export type CcOwnerAction = z.infer<typeof CcOwnerActionSchema>;

export const CcExecutiveKpiSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    value: z.union([z.number(), z.string(), z.null()]),
    unit: z.string().optional(),
    status: z.enum(["OK", "WARNING", "CRITICAL", "UNKNOWN"]),
    source: z.enum(["canon", "db", "gsc", "runtime", "audit", "manual"]),
    certified: z.boolean(),
  })
  .strict();

export const CcSummarySchema = z
  .object({
    departments_total: z.number().int().min(0),
    by_priority: z
      .object({
        P0: z.number().int(),
        P1: z.number().int(),
        P2: z.number().int(),
        P3: z.number().int(),
      })
      .strict(),
    by_state: z
      .object({
        live: z.number().int(),
        partial: z.number().int(),
        dormant: z.number().int(),
        broken: z.number().int(),
        duplicate: z.number().int(),
      })
      .strict(),
    capabilities_total: z.number().int().min(0),
    capabilities_certified: z.number().int().min(0),
    capabilities_without_evidence: z.number().int().min(0),
    handoffs_total: z.number().int().min(0),
    handoffs_incomplete: z.number().int().min(0),
  })
  .strict();

/** The BAKED, deterministic file. No wall-clock/git/live fields. */
export const CommandCenterSnapshotSchema = z
  .object({
    schema_version: z.literal("command-center.v1"),
    source_truth: z
      .object({
        canon_path: z.string().min(1),
        last_verified: z.string().nullable(),
      })
      .strict(),
    summary: CcSummarySchema,
    executive_kpis: z.array(CcExecutiveKpiSchema),
    departments: z.array(CcDepartmentSchema),
    capabilities: z.array(CcCapabilitySchema),
    chains: z.array(CcChainSchema),
    alerts: z.array(CcAlertSchema),
    owner_actions: z.array(CcOwnerActionSchema),
  })
  .strict();
export type CommandCenterSnapshot = z.infer<typeof CommandCenterSnapshotSchema>;

// ── Live response envelope (computed by the backend reader at request time) ──

export const StaleStatusSchema = z.enum([
  "FRESH",
  "WARNING",
  "STALE",
  "UNKNOWN",
]);
export const ValidationStatusSchema = z.enum([
  "VALIDATED",
  "WARN_ONLY",
  "STRICT_FAIL",
  "UNKNOWN",
]);

export const GlobalStatusSchema = z
  .object({
    level: z.enum(["OK", "WARNING", "CRITICAL"]),
    verdict: z.enum(["OPERATIONAL", "PARTIAL_READY", "BLOCKED"]),
    reasons: z.array(z.string()),
  })
  .strict();
export type GlobalStatus = z.infer<typeof GlobalStatusSchema>;

/** Department enriched by the reader with the live-capped current score. */
export const CcDepartmentLiveSchema = CcDepartmentSchema.extend({
  health_score_current: z.number().int().min(0).max(100),
  live_caps_applied: z.array(z.string()),
}).strict();
export type CcDepartmentLive = z.infer<typeof CcDepartmentLiveSchema>;

/** What GET /api/admin/command-center returns (data wrapped by AdminResponseInterceptor). */
export const CommandCenterModeSchema = z.enum(["full", "light", "disabled"]);
export type CommandCenterMode = z.infer<typeof CommandCenterModeSchema>;

/** PR2: per-URL drill-down for a seo:opportunity:* action. null for other actions. */
export const CcSeoDetailSchema = z
  .object({
    url: z.string(),
    page_kind: z.enum(["product", "content", "other"]),
    impressions: z.number(),
    clicks: z.number(),
    ctr: z.number(), // clicks/impressions (0..1)
    position: z.number().nullable(), // PR3: avg SERP position (rpc_seo_low_ctr_v1.avg_position); null if absent
    next_step: z.string(), // PR3: advisory per-URL editorial action (deterministic, rule-based)
  })
  .strict();
export type CcSeoDetail = z.infer<typeof CcSeoDetailSchema>;

export const CcActionV2Schema = z
  .object({
    id: z.string(),
    title: z.string(),
    department: z.string(),
    source: z.enum([
      "seo",
      "pricing",
      "orders",
      "suppliers",
      "runtime",
      "data",
      "governance",
    ]),
    action_type: z.enum(["business", "risk", "certification", "repair"]),
    impact: z.number().min(0).max(10),
    urgency: z.number().min(0).max(10),
    data_confidence: z.number().min(0).max(100),
    effort: z.number().min(0).max(10),
    risk: z.number().min(0).max(10),
    score: z.number(), // computed: impact+urgency+confidence/10-effort-risk (may be negative)
    reason: z.string(),
    evidence: z.array(z.string()),
    next_step: z.string(),
    details: z.array(CcSeoDetailSchema).nullable(), // PR2 drill-down (SEO only)
  })
  .strict();
export type CcActionV2 = z.infer<typeof CcActionV2Schema>;

export const CommandCenterResponseSchema = CommandCenterSnapshotSchema.extend({
  degraded: z.boolean(),
  mode: CommandCenterModeSchema,
  action_queue: z.array(CcActionV2Schema),
  generated_at: z.string(),
  git_sha: z.string().nullable(),
  stale_status: StaleStatusSchema,
  validation_status: ValidationStatusSchema,
  global_status: GlobalStatusSchema,
  departments: z.array(CcDepartmentLiveSchema),
}).strict();
export type CommandCenterResponse = z.infer<typeof CommandCenterResponseSchema>;
