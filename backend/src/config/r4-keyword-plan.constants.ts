/**
 * R4 Keyword Plan constants — pipeline phases v2, section config, gate definitions,
 * system templates, quality thresholds.
 * Used by r4-keyword-planner (2-pass Discover → Compile)
 * and r4-content-batch (Blueprint → B1-B9 Sections → Assemble → Lint).
 *
 * R4 = definition canonique + verite mecanique. NO procedures.
 */
import type {
  GateDefinition,
  GateResult,
  PriorityFix,
  AuditResult,
} from './keyword-plan.constants';

// Re-export shared interfaces from R3 (no duplication)
export type { GateDefinition, GateResult, PriorityFix, AuditResult };

// -- Pipeline phases v2 (2-pass: Discover → Compile) --

export const R4_KP_PIPELINE_PHASES = [
  // Planning phases (keyword planner)
  'R4P0_AUDIT',
  'R4P1_DISCOVER',
  'R4P2_CLASSIFY',
  'R4P3_COMPILE',
  'R4P4_SECTIONS',
  'R4P5_VALIDATE',
  'R4P6_PERSIST',
  // Content generation phases (content batch v4 — audit-first)
  'R4P7_AUDIT_CONTENT',
  'R4P8_BLUEPRINT',
  'R4P9_IMPROVE',
  'R4P10_ASSEMBLE_LINT',
  'R4P11_WRITE',
  'complete',
] as const;
export type R4KpPipelinePhase = (typeof R4_KP_PIPELINE_PHASES)[number];

// -- Section types for R4 pages --

export const R4_PLANNABLE_SECTIONS = [
  'R4_S0_DEFINITION',
  'R4_S1_TAKEAWAYS',
  'R4_S2_ROLE',
  'R4_S3_COMPOSITION',
  'R4_S4_VARIANTS',
  'R4_S5_CONFUSIONS',
  'R4_S6_FAQ',
] as const;
export type R4PlannableSection = (typeof R4_PLANNABLE_SECTIONS)[number];

export type R4SeoPriority = 'critical' | 'high' | 'medium' | 'low';

export interface R4SectionDef {
  id: string;
  label: string;
  keyword_targeted: boolean;
  required: boolean;
  min_words?: number;
  min_items?: number;
  max_items?: number;
  seo_priority: R4SeoPriority;
}

export const R4_SECTION_CONFIG: Record<R4PlannableSection, R4SectionDef> = {
  R4_S0_DEFINITION: {
    id: 'definition',
    label: 'Definition canonique',
    keyword_targeted: true,
    required: true,
    min_words: 80,
    seo_priority: 'critical',
  },
  R4_S1_TAKEAWAYS: {
    id: 'takeaways',
    label: 'A retenir',
    keyword_targeted: true,
    required: true,
    min_items: 2,
    max_items: 5,
    seo_priority: 'high',
  },
  R4_S2_ROLE: {
    id: 'role',
    label: 'Role mecanique',
    keyword_targeted: true,
    required: true,
    min_words: 60,
    seo_priority: 'high',
  },
  R4_S3_COMPOSITION: {
    id: 'composition',
    label: 'Composition',
    keyword_targeted: true,
    required: false,
    min_items: 3,
    seo_priority: 'medium',
  },
  R4_S4_VARIANTS: {
    id: 'variants',
    label: 'Variantes & types',
    keyword_targeted: true,
    required: false,
    seo_priority: 'medium',
  },
  R4_S5_CONFUSIONS: {
    id: 'confusions',
    label: 'Confusions courantes',
    keyword_targeted: true,
    required: true,
    min_items: 2,
    seo_priority: 'high',
  },
  R4_S6_FAQ: {
    id: 'faq',
    label: 'Questions frequentes',
    keyword_targeted: true,
    required: true,
    min_items: 3,
    max_items: 8,
    seo_priority: 'critical',
  },
};

// -- System templates (domain-specific enrichment) --

export interface R4SystemTemplate {
  extra_sections: string[];
  focus_terms: string[];
}

export const R4_SYSTEM_TEMPLATES: Record<string, R4SystemTemplate> = {
  freinage: {
    extra_sections: ['Normes & homologation', 'Reperes thermiques', 'Securite'],
    focus_terms: [
      'coefficient friction',
      'epaisseur min',
      'temperature max',
      'homologation ECE R90',
    ],
  },
  filtration: {
    extra_sections: ['Micronnage & debit', 'Normes & certifications'],
    focus_terms: [
      'microns',
      'debit nominal',
      'pression differentielle',
      'norme ISO',
    ],
  },
  suspension: {
    extra_sections: ['Confort vs tenue de route', 'Types technologiques'],
    focus_terms: [
      'amortissement',
      'debattement',
      'hydraulique',
      'gaz',
      'tarage',
    ],
  },
  moteur: {
    extra_sections: ['Tolerances & jeux', 'Intervalles constructeur'],
    focus_terms: ['couple', 'tolerance', 'jeu axial', 'precontrainte'],
  },
  eclairage: {
    extra_sections: ['Homologation & reglementation', 'Technologies'],
    focus_terms: [
      'lumens',
      'kelvin',
      'homologation E',
      'LED',
      'halogene',
      'xenon',
    ],
  },
  _default: {
    extra_sections: [],
    focus_terms: [],
  },
};

// -- Quality gates v2 (9 hard gates) --

export const R4_GATES: Record<string, GateDefinition> = {
  RG1_NO_HOWTO_IN_TARGETS: {
    description: 'Aucun verbe howto dans target_keywords',
    penalty: 20,
  },
  RG2_NO_TRANSACTIONAL_IN_TARGETS: {
    description: 'Aucun modificateur transactionnel dans targets',
    penalty: 20,
  },
  RG3_NO_DIAGNOSTIC_FOCUS: {
    description: 'Aucun terme diagnostic en focus dans targets',
    penalty: 20,
  },
  RG4_SECTIONS_COUNT: {
    description: '7 <= H2 <= 9',
    penalty: 10,
  },
  RG5_CLUSTERS_R4_ONLY: {
    description: 'HEAD/MID/LONG_TAIL role=R4 uniquement',
    penalty: 20,
  },
  RG6_FORBIDDEN_HAVE_TARGET: {
    description: 'Chaque forbidden_term a un target_page_role',
    penalty: 5,
  },
  RG7_SECTION_COVERAGE: {
    description: 'Sections required ont min 6 target_keywords',
    penalty: 15,
  },
  RG8_ANTI_CANNIB_JACCARD: {
    description: 'Jaccard < 0.12 vs R1/R3/R5/R6 existants',
    penalty: 20,
  },
  RG9_UNIVERSE_CLASSIFIED: {
    description: 'keyword_universe 100% classifie (pas de role=unknown)',
    penalty: 10,
  },
};

// -- Forbidden term lists (anti-cannibalization) --

export const R4_FORBIDDEN_FROM_R1 = [
  'acheter',
  'prix',
  'pas cher',
  'promo',
  'livraison',
  'compatible avec',
  'meilleur',
  'top',
  'comparatif prix',
  'stock',
  'reference OEM',
] as const;

export const R4_FORBIDDEN_FROM_R3 = [
  'changer',
  'remplacer',
  'installer',
  'tutoriel',
  'etapes',
  'procedure',
  'outils',
  'difficulte',
  'temps',
  'couple de serrage',
  'rodage',
  'comment faire',
] as const;

export const R4_FORBIDDEN_FROM_R5 = [
  'symptome',
  'panne',
  'cause',
  'pourquoi ca vibre',
  'bruit',
  'voyant',
  'solutions',
  'reparer',
] as const;

export const R4_FORBIDDEN_FROM_R6 = [
  'guide achat',
  'quel choisir',
  'budget',
  'marques recommandees',
  'rapport qualite prix',
] as const;

export const R4_ALL_FORBIDDEN = [
  ...R4_FORBIDDEN_FROM_R1.map((t) => ({
    term: t,
    reason: 'transactionnel',
    target_page_role: 'R1' as const,
  })),
  ...R4_FORBIDDEN_FROM_R3.map((t) => ({
    term: t,
    reason: 'how-to / procedure',
    target_page_role: 'R3' as const,
  })),
  ...R4_FORBIDDEN_FROM_R5.map((t) => ({
    term: t,
    reason: 'diagnostic',
    target_page_role: 'R5' as const,
  })),
  ...R4_FORBIDDEN_FROM_R6.map((t) => ({
    term: t,
    reason: 'guide achat',
    target_page_role: 'R6' as const,
  })),
];

// -- Risk flag constants --

export const R4_RISK_FLAGS = [
  'CONTAINS_HOWTO_VERBS',
  'TRANSACTIONAL_MODIFIERS',
  'DIAGNOSTIC_FOCUS_TERMS',
  'LOW_FAQ_COUNT',
  'LOW_TAKEAWAYS_COUNT',
  'HIGH_CANNIB_SCORE',
  'UNIVERSE_UNCLASSIFIED',
  'MISSING_REQUIRED_SECTION',
] as const;
export type R4RiskFlag = (typeof R4_RISK_FLAGS)[number];

// -- Quality thresholds --

export const R4_QUALITY_THRESHOLDS = {
  minQualityScore: 60,
  minCoverageScore: 0.7,
  maxCannibScore: 0.12,
  minFaqCount: 3,
  minTakeawaysCount: 2,
  minClusterSize: { HEAD: 3, MID: 5, LONG_TAIL: 5 },
  minTargetKeywordsPerSection: 6,
  minSupportingTermsPerSection: 10,
  minForbiddenTermsPerSection: 8,
  universeMinQueries: 120,
  universeMaxQueries: 220,
} as const;

// -- DB column prefix --

export const R4_KP_TABLE = '__seo_r4_keyword_plan' as const;
export const R4_KP_PREFIX = 'r4kp' as const;
export const R4_CONTENT_TABLE = '__seo_reference' as const;

// ============================================================
// v3 Content Generation (r4-content-batch)
// ============================================================

// -- Content section IDs (B1-B9 prompts) --

export const R4_CONTENT_SECTIONS = [
  'R4_B1_DEFINITION',
  'R4_B2_ROLE',
  'R4_B3_COMPOSITION',
  'R4_B4_VARIANTS',
  'R4_B5_KEY_SPECS',
  'R4_B6_FAQ',
  'R4_B7_DOES_NOT',
  'R4_B8_RULES',
  'R4_B9_SCOPE',
] as const;
export type R4ContentSection = (typeof R4_CONTENT_SECTIONS)[number];

// -- Content section config (word/item constraints per prompt) --

export interface R4ContentSectionDef {
  id: string;
  label: string;
  db_columns: string[];
  required: boolean;
  min_words?: number;
  max_words?: number;
  min_items?: number;
  max_items?: number;
  output_type: 'paragraph' | 'bullets' | 'numbered' | 'cards' | 'table' | 'faq';
}

export const R4_CONTENT_SECTION_CONFIG: Record<
  R4ContentSection,
  R4ContentSectionDef
> = {
  R4_B1_DEFINITION: {
    id: 'definition',
    label: 'Definition canonique',
    db_columns: ['definition', 'takeaways'],
    required: true,
    min_words: 50,
    max_words: 110,
    min_items: 3,
    max_items: 5,
    output_type: 'paragraph',
  },
  R4_B2_ROLE: {
    id: 'role_mecanique',
    label: 'Role mecanique',
    db_columns: ['role_mecanique'],
    required: true,
    min_words: 70,
    max_words: 140,
    output_type: 'paragraph',
  },
  R4_B3_COMPOSITION: {
    id: 'composition',
    label: 'Composition et elements associes',
    db_columns: ['composition'],
    required: true,
    min_items: 4,
    max_items: 7,
    output_type: 'numbered',
  },
  R4_B4_VARIANTS: {
    id: 'variants',
    label: 'Variantes et types',
    db_columns: ['variants'],
    required: false,
    min_items: 3,
    max_items: 5,
    output_type: 'cards',
  },
  R4_B5_KEY_SPECS: {
    id: 'key_specs',
    label: 'Reperes techniques',
    db_columns: ['key_specs'],
    required: true,
    min_items: 4,
    max_items: 8,
    output_type: 'table',
  },
  R4_B6_FAQ: {
    id: 'faq',
    label: 'Confusions courantes (FAQ)',
    db_columns: ['confusions_courantes', 'common_questions'],
    required: true,
    min_items: 4,
    max_items: 7,
    output_type: 'faq',
  },
  R4_B7_DOES_NOT: {
    id: 'does_not',
    label: 'Ce que ca ne fait pas',
    db_columns: ['role_negatif'],
    required: true,
    min_items: 5,
    max_items: 8,
    output_type: 'bullets',
  },
  R4_B8_RULES: {
    id: 'rules',
    label: 'Regles metier (anti-erreur)',
    db_columns: ['regles_metier'],
    required: true,
    min_items: 5,
    max_items: 9,
    output_type: 'numbered',
  },
  R4_B9_SCOPE: {
    id: 'scope',
    label: 'Scope et limites',
    db_columns: ['scope_limites'],
    required: true,
    min_words: 80,
    max_words: 140,
    output_type: 'paragraph',
  },
};

// -- Section → DB column mapping (for SQL writes) --

export const R4_SECTION_DB_MAP: Record<R4ContentSection, string[]> = {
  R4_B1_DEFINITION: ['definition', 'takeaways'],
  R4_B2_ROLE: ['role_mecanique'],
  R4_B3_COMPOSITION: ['composition'],
  R4_B4_VARIANTS: ['variants'],
  R4_B5_KEY_SPECS: ['key_specs'],
  R4_B6_FAQ: ['confusions_courantes', 'common_questions'],
  R4_B7_DOES_NOT: ['role_negatif'],
  R4_B8_RULES: ['regles_metier'],
  R4_B9_SCOPE: ['scope_limites'],
};

// -- Content-gen quality thresholds --

export const R4_CONTENT_THRESHOLDS = {
  minLintScore: 70,
  maxForbiddenInContent: 0,
  minKeywordsUsedPerSection: 4,
  minSectionsForPublish: 7,
} as const;

// -- Audit section statuses (v4 audit-first pipeline) --

export const R4_AUDIT_STATUSES = [
  'KEEP',
  'IMPROVE',
  'REMOVE',
  'MOVE_TO_R3',
  'MOVE_TO_R5',
  'MOVE_TO_R1',
] as const;
export type R4AuditStatus = (typeof R4_AUDIT_STATUSES)[number];

// -- Media slot types (R4 media plan) --

export const R4_MEDIA_TYPES = [
  'none',
  'image',
  'diagram',
  'table',
  'callout',
] as const;
export type R4MediaType = (typeof R4_MEDIA_TYPES)[number];

export const R4_MEDIA_GOALS = [
  'comprehension',
  'trust',
  'disambiguation',
  'scanability',
] as const;
export type R4MediaGoal = (typeof R4_MEDIA_GOALS)[number];

export interface R4SectionMediaDefault {
  type: R4MediaType;
  variant?: string;
  priority: 'always' | 'preferred' | 'optional' | 'none';
  goal?: R4MediaGoal;
}

export const R4_SECTION_MEDIA_DEFAULTS: Record<string, R4SectionMediaDefault> =
  {
    hero: {
      type: 'image',
      variant: 'diagram_simple',
      priority: 'always',
      goal: 'comprehension',
    },
    definition: { type: 'none', priority: 'none' },
    takeaways: { type: 'none', priority: 'none' },
    role_mecanique: {
      type: 'diagram',
      variant: 'diagram_simple',
      priority: 'optional',
      goal: 'comprehension',
    },
    composition: {
      type: 'table',
      variant: '4_columns',
      priority: 'preferred',
      goal: 'scanability',
    },
    variants: {
      type: 'table',
      variant: '4_columns',
      priority: 'preferred',
      goal: 'disambiguation',
    },
    key_specs: {
      type: 'table',
      variant: '3_columns',
      priority: 'always',
      goal: 'trust',
    },
    faq: { type: 'none', priority: 'none' },
    does_not: { type: 'none', priority: 'none' },
    rules: {
      type: 'callout',
      variant: 'purple_shield',
      priority: 'preferred',
      goal: 'trust',
    },
    scope: {
      type: 'callout',
      variant: 'slate_info',
      priority: 'preferred',
      goal: 'scanability',
    },
  };

// -- Page contract R4 enums (used by page-contract-r4.schema.ts) --

export const R4_SECTION_IDS = [
  'definition',
  'takeaways',
  'role_mecanique',
  'composition',
  'variants',
  'key_specs',
  'faq',
  'does_not',
  'rules',
  'scope',
] as const;
export type R4SectionId = (typeof R4_SECTION_IDS)[number];

export const R4_MEDIA_VARIANTS = [
  'photo_piece',
  'diagram_simple',
  'exploded_view',
  'mini_icon',
  'comparison_table',
  'specs_table',
  'callout_policy',
  'callout_scope',
  'og_template',
  'none',
] as const;
export type R4MediaVariant = (typeof R4_MEDIA_VARIANTS)[number];

export const R4_CONTENT_BLOCK_TYPES = [
  'paragraph',
  'bullets',
  'numbered',
  'cards',
  'table',
  'faq',
  'callout',
] as const;
export type R4ContentBlockType = (typeof R4_CONTENT_BLOCK_TYPES)[number];

export const R4_HARD_GATES = [
  'NO_HOWTO_FOCUS_IN_R4',
  'NO_TRANSACTIONAL_FOCUS_IN_R4',
  'NO_DIAGNOSTIC_FOCUS_IN_R4',
  'NO_DUPLICATE_SECTIONS',
  'R4_SECTIONS_COUNT_OK',
  'MEDIA_SLOTS_PRESENT',
  'CANONICAL_ORIGIN_UNIFIED',
] as const;
export type R4HardGate = (typeof R4_HARD_GATES)[number];

export const R4_CALLOUT_TONES = [
  'indigo',
  'green',
  'blue',
  'amber',
  'red',
  'purple',
  'slate',
] as const;
export type R4CalloutTone = (typeof R4_CALLOUT_TONES)[number];

export const R4_ENTITY_RELATIONS = [
  'interaction',
  'confusion',
  'system',
  'related',
] as const;
export type R4EntityRelation = (typeof R4_ENTITY_RELATIONS)[number];

export const R4_HERO_MEDIA_TYPES = ['image', 'diagram', 'none'] as const;
export type R4HeroMediaType = (typeof R4_HERO_MEDIA_TYPES)[number];

// -- R4 image rules --

export const R4_IMAGE_ALLOWED = [
  'photo_piece_fond_neutre',
  'schema_simple',
  'diagramme_interactions',
  'vue_eclatee',
  'pictogramme',
] as const;

export const R4_IMAGE_FORBIDDEN = [
  'etapes_demontage',
  'outils',
  'mains',
  'garage',
  'installation',
  'procedure',
] as const;
