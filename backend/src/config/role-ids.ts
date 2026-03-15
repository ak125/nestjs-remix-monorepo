/**
 * Canonical Role IDs — single source of truth for page roles.
 *
 * Every other role/page-type definition (PageRole enum, PageType union,
 * content-section-policy PageRole) maps to/from this enum.
 *
 * Why NOT in @monorepo/shared-types: incident 2026-01-11
 * (crash prod — import non résolu en Docker).
 */

import type { PageType } from '../workers/types/content-refresh.types';

export enum RoleId {
  R0_HOME = 'R0_HOME',
  R1_ROUTER = 'R1_ROUTER',
  R2_PRODUCT = 'R2_PRODUCT',
  /** @deprecated R3_GUIDE is an orphan role — no route, no contract, no prompts. Use R3_CONSEILS for how-to or R6_GUIDE_ACHAT for buying guides. */
  R3_GUIDE = 'R3_GUIDE',
  R3_CONSEILS = 'R3_CONSEILS',
  R4_REFERENCE = 'R4_REFERENCE',
  R5_DIAGNOSTIC = 'R5_DIAGNOSTIC',
  R6_SUPPORT = 'R6_SUPPORT',
  R6_GUIDE_ACHAT = 'R6_GUIDE_ACHAT',
  R7_BRAND = 'R7_BRAND',
  R8_VEHICLE = 'R8_VEHICLE',
  /** @deprecated R9 n'est plus un role canonique R*. La gouvernance est G*, pas R*. */
  R9_GOVERNANCE = 'R9_GOVERNANCE',
}

/** All role IDs as an array (useful for iteration / validation) */
export const ROLE_ID_LIST: RoleId[] = Object.values(RoleId);

// ── Mappers: RoleId ↔ worker PageType ──

const ROLE_TO_PAGE_TYPE: Partial<Record<RoleId, PageType>> = {
  [RoleId.R1_ROUTER]: 'R1_pieces',
  [RoleId.R3_GUIDE]: 'R3_guide_howto',
  [RoleId.R3_CONSEILS]: 'R3_conseils',
  [RoleId.R4_REFERENCE]: 'R4_reference',
  [RoleId.R5_DIAGNOSTIC]: 'R5_diagnostic',
  [RoleId.R6_GUIDE_ACHAT]: 'R6_guide_achat',
  // R2_PRODUCT and R6_SUPPORT have no PageType equivalent in the worker
};

const PAGE_TYPE_TO_ROLE: Record<string, RoleId> = {
  R1_pieces: RoleId.R1_ROUTER,
  R3_guide_howto: RoleId.R3_CONSEILS, // was R3_GUIDE (orphan) — remapped to R3_CONSEILS
  R3_guide_achat: RoleId.R6_GUIDE_ACHAT, // FIX: was R3_GUIDE — this is buying guide = R6
  R3_conseils: RoleId.R3_CONSEILS,
  R4_reference: RoleId.R4_REFERENCE,
  R5_diagnostic: RoleId.R5_DIAGNOSTIC,
  R6_guide_achat: RoleId.R6_GUIDE_ACHAT,
};

/** Convert a RoleId to the worker PageType. Returns null for R2/R6 (no worker equivalent). */
export function roleIdToPageType(roleId: RoleId): PageType | null {
  return ROLE_TO_PAGE_TYPE[roleId] ?? null;
}

/** Convert a worker PageType string to RoleId. Returns null if unrecognized. */
export function pageTypeToRoleId(pageType: string): RoleId | null {
  return PAGE_TYPE_TO_ROLE[pageType] ?? null;
}

// ── Canonical normalization layer ──
// See .spec/00-canon/db-governance/legacy-canon-map.md v1.1.0

/** Legacy role aliases → canonical RoleId. Used for normalizing old labels. */
export const LEGACY_ROLE_ALIASES: Record<string, RoleId> = {
  R3_guide: RoleId.R6_GUIDE_ACHAT,
  R3_guide_achat: RoleId.R6_GUIDE_ACHAT,
  R3_BLOG: RoleId.R3_CONSEILS,
  R1_pieces: RoleId.R1_ROUTER,
  R4_reference: RoleId.R4_REFERENCE,
  R4_GLOSSARY: RoleId.R4_REFERENCE,
  R5_diagnostic: RoleId.R5_DIAGNOSTIC,
  R6_BUYING_GUIDE: RoleId.R6_GUIDE_ACHAT,
};

/** Role IDs forbidden in new code — ambiguous without suffix. */
export const FORBIDDEN_ROLE_IDS = ['R3', 'R6', 'R9', 'R3_GUIDE'] as const;

/**
 * Normalize any role string (canonical, legacy, or page_type) to a RoleId.
 * Returns null if unrecognized.
 */
export function normalizeRoleId(input: string): RoleId | null {
  // Direct match on enum values
  const asRole = Object.values(RoleId).find((v) => v === input);
  if (asRole) return asRole;
  // Legacy alias
  if (input in LEGACY_ROLE_ALIASES) return LEGACY_ROLE_ALIASES[input];
  // Worker page type
  return PAGE_TYPE_TO_ROLE[input] ?? null;
}

/**
 * Asserts the role string is a canonical RoleId, NOT a legacy alias.
 * Use in output paths to enforce Regle 3 (ambiguite interdite en sortie).
 * Throws if the string is not a canonical RoleId.
 */
/** Canonical roles that should not appear in new output (deprecated). */
const DEPRECATED_OUTPUT_ROLES = new Set<RoleId>([
  RoleId.R9_GOVERNANCE,
  RoleId.R3_GUIDE,
]);

export function assertCanonicalRole(role: string): RoleId {
  const canonical = Object.values(RoleId).find((v) => v === role);
  if (!canonical) {
    throw new Error(
      `Non-canonical role in output: "${role}". Use normalizeRoleId() first.`,
    );
  }
  if (DEPRECATED_OUTPUT_ROLES.has(canonical)) {
    throw new Error(
      `Deprecated role in output: "${role}". R9 is no longer a canonical role.`,
    );
  }
  return canonical;
}
