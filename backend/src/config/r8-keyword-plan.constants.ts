/**
 * R8 Keyword Plan constants — pipeline 8 prompts (P0→P7), section config, negatives, gates.
 * Used for R8_VEHICLE pages: /constructeurs/{brand}/{model}/{type}.html
 *
 * Pipeline : P0 Boundary+Focus → P1 Keyword Planner → P2 Cluster+Coverage →
 *            P3 H-Structure → P4 Writer (compat) → P5 Writer (seo+table) →
 *            P6 Writer (catalog+bestsellers) → P7 Writer+QA (errors+faq+trust)
 * 10 sections stables, 6 keyword-targeted, 4 UI-only.
 */
import type {
  GateDefinition,
  GateResult,
  PriorityFix,
  AuditResult,
} from './keyword-plan.constants';

// Re-export shared interfaces (no duplication)
export type { GateDefinition, GateResult, PriorityFix, AuditResult };

// ── Pipeline phases R8 (8 prompts + complete) ───────────

export const R8_KP_PIPELINE_PHASES = [
  'P0_BOUNDARY_FOCUS',
  'P1_KEYWORD_PLANNER',
  'P2_CLUSTER_COVERAGE',
  'P3_HSTRUCTURE',
  'P4_WRITER_COMPAT',
  'P5_WRITER_SEO_TABLE',
  'P6_WRITER_CATALOG',
  'P7_WRITER_QA',
  'complete',
] as const;
export type R8KpPipelinePhase = (typeof R8_KP_PIPELINE_PHASES)[number];

// ── Section types for R8 pages (10 sections stables) ────

export const R8_PLANNABLE_SECTIONS = [
  'S_IDENTITY',
  'S_COMPAT_CHECK',
  'S_FAST_ACCESS',
  'S_SEO_INTRO',
  'S_SAFE_TABLE',
  'S_CATALOG',
  'S_BESTSELLERS',
  'S_ANTI_ERRORS',
  'S_FAQ',
  'S_TRUST',
] as const;
export type R8PlannableSection = (typeof R8_PLANNABLE_SECTIONS)[number];

export type R8SeoPriority = 'P0' | 'P1' | 'P2';

export interface R8SectionDef {
  label: string;
  required: boolean;
  /** true = keyword planner generates clusters/terms for this section */
  keyword_targeted: boolean;
  seo_priority: R8SeoPriority;
}

export const R8_SECTION_CONFIG: Record<R8PlannableSection, R8SectionDef> = {
  S_IDENTITY: {
    label: 'Hero Identity (H1 + subtitle + proof bar)',
    required: true,
    keyword_targeted: true,
    seo_priority: 'P0',
  },
  S_COMPAT_CHECK: {
    label: 'Vérification compatibilité (VIN/CNIT pré-formulaire)',
    required: true,
    keyword_targeted: true,
    seo_priority: 'P0',
  },
  S_FAST_ACCESS: {
    label: 'Accès rapides (chips familles + recherche)',
    required: true,
    keyword_targeted: false,
    seo_priority: 'P1',
  },
  S_SEO_INTRO: {
    label: 'Micro-texte SEO (compatibilité-first, 90-140 mots)',
    required: true,
    keyword_targeted: true,
    seo_priority: 'P0',
  },
  S_SAFE_TABLE: {
    label: 'Fiche technique (tableau 2 colonnes)',
    required: true,
    keyword_targeted: false,
    seo_priority: 'P2',
  },
  S_CATALOG: {
    label: 'Catalogue familles filtrées par véhicule',
    required: true,
    keyword_targeted: true,
    seo_priority: 'P0',
  },
  S_BESTSELLERS: {
    label: 'Pièces populaires (top 8)',
    required: false,
    keyword_targeted: true,
    seo_priority: 'P1',
  },
  S_ANTI_ERRORS: {
    label: 'Erreurs fréquentes (3-5 bullets dynamiques)',
    required: true,
    keyword_targeted: true,
    seo_priority: 'P0',
  },
  S_FAQ: {
    label: 'FAQ dynamique + carte grise',
    required: true,
    keyword_targeted: true,
    seo_priority: 'P0',
  },
  S_TRUST: {
    label: 'Badges confiance (garantie/livraison/conseil/retour)',
    required: true,
    keyword_targeted: false,
    seo_priority: 'P2',
  },
};

// ── Derived helper constants ────────────────────────────

export const R8_KEYWORD_TARGETED_SECTIONS = R8_PLANNABLE_SECTIONS.filter(
  (s) => R8_SECTION_CONFIG[s].keyword_targeted,
);

export const R8_REQUIRED_SECTIONS = R8_PLANNABLE_SECTIONS.filter(
  (s) => R8_SECTION_CONFIG[s].required,
);

// ── Global negatives (anti-cannib R3/R4/R5 — 5 catégories) ──

/** R3 diagnostic/pannes terms forbidden in R8 */
export const R8_FORBIDDEN_DIAGNOSTIC = [
  'symptômes',
  'causes',
  'voyant',
  'ne démarre pas',
  'fumée',
  'tremblements',
  'bruit',
  'vibration',
  'claquement',
  'grincement',
  'surchauffe',
  'calage',
  'a-coup',
  'perte de puissance',
] as const;

/** R3 réparation/howto terms forbidden in R8 */
export const R8_FORBIDDEN_REPARATION = [
  'comment changer',
  'tutoriel',
  'démontage',
  'couple serrage',
  'étape par étape',
  'pas à pas',
  'outils nécessaires',
  'durée intervention',
  'difficulté',
  'guide montage',
] as const;

/** R4 glossaire/définition terms forbidden in R8 */
export const R8_FORBIDDEN_GLOSSAIRE = [
  'définition',
  "c'est quoi",
  'fonctionnement',
  'rôle de',
  'à quoi sert',
  'principe de',
  'mécanisme',
] as const;

/** R5 comparatif/avis terms forbidden in R8 */
export const R8_FORBIDDEN_COMPARATIF = [
  'meilleur',
  'comparatif',
  'test',
  'avis',
] as const;

/** Promesses non prouvées (pas de données prix/livraison) */
export const R8_FORBIDDEN_PROMESSES = [
  'prix garanti',
  'livraison garantie',
  'moins cher',
] as const;

/** All negatives grouped by category (for P0 boundary + P2 reject gate) */
export const R8_GLOBAL_NEGATIVES = {
  R3_DIAGNOSTIC_PANNES: R8_FORBIDDEN_DIAGNOSTIC,
  R3_REPARATION: R8_FORBIDDEN_REPARATION,
  R4_GLOSSAIRE: R8_FORBIDDEN_GLOSSAIRE,
  R5_COMPARATIF_AVIS: R8_FORBIDDEN_COMPARATIF,
  PROMESSES_NON_PROUVEES: R8_FORBIDDEN_PROMESSES,
} as const;

/** Flat array of all forbidden terms (for quick includes check) */
export const R8_ALL_FORBIDDEN_TERMS = [
  ...R8_FORBIDDEN_DIAGNOSTIC,
  ...R8_FORBIDDEN_REPARATION,
  ...R8_FORBIDDEN_GLOSSAIRE,
  ...R8_FORBIDDEN_COMPARATIF,
  ...R8_FORBIDDEN_PROMESSES,
] as const;

// ── Generic phrases (pénalisées si ratio > 10%) ────────

export const R8_GENERIC_PHRASES = [
  'de qualité',
  'au meilleur prix',
  'large gamme',
  'livraison rapide',
  'satisfaction garantie',
  "n'hésitez pas",
  'nous proposons',
  'vous trouverez',
  'découvrez notre',
  'produit de qualité',
] as const;

// ── Quality gates (pipeline P2) ────────────────────────

export const R8_QUALITY_GATES = {
  /** Minimum queries in P1 pool */
  minQueryPoolSize: 8,
  /** Maximum queries in P1 pool */
  maxQueryPoolSize: 30,
  /** Minimum clusters after P2 grouping */
  minClusters: 3,
  /** Maximum clusters after P2 grouping */
  maxClusters: 8,
  /** At least 5% rejected = proof of filtering */
  minRejectedRatio: 0.05,
  /** > 60% rejected = pool too dirty */
  maxRejectedRatio: 0.6,
  /** Minimum quality score for DB write (4-axis total) */
  minQualityScore: 70,
} as const;

// ── Quality scoring axes (P3 output) ──────────────────

export const R8_QUALITY_AXES = {
  /** Alignment with vehicle_selection intent */
  intent_fit: { max: 40 },
  /** % of catalog families covered by terms */
  catalog_coverage: { max: 25 },
  /** No duplication with R3/R4/R5/R7 */
  uniqueness: { max: 20 },
  /** Scannability, actionable terms */
  ux_clarity: { max: 15 },
} as const;

// ── Gate definitions R8 (RG1-RG5) ─────────────────────

export const R8_GATE_DEFINITIONS: Record<string, GateDefinition> = {
  RG1_INTENT_ALIGNMENT: {
    description: 'Intent = vehicle_selection (awareness→consideration)',
    penalty: 30,
  },
  RG2_BOUNDARY_RESPECT: {
    description: 'No R3/R4/R5 terms in headings, terms, or content',
    penalty: 25,
  },
  RG3_CATALOG_SEED: {
    description:
      'All family/gamme names from real catalog data (no hallucination)',
    penalty: 20,
  },
  RG4_VEHICLE_QUALIFIER: {
    description: 'Every query contains {brand}+{model} or {type_name}',
    penalty: 15,
  },
  RG5_REJECT_RATIO: {
    description: 'Rejected queries ratio between 5% and 60%',
    penalty: 10,
  },
};

// ── Whitelist intent targets R8 ────────────────────────

export const R8_WHITELIST_INTENTS = [
  'pièces compatibles',
  'catalogue pièces',
  'compatibilité véhicule',
  'référence OE',
  'entretien',
  'révision',
  'kit distribution',
  'plaquettes frein',
  'disques frein',
  'filtre huile',
  'filtre air',
  'filtre habitacle',
  'amortisseur',
  'courroie',
  'bougie',
  'embrayage',
] as const;

// ── Intent tags for P1 query pool ─────────────────────

export const R8_INTENT_TAGS = [
  'compat',
  'catalog',
  'trust',
  'anti_error',
] as const;
export type R8IntentTag = (typeof R8_INTENT_TAGS)[number];

// ── Query risk levels for P1 ──────────────────────────

export const R8_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type R8RiskLevel = (typeof R8_RISK_LEVELS)[number];

// ── Query stages (head/mid/long tail) ─────────────────

export const R8_QUERY_STAGES = ['head', 'mid', 'long'] as const;
export type R8QueryStage = (typeof R8_QUERY_STAGES)[number];

// ── H2 heading templates (seed for P3) ────────────────

export const R8_HEADING_TEMPLATES = {
  S_IDENTITY: 'Pièces compatibles {brand} {model} {type_name} {power} ch',
  S_SEO_INTRO: 'Catalogue pièces {brand} {model} {type_name}',
  S_CATALOG: 'Familles de pièces pour {brand} {model}',
  S_ANTI_ERRORS: 'Erreurs fréquentes à éviter — {brand} {model} {type_name}',
  S_FAQ: 'Questions fréquentes — {brand} {model} {type_name}',
  S_COMPAT_CHECK: 'Vérifier la compatibilité de votre {brand} {model}',
} as const;

// ── Skip logic conditions ─────────────────────────────

export const R8_SKIP_CONDITIONS = {
  /** No catalog families = fatal error (no R8 page without catalog) */
  FATAL_NO_CATALOG: 'catalog_families_empty',
  /** No motor codes = skip code moteur mentions in S_ANTI_ERRORS/S_FAQ */
  SKIP_MOTOR_CODES: 'motor_codes_absent',
  /** No mine/cnit = skip carte grise question in S_FAQ */
  SKIP_CARTE_GRISE: 'mine_cnit_absent',
  /** Less than 2 siblings = skip comparison in S_ANTI_ERRORS */
  SKIP_COMPARISON: 'siblings_lt_2',
} as const;

// ── Quality modes (A/B/C) ─────────────────────────────

export const R8_QUALITY_MODES = ['A', 'B', 'C'] as const;
export type R8QualityMode = (typeof R8_QUALITY_MODES)[number];

export const R8_QUALITY_MODE_CONFIG = {
  /** Lean : minimal, rapide, 0 fluff */
  A: {
    label: 'Lean',
    seo_intro_words: { min: 60, max: 90 },
    anti_errors_count: { min: 3, max: 3 },
    faq_count: { min: 4, max: 4 },
    include_vin_cnit_proof: false,
    include_microcopy: false,
    include_internal_links: false,
  },
  /** Standard : + micro preuves (VIN/CNIT, années) */
  B: {
    label: 'Standard',
    seo_intro_words: { min: 90, max: 140 },
    anti_errors_count: { min: 3, max: 5 },
    faq_count: { min: 5, max: 6 },
    include_vin_cnit_proof: true,
    include_microcopy: true,
    include_internal_links: false,
  },
  /** Premium : + anti-erreur enrichi + microcopy + internal links */
  C: {
    label: 'Premium',
    seo_intro_words: { min: 120, max: 160 },
    anti_errors_count: { min: 4, max: 6 },
    faq_count: { min: 6, max: 8 },
    include_vin_cnit_proof: true,
    include_microcopy: true,
    include_internal_links: true,
  },
} as const;

// ── Section Writer groupings (P4→P7) ─────────────────

export const R8_WRITER_GROUPS = {
  P4: ['S_COMPAT_CHECK'] as const,
  P5: ['S_SEO_INTRO', 'S_SAFE_TABLE'] as const,
  P6: ['S_CATALOG', 'S_BESTSELLERS'] as const,
  P7: ['S_ANTI_ERRORS', 'S_FAQ', 'S_TRUST'] as const,
} as const;

// ── Family badge types (P6 catalog enrichment) ────────

export const R8_FAMILY_BADGE_TYPES = [
  'Entretien',
  'Sécurité',
  'Panne',
] as const;
export type R8FamilyBadge = (typeof R8_FAMILY_BADGE_TYPES)[number];

// ── Content Focus Targets (P0 — 10 priorités ROI) ────

export const R8_CONTENT_FOCUS_TARGETS = [
  {
    id: 'compat_proof',
    label: 'Preuve compatibilité (période/power/fuel)',
    roi: 1,
  },
  {
    id: 'carte_grise',
    label: 'Vérification carte grise (VIN/CNIT/type mine)',
    roi: 1,
  },
  {
    id: 'anti_error',
    label: 'Messages anti-erreur (versions proches)',
    roi: 1,
  },
  { id: 'fast_access', label: 'Accès rapides (chips familles)', roi: 2 },
  { id: 'search_gamme', label: 'Recherche gamme/pièce dans la page', roi: 2 },
  { id: 'sticky_bar', label: 'Sticky bar véhicule (mobile)', roi: 2 },
  {
    id: 'family_micro',
    label: 'Micro-descriptions par famille (8-12 mots)',
    roi: 3,
  },
  { id: 'family_badges', label: 'Badges Entretien/Sécurité/Panne', roi: 3 },
  {
    id: 'seo_intro',
    label: 'Intro courte router + preuve (90-140 mots)',
    roi: 4,
  },
  {
    id: 'internal_links',
    label: 'Liens internes R2 + 1-2 R3/R5 sans cannib',
    roi: 4,
  },
] as const;

// ── Coverage Map type (P2 output) ────────────────────

export interface R8CoverageEntry {
  section_key: string;
  /** Max 2 clusters mapped to this section */
  clusters: string[];
  /** Max 5 terms per section (prevents stuffing) */
  max_terms: number;
}

// ── Media kinds R8 ──────────────────────────────────────

export const R8_MEDIA_KINDS = [
  'image',
  'icon',
  'svg',
  'table',
  'logo_strip',
  'badge_row',
  'component',
] as const;
export type R8MediaKind = (typeof R8_MEDIA_KINDS)[number];

// ── Media placements R8 ─────────────────────────────────

export const R8_MEDIA_PLACEMENTS = [
  'hero_background',
  'hero_inline',
  'above_fold',
  'inline_left',
  'inline_right',
  'card_thumbnail',
  'list_leading',
  'below_heading',
  'sticky',
  'modal',
] as const;
export type R8MediaPlacement = (typeof R8_MEDIA_PLACEMENTS)[number];

// ── Media purposes R8 ───────────────────────────────────

export const R8_MEDIA_PURPOSES = [
  'vehicle_identity',
  'compat_proof',
  'navigation_speed',
  'catalog_scannability',
  'trust',
  'seo_support',
] as const;
export type R8MediaPurpose = (typeof R8_MEDIA_PURPOSES)[number];

// ── Default media slots (template pour P0) ──────────────

export const R8_DEFAULT_MEDIA_SLOTS = [
  {
    slot_id: 'MS_VEHICLE_HERO',
    section_key: 'S_IDENTITY',
    kind: 'image',
    placement: 'hero_inline',
    purpose: 'vehicle_identity',
  },
  {
    slot_id: 'MS_CG_HELP_SVG',
    section_key: 'S_COMPAT_CHECK',
    kind: 'svg',
    placement: 'inline_right',
    purpose: 'compat_proof',
  },
  {
    slot_id: 'MS_FAMILY_ICONS',
    section_key: 'S_FAST_ACCESS',
    kind: 'icon',
    placement: 'list_leading',
    purpose: 'navigation_speed',
  },
  {
    slot_id: 'MS_CATALOG_GRID',
    section_key: 'S_CATALOG',
    kind: 'icon',
    placement: 'card_thumbnail',
    purpose: 'catalog_scannability',
  },
  {
    slot_id: 'MS_TRUST_BADGES',
    section_key: 'S_TRUST',
    kind: 'badge_row',
    placement: 'below_heading',
    purpose: 'trust',
  },
  {
    slot_id: 'MS_OG_IMAGE',
    section_key: 'S_IDENTITY',
    kind: 'image',
    placement: 'hero_background',
    purpose: 'seo_support',
  },
] as const;

// ══════════════════════════════════════════════════════════
// R8 V5 — Content Diversity System
// 12 block types, 9 sections, 4 pipeline phases,
// 8-metric diversity scoring, nearest-neighbor, governance
// ══════════════════════════════════════════════════════════

// ── SEO Decision (4 states) ─────────────────────────────

export type R8SeoDecision =
  | 'INDEX'
  | 'REVIEW_REQUIRED'
  | 'REGENERATE'
  | 'REJECT';

// ── Block types (12 types, 3 catégories) ────────────────

export const R8_V5_BLOCK_TYPES = {
  core: [
    'vehicle_identity',
    'compatibility_scope',
    'catalog_access',
    'technical_specs',
  ] as const,
  differentiating: [
    'variant_difference',
    'selection_help',
    'maintenance_context',
    'compatibility_sensitive_points',
  ] as const,
  business: [
    'dynamic_category_ranking',
    'best_entrypoints',
    'dedicated_faq',
    'trust_and_support',
  ] as const,
} as const;

export const R8_V5_ALL_BLOCK_TYPES = [
  ...R8_V5_BLOCK_TYPES.core,
  ...R8_V5_BLOCK_TYPES.differentiating,
  ...R8_V5_BLOCK_TYPES.business,
] as const;
export type R8V5BlockType = (typeof R8_V5_ALL_BLOCK_TYPES)[number];

// ── Section keys V5 (9 sections → mapping 12 blocs) ─────

export const R8_V5_PLANNABLE_SECTIONS = [
  'S_IDENTITY',
  'S_COMPAT_SCOPE',
  'S_VARIANT_DIFFERENCE',
  'S_SELECTION_GUIDE',
  'S_ENTRETIEN_CONTEXT',
  'S_CATALOG_ACCESS',
  'S_TECH_SPECS',
  'S_FAQ_DEDICATED',
  'S_TRUST',
] as const;
export type R8V5PlannableSection = (typeof R8_V5_PLANNABLE_SECTIONS)[number];

// ── Pipeline V5 (4 phases) ──────────────────────────────

export const R8_V5_PIPELINE_PHASES = [
  'P0_BUILD_PLAN',
  'P1_COMPOSE_PAGE',
  'P2_EVALUATE_DIVERSITY',
  'P3_GATE_PUBLISH',
  'complete',
] as const;
export type R8V5PipelinePhase = (typeof R8_V5_PIPELINE_PHASES)[number];

// ── Writer groups V5 (3 batches in P1) ──────────────────

export const R8_V5_WRITER_GROUPS = {
  P1_A: ['S_IDENTITY', 'S_COMPAT_SCOPE', 'S_TECH_SPECS'] as const,
  P1_B: [
    'S_VARIANT_DIFFERENCE',
    'S_SELECTION_GUIDE',
    'S_ENTRETIEN_CONTEXT',
  ] as const,
  P1_C: ['S_CATALOG_ACCESS', 'S_FAQ_DEDICATED', 'S_TRUST'] as const,
} as const;

// ── Diversity scoring (8 métriques + formule pondérée) ──

export const R8_DIVERSITY_FORMULA_WEIGHTS = {
  specificContentRatioScore: 0.2,
  blockSpecificityScore: 0.15,
  semanticSimilarityScore: 0.2,
  categoryOrderDiversityScore: 0.1,
  catalogDeltaScore: 0.15,
  commercialIntentScore: 0.1,
  faqReuseRiskInverted: 0.1,
  boilerplatePenalty: -0.2,
} as const;

export const R8_DIVERSITY_THRESHOLDS = {
  /** < 70 = REVIEW_REQUIRED or worse */
  index_min: 70,
  /** 70-84 = INDEX with warnings */
  review_threshold: 85,
  /** >= 85 = INDEX clean */
  clean_threshold: 85,
} as const;

// ── Hard gates (binary pass/fail before composite score) ─

export const R8_HARD_GATES = {
  min_specific_content_ratio: 0.5,
  max_boilerplate_ratio: 0.35,
  min_semantic_diversity: 65,
  max_faq_reuse_risk: 45,
  min_commercial_intent: 55,
} as const;

// ── Reason codes normalisés ─────────────────────────────

export const R8_REASON_CODES = [
  'LOW_SPECIFIC_CONTENT',
  'HIGH_BOILERPLATE',
  'HIGH_FAQ_REUSE',
  'LOW_CATEGORY_DIVERSITY',
  'LOW_CATALOG_DELTA',
  'LOW_COMMERCIAL_INTENT',
  'LOW_SEMANTIC_DIVERSITY',
  'MISSING_VARIANT_DIFF_BLOCK',
  'MISSING_HELP_BLOCK',
  'MISSING_COMPAT_BLOCK',
  'MISSING_CATALOG_DYNAMIC_BLOCK',
  'INVALID_CANONICAL',
  'INVALID_CONTRACT',
  'CONTENT_BROKEN',
] as const;
export type R8ReasonCode = (typeof R8_REASON_CODES)[number];

// ── Block quotas + mandatory rules ──────────────────────

export const R8_V5_BLOCK_QUOTAS = {
  max_universal_blocks: 2,
  min_high_specificity_blocks: 2,
  min_variant_diff_blocks: 1,
  min_selected_blocks: 4,
  max_selected_blocks: 7,
} as const;

export const R8_V5_MANDATORY_RULES = {
  min_variant_diff: 1,
  min_help_or_maintenance: 1,
  min_compat_scope: 1,
  min_catalog_dynamic: 1,
} as const;

// ── FAQ specificity rules ───────────────────────────────

export const R8_V5_FAQ_RULES = {
  min_config_specific_questions: 2,
  min_version_diff_questions: 1,
  min_compat_code_questions: 1,
  max_global_questions: 2,
  min_total: 4,
  max_total: 8,
} as const;

// ── Dynamic category ranking factors ────────────────────

export const R8_V5_RANKING_FACTORS = [
  'engine_type',
  'fuel',
  'power_range',
  'period',
  'body_type',
  'maintenance_frequency',
  'compat_sensitivity',
  'season',
] as const;

// ── Intent tags V5 (élargi) ─────────────────────────────

export const R8_V5_INTENT_TAGS = [
  'compat',
  'catalog',
  'trust',
  'anti_error',
  'variant_diff',
  'selection',
  'maintenance',
] as const;
export type R8V5IntentTag = (typeof R8_V5_INTENT_TAGS)[number];

// ── Content focus targets V5 (10 ROI priorities) ────────

export const R8_V5_CONTENT_FOCUS_TARGETS = [
  {
    id: 'compat_proof',
    label: 'Preuve compatibilité (période/power/fuel)',
    roi: 1,
  },
  {
    id: 'variant_diff',
    label: 'Différences avec variantes proches (clé anti-duplicate)',
    roi: 1,
  },
  { id: 'selection_help', label: 'Aide sélection (ne pas se tromper)', roi: 1 },
  {
    id: 'carte_grise',
    label: 'Vérification carte grise (VIN/CNIT/type mine)',
    roi: 1,
  },
  {
    id: 'entretien_specific',
    label: 'Points entretien spécifiques à cette config',
    roi: 2,
  },
  {
    id: 'fast_access',
    label: 'Accès rapides (chips familles + recherche)',
    roi: 2,
  },
  {
    id: 'catalog_variation',
    label: 'Familles mises en avant différemment par config',
    roi: 2,
  },
  {
    id: 'faq_dedicated',
    label: 'FAQ avec questions uniques à cette motorisation',
    roi: 3,
  },
  {
    id: 'family_micro',
    label: 'Micro-descriptions par famille (8-12 mots)',
    roi: 3,
  },
  {
    id: 'internal_links',
    label: 'Liens internes R2 + 1-2 R3/R5 sans cannib',
    roi: 4,
  },
] as const;

// ── Heading templates V5 ────────────────────────────────

export const R8_V5_HEADING_TEMPLATES = {
  S_IDENTITY: 'Pièces compatibles {brand} {model} {type_name} {power} ch',
  S_COMPAT_SCOPE: 'Compatibilité et limites — {brand} {model} {type_name}',
  S_VARIANT_DIFFERENCE: 'Ce qui change sur la {model} {type_name} {power} ch',
  S_SELECTION_GUIDE: 'Choisir sans se tromper — {brand} {model} {type_name}',
  S_ENTRETIEN_CONTEXT: 'Entretien spécifique {model} {type_name} {power} ch',
  S_CATALOG_ACCESS: 'Catalogue pièces {brand} {model}',
  S_TECH_SPECS: 'Fiche technique {brand} {model} {type_name}',
  S_FAQ_DEDICATED: 'FAQ — {brand} {model} {type_name} {power} ch',
  S_TRUST: 'Garanties AutoMecanik',
} as const;

// ── Sitemap / robots rules ──────────────────────────────

export const R8_SITEMAP_RULES: Record<
  R8SeoDecision,
  { sitemap: boolean; robots: string }
> = {
  INDEX: { sitemap: true, robots: 'index, follow' },
  REVIEW_REQUIRED: { sitemap: false, robots: 'noindex, nofollow' },
  REGENERATE: { sitemap: false, robots: 'noindex, nofollow' },
  REJECT: { sitemap: false, robots: 'noindex, nofollow' },
};

// ── Table name constants ────────────────────────────────

export const R8_TABLES = {
  pages: '__seo_r8_pages',
  versions: '__seo_r8_page_versions',
  fingerprints: '__seo_r8_fingerprints',
  similarity: '__seo_r8_similarity_index',
  queue: '__seo_r8_regeneration_queue',
  qa: '__seo_r8_qa_reviews',
  engineStats: '__seo_r8_engine_family_stats',
  keywordPlan: '__seo_r8_keyword_plan',
} as const;

// ── Nearest-neighbor key builders ───────────────────────

function normalizeEngineFamily(typeName: string): string {
  return typeName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '');
}

export function buildNeighborFamilyKey(v: {
  brand: string;
  model: string;
  fuel: string;
  body: string;
}): string {
  return [v.brand, v.model, v.fuel, v.body]
    .map((s) => s.toLowerCase().trim())
    .join('::');
}

export function buildEngineFamilyKey(v: {
  brand: string;
  model: string;
  fuel: string;
  typeName: string;
}): string {
  return [v.brand, v.model, v.fuel, normalizeEngineFamily(v.typeName)]
    .map((s) => s.toLowerCase().trim())
    .join('::');
}

// ── H1 builder centralisé ───────────────────────────────

export function buildR8H1(v: {
  brand: string;
  model: string;
  type: string;
  powerPs: string | number;
  yearFrom: string | number;
  yearTo?: string | number | null;
}): string {
  const years = v.yearTo ? `${v.yearFrom}-${v.yearTo}` : `${v.yearFrom}-auj.`;
  return `${v.brand} ${v.model} ${v.type} ${v.powerPs} ch (${years})`;
}
