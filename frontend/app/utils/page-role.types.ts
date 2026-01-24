/**
 * Types et utilitaires pour le système de rôles SEO
 *
 * Phase 5: SEO "quasi-incopiable" - signaux multi-redondants
 */

/**
 * Rôles de pages SEO officiels
 * 1 URL = 1 rôle = 1 intention = 1 signal Google
 */
export enum PageRole {
  R1_ROUTER = "R1", // Sélection/Navigation
  R2_PRODUCT = "R2", // Transaction/Achat
  R3_BLOG = "R3", // Pédagogie/Expert
  R4_REFERENCE = "R4", // Référence métier
  R5_DIAGNOSTIC = "R5", // Diagnostic symptômes
  R6_SUPPORT = "R6", // Support/Légal
}

/**
 * Intentions de page associées à chaque rôle
 */
export type PageIntent =
  | "selection" // R1: choisir son véhicule
  | "purchase" // R2: acheter
  | "education" // R3: apprendre
  | "definition" // R4: comprendre un terme
  | "diagnosis" // R5: identifier un problème
  | "support"; // R6: obtenir de l'aide

/**
 * Types de contenu par rôle
 */
export type ContentType =
  | "router" // R1: navigation/filtres
  | "product" // R2: fiche produit
  | "article" // R3: article/guide
  | "reference" // R4: définition technique
  | "diagnostic" // R5: symptômes/causes
  | "legal" // R6: mentions légales, CGV
  | "support"; // R6: contact, aide, FAQ

/**
 * Métadonnées de rôle SEO pour une route Remix
 * À exporter via `handle` dans chaque route
 */
export interface PageRoleMeta {
  role: PageRole;
  intent: PageIntent;
  contentType: ContentType;
  clusterId?: string; // ID du cluster thématique (ex: "embrayage")
  canonicalEntity?: string; // Slug de l'entité canonique
}

/**
 * Handle Remix avec métadonnées de rôle
 */
export interface RouteHandleWithRole {
  pageRole?: PageRoleMeta;
  // Autres propriétés handle existantes
  [key: string]: unknown;
}

/**
 * Mapping rôle → intention par défaut
 */
export const ROLE_DEFAULT_INTENT: Record<PageRole, PageIntent> = {
  [PageRole.R1_ROUTER]: "selection",
  [PageRole.R2_PRODUCT]: "purchase",
  [PageRole.R3_BLOG]: "education",
  [PageRole.R4_REFERENCE]: "definition",
  [PageRole.R5_DIAGNOSTIC]: "diagnosis",
  [PageRole.R6_SUPPORT]: "support",
};

/**
 * Mapping rôle → type de contenu par défaut
 */
export const ROLE_DEFAULT_CONTENT_TYPE: Record<PageRole, ContentType> = {
  [PageRole.R1_ROUTER]: "router",
  [PageRole.R2_PRODUCT]: "product",
  [PageRole.R3_BLOG]: "article",
  [PageRole.R4_REFERENCE]: "reference",
  [PageRole.R5_DIAGNOSTIC]: "diagnostic",
  [PageRole.R6_SUPPORT]: "legal",
};

/**
 * Crée un objet PageRoleMeta avec les valeurs par défaut
 */
export function createPageRoleMeta(
  role: PageRole,
  overrides?: Partial<Omit<PageRoleMeta, "role">>,
): PageRoleMeta {
  return {
    role,
    intent: overrides?.intent || ROLE_DEFAULT_INTENT[role],
    contentType: overrides?.contentType || ROLE_DEFAULT_CONTENT_TYPE[role],
    clusterId: overrides?.clusterId,
    canonicalEntity: overrides?.canonicalEntity,
  };
}

/**
 * Labels lisibles pour les rôles (affichage debug/admin)
 */
export const PAGE_ROLE_LABELS: Record<PageRole, string> = {
  [PageRole.R1_ROUTER]: "Routeur (Sélection)",
  [PageRole.R2_PRODUCT]: "Produit (Transaction)",
  [PageRole.R3_BLOG]: "Blog/Expert (Pédagogie)",
  [PageRole.R4_REFERENCE]: "Référence (Définition)",
  [PageRole.R5_DIAGNOSTIC]: "Diagnostic (Symptômes)",
  [PageRole.R6_SUPPORT]: "Support (Aide)",
};
