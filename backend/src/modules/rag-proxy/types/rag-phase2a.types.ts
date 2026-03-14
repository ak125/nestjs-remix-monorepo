/**
 * RAG Pipeline Phase 2A — Legacy Adapted Shadow Audit Types.
 *
 * Phase 2A is a non-destructive, non-publishable, shadow-only audit that
 * projects legacy artifacts onto canonical roles R0-R8, detects collisions,
 * applies governance G1-G5, and produces readiness verdicts.
 *
 * Distinction 1.6 / 2A / 2 :
 *  - Phase 1.6 : cette matière est-elle admissible en principe vers un rôle R* ?
 *  - Phase 2A  : cet artefact legacy réel converge-t-il proprement vers le canon ?
 *  - Phase 2   : générer l'artefact métier à partir de la matière admise.
 *
 * Invariants:
 *  1. Non-destruction — read-only on code and DB (writes only to __phase2a_audit_reports)
 *  2. Non-publication — no output can be published as a page
 *  3. Non-usurpation — legacy does not become canonical by resemblance
 *  4. Traceability — every projection preserves source, detected role, proposed role, reasons
 *  5. Shadow-only persistence — writes only to shadow/audit tables, never to final métier tables
 *  6. Canon authority — 2A projects toward canon but never redefines R*, G*, or phase rules
 */
import { z } from 'zod';
import { RoleId } from '../../../config/role-ids';

// ── Artifact Types ──────────────────────────────────────

export const PHASE2A_ARTIFACT_TYPES = [
  'code_service',
  'code_schema',
  'code_constant',
  'code_route',
  'db_page_role',
  'db_page_type',
  'doc_agent',
  'doc_spec',
  'frontend_label',
  'frontend_route',
] as const;
export type Phase2aArtifactType = (typeof PHASE2A_ARTIFACT_TYPES)[number];

// ── Artifact Scope (editorial vs support vs transverse) ─

export const PHASE2A_ARTIFACT_SCOPES = [
  'editorial',
  'support',
  'app',
  'transverse',
] as const;
export type Phase2aArtifactScope = (typeof PHASE2A_ARTIFACT_SCOPES)[number];

// ── Collision Types ─────────────────────────────────────

export const PHASE2A_COLLISION_TYPES = [
  'role_collision',
  'contract_collision',
  'label_collision',
  'route_collision',
  'theory_repo_gap',
] as const;
export type Phase2aCollisionType = (typeof PHASE2A_COLLISION_TYPES)[number];

// ── Governance Layers ───────────────────────────────────
// In 2A, G4 = promotion control toward Phase 2 real (NOT public publication).

export const GOVERNANCE_LAYERS = [
  'G1_PURETE',
  'G2_DIVERSITE',
  'G3_ANTI_CANNIBALISATION',
  'G4_PROMOTION_CONTROL',
  'G5_REVIEW_ESCALATION',
] as const;
export type GovernanceLayer = (typeof GOVERNANCE_LAYERS)[number];

// ── Confidence Bands ────────────────────────────────────

export const CONFIDENCE_BANDS = ['HIGH', 'MEDIUM', 'LOW', 'UNSAFE'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

// ── Readiness Verdicts ──────────────────────────────────

export const PHASE2A_READINESS_VERDICTS = [
  'READY_FOR_PHASE2_REAL',
  'BLOCKED_ROLE_AMBIGUITY',
  'BLOCKED_CONTRACT_MISSING',
  'BLOCKED_CONTAMINATION',
  'NO_CANON_TARGET',
  'REVIEW_REQUIRED_G1',
  'REVIEW_REQUIRED_G2',
  'REVIEW_REQUIRED_G3',
  'HOLD_G4',
  'ESCALATE_G5',
] as const;
export type Phase2aReadinessVerdict =
  (typeof PHASE2A_READINESS_VERDICTS)[number];

// ── Recommended Actions ─────────────────────────────────

export const PHASE2A_RECOMMENDED_ACTIONS = [
  'ready_for_phase2_real',
  'fix_phase1_provenance',
  'fix_phase15_taxonomy',
  'fix_phase16_admissibility',
  'split_role',
  'split_governance',
  'remap_contract',
  'mark_shadow_only',
  'mark_out_of_scope',
  'escalate_human_review',
] as const;
export type Phase2aRecommendedAction =
  (typeof PHASE2A_RECOMMENDED_ACTIONS)[number];

// ── Blocking Families ─────────────────────────────────
// Identifies which upstream phase blocks an artifact.

export const PHASE2A_BLOCKING_FAMILIES = [
  'phase1',
  'phase15',
  'phase16',
  'repo',
  'governance',
] as const;
export type Phase2aBlockingFamily = (typeof PHASE2A_BLOCKING_FAMILIES)[number];

// ── Canonical Verdicts (spec-aligned) ─────────────────
// 8 semantic verdicts from the Phase 2A canonical spec.
// Complement (not replace) the governance-focused readinessVerdict.

export const PHASE2A_CANON_VERDICTS = [
  'CANONICAL_MATCH',
  'CANONICAL_MATCH_WITH_WARNINGS',
  'LEGACY_REMAP_REQUIRED',
  'ROLE_SPLIT_REQUIRED',
  'GOVERNANCE_SPLIT_REQUIRED',
  'CONTRACT_REMAP_REQUIRED',
  'BLOCKED_UPSTREAM',
  'ESCALATION_REQUIRED',
] as const;
export type Phase2aCanonVerdict = (typeof PHASE2A_CANON_VERDICTS)[number];

// ── Audit Status ────────────────────────────────────────

export const PHASE2A_AUDIT_STATUSES = [
  'audit_complete',
  'audit_partial',
  'audit_failed',
] as const;
export type Phase2aAuditStatus = (typeof PHASE2A_AUDIT_STATUSES)[number];

// ── Zod Schemas ─────────────────────────────────────────

export const Phase2aCollisionSchema = z.object({
  type: z.enum([...PHASE2A_COLLISION_TYPES]),
  description: z.string(),
  severity: z.enum(['blocking', 'warning', 'info']),
  relatedArtifact: z.string().optional(),
});
export type Phase2aCollision = z.infer<typeof Phase2aCollisionSchema>;

export const Phase2aGovernanceFlagSchema = z.object({
  layer: z.enum([...GOVERNANCE_LAYERS]),
  verdict: z.enum(['PASS', 'WARN', 'FAIL']),
  reason: z.string(),
  evidence: z.array(z.string()).default([]),
});
export type Phase2aGovernanceFlag = z.infer<typeof Phase2aGovernanceFlagSchema>;

export const Phase2aArtifactFindingSchema = z.object({
  artifactPath: z.string(),
  artifactType: z.enum([...PHASE2A_ARTIFACT_TYPES]),
  /** Scope: editorial (R1-R8 content), support (R6_SUPPORT), app (RX_CHECKOUT), transverse (multi-role) */
  artifactScope: z.enum([...PHASE2A_ARTIFACT_SCOPES]),

  // P2A-1: legacy detection
  legacyLabelsDetected: z.array(z.string()),

  // P2A-2: canonical projection
  canonicalRoleCandidate: z.nativeEnum(RoleId).nullable(),
  confidence: z.number().min(0).max(1),
  /** Human-readable confidence classification */
  confidenceBand: z.enum([...CONFIDENCE_BANDS]),

  // P2A-4: collisions
  collisions: z.array(Phase2aCollisionSchema),

  // Governance G1-G5
  governanceFlags: z.array(Phase2aGovernanceFlagSchema),

  // P2A-3: contract candidate
  canonicalContractCandidate: z.string().nullable().default(null),

  // P2A-5: readiness verdict + recommended action
  readinessVerdict: z.enum([...PHASE2A_READINESS_VERDICTS]),
  recommendedAction: z.enum([...PHASE2A_RECOMMENDED_ACTIONS]),
  blockReasons: z.array(z.string()).default([]),

  // Upstream blocking (Phase 1/1.5/1.6)
  blockingFamily: z
    .enum([...PHASE2A_BLOCKING_FAMILIES])
    .nullable()
    .default(null),

  // Canonical verdict (spec-aligned semantic layer)
  canonVerdict: z
    .enum([...PHASE2A_CANON_VERDICTS])
    .nullable()
    .default(null),
});
export type Phase2aArtifactFinding = z.infer<
  typeof Phase2aArtifactFindingSchema
>;

export const Phase2aAuditSummarySchema = z.object({
  readyCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
  reviewRequiredCount: z.number().int().min(0),
  holdCount: z.number().int().min(0),
  escalateCount: z.number().int().min(0),
  /** Artifacts that have no canonical target (technical, auxiliary, obsolete) */
  outOfScopeCount: z.number().int().min(0),
  /** Counts per canonical verdict (spec-aligned) */
  canonVerdictCounts: z
    .record(z.enum([...PHASE2A_CANON_VERDICTS]), z.number().int().min(0))
    .optional(),
});
export type Phase2aAuditSummary = z.infer<typeof Phase2aAuditSummarySchema>;

export const Phase2aAuditReportSchema = z.object({
  auditId: z.string().uuid(),
  version: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),

  totalArtifactsScanned: z.number().int().min(0),
  totalLegacyDetected: z.number().int().min(0),
  totalCollisions: z.number().int().min(0),
  totalBlockers: z.number().int().min(0),

  findings: z.array(Phase2aArtifactFindingSchema),
  summary: Phase2aAuditSummarySchema,

  phase2aStatus: z.enum([...PHASE2A_AUDIT_STATUSES]),
});
export type Phase2aAuditReport = z.infer<typeof Phase2aAuditReportSchema>;

// ── Request DTO ─────────────────────────────────────────

export const Phase2aAuditRequestSchema = z.object({
  artifactTypes: z.array(z.enum([...PHASE2A_ARTIFACT_TYPES])).optional(),
  dryRun: z.boolean().optional().default(false),
});
export type Phase2aAuditRequest = z.infer<typeof Phase2aAuditRequestSchema>;
