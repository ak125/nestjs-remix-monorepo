/**
 * RAG Pipeline Phase 1.6 — Business Admissibility Gate Types.
 *
 * Determines per-role, per-block admissibility for downstream pipelines.
 * A canonical document (Phase 1.5 passed) is NOT automatically exploitable.
 * Phase 1.6 produces an explicit ReadinessRecord before Phase 2+ can consume it.
 */
import { z } from 'zod';
import { RoleId } from '../../../config/role-ids';

// ── Document Readiness Status ────────────────────────────

export const DOCUMENT_READINESS_STATUSES = [
  'READY',
  'READY_WITH_LIMITS',
  'ENRICHMENT_REQUIRED',
  'SUPPORT_ONLY',
  'BLOCKED',
] as const;
export type DocumentReadinessStatus =
  (typeof DOCUMENT_READINESS_STATUSES)[number];

// ── Role Admissibility Status ────────────────────────────

export const ROLE_ADMISSIBILITY_STATUSES = [
  'ALLOWED',
  'ALLOWED_WITH_LIMITS',
  'NOT_ENOUGH_EVIDENCE',
  'NOT_ENOUGH_COVERAGE',
  'ROLE_MISMATCH',
  'BLOCKED',
] as const;
export type RoleAdmissibilityStatus =
  (typeof ROLE_ADMISSIBILITY_STATUSES)[number];

// ── Block Admissibility Status ───────────────────────────

export const BLOCK_ADMISSIBILITY_STATUSES = [
  'USABLE',
  'USABLE_WITH_WARNING',
  'INSUFFICIENT',
  'FORBIDDEN_FOR_ROLE',
  'NOT_TRUSTED_ENOUGH',
] as const;
export type BlockAdmissibilityStatus =
  (typeof BLOCK_ADMISSIBILITY_STATUSES)[number];

// ── Usage Policy (evidence → usage) ─────────────────────

export const USAGE_POLICIES = [
  'publish_candidate',
  'generation_allowed',
  'generation_limited',
  'support_only',
  'blocked',
] as const;
export type UsagePolicy = (typeof USAGE_POLICIES)[number];

// ── Downstream Usage Levels (7-tier hierarchy) ──────────
// Per-role usage level — more granular than document-level UsagePolicy.
// Ordered from most permissive to most restrictive.

export const DOWNSTREAM_USAGE_LEVELS = [
  'publish_candidate',
  'generation_allowed',
  'generation_limited',
  'enrichment_only',
  'support_only',
  'exploration_only',
  'blocked',
] as const;
export type DownstreamUsageLevel = (typeof DOWNSTREAM_USAGE_LEVELS)[number];

// ── Primary Generation Level (5-tier) ───────────────────
// Per-role eligibility as primary generation source.
// Replaces the 2 booleans: primaryGenerationEligible + primaryPublicationCandidate.

export const PRIMARY_GENERATION_LEVELS = [
  'primary_publication_candidate',
  'primary_generation_allowed',
  'primary_generation_limited',
  'support_only',
  'blocked',
] as const;
export type PrimaryGenerationLevel = (typeof PRIMARY_GENERATION_LEVELS)[number];

// ── Staleness Risk ──────────────────────────────────────

export const STALENESS_RISKS = ['low', 'medium', 'high', 'critical'] as const;
export type StalenessRisk = (typeof STALENESS_RISKS)[number];

// ── Zod Schemas ─────────────────────────────────────────

export const EvidencePolicySchema = z.object({
  truthLevel: z.enum(['L1', 'L2', 'L3', 'L4']),
  validationStatus: z.enum(['valid', 'pending_review', 'quarantined']),
  usagePolicy: z.enum([
    'publish_candidate',
    'generation_allowed',
    'generation_limited',
    'support_only',
    'blocked',
  ]),
});
export type EvidencePolicy = z.infer<typeof EvidencePolicySchema>;

export const RoleSufficiencySchema = z.object({
  roleId: z.nativeEnum(RoleId),
  score: z.number().min(0).max(100),
  missingAxes: z.array(z.string()),
  thinContentFlags: z.array(z.string()),
  roleStatus: z.enum([
    'ALLOWED',
    'ALLOWED_WITH_LIMITS',
    'NOT_ENOUGH_EVIDENCE',
    'NOT_ENOUGH_COVERAGE',
    'ROLE_MISMATCH',
    'BLOCKED',
  ]),
  // R3: Primary generation eligibility (5-tier, replaces 2 booleans)
  primaryGenerationLevel: z.enum([...PRIMARY_GENERATION_LEVELS]),
  // B: Per-role downstream usage level (7-tier, degraded from document policy)
  downstreamUsageLevel: z.enum([
    'publish_candidate',
    'generation_allowed',
    'generation_limited',
    'enrichment_only',
    'support_only',
    'exploration_only',
    'blocked',
  ]),
  // D: What Phase 2 must enrich before this role becomes ALLOWED
  requiredEnrichments: z.array(z.string()),
  // F: Explicit list of allowed downstream actions for this role
  allowedNextPhaseActions: z.array(z.string()),
  // G: Semantic limits — what agents CANNOT do with this role
  roleLimits: z.array(z.string()),
});
export type RoleSufficiency = z.infer<typeof RoleSufficiencySchema>;

export const BlockAdmissibilitySchema = z.object({
  blockId: z.string(),
  roleId: z.nativeEnum(RoleId),
  status: z.enum([
    'USABLE',
    'USABLE_WITH_WARNING',
    'INSUFFICIENT',
    'FORBIDDEN_FOR_ROLE',
    'NOT_TRUSTED_ENOUGH',
  ]),
  reason: z.string(),
});
export type BlockAdmissibility = z.infer<typeof BlockAdmissibilitySchema>;

export const ContaminationFindingSchema = z.object({
  type: z.enum(['vocabulary_leak', 'role_mismatch', 'cross_role_content']),
  roleId: z.nativeEnum(RoleId),
  evidence: z.array(z.string()),
  severity: z.enum(['blocking', 'warning']),
});
export type ContaminationFinding = z.infer<typeof ContaminationFindingSchema>;

export const FreshnessAssessmentSchema = z.object({
  lastModified: z.string(),
  staleDays: z.number(),
  stalenessRisk: z.enum(['low', 'medium', 'high', 'critical']),
  refreshNeeded: z.boolean(),
});
export type FreshnessAssessment = z.infer<typeof FreshnessAssessmentSchema>;

// ── R4: Decision Trace (audit metadata) ─────────────────

export const DecisionTraceSchema = z.object({
  decisionId: z.string(),
  decidedBy: z.string(),
  decidedAt: z.string(),
  pipelineVersion: z.string(),
  rulesetVersion: z.string(),
});
export type DecisionTrace = z.infer<typeof DecisionTraceSchema>;

// ── Main Output: ReadinessRecord ────────────────────────

export const ReadinessRecordSchema = z.object({
  // Document-level decision
  documentStatus: z.enum([
    'READY',
    'READY_WITH_LIMITS',
    'ENRICHMENT_REQUIRED',
    'SUPPORT_ONLY',
    'BLOCKED',
  ]),

  // 1.6.1 — Evidence policy
  evidencePolicy: EvidencePolicySchema,

  // 1.6.2 — Per-role sufficiency
  roleSufficiency: z.array(RoleSufficiencySchema),

  // 1.6.3 — Per-block admissibility
  blockAdmissibility: z.array(BlockAdmissibilitySchema),

  // 1.6.4 — Contamination findings
  contaminationFindings: z.array(ContaminationFindingSchema),

  // 1.6.5 — Freshness
  freshness: FreshnessAssessmentSchema,

  // D: Per-role enrichment requirements (convenience accessor)
  requiredEnrichmentsByRole: z
    .record(z.string(), z.array(z.string()))
    .optional(),

  // Passage eligibility — can this document proceed to Phase 2?
  // Derived: phase16Status IN (admissible, admissible_with_limits)
  //   AND at least 1 role has allowedNextPhaseActions.length > 0
  phase2Eligible: z.boolean(),

  // Final gate output
  publicationTargetReady: z.boolean(),
  phase16Status: z.enum([
    'admissible',
    'admissible_with_limits',
    'enrichment_required',
    'blocked',
  ]),
  blockReasons: z.array(z.string()).default([]),
  evaluatedAt: z.string(),

  // R4: Decision trace for audit
  decisionTrace: DecisionTraceSchema,
});
export type ReadinessRecord = z.infer<typeof ReadinessRecordSchema>;
