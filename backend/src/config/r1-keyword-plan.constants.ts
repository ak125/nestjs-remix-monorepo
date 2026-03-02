/**
 * R1 Keyword Plan constants — pipeline phases, section config, gate definitions, quality thresholds.
 * Used by R1KeywordPlanGatesService and keyword-planner agent (mode R1).
 * Mirrors keyword-plan.constants.ts (R3) with transactional adaptations.
 *
 * Taxonomie C.2 : 10 sections (R1_S0_SERP..R1_S9_FAQ), 6 keyword-targeted, 4 UI-only.
 */
import type {
  GateDefinition,
  GateResult,
  PriorityFix,
  AuditResult,
} from './keyword-plan.constants';

// Re-export shared interfaces from R3 (no duplication)
export type { GateDefinition, GateResult, PriorityFix, AuditResult };

// ── Pipeline phases R1 ──────────────────────────────────

export const R1_KP_PIPELINE_PHASES = [
  'KP0_AUDIT',
  'KP1_ARCHITECTURE',
  'KP2_SECTION_TERMS',
  'KP3_VALIDATE',
  'complete',
] as const;
export type R1KpPipelinePhase = (typeof R1_KP_PIPELINE_PHASES)[number];

// ── Section types for R1 pages (C.2 taxonomy) ───────────

export const R1_PLANNABLE_SECTIONS = [
  'R1_S0_SERP',
  'R1_S1_HERO',
  'R1_S2_SELECTOR',
  'R1_S3_BADGES',
  'R1_S4_MICRO_SEO',
  'R1_S5_COMPAT',
  'R1_S6_SAFE_TABLE',
  'R1_S7_EQUIP',
  'R1_S8_CROSS_SELL',
  'R1_S9_FAQ',
] as const;
export type R1PlannableSection = (typeof R1_PLANNABLE_SECTIONS)[number];

export type R1SeoPriority = 'critique' | 'haute' | 'moyenne' | 'basse';

export interface R1SectionDef {
  label: string;
  sgpg_columns: string[];
  /** Columns from __seo_gamme table (for S0_SERP cross-table audit) */
  sg_columns?: string[];
  min_words: number;
  min_chars: number;
  required: boolean;
  /** true = keyword planner generates clusters/terms for this section */
  keyword_targeted: boolean;
  seo_priority: R1SeoPriority;
  generic_penalty: number;
}

export const R1_SECTION_CONFIG: Record<R1PlannableSection, R1SectionDef> = {
  R1_S0_SERP: {
    label: 'SERP Pack',
    sgpg_columns: ['sgpg_h1_override'],
    sg_columns: ['sg_title_draft', 'sg_descrip_draft'],
    min_words: 25,
    min_chars: 150,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    generic_penalty: 15,
  },
  R1_S1_HERO: {
    label: 'Hero Subtitle',
    sgpg_columns: ['sgpg_hero_subtitle'],
    min_words: 10,
    min_chars: 60,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 12,
  },
  R1_S2_SELECTOR: {
    label: 'Selector Microcopy',
    sgpg_columns: ['sgpg_selector_microcopy'],
    min_words: 10,
    min_chars: 50,
    required: false,
    keyword_targeted: false,
    seo_priority: 'basse',
    generic_penalty: 5,
  },
  R1_S3_BADGES: {
    label: 'Proof Badges',
    sgpg_columns: [
      'sgpg_arg1_title',
      'sgpg_arg2_title',
      'sgpg_arg3_title',
      'sgpg_arg4_title',
    ],
    min_words: 8,
    min_chars: 40,
    required: false,
    keyword_targeted: false,
    seo_priority: 'basse',
    generic_penalty: 5,
  },
  R1_S4_MICRO_SEO: {
    label: 'Micro-SEO Block',
    sgpg_columns: ['sgpg_micro_seo_block'],
    min_words: 140,
    min_chars: 700,
    required: true,
    keyword_targeted: true,
    seo_priority: 'critique',
    generic_penalty: 15,
  },
  R1_S5_COMPAT: {
    label: 'Compatibilities Intro',
    sgpg_columns: ['sgpg_compatibilities_intro'],
    min_words: 10,
    min_chars: 60,
    required: false,
    keyword_targeted: true,
    seo_priority: 'moyenne',
    generic_penalty: 8,
  },
  R1_S6_SAFE_TABLE: {
    label: 'Safe Table',
    sgpg_columns: ['sgpg_safe_table_rows'],
    min_words: 15,
    min_chars: 80,
    required: false,
    keyword_targeted: false,
    seo_priority: 'moyenne',
    generic_penalty: 5,
  },
  R1_S7_EQUIP: {
    label: 'Equipementiers Line',
    sgpg_columns: ['sgpg_equipementiers_line'],
    min_words: 10,
    min_chars: 50,
    required: false,
    keyword_targeted: true,
    seo_priority: 'moyenne',
    generic_penalty: 8,
  },
  R1_S8_CROSS_SELL: {
    label: 'Family Cross-Sell',
    sgpg_columns: ['sgpg_family_cross_sell_intro'],
    min_words: 10,
    min_chars: 50,
    required: false,
    keyword_targeted: false,
    seo_priority: 'basse',
    generic_penalty: 5,
  },
  R1_S9_FAQ: {
    label: 'FAQ Selector',
    sgpg_columns: ['sgpg_faq'],
    min_words: 120,
    min_chars: 600,
    required: true,
    keyword_targeted: true,
    seo_priority: 'haute',
    generic_penalty: 12,
  },
};

// ── Derived helper constants ────────────────────────────

export const R1_KEYWORD_TARGETED_SECTIONS = R1_PLANNABLE_SECTIONS.filter(
  (s) => R1_SECTION_CONFIG[s].keyword_targeted,
);

export const R1_REQUIRED_SECTIONS = R1_PLANNABLE_SECTIONS.filter(
  (s) => R1_SECTION_CONFIG[s].required,
);

// ── Gate definitions R1 (G1-G7, adapted from R3) ────────

export const R1_GATE_DEFINITIONS: Record<string, GateDefinition> = {
  RG1_INTENT_ALIGNMENT: {
    description:
      'Intent ∈ [transactional, navigational, commercial_investigation]',
    penalty: 30,
  },
  RG2_BOUNDARY_RESPECT: {
    description: 'No R3 diagnostic/howto terms in R1 headings',
    penalty: 25,
  },
  RG3_CLUSTER_COVERAGE: {
    description:
      'All head queries mapped to at least 1 keyword-targeted R1 section',
    penalty: 20,
  },
  RG4_SECTION_OVERLAP: {
    description: 'No duplicate include_terms across R1 sections (>15% overlap)',
    penalty: 15,
  },
  RG5_FAQ_DEDUP: {
    description: 'FAQ R1 not duplicated from R3 how-to FAQ or PAA',
    penalty: 10,
  },
  RG6_ANCHOR_VALIDITY: {
    description: 'Internal links point to valid /pieces/ routes',
    penalty: 10,
  },
  RG7_R3_RISK: {
    description:
      'Cross-check R1 vs R3 include_terms for same gamme (Jaccard overlap)',
    penalty: 5,
  },
};

// ── Audit gates R1 (KA1-KA6) ───────────────────────────

export const R1_AUDIT_GATE_DEFINITIONS: Record<string, GateDefinition> = {
  KA1_REQUIRED_SECTIONS: {
    description: 'All required R1 sections populated',
    penalty: 30,
  },
  KA2_SCORE_THRESHOLD: {
    description: 'All R1 sections score >= 70',
    penalty: 20,
  },
  KA3_CONTENT_CONTRACT: {
    description: 'Word count within content_contract bounds',
    penalty: 15,
  },
  KA4_GENERIC_PHRASES: {
    description: 'Generic phrase ratio < 10% per section',
    penalty: 10,
  },
  KA5_RAG_SOURCED: {
    description: 'All sections have RAG-traceable content',
    penalty: 5,
  },
  KA6_THIN_CONTENT: {
    description: 'No section < 50% min content length',
    penalty: 15,
  },
};

// ── Quality thresholds R1 ───────────────────────────────

export const R1_KP_QUALITY_THRESHOLDS = {
  minQualityScore: 60,
  minCoverageScore: 0.7,
  maxDuplicationScore: 0.15,
  /** Mirror of R3's maxR1RiskScore — C.8: overlap > 15% = FAIL */
  maxR3RiskScore: 0.15,
  improvementScoreThreshold: 70,
  healthyScoreMin: 85,
  minCoverageForSkip: 0.9,
  thinContentRatio: 0.5,
  weakPhraseRatio: 0.1,
} as const;

// ── Audit priority weights (unclamped, 0-300+) ─────────

export const R1_AUDIT_PRIORITY_WEIGHTS = {
  missingRequiredSection: 30,
  sectionBelowScore: 20,
  highGenericPhraseRatio: 10,
  noSources: 5,
  thinContent: 15,
} as const;

// ── R3 forbidden terms for R1 (anti-cannibalization) ────

export const R3_FORBIDDEN_IN_R1 = [
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

// ── Generic phrases (transactional context) ─────────────

export const R1_GENERIC_PHRASES = [
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

// ── Valid anchor prefixes for R1 ────────────────────────

export const R1_VALID_ANCHOR_PREFIXES = ['/pieces/'] as const;
