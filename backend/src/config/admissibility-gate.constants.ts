/**
 * Phase 1.6 — Admissibility Gate Constants.
 *
 * Rule tables driving the business admissibility gate.
 * All decisions are deterministic lookups — no LLM, no external calls.
 */
import { RoleId } from './role-ids';
import type {
  UsagePolicy,
  StalenessRisk,
} from '../modules/rag-proxy/types/rag-readiness.types';

// ── Ruleset Version (bump on any rule table change) ─────
export const ADMISSIBILITY_RULESET_VERSION = '1.3.0';

// Re-export existing forbidden terms for contamination detection
import {
  R4_FORBIDDEN_FROM_R1,
  R4_FORBIDDEN_FROM_R3,
  R4_FORBIDDEN_FROM_R5,
  R4_FORBIDDEN_FROM_R6,
} from './r4-keyword-plan.constants';
import {
  R5_FORBIDDEN_R3_TERMS,
  R5_FORBIDDEN_R4_TERMS,
} from './r5-diagnostic.constants';
import {
  R6_FORBIDDEN_FROM_R1,
  R6_FORBIDDEN_FROM_R3,
  R6_FORBIDDEN_FROM_R4,
  R6_FORBIDDEN_FROM_R5,
} from './r6-keyword-plan.constants';
import {
  R7_FORBIDDEN_FROM_R3,
  R7_FORBIDDEN_FROM_R4,
  R7_FORBIDDEN_FROM_R5,
} from './r7-keyword-plan.constants';

// ── Evidence Policy Matrix ──────────────────────────────

type TruthLevel = 'L1' | 'L2' | 'L3' | 'L4';
type ValidationStatus = 'valid' | 'pending_review' | 'quarantined';

export const EVIDENCE_POLICY_MATRIX: Record<
  TruthLevel,
  Record<ValidationStatus, UsagePolicy>
> = {
  L1: {
    valid: 'publish_candidate',
    pending_review: 'generation_allowed',
    quarantined: 'support_only',
  },
  L2: {
    valid: 'generation_allowed',
    pending_review: 'generation_limited',
    quarantined: 'support_only',
  },
  L3: {
    valid: 'generation_limited',
    pending_review: 'support_only',
    quarantined: 'blocked',
  },
  L4: {
    valid: 'support_only',
    pending_review: 'blocked',
    quarantined: 'blocked',
  },
};

// ── DocFamily → Eligible Roles ──────────────────────────

export const DOC_FAMILY_ELIGIBLE_ROLES: Record<string, RoleId[]> = {
  gamme: [
    RoleId.R3_GUIDE,
    RoleId.R3_CONSEILS,
    RoleId.R4_REFERENCE,
    RoleId.R6_GUIDE_ACHAT,
  ],
  diagnostic: [RoleId.R5_DIAGNOSTIC],
  brand: [RoleId.R7_BRAND],
  vehicle: [RoleId.R8_VEHICLE],
  reference: [RoleId.R4_REFERENCE],
  maintenance: [RoleId.R3_GUIDE, RoleId.R3_CONSEILS],
  catalog: [RoleId.R3_GUIDE, RoleId.R3_CONSEILS, RoleId.R6_GUIDE_ACHAT],
  seo_support: [RoleId.R3_GUIDE],
  raw_capture: [],
  media_prompt: [],
};

// ── Role → Required RAG Blocks ──────────────────────────
//
// Maps each role to the RAG block paths it needs to be considered sufficient.
// Uses dotted paths matching RAG_SECTION_REQUIREMENTS and frontmatter v4 format.

export interface RoleBlockRequirement {
  blockId: string;
  minItems: number;
  weight: number; // Contribution to sufficiency score
  required: boolean;
}

export const ROLE_REQUIRED_BLOCKS: Record<string, RoleBlockRequirement[]> = {
  // R3 — Conseils / Guide: needs domain, maintenance, selection, diagnostic basics
  [RoleId.R3_GUIDE]: [
    { blockId: 'domain.role', minItems: 1, weight: 15, required: true },
    {
      blockId: 'maintenance.interval',
      minItems: 1,
      weight: 10,
      required: true,
    },
    {
      blockId: 'maintenance.wear_signs',
      minItems: 1,
      weight: 10,
      required: true,
    },
    { blockId: 'selection.criteria', minItems: 3, weight: 15, required: true },
    {
      blockId: 'selection.anti_mistakes',
      minItems: 3,
      weight: 10,
      required: true,
    },
    {
      blockId: 'maintenance.good_practices',
      minItems: 2,
      weight: 10,
      required: false,
    },
    { blockId: 'diagnostic.causes', minItems: 3, weight: 10, required: false },
    { blockId: 'rendering.faq', minItems: 3, weight: 10, required: false },
  ],
  [RoleId.R3_CONSEILS]: [
    { blockId: 'domain.role', minItems: 1, weight: 15, required: true },
    {
      blockId: 'maintenance.interval',
      minItems: 1,
      weight: 10,
      required: true,
    },
    {
      blockId: 'maintenance.wear_signs',
      minItems: 1,
      weight: 10,
      required: true,
    },
    { blockId: 'selection.criteria', minItems: 3, weight: 15, required: true },
    {
      blockId: 'selection.anti_mistakes',
      minItems: 3,
      weight: 10,
      required: true,
    },
    {
      blockId: 'maintenance.good_practices',
      minItems: 2,
      weight: 10,
      required: false,
    },
    { blockId: 'diagnostic.causes', minItems: 3, weight: 10, required: false },
    { blockId: 'rendering.faq', minItems: 3, weight: 10, required: false },
  ],
  // R4 — Reference: needs domain definition, composition, variants, specs
  [RoleId.R4_REFERENCE]: [
    { blockId: 'domain.role', minItems: 1, weight: 15, required: true },
    { blockId: 'domain.definition', minItems: 1, weight: 15, required: true },
    { blockId: 'domain.composition', minItems: 1, weight: 10, required: true },
    { blockId: 'domain.variants', minItems: 1, weight: 10, required: false },
    { blockId: 'domain.key_specs', minItems: 1, weight: 10, required: false },
    {
      blockId: 'domain.related_parts',
      minItems: 1,
      weight: 5,
      required: false,
    },
    { blockId: 'rendering.faq', minItems: 3, weight: 10, required: false },
  ],
  // R5 — Diagnostic: needs symptoms, causes, quick checks
  [RoleId.R5_DIAGNOSTIC]: [
    { blockId: 'diagnostic.symptoms', minItems: 2, weight: 20, required: true },
    { blockId: 'diagnostic.causes', minItems: 2, weight: 15, required: true },
    {
      blockId: 'diagnostic.quick_checks',
      minItems: 1,
      weight: 15,
      required: true,
    },
    {
      blockId: 'diagnostic.severity',
      minItems: 1,
      weight: 10,
      required: false,
    },
    { blockId: 'diagnostic.urgency', minItems: 1, weight: 10, required: false },
    { blockId: 'rendering.faq', minItems: 2, weight: 5, required: false },
  ],
  // R6 — Guide Achat: needs selection criteria, quality tiers, compatibility
  [RoleId.R6_GUIDE_ACHAT]: [
    { blockId: 'selection.criteria', minItems: 3, weight: 15, required: true },
    {
      blockId: 'selection.quality_tiers',
      minItems: 1,
      weight: 15,
      required: true,
    },
    {
      blockId: 'selection.compatibility',
      minItems: 1,
      weight: 10,
      required: true,
    },
    {
      blockId: 'selection.anti_mistakes',
      minItems: 3,
      weight: 10,
      required: true,
    },
    { blockId: 'selection.brands', minItems: 1, weight: 10, required: false },
    {
      blockId: 'selection.price_range',
      minItems: 1,
      weight: 10,
      required: false,
    },
    { blockId: 'rendering.faq', minItems: 3, weight: 10, required: false },
  ],
  // R7 — Brand: minimal RAG blocks (mostly DB-driven)
  [RoleId.R7_BRAND]: [
    { blockId: 'brand.identity', minItems: 1, weight: 25, required: true },
    {
      blockId: 'brand.gammes_covered',
      minItems: 1,
      weight: 20,
      required: true,
    },
    {
      blockId: 'brand.quality_positioning',
      minItems: 1,
      weight: 15,
      required: false,
    },
    { blockId: 'rendering.faq', minItems: 2, weight: 10, required: false },
  ],
  // R8 — Vehicle: minimal RAG blocks (mostly DB-driven)
  [RoleId.R8_VEHICLE]: [
    {
      blockId: 'vehicle.compatibility',
      minItems: 1,
      weight: 30,
      required: true,
    },
    { blockId: 'vehicle.specs', minItems: 1, weight: 20, required: false },
    {
      blockId: 'vehicle.common_issues',
      minItems: 1,
      weight: 15,
      required: false,
    },
  ],
};

// ── Sufficiency Score Thresholds ────────────────────────

export const SUFFICIENCY_THRESHOLDS = {
  ALLOWED: 70,
  ALLOWED_WITH_LIMITS: 50,
  NOT_ENOUGH_COVERAGE: 30,
  // Below 30 → NOT_ENOUGH_EVIDENCE or BLOCKED
} as const;

/** Bonus points for trusted sources */
export const EVIDENCE_BONUS: Record<string, number> = {
  publish_candidate: 10,
  generation_allowed: 5,
  generation_limited: 0,
  support_only: -10,
  blocked: -30,
};

// ── Contamination Vocabulary ────────────────────────────
//
// Consolidates existing forbidden term lists keyed by TARGET role.
// "What terms should NOT appear in content destined for this role?"

export interface ContaminationRule {
  sourceRole: string;
  terms: readonly string[];
}

export const ROLE_FORBIDDEN_VOCABULARY: Partial<
  Record<RoleId, ContaminationRule[]>
> = {
  [RoleId.R3_GUIDE]: [
    { sourceRole: 'R5', terms: R5_FORBIDDEN_R3_TERMS },
    // R3 should not contain R4 encyclopedic terms
    { sourceRole: 'R4', terms: R5_FORBIDDEN_R4_TERMS },
  ],
  [RoleId.R3_CONSEILS]: [
    { sourceRole: 'R5', terms: R5_FORBIDDEN_R3_TERMS },
    { sourceRole: 'R4', terms: R5_FORBIDDEN_R4_TERMS },
  ],
  [RoleId.R4_REFERENCE]: [
    { sourceRole: 'R1', terms: R4_FORBIDDEN_FROM_R1 },
    { sourceRole: 'R3', terms: R4_FORBIDDEN_FROM_R3 },
    { sourceRole: 'R5', terms: R4_FORBIDDEN_FROM_R5 },
    { sourceRole: 'R6', terms: R4_FORBIDDEN_FROM_R6 },
  ],
  [RoleId.R5_DIAGNOSTIC]: [
    { sourceRole: 'R3', terms: R5_FORBIDDEN_R3_TERMS },
    { sourceRole: 'R4', terms: R5_FORBIDDEN_R4_TERMS },
  ],
  [RoleId.R6_GUIDE_ACHAT]: [
    { sourceRole: 'R1', terms: R6_FORBIDDEN_FROM_R1 },
    { sourceRole: 'R3', terms: R6_FORBIDDEN_FROM_R3 },
    { sourceRole: 'R4', terms: R6_FORBIDDEN_FROM_R4 },
    { sourceRole: 'R5', terms: R6_FORBIDDEN_FROM_R5 },
  ],
  [RoleId.R7_BRAND]: [
    { sourceRole: 'R3', terms: R7_FORBIDDEN_FROM_R3 },
    { sourceRole: 'R4', terms: R7_FORBIDDEN_FROM_R4 },
    { sourceRole: 'R5', terms: R7_FORBIDDEN_FROM_R5 },
  ],
};

// ── Freshness Thresholds (days) ─────────────────────────

export const FRESHNESS_THRESHOLDS: Record<StalenessRisk, number> = {
  low: 30,
  medium: 90,
  high: 180,
  critical: 365,
};

/** Staleness risk after which a refresh is mandatory before generation */
export const REFRESH_REQUIRED_RISK: StalenessRisk = 'high';

// ── Downstream Usage Level Degradation ──────────────────
//
// Maps document-level UsagePolicy to the per-role max downstream usage level.
// Role-specific conditions (contamination, score) can only DEGRADE, never UPGRADE.

import type { DownstreamUsageLevel } from '../modules/rag-proxy/types/rag-readiness.types';

/** Document-level policy → max allowed downstream usage for any role */
export const POLICY_TO_MAX_USAGE: Record<UsagePolicy, DownstreamUsageLevel> = {
  publish_candidate: 'publish_candidate',
  generation_allowed: 'generation_allowed',
  generation_limited: 'generation_limited',
  support_only: 'support_only',
  blocked: 'blocked',
};

/** Ordered downstream usage levels (index 0 = most permissive) */
export const DOWNSTREAM_USAGE_ORDER: DownstreamUsageLevel[] = [
  'publish_candidate',
  'generation_allowed',
  'generation_limited',
  'enrichment_only',
  'support_only',
  'exploration_only',
  'blocked',
];

// ── Downstream Usage → Allowed Next-Phase Actions ────────
//
// Cumulative: each level includes all actions from more restrictive levels.

export const NEXT_PHASE_ACTIONS = [
  'audit',
  'research',
  'pre_brief',
  'enrichment_prep',
  'compilation_support',
  'limited_generation',
  'final_generation',
  'publication',
] as const;
export type NextPhaseAction = (typeof NEXT_PHASE_ACTIONS)[number];

export const USAGE_TO_ALLOWED_ACTIONS: Record<
  DownstreamUsageLevel,
  NextPhaseAction[]
> = {
  blocked: [],
  exploration_only: ['audit'],
  support_only: ['audit', 'research', 'pre_brief'],
  enrichment_only: ['audit', 'research', 'pre_brief', 'enrichment_prep'],
  generation_limited: [
    'audit',
    'research',
    'pre_brief',
    'enrichment_prep',
    'compilation_support',
    'limited_generation',
  ],
  generation_allowed: [
    'audit',
    'research',
    'pre_brief',
    'enrichment_prep',
    'compilation_support',
    'limited_generation',
    'final_generation',
  ],
  publish_candidate: [
    'audit',
    'research',
    'pre_brief',
    'enrichment_prep',
    'compilation_support',
    'limited_generation',
    'final_generation',
    'publication',
  ],
};

// ── Role Semantic Limits ─────────────────────────────────
//
// Per-role constraints when ALLOWED_WITH_LIMITS.
// Key = `${RoleId}_ALLOWED_WITH_LIMITS`. Empty array for ALLOWED or non-applicable.

export const ROLE_SEMANTIC_LIMITS: Record<string, readonly string[]> = {
  [`${RoleId.R3_GUIDE}_ALLOWED_WITH_LIMITS`]: [
    'no_strong_claims',
    'no_definitive_faq',
    'enrichment_required_before_publish',
  ],
  [`${RoleId.R3_CONSEILS}_ALLOWED_WITH_LIMITS`]: [
    'no_strong_claims',
    'no_definitive_faq',
    'enrichment_required_before_publish',
  ],
  [`${RoleId.R4_REFERENCE}_ALLOWED_WITH_LIMITS`]: [
    'no_causal_assertions',
    'no_diagnostic_claims',
    'thin_composition_warning',
  ],
  [`${RoleId.R5_DIAGNOSTIC}_ALLOWED_WITH_LIMITS`]: [
    'no_treatment_prescription',
    'severity_unverified',
    'enrichment_required_before_publish',
  ],
  [`${RoleId.R6_GUIDE_ACHAT}_ALLOWED_WITH_LIMITS`]: [
    'no_strong_claims',
    'no_causal_assertions',
    'no_definitive_faq',
    'enrichment_required_before_publish',
  ],
  [`${RoleId.R7_BRAND}_ALLOWED_WITH_LIMITS`]: [
    'no_quality_ranking',
    'no_competitor_comparison',
    'enrichment_required_before_publish',
  ],
  [`${RoleId.R8_VEHICLE}_ALLOWED_WITH_LIMITS`]: [
    'no_definitive_specs',
    'compatibility_unverified',
  ],
};

/** Cap a downstream usage level to a maximum (only degrade, never upgrade) */
export function capUsageLevel(
  current: DownstreamUsageLevel,
  maxAllowed: DownstreamUsageLevel,
): DownstreamUsageLevel {
  const currentIdx = DOWNSTREAM_USAGE_ORDER.indexOf(current);
  const maxIdx = DOWNSTREAM_USAGE_ORDER.indexOf(maxAllowed);
  // Higher index = more restrictive. Return the more restrictive one.
  return currentIdx >= maxIdx ? current : maxAllowed;
}
