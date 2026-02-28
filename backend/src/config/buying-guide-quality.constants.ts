/**
 * Constantes partagées de qualité pour les guides d'achat (buying guides).
 *
 * Source unique (Single Source of Truth) utilisée par :
 *  - BuyingGuideEnricherService  (admin/services)
 *  - BuyingGuideDataService      (gamme-rest/services)
 *
 * NE PAS dupliquer ces constantes dans d'autres fichiers.
 */

// ─────────────────────────────────────────────────────────────
// Quality flag type
// ─────────────────────────────────────────────────────────────

/**
 * Flags qualité du contrat éditorial "GammeContentContract v1"
 */
export type GammeContentQualityFlag =
  | 'GENERIC_PHRASES'
  | 'MISSING_REQUIRED_TERMS'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'FAQ_TOO_SMALL'
  | 'FAQ_ANSWERS_TOO_SHORT'
  | 'SYMPTOMS_TOO_SMALL'
  | 'DUPLICATE_ITEMS'
  | 'MISSING_SOURCE_PROVENANCE'
  | 'INTRO_ROLE_MISMATCH'
  | 'MISSING_IMAGE'
  | 'MISSING_ALT_TEXT'
  | 'INVALID_IMAGE_RATIO'
  | 'CONTENT_OVERLAP'
  | 'H1_MUTATION_BLOCKED';

// ─────────────────────────────────────────────────────────────
// Contract versions
// ─────────────────────────────────────────────────────────────

export const CONTRACT_VERSION = 'GammeContentContract.v1' as const;
export const BUYING_GUIDE_VERSION = 'GammeBuyingGuide.v1' as const;

// ─────────────────────────────────────────────────────────────
// Narrative length thresholds
// ─────────────────────────────────────────────────────────────

export const MIN_NARRATIVE_LENGTH = 40;
export const MAX_NARRATIVE_LENGTH = 420;

/** Minimum word count for R1 sg_content (avoid too-thin router pages) */
export const MIN_R1_WORDS = 100;

/** Maximum word count for R1 sg_content (already enforced by PageRoleValidator) */
export const MAX_R1_WORDS = 150;

// ─────────────────────────────────────────────────────────────
// Section minimum thresholds
// ─────────────────────────────────────────────────────────────

/** Minimum anti-mistakes for content quality gate (BuyingGuideDataService) */
export const MIN_ANTI_MISTAKES_CONTENT = 3;

/** Minimum anti-mistakes for buying guide enrichment gate (BuyingGuideEnricherService) */
export const MIN_ANTI_MISTAKES_BUYING_GUIDE = 4;

/** Minimum arguments (Section 4 "Pourquoi acheter chez nous") */
export const MIN_ARGUMENTS = 3;

/** Minimum selection criteria for buying guide */
export const MIN_SELECTION_CRITERIA = 5;

/** Minimum decision tree nodes for buying guide */
export const MIN_DECISION_NODES = 1;

/** Minimum FAQs */
export const MIN_FAQS = 3;

/** Minimum symptoms */
export const MIN_SYMPTOMS = 3;

/** Advisory threshold for FAQ count (signal, not a gate) */
export const ADVISORY_FAQ_COUNT = 5;

/** Minimum average FAQ answer length (chars) */
export const MIN_FAQ_ANSWER_LENGTH = 80;

// ─────────────────────────────────────────────────────────────
// RAG confidence / quality thresholds (enricher only)
// ─────────────────────────────────────────────────────────────

export const MIN_VERIFIED_CONFIDENCE = 0.8;
export const MIN_QUALITY_SCORE = 70;
export const QUALITY_SCORE_ADVISORY = 85; // seuil ingestion recommendations (advisory, non-bloquant)

// ─────────────────────────────────────────────────────────────
// Generic phrases to detect (wiki-style, low value content)
// ─────────────────────────────────────────────────────────────

export const GENERIC_PHRASES: readonly string[] = [
  'rôle essentiel',
  'entretien régulier',
  'pièce importante',
  'bon fonctionnement',
  'il est recommandé',
  'il est conseillé',
  'en bon état',
  'pièce indispensable',
] as const;

// ─────────────────────────────────────────────────────────────
// Absolute claims to ban (hyperbolic/unverifiable statements)
// ─────────────────────────────────────────────────────────────

export const BAN_ABSOLUTE_CLAIMS: readonly string[] = [
  'toujours',
  'jamais',
  'meilleur',
  'le plus fiable',
  'garanti à vie',
  'le moins cher',
  'le plus performant',
  'imbattable',
  'numéro 1',
  'sans aucun doute',
] as const;

// ─────────────────────────────────────────────────────────────
// Family domain terms (required for family-specific validation)
// ─────────────────────────────────────────────────────────────

export const FAMILY_REQUIRED_TERMS = {
  freinage: ['frein', 'freinage', 'distance', 'sécurité'],
  moteur: ['moteur', 'combustion', 'lubrification', 'fiabilité'],
  suspension: ['suspension', 'stabilité', 'amortissement', 'tenue'],
  transmission: ['transmission', 'couple', 'embrayage', 'motricité'],
  electrique: ['électrique', 'charge', 'alimentation', 'batterie'],
  climatisation: ['climatisation', 'froid', 'pression', 'compresseur'],
} as const;

export type FamilyKey = keyof typeof FAMILY_REQUIRED_TERMS;

// ─────────────────────────────────────────────────────────────
// Family markers (for inferring family from gamme name)
// ─────────────────────────────────────────────────────────────

export const FAMILY_MARKERS: Record<FamilyKey, string[]> = {
  freinage: ['frein', 'disque', 'plaquette', 'étrier', 'abs'],
  moteur: ['moteur', 'injecteur', 'distribution', 'lubrification'],
  suspension: ['suspension', 'amortisseur', 'coupelle', 'ressort'],
  transmission: ['embrayage', 'cardan', 'boîte', 'transmission'],
  electrique: ['alternateur', 'batterie', 'démarreur', 'électrique'],
  climatisation: ['climatisation', 'compresseur', 'condenseur', 'évaporateur'],
};

// ─────────────────────────────────────────────────────────────
// Flag penalties (quality score = 100 - sum of penalties)
// ─────────────────────────────────────────────────────────────

export const FLAG_PENALTIES: Record<GammeContentQualityFlag, number> = {
  GENERIC_PHRASES: 18,
  MISSING_REQUIRED_TERMS: 16,
  TOO_SHORT: 10,
  TOO_LONG: 8,
  FAQ_TOO_SMALL: 14,
  FAQ_ANSWERS_TOO_SHORT: 10,
  SYMPTOMS_TOO_SMALL: 12,
  DUPLICATE_ITEMS: 8,
  MISSING_SOURCE_PROVENANCE: 20,
  INTRO_ROLE_MISMATCH: 25,
  MISSING_IMAGE: 8, // default; overridden per page type via IMAGE_PENALTIES
  MISSING_ALT_TEXT: 5, // default; overridden per page type via IMAGE_PENALTIES
  INVALID_IMAGE_RATIO: 3, // inactive V1 (detection not yet implemented)
  CONTENT_OVERLAP: 15, // cross-gamme content cannibalization detected
  H1_MUTATION_BLOCKED: 100, // hard reject: attempted to modify a QA-protected H1
};

// ─────────────────────────────────────────────────────────────
// Image penalty by page type (ref: .spec/00-canon/image-matrix-v1.md §5)
// ─────────────────────────────────────────────────────────────

export type ContentPageType =
  | 'R1_pieces'
  | 'R3_guide_achat'
  | 'R3_conseil'
  | 'R4_reference'
  | 'R5_diagnostic'
  | 'R6_panne';

export const IMAGE_PENALTIES: Record<
  ContentPageType,
  { MISSING_IMAGE: number; MISSING_ALT_TEXT: number }
> = {
  R1_pieces: { MISSING_IMAGE: 8, MISSING_ALT_TEXT: 5 }, // TRANSACTION
  R3_guide_achat: { MISSING_IMAGE: 8, MISSING_ALT_TEXT: 5 }, // GUIDE_ACHAT
  R3_conseil: { MISSING_IMAGE: 8, MISSING_ALT_TEXT: 5 }, // BLOG_CONSEIL
  R5_diagnostic: { MISSING_IMAGE: 5, MISSING_ALT_TEXT: 3 }, // DIAGNOSTIC
  R6_panne: { MISSING_IMAGE: 5, MISSING_ALT_TEXT: 3 }, // PANNE_SYMPTOME
  R4_reference: { MISSING_IMAGE: 0, MISSING_ALT_TEXT: 3 }, // GLOSSAIRE_REFERENCE
};

/**
 * Retourne la penalite image pour un page type donne.
 * Les pages SELECTION et OUTIL ne passent pas par le pipeline content-refresh.
 */
export function getImagePenalty(
  flag: 'MISSING_IMAGE' | 'MISSING_ALT_TEXT',
  pageType: string,
): number {
  const penalties = IMAGE_PENALTIES[pageType as ContentPageType];
  if (penalties) {
    return penalties[flag];
  }
  return FLAG_PENALTIES[flag];
}

// ─────────────────────────────────────────────────────────────
// Action markers (actionable verbs in buying guide content)
// ─────────────────────────────────────────────────────────────

/**
 * Accented version — used by BuyingGuideEnricherService which compares
 * against raw lowercased text (accents preserved).
 */
export const ACTION_MARKERS: readonly string[] = [
  'vérifier',
  'contrôler',
  'choisir',
  'comparer',
  'identifier',
  'confirmer',
  'mesurer',
  'valider',
  'respecter',
  'remplacer',
  'éviter',
  'filtrer',
  'sélectionner',
] as const;

/**
 * Unaccented version — used by BuyingGuideDataService which normalizes
 * text via NFD + strip diacritics before comparison.
 */
export const ACTION_MARKERS_NORMALIZED: readonly string[] = [
  'verifier',
  'controler',
  'choisir',
  'comparer',
  'identifier',
  'confirmer',
  'mesurer',
  'valider',
  'respecter',
  'remplacer',
  'eviter',
  'filtrer',
  'selectionner',
] as const;

// ─────────────────────────────────────────────────────────────
// Trusted source prefixes (source provenance validation)
// ─────────────────────────────────────────────────────────────

export const TRUSTED_SOURCE_PREFIXES: readonly string[] = [
  'db://',
  'db:',
  'pdf://',
  'pdf:',
  'oem://',
  'oem:',
  'catalog://',
  'catalog:',
  'manual://',
  'manual:',
  'tech://',
  'tech:',
  'bulletin://',
  'bulletin:',
  'scraping://',
  'scraping:',
  'rag://',
  'rag:',
  'https://',
  'http://',
] as const;
