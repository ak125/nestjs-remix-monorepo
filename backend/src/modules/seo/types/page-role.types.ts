/**
 * Rôles de pages SEO officiels
 * 1 URL = 1 rôle = 1 intention = 1 signal Google
 *
 * Hiérarchie: R4 → R3 → R5 → R1 → R2
 */
export enum PageRole {
  R1_ROUTER = 'R1', // Sélection/Navigation
  R2_PRODUCT = 'R2', // Transaction/Achat
  R3_BLOG = 'R3', // Pédagogie/Expert
  R4_REFERENCE = 'R4', // Référence métier
  R5_DIAGNOSTIC = 'R5', // Diagnostic symptômes
  R6_SUPPORT = 'R6', // Support/Légal
}

export interface PageRoleMeta {
  label: string;
  intention: string;
  maxWords?: number;
  indexable: boolean;
}

export const PAGE_ROLE_META: Record<PageRole, PageRoleMeta> = {
  [PageRole.R1_ROUTER]: {
    label: 'Routeur',
    intention: 'Trouver la bonne pièce pour son véhicule',
    maxWords: 150,
    indexable: true,
  },
  [PageRole.R2_PRODUCT]: {
    label: 'Produit',
    intention: 'Vérifier compatibilité / acheter',
    indexable: true,
  },
  [PageRole.R3_BLOG]: {
    label: 'Blog/Expert',
    intention: 'Comprendre un problème réel',
    indexable: true,
  },
  [PageRole.R4_REFERENCE]: {
    label: 'Référence',
    intention: 'Définition officielle / vérité mécanique',
    indexable: true,
  },
  [PageRole.R5_DIAGNOSTIC]: {
    label: 'Diagnostic',
    intention: 'Identifier un symptôme',
    indexable: true,
  },
  [PageRole.R6_SUPPORT]: {
    label: 'Support',
    intention: 'Rassurer / informer',
    indexable: false, // parfois noindex
  },
};

/**
 * Hiérarchie officielle des rôles (du plus "haut" au plus "bas")
 * R4 → R3 → R5 → R1 → R2
 */
export const PAGE_ROLE_HIERARCHY: PageRole[] = [
  PageRole.R4_REFERENCE,
  PageRole.R3_BLOG,
  PageRole.R5_DIAGNOSTIC,
  PageRole.R1_ROUTER,
  PageRole.R2_PRODUCT,
  PageRole.R6_SUPPORT,
];

/**
 * Règles de maillage autorisées (hiérarchique)
 * Clé = rôle source, Valeur = rôles cibles autorisés
 *
 * Schéma strict :
 * - R4 Référence → R3/R5 + R1 (optionnel)
 * - R3 Blog → R4 + R2 (1-2 max)
 * - R5 Diagnostic → R4 + R1
 * - R1 Routeur → R2 uniquement
 * - R2 Produit → R4 (1 max) + R3 (0-1 max)
 */
export const ALLOWED_LINKS: Record<PageRole, PageRole[]> = {
  [PageRole.R4_REFERENCE]: [
    PageRole.R3_BLOG,
    PageRole.R5_DIAGNOSTIC,
    PageRole.R1_ROUTER,
  ],
  [PageRole.R3_BLOG]: [PageRole.R4_REFERENCE, PageRole.R2_PRODUCT],
  [PageRole.R5_DIAGNOSTIC]: [PageRole.R4_REFERENCE, PageRole.R1_ROUTER],
  [PageRole.R1_ROUTER]: [PageRole.R2_PRODUCT],
  [PageRole.R2_PRODUCT]: [PageRole.R4_REFERENCE, PageRole.R3_BLOG], // max 1 lien R4, 0-1 lien R3
  [PageRole.R6_SUPPORT]: [], // pas de liens sortants SEO
};

/**
 * Pattern URL avec son rôle associé
 * role: null signifie page exclue du système (noindex/privée)
 */
export interface UrlRolePattern {
  pattern: RegExp;
  role: PageRole | null;
  description?: string;
}

/**
 * Patterns URL → Rôle (ordre = priorité)
 * IMPORTANT: L'ordre est critique - les patterns plus spécifiques doivent être en premier
 */
export const URL_ROLE_PATTERNS: UrlRolePattern[] = [
  // ========== EXCLURE (retourne null) ==========
  // Ces pages sont noindex ou privées - ne pas assigner de rôle
  { pattern: /^\/cart$/, role: null, description: 'Cart (noindex)' },
  { pattern: /^\/checkout/, role: null, description: 'Checkout (noindex)' },
  { pattern: /^\/account/, role: null, description: 'Account (protected)' },
  { pattern: /^\/login$/, role: null, description: 'Login (noindex)' },
  { pattern: /^\/register$/, role: null, description: 'Register (noindex)' },
  {
    pattern: /^\/forgot-password/,
    role: null,
    description: 'Forgot password (noindex)',
  },
  {
    pattern: /^\/reset-password/,
    role: null,
    description: 'Reset password (noindex)',
  },
  {
    pattern: /^\/search\/results/,
    role: null,
    description: 'Search results (dynamic)',
  },
  { pattern: /^\/recherche/, role: null, description: 'Search FR (dynamic)' },
  {
    pattern: /^\/commercial\//,
    role: null,
    description: 'Commercial B2B (noindex)',
  },
  { pattern: /^\/admin\//, role: null, description: 'Admin (noindex)' },

  // ========== R6 SUPPORT ==========
  {
    pattern: /^\/support/,
    role: PageRole.R6_SUPPORT,
    description: 'Support pages',
  },
  {
    pattern: /^\/contact$/,
    role: PageRole.R6_SUPPORT,
    description: 'Contact page',
  },
  { pattern: /^\/aide$/, role: PageRole.R6_SUPPORT, description: 'Help page' },
  {
    pattern: /^\/mentions-legales/,
    role: PageRole.R6_SUPPORT,
    description: 'Legal mentions',
  },
  {
    pattern: /^\/conditions-generales-de-vente/,
    role: PageRole.R6_SUPPORT,
    description: 'Terms of sale',
  },
  {
    pattern: /^\/politique-/,
    role: PageRole.R6_SUPPORT,
    description: 'Policies',
  },
  {
    pattern: /^\/legal/,
    role: PageRole.R6_SUPPORT,
    description: 'Legal pages',
  },
  {
    pattern: /^\/tickets/,
    role: PageRole.R6_SUPPORT,
    description: 'Tickets (support)',
  },
  {
    pattern: /^\/reviews/,
    role: PageRole.R6_SUPPORT,
    description: 'Reviews (social)',
  },
  {
    pattern: /^\/staff$/,
    role: PageRole.R6_SUPPORT,
    description: 'Staff (about)',
  },

  // ========== R4 RÉFÉRENCE AUTO ==========
  {
    pattern: /^\/reference-auto(\/|$)/,
    role: PageRole.R4_REFERENCE,
    description: 'Reference auto pages',
  },
  {
    pattern: /^\/blog-pieces-auto\/glossaire/,
    role: PageRole.R4_REFERENCE,
    description: 'Glossary (temporary)',
  },

  // ========== R5 DIAGNOSTIC ==========
  {
    pattern: /^\/diagnostic-auto(\/|$)/,
    role: PageRole.R5_DIAGNOSTIC,
    description: 'Diagnostic auto pages (Observable Pro)',
  },

  // ========== R3 BLOG/EXPERT ==========
  {
    pattern: /^\/blog-pieces-auto/,
    role: PageRole.R3_BLOG,
    description: 'Blog content',
  },

  // ========== R2 PRODUIT ==========
  {
    pattern: /^\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html$/,
    role: PageRole.R2_PRODUCT,
    description: 'Product with vehicle context',
  },
  {
    pattern: /^\/products\/\d+$/,
    role: PageRole.R2_PRODUCT,
    description: 'Legacy product',
  },

  // ========== R1 ROUTEUR ==========
  {
    pattern: /^\/pieces\/[^/]+-\d+\.html$/,
    role: PageRole.R1_ROUTER,
    description: 'Gamme page',
  },
  {
    pattern: /^\/pieces\/catalogue$/,
    role: PageRole.R1_ROUTER,
    description: 'Catalog page',
  },
  {
    pattern: /^\/constructeurs\/[^/]+\.html$/,
    role: PageRole.R1_ROUTER,
    description: 'Brand page',
  },
  {
    pattern: /^\/constructeurs\/[^/]+\/[^/]+\/[^/]+\.html$/,
    role: PageRole.R1_ROUTER,
    description: 'Vehicle type page',
  },
  {
    pattern: /^\/marques$/,
    role: PageRole.R1_ROUTER,
    description: 'Brands list',
  },
  {
    pattern: /^\/brands/,
    role: PageRole.R1_ROUTER,
    description: 'Brands (EN)',
  },
  {
    pattern: /^\/products\/ranges/,
    role: PageRole.R1_ROUTER,
    description: 'Product ranges',
  },
  {
    pattern: /^\/products\/gammes\//,
    role: PageRole.R1_ROUTER,
    description: 'Gammes legacy',
  },
  {
    pattern: /^\/gammes\//,
    role: PageRole.R1_ROUTER,
    description: 'Gammes catch-all',
  },
  {
    pattern: /^\/catalogue$/,
    role: PageRole.R1_ROUTER,
    description: 'Catalog index',
  },
  {
    pattern: /^\/vehicles$/,
    role: PageRole.R1_ROUTER,
    description: 'Vehicles selector',
  },
];

/**
 * Détermine le rôle d'une page à partir de son URL
 * @param url - L'URL relative de la page (ex: /pieces/freinage-1.html)
 * @returns Le rôle de la page ou null si non classé
 */
export function getPageRoleFromUrl(url: string): PageRole | null {
  for (const { pattern, role } of URL_ROLE_PATTERNS) {
    if (pattern.test(url)) {
      return role;
    }
  }
  return null;
}

/**
 * Vérifie si un lien de sourceRole vers targetRole est autorisé
 * @param sourceRole - Le rôle de la page source
 * @param targetRole - Le rôle de la page cible
 * @returns true si le lien est autorisé
 */
export function isLinkAllowed(
  sourceRole: PageRole,
  targetRole: PageRole,
): boolean {
  return ALLOWED_LINKS[sourceRole]?.includes(targetRole) ?? false;
}

/**
 * Retourne le rang hiérarchique d'un rôle (0 = plus haut)
 * @param role - Le rôle à évaluer
 * @returns L'index dans la hiérarchie
 */
export function getRoleHierarchyRank(role: PageRole): number {
  return PAGE_ROLE_HIERARCHY.indexOf(role);
}

/**
 * Vérifie si sourceRole est plus haut dans la hiérarchie que targetRole
 * @param sourceRole - Le rôle source
 * @param targetRole - Le rôle cible
 * @returns true si sourceRole est au-dessus de targetRole
 */
export function isRoleAbove(
  sourceRole: PageRole,
  targetRole: PageRole,
): boolean {
  return getRoleHierarchyRank(sourceRole) < getRoleHierarchyRank(targetRole);
}

// =====================================================
// R3 Blog sub-roles (conseils vs guide-achat)
// =====================================================

/**
 * R3 Blog sub-roles
 */
export type R3SubRole = 'conseils' | 'guide-achat';

/**
 * Detect R3 sub-role from URL pattern
 */
export function getR3SubRoleFromUrl(url: string): R3SubRole | null {
  if (url.includes('/blog-pieces-auto/conseils/')) return 'conseils';
  if (url.includes('/blog-pieces-auto/guide-achat/')) return 'guide-achat';
  return null;
}

// =====================================================
// RoleId — canonical source of truth (Phase 0)
// =====================================================

export { RoleId } from '../../../config/role-ids';
import { RoleId } from '../../../config/role-ids';

/**
 * Map PageRole enum to canonical RoleId.
 * R3 needs URL context (r3SubRole) to distinguish guide vs conseils.
 * Default R3 (no sub-role) → R3_GUIDE.
 */
export function pageRoleToRoleId(
  role: PageRole,
  r3SubRole?: R3SubRole,
): RoleId | null {
  switch (role) {
    case PageRole.R1_ROUTER:
      return RoleId.R1_ROUTER;
    case PageRole.R2_PRODUCT:
      return RoleId.R2_PRODUCT;
    case PageRole.R3_BLOG:
      if (r3SubRole === 'conseils') return RoleId.R3_CONSEILS;
      return RoleId.R3_GUIDE;
    case PageRole.R4_REFERENCE:
      return RoleId.R4_REFERENCE;
    case PageRole.R5_DIAGNOSTIC:
      return RoleId.R5_DIAGNOSTIC;
    case PageRole.R6_SUPPORT:
      return RoleId.R6_SUPPORT;
    default:
      return null;
  }
}
