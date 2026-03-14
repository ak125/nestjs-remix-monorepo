/**
 * Phase 2A — Shadow Audit Constants.
 *
 * Scan targets, governance rules, confidence thresholds, and contract mappings
 * for the legacy→canonical shadow audit. All decisions are deterministic lookups.
 */
import { RoleId } from './role-ids';

// ── Ruleset Version ─────────────────────────────────────
export const PHASE2A_VERSION = '2.0.0';

// ── Confidence Thresholds ───────────────────────────────

export const CONFIDENCE_THRESHOLDS = {
  /** Direct canonical enum match */
  HIGH: 0.9,
  /** Legacy alias resolved via LEGACY_ROLE_ALIASES */
  MEDIUM: 0.7,
  /** Inferred from filename/path pattern */
  LOW: 0.5,
  /** Ambiguous — bare R3/R6/R9 or unknown */
  AMBIGUOUS: 0.3,
} as const;

// ── Confidence Band Boundaries ──────────────────────────
// Maps numeric confidence to human-readable bands.

import type { ConfidenceBand } from '../modules/rag-proxy/types/rag-phase2a.types';

export function confidenceToBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'HIGH';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (confidence >= CONFIDENCE_THRESHOLDS.LOW) return 'LOW';
  return 'UNSAFE';
}

// ── G2 Diversite Threshold ───────────────────────────────
// If a single role represents more than this % of editorial findings → WARN
export const G2_CONCENTRATION_THRESHOLD = 0.7;

// ── Contract Schema Map ─────────────────────────────────
// Maps each canonical role to its expected page-contract schema file.
// Used by G4 (Promotion Control) to verify contract existence.

export const CONTRACT_SCHEMA_MAP: Partial<Record<RoleId, string>> = {
  [RoleId.R1_ROUTER]: 'page-contract-r1.schema.ts',
  [RoleId.R3_GUIDE]: 'page-contract-r3.schema.ts',
  [RoleId.R3_CONSEILS]: 'page-contract-r3.schema.ts',
  [RoleId.R4_REFERENCE]: 'page-contract-r4.schema.ts',
  [RoleId.R5_DIAGNOSTIC]: 'page-contract-r5.schema.ts',
  [RoleId.R6_GUIDE_ACHAT]: 'page-contract-r6.schema.ts',
  [RoleId.R7_BRAND]: 'page-contract-r7.schema.ts',
  [RoleId.R8_VEHICLE]: 'page-contract-r8.schema.ts',
};

// ── Keyword Plan Constants Map ──────────────────────────
// Maps roles to their keyword plan constants files.

export const KEYWORD_PLAN_MAP: Partial<Record<RoleId, string>> = {
  [RoleId.R1_ROUTER]: 'r1-keyword-plan.constants.ts',
  [RoleId.R4_REFERENCE]: 'r4-keyword-plan.constants.ts',
  [RoleId.R6_GUIDE_ACHAT]: 'r6-keyword-plan.constants.ts',
  [RoleId.R7_BRAND]: 'r7-keyword-plan.constants.ts',
  [RoleId.R8_VEHICLE]: 'r8-keyword-plan.constants.ts',
};

// ── Code Artifact Scan Targets ──────────────────────────

export const CODE_SCAN_PATHS = {
  /** Page contract schemas — 1 per role */
  schemas: 'backend/src/config/page-contract-r*.schema.ts',
  /** Keyword plan constants — 1 per role */
  constants: 'backend/src/config/*-keyword-plan.constants.ts',
  /** Services that reference roles directly */
  services: [
    'backend/src/modules/admin/services/content-refresh.service.ts',
    'backend/src/modules/admin/services/buying-guide-enricher.service.ts',
    'backend/src/modules/rag-proxy/services/rag-normalization.service.ts',
    'backend/src/modules/rag-proxy/services/rag-admissibility-gate.service.ts',
  ],
  /** Role definition files */
  roleDefinitions: [
    'backend/src/config/role-ids.ts',
    'backend/src/workers/types/content-refresh.types.ts',
  ],
} as const;

// ── DB Artifact Queries ─────────────────────────────────

export const DB_SCAN_QUERIES = {
  seoPageRoles:
    'SELECT DISTINCT page_role FROM __seo_page WHERE page_role IS NOT NULL',
  seoConseilPageTypes:
    'SELECT DISTINCT page_type FROM __seo_gamme_conseil WHERE page_type IS NOT NULL',
  ragDocFamilies:
    'SELECT DISTINCT doc_family, canonical_status FROM __rag_knowledge WHERE phase15_status IS NOT NULL AND doc_family IS NOT NULL',
  seoPurchaseGuideRoles:
    'SELECT DISTINCT page_role FROM __seo_gamme_purchase_guide WHERE page_role IS NOT NULL',
} as const;

// ── Doc Artifact Scan Targets ───────────────────────────

export const DOC_SCAN_PATHS = {
  agents: '.claude/agents/*.md',
  canonSpecs: '.spec/00-canon/**/*.md',
  skillRefs: '.claude/skills/seo-content-architect/references/*.md',
} as const;

// ── Frontend Artifact Scan Targets ──────────────────────

export const FRONTEND_SCAN_PATHS = {
  pageRoleTypes: 'frontend/app/utils/page-role.types.ts',
  routes: [
    'frontend/app/routes/pieces.*.tsx',
    'frontend/app/routes/reference-auto.*.tsx',
  ],
} as const;

// ── Role Detection Regex ────────────────────────────────
// Used to extract role labels from file content.

export const ROLE_LABEL_REGEX =
  /\b(R[0-9]_[A-Z_]+|R3_guide(?:_(?:achat|howto))?|R3_BLOG|R3_conseils|R[0-9]_pieces|R[0-9]_diagnostic|R[0-9]_reference|R[0-9]_vehicle)\b/g;

/** Bare ambiguous role references (forbidden in output) */
export const BARE_ROLE_REGEX = /\b(R[3689])\b(?!_)/g;

// ── Route → Role Mapping ────────────────────────────────
// From legacy-canon-map.md section 5.

export const ROUTE_TO_ROLE: Record<string, RoleId> = {
  'pieces.': RoleId.R1_ROUTER,
  'reference-auto.': RoleId.R4_REFERENCE,
  'diagnostic.': RoleId.R5_DIAGNOSTIC,
  'admin.': RoleId.R0_HOME, // admin routes don't have a single editorial role
};

// ── Governance Rule Descriptions ────────────────────────

export const GOVERNANCE_RULE_DESCRIPTIONS = {
  G1_PURETE:
    'Artifact must target exactly one canonical role. No ambiguous or mixed labels.',
  G2_DIVERSITE:
    'Artifact role distribution must not be excessively concentrated on a single role.',
  G3_ANTI_CANNIBALISATION:
    'No two artifacts should claim the same route prefix for different roles.',
  G4_PROMOTION_CONTROL:
    'In Phase 2A, G4 controls promotion toward Phase 2 real — not public publication. A page-contract schema must exist for the projected role.',
  G5_REVIEW_ESCALATION:
    'Artifacts with low confidence or unresolved collisions require human review.',
} as const;

// ── Artifact Scope Inference ────────────────────────────
// Maps artifact characteristics to scope classification.

import type { Phase2aArtifactScope } from '../modules/rag-proxy/types/rag-phase2a.types';

export function inferArtifactScope(
  artifactPath: string,
  roleCandidate: RoleId | null,
): Phase2aArtifactScope {
  // Multi-role definition files are transverse
  if (
    artifactPath.includes('role-ids') ||
    artifactPath.includes('page-role.types') ||
    artifactPath.includes('content-refresh.types')
  ) {
    return 'transverse';
  }
  // Support roles
  if (roleCandidate === RoleId.R6_SUPPORT) return 'support';
  // Admin/checkout = app
  if (artifactPath.includes('admin.') || artifactPath.includes('checkout')) {
    return 'app';
  }
  // Default editorial for R1-R8 content roles
  return 'editorial';
}
