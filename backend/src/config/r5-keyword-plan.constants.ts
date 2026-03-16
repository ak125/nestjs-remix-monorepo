/**
 * r5-keyword-plan.constants.ts
 *
 * Constants for R5_DIAGNOSTIC keyword planner.
 * Sections, intents, caution levels, quality gates, safety gate.
 */

// ── Section IDs ──

export const R5_SECTION_IDS = [
  'symptoms',
  'perception',
  'sign_test',
  'obd_codes',
  'costs',
  'faq_diagnostic',
] as const;

export type R5SectionId = (typeof R5_SECTION_IDS)[number];

export const R5_REQUIRED_SECTIONS: R5SectionId[] = ['symptoms'];

export const R5_CONDITIONAL_SECTIONS: R5SectionId[] = [
  'perception',
  'sign_test',
];

export const R5_OPTIONAL_SECTIONS: R5SectionId[] = [
  'obd_codes',
  'costs',
  'faq_diagnostic',
];

// ── Section config ──

export const R5_SECTION_CONFIG: Record<
  R5SectionId,
  {
    heading_template: string;
    min_words: number;
    max_words: number;
    evidence_source: string;
    required: boolean;
  }
> = {
  symptoms: {
    heading_template: 'Symptômes observables : {piece}',
    min_words: 80,
    max_words: 300,
    evidence_source: 'diagnostic.symptoms',
    required: true,
  },
  perception: {
    heading_template: 'Ce que vous pouvez percevoir',
    min_words: 50,
    max_words: 200,
    evidence_source: 'diagnostic.symptoms[].perception',
    required: false,
  },
  sign_test: {
    heading_template: 'Vérifications simples à faire',
    min_words: 60,
    max_words: 250,
    evidence_source: 'diagnostic.quick_checks',
    required: false,
  },
  obd_codes: {
    heading_template: 'Codes OBD / DTC associés',
    min_words: 30,
    max_words: 150,
    evidence_source: 'diagnostic.obd_codes',
    required: false,
  },
  costs: {
    heading_template: 'Estimation du coût de réparation',
    min_words: 30,
    max_words: 100,
    evidence_source: 'selection.cost_range',
    required: false,
  },
  faq_diagnostic: {
    heading_template: 'Questions fréquentes',
    min_words: 50,
    max_words: 200,
    evidence_source: 'rendering.faq',
    required: false,
  },
};

// ── Intents ──

export const R5_ALLOWED_INTENTS = [
  'identify',
  'verify',
  'triage',
  'escalate',
  'understand_cause',
] as const;

export type R5Intent = (typeof R5_ALLOWED_INTENTS)[number];

export const R5_INTENT_TO_SECTIONS: Record<R5Intent, R5SectionId[]> = {
  identify: ['symptoms', 'perception'],
  verify: ['sign_test'],
  triage: ['symptoms', 'costs'],
  escalate: ['sign_test', 'faq_diagnostic'],
  understand_cause: ['symptoms'],
};

// ── Caution levels ──

export type CautionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const DOMAIN_CAUTION_MATRIX: Record<string, CautionLevel> = {
  freinage: 'HIGH',
  direction: 'HIGH',
  distribution: 'HIGH',
  suspension: 'MEDIUM',
  moteur: 'MEDIUM',
  transmission: 'MEDIUM',
  refroidissement: 'MEDIUM',
  filtration: 'LOW',
  eclairage: 'LOW',
  embrayage: 'LOW',
  echappement: 'LOW',
  electrique: 'LOW',
  climatisation: 'LOW',
  demarrage: 'LOW',
  carrosserie: 'LOW',
};

export const SAFETY_CRITICAL_DOMAINS = [
  'freinage',
  'direction',
  'distribution',
];

// ── Forbidden terms (R5 must not cannibalize) ──

export const R5_FORBIDDEN_TERMS = {
  R3_HOWTO: [
    'étape 1',
    'etape 1',
    'démonter',
    'demonter',
    'remonter',
    'remontage',
    'couple de serrage',
    'tutoriel',
    'pas-à-pas',
    'pas a pas',
  ],
  R4_ENCYCLOPEDIE: [
    "qu'est-ce que",
    'se compose de',
    'par définition',
    'par definition',
    'glossaire',
    'encyclopédie',
  ],
  R6_GUIDE_ACHAT: [
    'comment choisir',
    "guide d'achat",
    'meilleur rapport',
    'comparatif',
  ],
  R2_TRANSACTIONNEL: [
    'ajouter au panier',
    'prix',
    'promo',
    'livraison',
    'en stock',
  ],
} as const;

// ── Quality gates ──

export const R5_QUALITY_GATES = {
  RG1_SYMPTOMS_PRESENT: {
    id: 'RG1',
    description: 'Section symptoms obligatoire présente',
    blocking: true,
    threshold: 'required',
  },
  RG2_MIN_SYMPTOMS: {
    id: 'RG2',
    description: 'Minimum 3 symptômes documentés',
    blocking: false,
    threshold: 3,
  },
  RG3_FORBIDDEN_TERMS: {
    id: 'RG3',
    description: 'Aucun terme R3/R4/R6/R2 interdit',
    blocking: true,
    threshold: 0,
  },
  RG4_TERMS_PER_SYMPTOM: {
    id: 'RG4',
    description: 'Min 2 termes SEO par symptôme',
    blocking: false,
    threshold: 2,
  },
  RG5_CAUTION_COHERENT: {
    id: 'RG5',
    description: 'Caution level cohérent avec domaine',
    blocking: false,
    threshold: 'match_matrix',
  },
  RG6_PRUDENCE: {
    id: 'RG6',
    description: 'Hypothèses formulées en prudence (pas de certitude)',
    blocking: true,
    threshold: 0,
  },
  RG7_NON_INVASIVE: {
    id: 'RG7',
    description: 'Check plan = contrôles non-invasifs uniquement',
    blocking: true,
    threshold: 0,
  },
  RG8_GLOBAL_SCORE: {
    id: 'RG8',
    description: 'Score global ≥ 65',
    blocking: false,
    threshold: 65,
  },
} as const;

export const R5_SAFETY_GATE = {
  SG1_CRITICAL_PIECE: {
    id: 'SG1',
    description:
      'Pièce critique (freinage/direction/distribution) = caution HIGH minimum',
    blocking: true,
  },
} as const;

// ── Evidence sufficiency ──

export const R5_EVIDENCE_THRESHOLDS = {
  symptoms_min_count: 3,
  causes_min_count: 2,
  quick_checks_min_count: 1,
  obd_codes_min_count: 1,
  min_quality_score: 65,
} as const;

// ── Observable types ──

export const R5_OBSERVABLE_TYPES = [
  'bruit',
  'vibration',
  'voyant',
  'odeur',
  'visuel',
  'comportement',
] as const;

export const R5_OBSERVABLE_CONTEXTS = [
  'freinage',
  'accélération',
  'virage',
  'démarrage',
  'ralenti',
  'permanent',
  'charge',
  'froid',
  'chaud',
] as const;
