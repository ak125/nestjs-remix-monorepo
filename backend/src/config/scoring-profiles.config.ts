/**
 * Quality Scoring Profiles v1.0
 *
 * Defines scoring dimensions, weights, hard gates, and penalties
 * per page type. Used by QualityScoringEngineService.
 *
 * Git-versioned — changes require code review.
 */

export const SCORING_VERSION = 'v2.1';

// ── Types ──

export type PageType =
  | 'R1_pieces'
  | 'R3_guide'
  | 'R3_conseils'
  | 'R4_reference';

export type DimensionName =
  | 'content_depth'
  | 'seo_technical'
  | 'trust_evidence'
  | 'freshness';

export type GateSeverity = 'BLOCKED' | 'WARN';

export type ScoreStatus =
  | 'HEALTHY' // score >= 80, confidence >= 60
  | 'REVIEW' // score 60-79 OR confidence < 60
  | 'DEGRADED' // score 40-59
  | 'BLOCKED' // hard gate violation (critical)
  | 'INSUFFICIENT_DATA'; // < minDataThreshold features present

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DimensionConfig {
  name: DimensionName;
  weight: number; // 0-100, sum per profile = 100
}

export interface HardGateRule {
  id: string;
  description: string;
  severity: GateSeverity;
  /** Returns true if gate passes (no violation) */
  check: string; // Name of check function in scoring engine
}

export interface PenaltyRule {
  id: string;
  description: string;
  points: number; // negative value to subtract
  /** Returns true if penalty should be applied */
  check: string;
}

export interface ScoringProfile {
  pageType: PageType;
  label: string;
  dimensions: DimensionConfig[];
  hardGates: HardGateRule[];
  softPenalties: PenaltyRule[];
  /** Minimum % of non-null features required for a valid score (vs INSUFFICIENT_DATA) */
  minDataThreshold: number;
}

// ── Gamme Aggregation Weights ──

export const GAMME_PAGE_WEIGHTS: Record<PageType, number> = {
  R3_guide: 30,
  R1_pieces: 25,
  R4_reference: 20,
  R3_conseils: 15,
  // R5_diagnostic: 10 — deferred (M:N relation)
};

/** Pages required for every gamme. Missing = coverage penalty. */
export const REQUIRED_PAGE_TYPES: PageType[] = [
  'R3_guide',
  'R4_reference',
  'R1_pieces',
];

/** Optional pages. Present = bonus, absent = no penalty. */
export const OPTIONAL_PAGE_TYPES: PageType[] = ['R3_conseils'];

/** Points lost per missing required page type (v1 flat penalty — kept for reference) */
export const MISSING_PAGE_PENALTY = 5;

/** v2: max total coverage penalty (proportional to missing weight) */
export const COVERAGE_PENALTY_MAX = 15;

// ── Business Value (v2) ──

export const BUSINESS_VALUE_WEIGHTS = {
  product_count: 50, // max pts, log-scale (165 distinct values across 232 gammes)
  pg_top: 30, // flat bonus for top gammes
  indexed: 20, // bonus for indexed gammes
};

export const COMPOSITE_BLEND = {
  quality: 0.7,
  business: 0.3,
};

/** Enable continuous scoring curves (v2). Set false to rollback to binary checks. */
export const CONTINUOUS_SCORING = true;

// ── Priority Thresholds ──

export const PRIORITY_THRESHOLDS: Array<{ min: number; priority: Priority }> = [
  { min: 85, priority: 'LOW' },
  { min: 70, priority: 'MEDIUM' },
  { min: 50, priority: 'HIGH' },
  { min: 0, priority: 'CRITICAL' },
];

// ── Dimension Scoring Thresholds ──

/** Content Depth: how we score each feature (per page type) */
export const DEPTH_THRESHOLDS = {
  R3_guide: {
    how_to_choose_min: 200, // chars for full points
    selection_criteria_min: 100,
    anti_mistakes_min: 3, // count
    decision_tree_min: 100, // chars
    faq_min: 3, // count
    symptoms_min: 3, // count
    intro_role_min: 50, // chars
    risk_explanation_min: 50,
    arg_count_min: 3,
  },
  R4_reference: {
    definition_min: 200, // chars
    role_mecanique_min: 100,
    composition_min: 2, // array count
    confusions_min: 1,
    symptomes_min: 1,
    content_html_min: 500,
    regles_metier_min: 1,
  },
  R3_conseils: {
    sections_expected: 8, // S1-S8
    rich_section_min_chars: 300,
    total_content_min: 2500, // chars across all sections
  },
  R1_pieces: {
    has_img: true,
    has_pic: true,
    has_wall: true,
  },
};

/** SEO Technical: thresholds */
export const SEO_THRESHOLDS = {
  title_min: 30,
  title_max: 65,
  desc_min: 120,
  desc_max: 165,
  h1_min: 10,
  content_min: 800, // page content length
  rag_content_min: 1500, // RAG file length
};

/** Trust & Evidence: thresholds */
export const TRUST_THRESHOLDS = {
  pipeline_quality_min: 70,
  pipeline_quality_good: 85,
  rag_truth_level_good: ['L1', 'L2'], // high confidence levels
};

/** Freshness: days since update thresholds per page type */
export const FRESHNESS_THRESHOLDS: Record<
  PageType,
  { good: number; acceptable: number; stale: number }
> = {
  R3_guide: { good: 30, acceptable: 90, stale: 180 },
  R4_reference: { good: 60, acceptable: 180, stale: 365 },
  R3_conseils: { good: 30, acceptable: 60, stale: 120 },
  R1_pieces: { good: 14, acceptable: 30, stale: 60 },
};

// ── Scoring Profiles ──

export const SCORING_PROFILES: Record<PageType, ScoringProfile> = {
  R3_guide: {
    pageType: 'R3_guide',
    label: "Guide d'achat",
    dimensions: [
      { name: 'content_depth', weight: 35 },
      { name: 'seo_technical', weight: 25 },
      { name: 'trust_evidence', weight: 25 },
      { name: 'freshness', weight: 15 },
    ],
    hardGates: [
      {
        id: 'guide_is_draft',
        description: 'Guide est en brouillon (non publie)',
        severity: 'BLOCKED',
        check: 'checkGuideNotDraft',
      },
      {
        id: 'guide_no_content',
        description: 'Guide sans aucun contenu substantiel',
        severity: 'BLOCKED',
        check: 'checkGuideHasContent',
      },
    ],
    softPenalties: [
      {
        id: 'guide_no_how_to_choose',
        description: 'Section "comment choisir" absente ou trop courte',
        points: -8,
        check: 'checkGuideNoHowToChoose',
      },
      {
        id: 'guide_few_faq',
        description: 'Moins de 3 FAQ',
        points: -5,
        check: 'checkGuideFewFaq',
      },
      {
        id: 'guide_no_source',
        description: 'Source non verifiee',
        points: -10,
        check: 'checkGuideNoSource',
      },
    ],
    minDataThreshold: 30, // needs at least 30% of features non-default
  },

  R4_reference: {
    pageType: 'R4_reference',
    label: 'Reference / Glossaire',
    dimensions: [
      { name: 'content_depth', weight: 20 },
      { name: 'seo_technical', weight: 25 },
      { name: 'trust_evidence', weight: 35 },
      { name: 'freshness', weight: 20 },
    ],
    hardGates: [
      {
        id: 'ref_no_definition',
        description: 'Page reference sans definition',
        severity: 'BLOCKED',
        check: 'checkRefHasDefinition',
      },
    ],
    softPenalties: [
      {
        id: 'ref_no_schema',
        description: 'Pas de schema.org JSON-LD',
        points: -5,
        check: 'checkRefNoSchema',
      },
      {
        id: 'ref_no_confusions',
        description: 'Pas de confusions courantes (aide disambiguation)',
        points: -3,
        check: 'checkRefNoConfusions',
      },
      {
        id: 'ref_short_definition',
        description: 'Definition trop courte (< 200 chars)',
        points: -8,
        check: 'checkRefShortDefinition',
      },
    ],
    minDataThreshold: 20,
  },

  R3_conseils: {
    pageType: 'R3_conseils',
    label: 'Conseils DIY',
    dimensions: [
      { name: 'content_depth', weight: 35 },
      { name: 'seo_technical', weight: 20 },
      { name: 'trust_evidence', weight: 20 },
      { name: 'freshness', weight: 25 },
    ],
    hardGates: [
      {
        id: 'conseil_no_sections',
        description: 'Aucune section conseil presente',
        severity: 'BLOCKED',
        check: 'checkConseilHasSections',
      },
    ],
    softPenalties: [
      {
        id: 'conseil_missing_core',
        description: 'Sections S1 (intro) ou S2 (symptomes) manquantes',
        points: -8,
        check: 'checkConseilMissingCore',
      },
      {
        id: 'conseil_thin_content',
        description: 'Contenu total < 2500 chars',
        points: -10,
        check: 'checkConseilThinContent',
      },
      {
        id: 'conseil_few_rich',
        description: 'Moins de 3 sections riches (>= 300 chars)',
        points: -5,
        check: 'checkConseilFewRich',
      },
    ],
    minDataThreshold: 20,
  },

  R1_pieces: {
    pageType: 'R1_pieces',
    label: 'Transactionnel',
    dimensions: [
      { name: 'content_depth', weight: 20 },
      { name: 'seo_technical', weight: 30 },
      { name: 'trust_evidence', weight: 20 },
      { name: 'freshness', weight: 30 },
    ],
    hardGates: [],
    softPenalties: [
      {
        id: 'r1_no_image',
        description: "Pas d'image produit (pg_img)",
        points: -5,
        check: 'checkR1NoImage',
      },
      {
        id: 'r1_no_hero',
        description: "Pas d'image hero (pg_pic)",
        points: -3,
        check: 'checkR1NoHero',
      },
    ],
    minDataThreshold: 10,
  },
};

// ── Confidence Score Components ──

export interface ConfidenceSignal {
  id: string;
  weight: number; // 0-100
  description: string;
}

export const CONFIDENCE_SIGNALS: ConfidenceSignal[] = [
  {
    id: 'source_verified',
    weight: 25,
    description: 'Source provenance verifiee',
  },
  {
    id: 'pipeline_recent',
    weight: 20,
    description: 'Pipeline execute < 30 jours',
  },
  {
    id: 'rag_available',
    weight: 20,
    description: 'Fichier RAG present et substantiel',
  },
  {
    id: 'data_completeness',
    weight: 20,
    description: 'Majorite des features presentes',
  },
  {
    id: 'truth_level_high',
    weight: 15,
    description: 'RAG truth level L1 ou L2',
  },
];
