/**
 * R7 Keyword Plan constants — pipeline phases, section config, gate definitions, quality thresholds.
 * Used for R7_BRAND (constructeur) pages: /constructeurs/{alias}-{id}.html
 * Mirrors r1-keyword-plan.constants.ts pattern with brand-specific adaptations.
 *
 * Taxonomie V5 : 13 sections (R7_S0_BREADCRUMB..R7_S11_ABOUT), 7 keyword-targeted, 6 UI-only.
 */
import type {
  GateDefinition,
  GateResult,
  PriorityFix,
  AuditResult,
} from './keyword-plan.constants';

// Re-export shared interfaces (no duplication)
export type { GateDefinition, GateResult, PriorityFix, AuditResult };

// ── Pipeline phases R7 ──────────────────────────────────

export const R7_KP_PIPELINE_PHASES = [
  'KP0_AUDIT',
  'KP1_ARCHITECTURE',
  'KP2_SECTION_TERMS',
  'KP3_VALIDATE',
  'complete',
] as const;
export type R7KpPipelinePhase = (typeof R7_KP_PIPELINE_PHASES)[number];

// ── Section types for R7 pages (V5 taxonomy) ───────────

export const R7_PLANNABLE_SECTIONS = [
  'R7_S0_BREADCRUMB',
  'R7_S1_HERO',
  'R7_S2_MICRO_SEO',
  'R7_S3_SHORTCUTS',
  'R7_S4_GAMMES',
  'R7_S5_PARTS',
  'R7_S6_VEHICLES',
  'R7_S6B_TOP_RECHERCHES',
  'R7_S7_COMPATIBILITY',
  'R7_S8_SAFE_TABLE',
  'R7_S9_FAQ',
  'R7_S10_RELATED',
  'R7_S11_ABOUT',
] as const;
export type R7PlannableSection = (typeof R7_PLANNABLE_SECTIONS)[number];

export type R7SeoPriority = 'critique' | 'haute' | 'moyenne' | 'basse';

export interface R7SectionDef {
  label: string;
  min_words: number;
  min_chars: number;
  required: boolean;
  /** true = keyword planner generates clusters/terms for this section */
  keyword_targeted: boolean;
  seo_priority: R7SeoPriority;
  generic_penalty: number;
}

export const R7_SECTION_CONFIG: Record<R7PlannableSection, R7SectionDef> = {
  R7_S0_BREADCRUMB: {
    label: 'Breadcrumb',
    min_words: 0,
    min_chars: 0,
    required: true,
    keyword_targeted: false,
    seo_priority: 'basse',
    generic_penalty: 0,
  },
  R7_S1_HERO: {
    label:
      'Hero + VehicleSelector + Aide motorisation + Assurance compatibilité',
    min_words: 15,
    min_chars: 80,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    generic_penalty: 12,
  },
  R7_S2_MICRO_SEO: {
    label: 'Micro-bloc SEO Router',
    min_words: 140,
    min_chars: 700,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    generic_penalty: 15,
  },
  R7_S3_SHORTCUTS: {
    label: 'Top raccourcis (6 cards maillage interne)',
    min_words: 0,
    min_chars: 0,
    required: true,
    keyword_targeted: false,
    seo_priority: 'haute',
    generic_penalty: 5,
  },
  R7_S4_GAMMES: {
    label: 'Gammes populaires',
    min_words: 0,
    min_chars: 0,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 8,
  },
  R7_S5_PARTS: {
    label: 'Pièces populaires',
    min_words: 0,
    min_chars: 0,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 8,
  },
  R7_S6_VEHICLES: {
    label: 'Véhicules populaires',
    min_words: 0,
    min_chars: 0,
    required: false,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 8,
  },
  R7_S6B_TOP_RECHERCHES: {
    label: 'Top recherches liens texte (maillage SEO)',
    min_words: 0,
    min_chars: 0,
    required: false,
    keyword_targeted: true,
    seo_priority: 'moyenne',
    generic_penalty: 5,
  },
  R7_S7_COMPATIBILITY: {
    label: 'Guide compatibilité (3 steps + erreurs fréquentes)',
    min_words: 80,
    min_chars: 400,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 10,
  },
  R7_S8_SAFE_TABLE: {
    label: 'Tableau Safe (quand remplacer les pièces)',
    min_words: 30,
    min_chars: 150,
    required: true,
    keyword_targeted: false,
    seo_priority: 'moyenne',
    generic_penalty: 5,
  },
  R7_S9_FAQ: {
    label: 'FAQ R7 Brand (5 Q/R + JSON-LD FAQPage)',
    min_words: 120,
    min_chars: 600,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 12,
  },
  R7_S10_RELATED: {
    label: 'Marques associées (maillage R7→R7)',
    min_words: 0,
    min_chars: 0,
    required: false,
    keyword_targeted: false,
    seo_priority: 'moyenne',
    generic_penalty: 0,
  },
  R7_S11_ABOUT: {
    label: 'À propos du constructeur (tronqué 800 chars max)',
    min_words: 30,
    min_chars: 100,
    required: false,
    keyword_targeted: false,
    seo_priority: 'basse',
    generic_penalty: 5,
  },
};

// ── Derived helper constants ────────────────────────────

export const R7_KEYWORD_TARGETED_SECTIONS = R7_PLANNABLE_SECTIONS.filter(
  (s) => R7_SECTION_CONFIG[s].keyword_targeted,
);

export const R7_REQUIRED_SECTIONS = R7_PLANNABLE_SECTIONS.filter(
  (s) => R7_SECTION_CONFIG[s].required,
);

// ── Quality gates (conditions d'affichage sections) ─────

export const R7_SECTION_QUALITY_GATES = {
  R7_S4_GAMMES: { minItems: 3 },
  R7_S5_PARTS: { minItems: 4 },
  R7_S6_VEHICLES: { minItems: 2 },
  R7_S11_ABOUT: { maxChars: 800, truncate: true },
} as const;

// ── JSON-LD types for R7 @graph ─────────────────────────

export const R7_JSON_LD_TYPES = [
  'BreadcrumbList',
  'Organization',
  'CollectionPage',
  'ItemList', // vehicles + parts
  'FAQPage',
  'HowTo',
] as const;

// ── Gate definitions R7 (RG1-RG7) ──────────────────────

export const R7_GATE_DEFINITIONS: Record<string, GateDefinition> = {
  RG1_INTENT_ALIGNMENT: {
    description:
      'Intent ∈ [brand_selection, navigational, commercial_investigation]',
    penalty: 30,
  },
  RG2_BOUNDARY_RESPECT: {
    description: 'No R3/R5 diagnostic/howto terms in R7 headings or content',
    penalty: 25,
  },
  RG3_QUALITY_GATES: {
    description:
      'Section quality gates respected (gammes>=3, parts>=4, vehicles>=2)',
    penalty: 20,
  },
  RG4_ABOUT_TRUNCATION: {
    description: 'About section ≤ 800 chars (anti-cannibalisation vs R3/R4)',
    penalty: 10,
  },
  RG5_HOWTO_JSONLD: {
    description: 'HowTo JSON-LD present in @graph with 3 steps',
    penalty: 5,
  },
  RG6_NO_GENERIC_PHRASES: {
    description: 'Generic phrase ratio < 10% per keyword-targeted section',
    penalty: 10,
  },
  RG7_R7_DEDUP: {
    description:
      'Cross-check R7 vs R1 include_terms for same brand (Jaccard overlap)',
    penalty: 5,
  },
};

// ── Quality thresholds R7 ───────────────────────────────

export const R7_KP_QUALITY_THRESHOLDS = {
  minQualityScore: 60,
  minCoverageScore: 0.7,
  maxDuplicationScore: 0.15,
  maxCannibScore: 0.15,
  minFaqCount: 4,
  maxAboutChars: 800,
  improvementScoreThreshold: 70,
  healthyScoreMin: 85,
  thinContentRatio: 0.5,
  weakPhraseRatio: 0.1,
} as const;

// ── Audit priority weights ──────────────────────────────

export const R7_AUDIT_PRIORITY_WEIGHTS = {
  missingRequiredSection: 30,
  sectionBelowScore: 20,
  highGenericPhraseRatio: 10,
  thinContent: 15,
  qualityGateViolation: 25,
} as const;

// ── Forbidden terms (anti-cannibalisation) ──────────────

/** R3 blog/conseil terms forbidden in R7 */
export const R7_FORBIDDEN_FROM_R3 = [
  'étape',
  'pas-à-pas',
  'tuto',
  'tutoriel',
  'montage',
  'démonter',
  'visser',
  'dévisser',
  'couple de serrage',
  'symptôme',
  'diagnostic',
  'panne',
  'voyant',
  'comparatif',
  'versus',
  'vs',
] as const;

/** R4 reference/glossary terms forbidden in R7 */
export const R7_FORBIDDEN_FROM_R4 = [
  'définition',
  'glossaire',
  'encyclopédie',
  'étymologie',
  'historique technique',
] as const;

/** R5 diagnostic terms forbidden in R7 */
export const R7_FORBIDDEN_FROM_R5 = [
  'comment réparer',
  'comment changer',
  'comment remplacer',
  'bruit au',
  'fuite de',
  'voyant allumé',
  'panne de',
  'symptômes de',
] as const;

// ── Generic phrases (brand context) ─────────────────────

export const R7_GENERIC_PHRASES = [
  'de qualité',
  'au meilleur prix',
  'large gamme',
  'livraison rapide',
  'satisfaction garantie',
  'produit de qualité',
  "n'hésitez pas",
  'nous proposons',
  'vous trouverez',
  'découvrez notre',
] as const;

// ── Valid anchor prefixes for R7 ────────────────────────

export const R7_VALID_ANCHOR_PREFIXES = [
  '/pieces/',
  '/constructeurs/',
  '/brands/',
] as const;

// ── H2 headings template (V5 final) ────────────────────

export const R7_HEADING_TEMPLATES = {
  R7_S2_MICRO_SEO: 'Pièces auto {brand} : trouvez la référence compatible',
  R7_S4_GAMMES: 'Gammes de pièces {brand} populaires',
  R7_S5_PARTS: 'Pièces {brand} populaires',
  R7_S6_VEHICLES: 'Véhicules {brand} les plus recherchés',
  R7_S6B_TOP_RECHERCHES: 'Recherches populaires {brand}',
  R7_S7_COMPATIBILITY: 'Trouver la bonne motorisation {brand}',
  R7_S8_SAFE_TABLE: "Pièces d'entretien {brand} : quand les remplacer ?",
  R7_S9_FAQ: 'FAQ — Pièces {brand} et compatibilité',
  R7_S11_ABOUT: 'À propos de {brand}',
} as const;

// ── Table names R7 ─────────────────────────────────────

export const R7_TABLES = {
  pages: '__seo_r7_pages',
  versions: '__seo_r7_page_versions',
  fingerprints: '__seo_r7_fingerprints',
  queue: '__seo_r7_regeneration_queue',
  qa: '__seo_r7_qa_reviews',
  keywordPlan: '__seo_r7_keyword_plan',
} as const;

// ── SEO Decision enum R7 ──────────────────────────────

export type R7SeoDecision =
  | 'PUBLISH'
  | 'REVIEW_REQUIRED'
  | 'REGENERATE'
  | 'REJECT';

// ── Sitemap rules per decision ────────────────────────

export const R7_SITEMAP_RULES: Record<
  R7SeoDecision,
  { sitemap: boolean; robots: string; priority: number }
> = {
  PUBLISH: { sitemap: true, robots: 'index, follow', priority: 0.8 },
  REVIEW_REQUIRED: {
    sitemap: true,
    robots: 'index, follow',
    priority: 0.6,
  },
  REGENERATE: { sitemap: false, robots: 'noindex, follow', priority: 0 },
  REJECT: { sitemap: false, robots: 'noindex, nofollow', priority: 0 },
};
