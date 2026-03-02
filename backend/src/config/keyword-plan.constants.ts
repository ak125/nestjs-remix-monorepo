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
  /** C.8: overlap > 15% = FAIL */
  maxR1RiskScore: 0.15,
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

/** Recommended media type per section (aligned with MEDIA_LAYOUT_CONTRACT) */
export const SECTION_DEFAULT_MEDIA: Record<
  string,
  {
    type: MediaSlotType;
    required: boolean;
    schema?: { columns?: string[]; item_count_target?: string };
  }
> = {
  S1: { type: 'checklist', required: true },
  S2: {
    type: 'table',
    required: true,
    schema: {
      columns: ['Symptome', 'Cause probable', 'Action recommandee'],
    },
  },
  S2_DIAG: {
    type: 'table',
    required: true,
    schema: {
      columns: ['Symptome', 'Cause probable', 'Action recommandee'],
    },
  },
  S3: {
    type: 'checklist',
    required: true,
    schema: {
      columns: [
        'Caracteristique',
        'Ou la lire',
        'Risque si erreur',
        'Comment verifier',
      ],
    },
  },
  S4_DEPOSE: {
    type: 'steps',
    required: true,
    schema: { item_count_target: '7-12' },
  },
  S4_REPOSE: {
    type: 'steps',
    required: true,
    schema: { item_count_target: '5-10' },
  },
  S5: {
    type: 'callout',
    required: true,
    schema: { columns: ['Erreur', 'Risque', 'Correctif'] },
  },
  S6: {
    type: 'checklist',
    required: true,
    schema: { item_count_target: '6-10' },
  },
  S7: { type: 'cards', required: true },
  S8: {
    type: 'faq',
    required: true,
    schema: { item_count_target: '4-6' },
  },
  META: { type: 'cards', required: true },
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
  improvementScoreThreshold: 75,
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
  /** RAG file modified after content was generated */
  ragStale: 25,
  /** RAG file missing required blocks for a section */
  ragInsufficient: 20,
} as const;

// ── Audit gate definitions (GA1-GA6, separate from plan gates G1-G6) ──

export interface PriorityFix {
  section: string;
  issue:
    | 'missing'
    | 'low_score'
    | 'thin_content'
    | 'weak_phrases'
    | 'no_sources'
    | 'rag_stale'
    | 'rag_insufficient';
  current_score: number | null;
  fix_type: 'create' | 'improve' | 'blocked';
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

// ── RAG sufficiency mapping (section → required RAG blocks) ─

export interface RagBlockRequirement {
  /** V4 block path (dotted) */
  block: string;
  /** Minimum items (1 for non_empty, 2+ for lists) */
  minItems: number;
  /** V1 fallback paths, tried in order. null = no V1 equivalent. */
  v1Fallbacks: string[] | null;
  /** Type of check */
  checkType: 'non_empty' | 'list';
  /** Transform hint for V1 → V4 data shape adaptation */
  v1Transform?:
    | 'wrap_string_as_list'
    | 'extract_then_from_tree'
    | 'extract_labels';
}

export const RAG_SECTION_REQUIREMENTS: Record<string, RagBlockRequirement[]> = {
  S1: [
    {
      block: 'domain.role',
      minItems: 1,
      v1Fallbacks: [
        'mechanical_rules.role_summary',
        'page_contract.intro.role',
      ],
      checkType: 'non_empty',
    },
  ],
  S2: [
    {
      block: 'maintenance.interval',
      minItems: 1,
      v1Fallbacks: ['page_contract.timing'],
      checkType: 'non_empty',
    },
    {
      block: 'maintenance.wear_signs',
      minItems: 1,
      v1Fallbacks: null,
      checkType: 'list',
    },
  ],
  S2_DIAG: [
    {
      block: 'diagnostic.symptoms',
      minItems: 2,
      v1Fallbacks: ['symptoms', 'page_contract.symptoms'],
      checkType: 'list',
      v1Transform: 'extract_labels',
    },
    {
      block: 'diagnostic.quick_checks',
      minItems: 1,
      v1Fallbacks: null,
      checkType: 'list',
    },
  ],
  S3: [
    {
      block: 'selection.criteria',
      minItems: 3,
      v1Fallbacks: ['page_contract.howToChoose'],
      checkType: 'list',
      v1Transform: 'wrap_string_as_list',
    },
  ],
  S4_DEPOSE: [
    {
      block: 'diagnostic.causes',
      minItems: 3,
      v1Fallbacks: ['diagnostic_tree'],
      checkType: 'list',
      v1Transform: 'extract_then_from_tree',
    },
  ],
  S5: [
    {
      block: 'selection.anti_mistakes',
      minItems: 3,
      v1Fallbacks: ['page_contract.antiMistakes'],
      checkType: 'list',
    },
  ],
  S6: [
    {
      block: 'maintenance.good_practices',
      minItems: 2,
      v1Fallbacks: null,
      checkType: 'list',
    },
  ],
  S8: [
    {
      block: 'rendering.faq',
      minItems: 3,
      v1Fallbacks: ['page_contract.faq'],
      checkType: 'list',
    },
  ],
};

/** Default RAG field for sgc_sources attribution, keyed by section type */
export const SECTION_RAG_FIELD_MAP: Record<string, string> = {
  S1: 'domain.role',
  S2: 'maintenance.interval',
  S2_DIAG: 'diagnostic.symptoms',
  S3: 'selection.criteria',
  S4_DEPOSE: 'diagnostic.causes',
  S4_REPOSE: 'installation.steps',
  S5: 'selection.anti_mistakes',
  S6: 'maintenance.good_practices',
  S_GARAGE: 'installation.difficulty',
  S7: 'domain.related_parts',
  S8: 'rendering.faq',
};

// ── Keyword research query templates ────────────────────

export const KW_RESEARCH_TEMPLATES = {
  transactional: [
    '{gamme} pas cher',
    'prix {gamme}',
    'acheter {gamme} en ligne',
  ],
  informational: [
    'quand changer {gamme}',
    'comment changer {gamme}',
    'symptôme {gamme} usé',
    '{gamme} durée de vie',
  ],
  guide_achat: [
    'comment choisir {gamme}',
    'meilleur {gamme}',
    '{gamme} comparatif',
  ],
  diagnostic: ['bruit {gamme}', 'voyant {gamme}', 'panne {gamme} symptôme'],
  paa: ['{gamme}', 'quand changer {gamme}'],
} as const;

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
  /** Keyword research queries to investigate (populated in P0.5) */
  keyword_research_queries?: Record<string, string[]>;
  /** Sections blocked due to insufficient RAG (cannot generate without enrichment) */
  sections_blocked?: string[];
  /** true if RAG file was modified after last content generation */
  rag_stale?: boolean;
  /** Gate results from audit (GA1-GA7) */
  gate_report?: Record<string, GateResult>;
}
