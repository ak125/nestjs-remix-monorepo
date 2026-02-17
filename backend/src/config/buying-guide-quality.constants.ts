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
  | 'SYMPTOMS_TOO_SMALL'
  | 'DUPLICATE_ITEMS'
  | 'MISSING_SOURCE_PROVENANCE'
  | 'INTRO_ROLE_MISMATCH';

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

// ─────────────────────────────────────────────────────────────
// RAG confidence / quality thresholds (enricher only)
// ─────────────────────────────────────────────────────────────

export const MIN_VERIFIED_CONFIDENCE = 0.8;
export const MIN_QUALITY_SCORE = 70;

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
  SYMPTOMS_TOO_SMALL: 12,
  DUPLICATE_ITEMS: 8,
  MISSING_SOURCE_PROVENANCE: 20,
  INTRO_ROLE_MISMATCH: 25,
};

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
