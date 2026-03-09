/**
 * PageContract Shared Constants — source de verite pour les identifiants de role.
 * Aligne sur .spec/content-roles/surface-routing-matrix.md
 *
 * Importe par les schemas per-role (R1, R3, R4, R5, R6) pour garantir
 * la coherence des enums page_role et target_role.
 */

// ── Page Roles (surface-routing-matrix) ─────────────────

export const PAGE_ROLES = [
  'R0_HUB',
  'R1_ROUTER',
  'R2_PRODUCT',
  'R3_BLOG',
  'R4_REFERENCE',
  'R5_DIAGNOSTIC',
  'R6_BUYING_GUIDE',
] as const;
export type PageRole = (typeof PAGE_ROLES)[number];

// ── Link Target Roles (pour internal links, redirects) ──

export const LINK_TARGET_ROLES = [
  'R1_ROUTER',
  'R3_GUIDE',
  'R3_CONSEILS',
  'R4_REFERENCE',
  'R5_DIAGNOSTIC',
  'R6_BUYING_GUIDE',
  'OTHER',
  'NONE',
] as const;
export type LinkTargetRole = (typeof LINK_TARGET_ROLES)[number];

// ── Forbidden lexicon target roles (pour anti-cannibalisation) ──

export const FORBIDDEN_TARGET_ROLES = ['R1', 'R3', 'R5'] as const;
export type ForbiddenTargetRole = (typeof FORBIDDEN_TARGET_ROLES)[number];
