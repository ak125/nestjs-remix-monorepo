/**
 * R6 Keyword Plan constants V2 — Buying Guide (choisir / comparer / compat / qualite / budget / marques / pieges / pro).
 * 10 sections, 13 block types, 8 gates, intent classification tokens.
 * Used by page-contract-r6.schema.ts and r6-keyword-planner / r6-content-batch agents.
 *
 * INTERDIT R6 : tout contenu procedural detaille (HowTo) + diagnostic complet.
 */

import type {
  GateDefinition,
  GateResult,
  PriorityFix,
  AuditResult,
} from './keyword-plan.constants';

// Re-export shared interfaces from R3 (no duplication)
export type { GateDefinition, GateResult, PriorityFix, AuditResult };

// ── Pipeline phases R6 ──────────────────────────────────

export const R6_KP_PIPELINE_PHASES = [
  'P0_AUDIT',
  'P1_SECTION_PLANNER',
  'P2_CONTENT_GEN',
  'P3_CANNIB_GUARD',
  'P4_QA',
  'complete',
] as const;
export type R6KpPipelinePhase = (typeof R6_KP_PIPELINE_PHASES)[number];

// ── Section IDs V2 (10 stable sections) ─────────────────

export const R6_SECTION_IDS = [
  'hero_decision',
  'summary_pick_fast',
  'quality_tiers',
  'compatibility',
  'price_guide',
  'brands_guide',
  'pitfalls',
  'when_pro',
  'faq_r6',
  'cta_final',
] as const;
export type R6SectionId = (typeof R6_SECTION_IDS)[number];

// ── Section configuration ───────────────────────────────

export type R6SeoPriority = 'critique' | 'haute' | 'moyenne' | 'basse';

export interface R6SectionDef {
  label: string;
  sgpg_columns: string[];
  min_words: number;
  min_chars: number;
  required: boolean;
  keyword_targeted: boolean;
  seo_priority: R6SeoPriority;
  generic_penalty: number;
  required_blocks: string[];
}

export const R6_SECTION_CONFIG: Record<R6SectionId, R6SectionDef> = {
  hero_decision: {
    label: "Decision d'achat",
    sgpg_columns: ['sgpg_intro_role', 'sgpg_hero_subtitle'],
    min_words: 80,
    min_chars: 400,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    generic_penalty: 15,
    required_blocks: ['HeroDecision'],
  },
  summary_pick_fast: {
    label: 'Regles de choix rapide',
    sgpg_columns: ['sgpg_how_to_choose', 'sgpg_decision_tree'],
    min_words: 100,
    min_chars: 500,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    generic_penalty: 15,
    required_blocks: ['DecisionQuick'],
  },
  quality_tiers: {
    label: 'Niveaux de qualite',
    sgpg_columns: ['sgpg_selection_criteria'],
    min_words: 100,
    min_chars: 500,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 12,
    required_blocks: ['QualityTiersTable'],
  },
  compatibility: {
    label: 'Compatibilite',
    sgpg_columns: ['sgpg_compatibility_axes'],
    min_words: 80,
    min_chars: 400,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 12,
    required_blocks: ['CompatibilityChecklist'],
  },
  price_guide: {
    label: 'Guide des prix',
    sgpg_columns: ['sgpg_micro_seo_block'],
    min_words: 60,
    min_chars: 300,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 10,
    required_blocks: ['PriceGuide'],
  },
  brands_guide: {
    label: 'Guide des marques',
    sgpg_columns: ['sgpg_brands_guide'],
    min_words: 80,
    min_chars: 400,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 12,
    required_blocks: ['BrandsGuide'],
  },
  pitfalls: {
    label: 'Pieges a eviter',
    sgpg_columns: ['sgpg_anti_mistakes'],
    min_words: 80,
    min_chars: 400,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 12,
    required_blocks: ['Checklist'],
  },
  when_pro: {
    label: 'Quand faire appel a un pro',
    sgpg_columns: ['sgpg_when_pro'],
    min_words: 60,
    min_chars: 300,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 10,
    required_blocks: ['WhenPro'],
  },
  faq_r6: {
    label: 'FAQ',
    sgpg_columns: ['sgpg_faq'],
    min_words: 200,
    min_chars: 1000,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    generic_penalty: 15,
    required_blocks: ['FAQ'],
  },
  cta_final: {
    label: 'Pour aller plus loin',
    sgpg_columns: ['sgpg_interest_nuggets', 'sgpg_family_cross_sell_intro'],
    min_words: 30,
    min_chars: 150,
    required: false,
    keyword_targeted: false,
    seo_priority: 'basse',
    generic_penalty: 5,
    required_blocks: ['FurtherReading', 'InternalLinks'],
  },
};

// ── Media types, placements, sources ────────────────────

export const R6_MEDIA_TYPES = [
  'image',
  'diagram',
  'table',
  'checklist',
  'callout',
  'cards',
  'quote',
] as const;
export type R6MediaType = (typeof R6_MEDIA_TYPES)[number];

export const R6_MEDIA_PLACEMENTS = [
  'hero',
  'after_h2',
  'before_block',
  'after_block',
  'inline_left',
  'inline_right',
  'aside',
  'end_section',
] as const;
export type R6MediaPlacement = (typeof R6_MEDIA_PLACEMENTS)[number];

export const R6_MEDIA_SOURCES = [
  'cdn',
  'catalog',
  'internal',
  'rag',
  'generated',
  'none',
] as const;
export type R6MediaSource = (typeof R6_MEDIA_SOURCES)[number];

// ── Block types V2 (13) ────────────────────────────────

export const R6_BLOCK_TYPES = [
  'RichText',
  'HeroDecision',
  'DecisionQuick',
  'QualityTiersTable',
  'CompatibilityChecklist',
  'PriceGuide',
  'BrandsGuide',
  'BudgetTiers',
  'Checklist',
  'WhenPro',
  'FAQ',
  'FurtherReading',
  'InternalLinks',
] as const;
export type R6BlockType = (typeof R6_BLOCK_TYPES)[number];

// ── Media budget ────────────────────────────────────────

export const R6_MEDIA_BUDGET = {
  maxImages: 4,
  maxInArticleImages: 3,
  maxCallouts: 4,
  maxTablesPerSection: 1,
  zeroCostTypes: [
    'table',
    'checklist',
    'callout',
    'cards',
    'quote',
    'diagram',
  ] as const,
} as const;

// ── Gate definitions GR1-GR8 ────────────────────────────

export const R6_GATE_DEFINITIONS: Record<string, GateDefinition> = {
  GR1_INTENT_ALIGNMENT: {
    description:
      'Intent = buying-guide only (no transactional/diagnostic/howto)',
    penalty: 30,
  },
  GR2_CANNIB_R1: {
    description: 'No R1 transactional terms in any section',
    penalty: 30,
  },
  GR3_CANNIB_R3: {
    description: 'No R3 how-to/mounting procedure terms in any section',
    penalty: 30,
  },
  GR4_CANNIB_R5: {
    description: 'No R5 diagnostic/symptom-first terms in any section',
    penalty: 25,
  },
  GR5_REQUIRED_BLOCKS: {
    description:
      'DecisionQuick + QualityTiersTable + CompatibilityChecklist + Checklist + FAQ all present',
    penalty: 20,
  },
  GR6_EVIDENCE_RATIO: {
    description: 'At least 60% of factual claims backed by evidence_pack',
    penalty: 15,
  },
  GR7_MEDIA_BUDGET: {
    description: 'Images <= 4, callouts <= 4',
    penalty: 5,
  },
  GR8_HOWTO_STRICT: {
    description: 'Hard fail if any howto_strict_terms detected in R6 content',
    penalty: 100,
  },
};

// ── Intent classification token lists V2 ────────────────
// Two-level system: howto_strict (hard fail) + howto_soft (warning)

/** Hard fail — any match = content is R3, not R6 */
export const R6_HOWTO_STRICT_TERMS = [
  'couple de serrage',
  'cle dynamometrique',
  'purge',
  'chandelles',
  'depose/repose',
  'etape 1',
  'outillage requis',
  'OBD reset',
  'calibration detaillee',
  'tutoriel',
] as const;

/** Warning only — context-dependent, not a hard fail */
export const R6_HOWTO_SOFT_TERMS = ['remplacer', 'changer', 'deposer'] as const;

/** R6 buying intent tokens — score weight for R6 classification */
export const R6_BUYING_TOKENS = [
  'choisir',
  'compatibilite',
  'OEM',
  'reference',
  'equivalent OE',
  'adaptable',
  'reconditionne',
  'echange standard',
  'consigne',
  'garantie',
  'budget',
  'marques',
  'qualite',
] as const;

/** R5 diagnostic tokens — score weight for R5 classification */
export const R6_DIAG_TOKENS = [
  'symptomes',
  'causes',
  'vibration',
  'bruit',
  'voyant',
  'test',
  'diagnostic',
  'panne',
] as const;

// ── Anti-cannibalization term lists ─────────────────────
// R6 yields to ALL other roles (lowest priority)

/** R6 forbidden from R1 — transactional terms */
export const R6_FORBIDDEN_FROM_R1 = [
  'acheter',
  'commander',
  'livraison',
  'promo',
  'remise',
  'pas cher',
  'ajouter au panier',
  'expedition',
  'soldes',
  'prix discount',
  'en stock',
  'livraison rapide',
] as const;

/** R6 forbidden from R3 — how-to/mounting terms */
export const R6_FORBIDDEN_FROM_R3 = [
  'etape',
  'pas-a-pas',
  'tuto',
  'tutoriel',
  'montage',
  'demonter',
  'visser',
  'devisser',
  'couple de serrage',
  'demontage',
  'remontage',
  'comment remplacer',
  'comment changer',
  'outils necessaires',
] as const;

/** R6 forbidden from R5 — diagnostic terms */
export const R6_FORBIDDEN_FROM_R5 = [
  'diagnostic',
  'panne',
  'voyant',
  'code erreur',
  'OBD',
  'code defaut',
  'calculateur',
  'capteur defaillant',
  'multimetre',
  'valise diagnostic',
] as const;

/** R6 forbidden from R4 — encyclopedic terms */
export const R6_FORBIDDEN_FROM_R4 = [
  'definition de',
  'encyclopedie',
  'historique',
  'invente en',
  'etymologie',
] as const;

// ── Quality tier IDs (for QualityTiersTable block) ──────

export const R6_QUALITY_TIER_IDS = [
  'oe',
  'equiv_oe',
  'adaptable',
  'reconditionne',
  'echange_standard',
] as const;
export type R6QualityTierId = (typeof R6_QUALITY_TIER_IDS)[number];

// ── Quality thresholds ──────────────────────────────────

export const R6_KP_QUALITY_THRESHOLDS = {
  minQualityScore: 70,
  minCoverageScore: 0.8,
  maxOverlapScore: 0.12,
  improvementScoreThreshold: 75,
  healthyScoreMin: 85,
  thinContentRatio: 0.5,
  weakPhraseRatio: 0.08,
} as const;

// ── Audit thresholds V2 ─────────────────────────────────

export const R6_AUDIT_THRESHOLDS = {
  minQaScore: 70,
  requiredBlocks: [
    'DecisionQuick',
    'QualityTiersTable',
    'CompatibilityChecklist',
    'Checklist',
    'FAQ',
  ] as const,
  minFaqCount: 6,
  maxFaqCount: 12,
  minPitfallsCount: 8,
  maxPitfallsCount: 12,
  minPickFastItems: 4,
  maxPickFastItems: 6,
  minQualityTierRows: 2,
  maxQualityTierRows: 5,
  minCompatibilityAxes: 2,
  maxCompatibilityAxes: 6,
  minWhenProCases: 2,
  maxWhenProCases: 6,
  minBrandsQualitySignals: 2,
  maxBrandsAlertSigns: 5,
} as const;

export const R6_AUDIT_PRIORITY_WEIGHTS = {
  missingRequiredBlock: 25,
  missingRequiredSection: 30,
  sectionBelowScore: 20,
  highGenericPhraseRatio: 10,
  thinContent: 15,
  cannibalizationHigh: 30,
  cannibalizationMed: 15,
  noSources: 10,
  howtoStrictHit: 100,
} as const;

// ── Per-section include_terms minimums ──────────────────

export const R6_SECTION_TERM_MINIMUMS: Record<R6SectionId, number> = {
  hero_decision: 3,
  summary_pick_fast: 4,
  quality_tiers: 4,
  compatibility: 3,
  price_guide: 2,
  brands_guide: 3,
  pitfalls: 4,
  when_pro: 2,
  faq_r6: 2,
  cta_final: 1,
};

// ── Per-section default media ───────────────────────────

export const R6_SECTION_DEFAULT_MEDIA: Record<
  R6SectionId,
  { type: R6MediaType; placement: R6MediaPlacement; required: boolean }
> = {
  hero_decision: { type: 'image', placement: 'hero', required: true },
  summary_pick_fast: {
    type: 'callout',
    placement: 'before_block',
    required: true,
  },
  quality_tiers: { type: 'table', placement: 'after_h2', required: true },
  compatibility: { type: 'checklist', placement: 'after_h2', required: true },
  price_guide: { type: 'callout', placement: 'after_h2', required: true },
  brands_guide: { type: 'callout', placement: 'after_h2', required: false },
  pitfalls: { type: 'checklist', placement: 'after_h2', required: true },
  when_pro: { type: 'callout', placement: 'before_block', required: false },
  faq_r6: { type: 'callout', placement: 'end_section', required: false },
  cta_final: { type: 'cards', placement: 'after_h2', required: false },
};

// ── RAG section requirements ────────────────────────────

export interface R6RagBlockRequirement {
  block: string;
  minItems: number;
  checkType: 'non_empty' | 'list';
}

export const R6_RAG_SECTION_REQUIREMENTS: Record<
  R6SectionId,
  R6RagBlockRequirement[]
> = {
  hero_decision: [
    { block: 'domain.role', minItems: 1, checkType: 'non_empty' },
  ],
  summary_pick_fast: [
    { block: 'selection.criteria', minItems: 2, checkType: 'list' },
  ],
  quality_tiers: [
    { block: 'selection.criteria', minItems: 3, checkType: 'list' },
  ],
  compatibility: [
    { block: 'selection.compatibility', minItems: 2, checkType: 'list' },
  ],
  price_guide: [],
  brands_guide: [],
  pitfalls: [
    { block: 'selection.anti_mistakes', minItems: 4, checkType: 'list' },
  ],
  when_pro: [
    { block: 'installation.pro_required', minItems: 1, checkType: 'non_empty' },
  ],
  faq_r6: [{ block: 'rendering.faq', minItems: 4, checkType: 'list' }],
  cta_final: [],
};
