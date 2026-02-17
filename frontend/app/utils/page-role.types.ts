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
 * Phase 9: Étapes du funnel marketing
 */
export type FunnelStage =
  | "awareness" // Découverte
  | "consideration" // Réflexion
  | "decision" // Décision d'achat
  | "retention"; // Fidélisation

/**
 * Phase 9: Objectifs de conversion par page
 */
export type ConversionGoal =
  | "purchase" // Achat (produit, panier, checkout)
  | "lead" // Génération de lead (contact, devis)
  | "engagement" // Engagement (blog, guides)
  | "navigation"; // Navigation (catalogue, filtres)

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
  // Phase 9: Nouveaux attributs analytics
  funnelStage?: FunnelStage; // Étape du funnel marketing
  conversionGoal?: ConversionGoal; // Objectif de conversion
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
 * Phase 9: Mapping rôle → funnel stage par défaut
 */
export const ROLE_DEFAULT_FUNNEL_STAGE: Record<PageRole, FunnelStage> = {
  [PageRole.R1_ROUTER]: "awareness",
  [PageRole.R2_PRODUCT]: "decision",
  [PageRole.R3_BLOG]: "consideration",
  [PageRole.R4_REFERENCE]: "consideration",
  [PageRole.R5_DIAGNOSTIC]: "consideration",
  [PageRole.R6_SUPPORT]: "retention",
};

/**
 * Phase 9: Mapping rôle → conversion goal par défaut
 */
export const ROLE_DEFAULT_CONVERSION_GOAL: Record<PageRole, ConversionGoal> = {
  [PageRole.R1_ROUTER]: "navigation",
  [PageRole.R2_PRODUCT]: "purchase",
  [PageRole.R3_BLOG]: "engagement",
  [PageRole.R4_REFERENCE]: "engagement",
  [PageRole.R5_DIAGNOSTIC]: "engagement",
  [PageRole.R6_SUPPORT]: "lead",
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
    // Phase 9: Nouveaux attributs avec valeurs par défaut
    funnelStage: overrides?.funnelStage || ROLE_DEFAULT_FUNNEL_STAGE[role],
    conversionGoal:
      overrides?.conversionGoal || ROLE_DEFAULT_CONVERSION_GOAL[role],
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

/**
 * Intent utilisateur (chat RAG) — granularité fine
 */
export type UserIntent =
  | "fitment" // Compatibilité véhicule
  | "troubleshoot" // Diagnostic/panne
  | "policy" // Livraison/retour/garantie
  | "cost" // Prix/tarif
  | "compare" // Comparaison
  | "maintain" // Entretien/intervalles
  | "do" // Tutoriel/montage
  | "define" // Définition technique
  | "choose"; // Choix/achat

/**
 * Famille d'intent (regroupement pour le routage RAG)
 */
export type IntentFamily =
  | "transactional" // fitment, cost, choose
  | "informational" // define, compare, maintain
  | "diagnostic" // troubleshoot
  | "support"; // policy, do

/**
 * Mappe un UserIntent vers sa famille de routage
 */
export function mapUserIntentToFamily(intent: UserIntent): IntentFamily {
  switch (intent) {
    case "fitment":
    case "cost":
    case "choose":
      return "transactional";
    case "define":
    case "compare":
    case "maintain":
      return "informational";
    case "troubleshoot":
      return "diagnostic";
    case "policy":
    case "do":
      return "support";
  }
}

/**
 * Mappe un UserIntent vers le PageIntent correspondant
 */
export function mapUserIntentToPageIntent(intent: UserIntent): PageIntent {
  switch (intent) {
    case "fitment":
    case "choose":
      return "selection";
    case "cost":
      return "purchase";
    case "define":
    case "compare":
    case "maintain":
      return "education";
    case "troubleshoot":
      return "diagnosis";
    case "policy":
    case "do":
      return "support";
  }
}
