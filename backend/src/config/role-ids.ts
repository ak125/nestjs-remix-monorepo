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
  R1_ROUTER = 'R1_ROUTER',
  R2_PRODUCT = 'R2_PRODUCT',
  R3_GUIDE = 'R3_GUIDE',
  R3_CONSEILS = 'R3_CONSEILS',
  R4_REFERENCE = 'R4_REFERENCE',
  R5_DIAGNOSTIC = 'R5_DIAGNOSTIC',
  R6_SUPPORT = 'R6_SUPPORT',
}

/** All role IDs as an array (useful for iteration / validation) */
export const ROLE_ID_LIST: RoleId[] = Object.values(RoleId);

// ── Mappers: RoleId ↔ worker PageType ──

const ROLE_TO_PAGE_TYPE: Partial<Record<RoleId, PageType>> = {
  [RoleId.R1_ROUTER]: 'R1_pieces',
  [RoleId.R3_GUIDE]: 'R3_guide_achat',
  [RoleId.R3_CONSEILS]: 'R3_conseils',
  [RoleId.R4_REFERENCE]: 'R4_reference',
  [RoleId.R5_DIAGNOSTIC]: 'R5_diagnostic',
  // R2_PRODUCT and R6_SUPPORT have no PageType equivalent in the worker
};

const PAGE_TYPE_TO_ROLE: Record<string, RoleId> = {
  R1_pieces: RoleId.R1_ROUTER,
  R3_guide_achat: RoleId.R3_GUIDE,
  R3_conseils: RoleId.R3_CONSEILS,
  R4_reference: RoleId.R4_REFERENCE,
  R5_diagnostic: RoleId.R5_DIAGNOSTIC,
};

/** Convert a RoleId to the worker PageType. Returns null for R2/R6 (no worker equivalent). */
export function roleIdToPageType(roleId: RoleId): PageType | null {
  return ROLE_TO_PAGE_TYPE[roleId] ?? null;
}

/** Convert a worker PageType string to RoleId. Returns null if unrecognized. */
export function pageTypeToRoleId(pageType: string): RoleId | null {
  return PAGE_TYPE_TO_ROLE[pageType] ?? null;
}
