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
  R0_HOME = "R0", // Accueil/Découverte
  R1_ROUTER = "R1", // Sélection/Navigation
  R2_PRODUCT = "R2", // Transaction/Achat
  /** @deprecated Use R3_CONSEILS (blog/conseils) or R6_GUIDE_ACHAT (guide d'achat) */
  R3_BLOG = "R3", // Pédagogie/Expert — LEGACY, see R3_CONSEILS
  R3_CONSEILS = "R3_CONSEILS", // Conseils/Blog (canonical)
  R4_REFERENCE = "R4", // Référence métier
  R5_DIAGNOSTIC = "R5", // Diagnostic symptômes
  R6_SUPPORT = "R6", // Support/Légal
  R6_GUIDE_ACHAT = "R6_GUIDE", // Guide d'achat
  R7_BRAND = "R7", // Marque/Constructeur
  R8_VEHICLE = "R8", // Véhicule (sélection pièces par véhicule spécifique)
  RX_CHECKOUT = "RX_CHECKOUT", // Checkout/Paiement (funnel transactionnel)
}

/**
 * Intentions de page associées à chaque rôle
 */
export type PageIntent =
  | "discovery" // R0: découvrir le catalogue
  | "selection" // R1: choisir son véhicule
  | "purchase" // R2: acheter
  | "education" // R3: apprendre
  | "definition" // R4: comprendre un terme
  | "diagnosis" // R5: identifier un problème
  | "support" // R6: obtenir de l'aide
  | "buying_guide" // R6_GUIDE: choisir la bonne pièce
  | "brand_selection" // R7: sélectionner par marque
  | "vehicle_selection" // R8: sélectionner pièces pour un véhicule
  | "checkout"; // RX_CHECKOUT: finaliser l'achat

/**
 * Types de contenu par rôle
 */
export type ContentType =
  | "homepage" // R0: page d'accueil
  | "router" // R1: navigation/filtres
  | "product" // R2: fiche produit
  | "article" // R3: article/guide
  | "reference" // R4: définition technique
  | "diagnostic" // R5: symptômes/causes
  | "legal" // R6: mentions légales, CGV
  | "support" // R6: contact, aide, FAQ
  | "guide" // R6_GUIDE: guide d'achat
  | "brand" // R7: page constructeur/marque
  | "vehicle" // R8: page véhicule (catalogue pièces)
  | "checkout"; // RX_CHECKOUT: tunnel de conversion

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
  [PageRole.R0_HOME]: "discovery",
  [PageRole.R1_ROUTER]: "selection",
  [PageRole.R2_PRODUCT]: "purchase",
  [PageRole.R3_BLOG]: "education",
  [PageRole.R3_CONSEILS]: "education",
  [PageRole.R4_REFERENCE]: "definition",
  [PageRole.R5_DIAGNOSTIC]: "diagnosis",
  [PageRole.R6_SUPPORT]: "support",
  [PageRole.R6_GUIDE_ACHAT]: "buying_guide",
  [PageRole.R7_BRAND]: "brand_selection",
  [PageRole.R8_VEHICLE]: "vehicle_selection",
  [PageRole.RX_CHECKOUT]: "checkout",
};

/**
 * Mapping rôle → type de contenu par défaut
 */
export const ROLE_DEFAULT_CONTENT_TYPE: Record<PageRole, ContentType> = {
  [PageRole.R0_HOME]: "homepage",
  [PageRole.R1_ROUTER]: "router",
  [PageRole.R2_PRODUCT]: "product",
  [PageRole.R3_BLOG]: "article",
  [PageRole.R3_CONSEILS]: "article",
  [PageRole.R4_REFERENCE]: "reference",
  [PageRole.R5_DIAGNOSTIC]: "diagnostic",
  [PageRole.R6_SUPPORT]: "legal",
  [PageRole.R6_GUIDE_ACHAT]: "guide",
  [PageRole.R7_BRAND]: "brand",
  [PageRole.R8_VEHICLE]: "vehicle",
  [PageRole.RX_CHECKOUT]: "checkout",
};

/**
 * Phase 9: Mapping rôle → funnel stage par défaut
 */
export const ROLE_DEFAULT_FUNNEL_STAGE: Record<PageRole, FunnelStage> = {
  [PageRole.R0_HOME]: "awareness",
  [PageRole.R1_ROUTER]: "awareness",
  [PageRole.R2_PRODUCT]: "decision",
  [PageRole.R3_BLOG]: "consideration",
  [PageRole.R3_CONSEILS]: "consideration",
  [PageRole.R4_REFERENCE]: "consideration",
  [PageRole.R5_DIAGNOSTIC]: "consideration",
  [PageRole.R6_SUPPORT]: "retention",
  [PageRole.R6_GUIDE_ACHAT]: "consideration",
  [PageRole.R7_BRAND]: "awareness",
  [PageRole.R8_VEHICLE]: "awareness",
  [PageRole.RX_CHECKOUT]: "decision",
};

/**
 * Phase 9: Mapping rôle → conversion goal par défaut
 */
export const ROLE_DEFAULT_CONVERSION_GOAL: Record<PageRole, ConversionGoal> = {
  [PageRole.R0_HOME]: "navigation",
  [PageRole.R1_ROUTER]: "navigation",
  [PageRole.R2_PRODUCT]: "purchase",
  [PageRole.R3_BLOG]: "engagement",
  [PageRole.R3_CONSEILS]: "engagement",
  [PageRole.R4_REFERENCE]: "engagement",
  [PageRole.R5_DIAGNOSTIC]: "engagement",
  [PageRole.R6_SUPPORT]: "lead",
  [PageRole.R6_GUIDE_ACHAT]: "purchase",
  [PageRole.R7_BRAND]: "navigation",
  [PageRole.R8_VEHICLE]: "navigation",
  [PageRole.RX_CHECKOUT]: "purchase",
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
  [PageRole.R0_HOME]: "Accueil (Découverte)",
  [PageRole.R1_ROUTER]: "Routeur (Sélection)",
  [PageRole.R2_PRODUCT]: "Produit (Transaction)",
  [PageRole.R3_BLOG]: "Blog/Expert (Pédagogie)", // legacy — prefer R3_CONSEILS
  [PageRole.R3_CONSEILS]: "Conseils (Pédagogie)",
  [PageRole.R4_REFERENCE]: "Référence (Définition)",
  [PageRole.R5_DIAGNOSTIC]: "Diagnostic (Symptômes)",
  [PageRole.R6_SUPPORT]: "Support (Aide)",
  [PageRole.R6_GUIDE_ACHAT]: "Guide d'achat (Choix)",
  [PageRole.R7_BRAND]: "Marque (Constructeur)",
  [PageRole.R8_VEHICLE]: "Vehicule (Catalogue pieces)",
  [PageRole.RX_CHECKOUT]: "Checkout (Transaction)",
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

// ── Legacy Role Normalization ──
// See .spec/00-canon/db-governance/legacy-canon-map.md v1.1.0

/** Legacy role strings → canonical PageRole. Used for normalizing old labels in frontend. */
export const LEGACY_PAGE_ROLE_MAP: Record<string, PageRole> = {
  R3_BLOG: PageRole.R3_CONSEILS,
  R3_guide: PageRole.R6_GUIDE_ACHAT,
  R3_guide_achat: PageRole.R6_GUIDE_ACHAT,
  R3: PageRole.R3_CONSEILS, // ambiguous bare R3 → default conseils
};

/**
 * Normalize a legacy role string to canonical PageRole.
 * Returns null if unrecognized.
 */
export function normalizeLegacyPageRole(input: string): PageRole | null {
  // Legacy map takes priority — enforces canonical output (Rule 1)
  const legacy = LEGACY_PAGE_ROLE_MAP[input];
  if (legacy) return legacy;
  const direct = Object.values(PageRole).find((v) => v === input);
  if (direct) return direct;
  return null;
}

/** True for editorial R* roles (R0-R8), false for app roles (RX_CHECKOUT) */
export function isEditorialRole(role: PageRole): boolean {
  return role !== PageRole.RX_CHECKOUT;
}
