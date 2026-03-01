/**
 * Keyword Plan constants — pipeline phases, gate definitions, quality thresholds.
 * Used by KeywordPlanGatesService and keyword-planner agent.
 */

// ── Pipeline phases ──────────────────────────────────────

export const PIPELINE_PHASES = [
  'P0',
  'P1',
  'P2-P9',
  'P10',
  'complete',
] as const;
export type PipelinePhase = (typeof PIPELINE_PHASES)[number];

// ── Section types targetable by P2-P9 ───────────────────

export const PLANNABLE_SECTIONS = [
  'S1',
  'S2',
  'S2_DIAG',
  'S3',
  'S4_DEPOSE',
  'S4_REPOSE',
  'S5',
  'S6',
  'S_GARAGE',
  'S7',
  'S8',
  'META',
] as const;
export type PlannableSection = (typeof PLANNABLE_SECTIONS)[number];

// ── Gate definitions (G1-G6) ─────────────────────────────

export interface GateResult {
  gate: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fixes_applied?: string[];
}

export interface GateDefinition {
  description: string;
  penalty: number;
}

export const GATE_DEFINITIONS: Record<string, GateDefinition> = {
  G1_INTENT_ALIGNMENT: {
    description: 'Primary intent matches R3 role (informational/how-to)',
    penalty: 30,
  },
  G2_BOUNDARY_RESPECT: {
    description: 'No forbidden R1 pricing terms in headings or boundaries',
    penalty: 25,
  },
  G3_CLUSTER_COVERAGE: {
    description: 'All head queries mapped to at least 1 section',
    penalty: 20,
  },
  G4_SECTION_OVERLAP: {
    description: 'No duplicate include_terms across sections (>15% overlap)',
    penalty: 15,
  },
  G5_FAQ_DEDUP: {
    description: 'FAQ questions not duplicated from PAA questions',
    penalty: 10,
  },
  G6_ANCHOR_VALIDITY: {
    description: 'Recommended anchors link to valid internal pages',
    penalty: 10,
  },
  G7_MEDIA_BUDGET: {
    description: 'In-article images <= 2, zero-cost types respected',
    penalty: 5,
  },
};

// ── Quality thresholds ───────────────────────────────────

export const KP_QUALITY_THRESHOLDS = {
  minQualityScore: 60,
  minCoverageScore: 0.7,
  maxDuplicationScore: 0.15,
  maxR1RiskScore: 0.1,
} as const;

// ── R3 allowed intents ───────────────────────────────────

export const R3_ALLOWED_INTENTS = [
  'informational',
  'how-to',
  'diagnostic',
  'comparison',
] as const;

// ── Forbidden R1 terms (re-export for convenience) ───────

export { PRIX_PAS_CHER } from '../modules/seo/seo-v4.types';

// ── Valid anchor prefixes ────────────────────────────────

export const VALID_ANCHOR_PREFIXES = [
  '/pieces/',
  '/blog-pieces-auto/',
  '/reference-auto/',
  '/diagnostic-auto/',
] as const;

// ── Media Slot types ──────────────────────────────────────

export const MEDIA_SLOT_TYPES = [
  'image',
  'table',
  'steps',
  'checklist',
  'faq',
  'cards',
  'callout',
] as const;
export type MediaSlotType = (typeof MEDIA_SLOT_TYPES)[number];

export const MEDIA_PLACEMENTS = [
  'before_content',
  'inline',
  'after_content',
] as const;
export type MediaPlacement = (typeof MEDIA_PLACEMENTS)[number];

export interface MediaSlotImageSpec {
  alt_template: string;
  loading: 'eager' | 'lazy';
  size: 'sm' | 'md' | 'lg';
  placement_visual: 'left' | 'right' | 'full' | 'center';
}

export interface MediaSlot {
  type: MediaSlotType;
  placement: MediaPlacement;
  purpose: string;
  /** 0 for table/steps/checklist/faq/cards/callout, 1 for image */
  budget_cost: number;
  image_spec?: MediaSlotImageSpec;
}

export const MEDIA_BUDGET = {
  maxInArticleImages: 2,
  zeroCostTypes: [
    'table',
    'steps',
    'checklist',
    'faq',
    'cards',
    'callout',
  ] as const,
} as const;

/** Recommended media type per section */
export const SECTION_DEFAULT_MEDIA: Record<
  string,
  { type: MediaSlotType; required: boolean }
> = {
  S2: { type: 'table', required: false },
  S2_DIAG: { type: 'table', required: true },
  S3: { type: 'checklist', required: false },
  S4_DEPOSE: { type: 'steps', required: true },
  S4_REPOSE: { type: 'steps', required: true },
  S5: { type: 'callout', required: false },
  S6: { type: 'checklist', required: true },
  S8: { type: 'faq', required: true },
};

// ── V4 Audit-First Pipeline ─────────────────────────────

export const V4_PIPELINE_PHASES = [
  'P0_AUDIT',
  'P1_TARGETED',
  'P2-P9_IMPROVE',
  'P10_META',
  'P11_ASSEMBLE',
  'complete',
] as const;
export type V4PipelinePhase = (typeof V4_PIPELINE_PHASES)[number];

// ── Audit thresholds ────────────────────────────────────

export const AUDIT_THRESHOLDS = {
  /** Sections scoring below this are flagged for improvement */
  improvementScoreThreshold: 70,
  /** If >50% of a section type scores exactly 50 → systemic problem */
  systemic50Threshold: 0.5,
  /** If coverage ≥90% and all scores ≥85 → skip gamme entirely */
  minCoverageForSkip: 0.9,
  /** Min score for a section to be considered "healthy" */
  healthyScoreMin: 85,
  /** < 50% of minContentLength = thin content */
  thinContentRatio: 0.5,
  /** Generic ratio threshold for weak phrase detection */
  weakPhraseRatio: 0.1,
  /** Priority >= this value → high urgency */
  highPriorityThreshold: 100,
} as const;

// ── Audit priority weights (unclamped, 0-300+) ──────────

export const AUDIT_PRIORITY_WEIGHTS = {
  /** Per missing required section (max 210 for 7 sections) */
  missingRequiredSection: 30,
  /** Per section scoring below improvementScoreThreshold */
  sectionBelowScore: 20,
  /** Per section with generic phrase ratio > maxGenericRatio */
  highGenericPhraseRatio: 10,
  /** Per section without E-E-A-T source */
  noSources: 5,
  /** Per section with content < thinContentRatio × minContentLength */
  thinContent: 15,
} as const;

// ── Audit gate definitions (GA1-GA6, separate from plan gates G1-G6) ──

export interface PriorityFix {
  section: string;
  issue:
    | 'missing'
    | 'low_score'
    | 'thin_content'
    | 'weak_phrases'
    | 'no_sources';
  current_score: number | null;
  fix_type: 'create' | 'improve';
}

export const AUDIT_GATE_DEFINITIONS: Record<string, GateDefinition> = {
  GA1_REQUIRED_SECTIONS: {
    description: 'All required sections present',
    penalty: 30,
  },
  GA2_SCORE_THRESHOLD: {
    description: 'All sections score >= 70',
    penalty: 20,
  },
  GA3_CROSS_SECTION_DEDUP: {
    description: 'No duplicate paragraphs across sections',
    penalty: 15,
  },
  GA4_GENERIC_PHRASES: {
    description: 'Generic phrase ratio < threshold per section',
    penalty: 10,
  },
  GA5_EEAT_SOURCES: {
    description: 'All sections have E-E-A-T source',
    penalty: 5,
  },
  GA6_THIN_CONTENT: {
    description: 'No section < 50% min content length',
    penalty: 15,
  },
};

// ── Audit result shape (JSONB stored in skp_audit_result) ──

export interface AuditResult {
  /** 0-300+: higher = more work needed, process first (unclamped) */
  priority_score: number;
  /** Structured fix descriptors */
  priority_fixes: PriorityFix[];
  /** Sections that exist but score < improvementScoreThreshold */
  sections_to_improve: string[];
  /** Sections missing entirely from required pack */
  sections_to_create: string[];
  /** Current score per section, e.g. { S1: 92, S3: 50 } */
  section_scores: Record<string, number>;
  /** Alias for sections_to_create (backward compat) */
  missing_sections: string[];
  /** Generic phrase ratio per section, e.g. { S3: 0.18 } */
  weak_phrases_ratio: Record<string, number>;
  /** Content length in chars per section */
  content_lengths: Record<string, number>;
  /** One-liner summary for logs */
  audit_summary: string;
}
