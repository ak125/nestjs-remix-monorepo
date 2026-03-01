/**
 * Conseil Pack definitions — section requirements, quality thresholds, E-E-A-T markers.
 * Used by ConseilQualityScorerService, ConseilPriorityService, and conseil-batch agent.
 */

// ── Pack levels ──────────────────────────────────────────

export type PackLevel = 'standard' | 'pro' | 'eeat';

export interface PackDefinition {
  id: PackLevel;
  label: string;
  requiredSections: string[];
  optionalSections: string[];
  minSectionScore: number;
  minPackScore: number;
  minFaqCount: number;
}

export const PACK_DEFINITIONS: Record<PackLevel, PackDefinition> = {
  standard: {
    id: 'standard',
    label: 'Pack R3 Standard',
    requiredSections: ['S1', 'S2', 'S3', 'S4_DEPOSE', 'S5', 'S6', 'S8'],
    optionalSections: ['S4_REPOSE', 'S7'],
    minSectionScore: 60,
    minPackScore: 70,
    minFaqCount: 3,
  },
  pro: {
    id: 'pro',
    label: 'Pack Pro',
    requiredSections: [
      'S1',
      'S2',
      'S2_DIAG',
      'S3',
      'S4_DEPOSE',
      'S5',
      'S_GARAGE',
      'S6',
      'S8',
    ],
    optionalSections: ['S4_REPOSE', 'S7'],
    minSectionScore: 70,
    minPackScore: 80,
    minFaqCount: 5,
  },
  eeat: {
    id: 'eeat',
    label: 'Pack E-E-A-T',
    requiredSections: [
      'S1',
      'S2',
      'S2_DIAG',
      'S3',
      'S4_DEPOSE',
      'S5',
      'S_GARAGE',
      'S6',
      'S8',
    ],
    optionalSections: ['S4_REPOSE', 'S7', 'META'],
    minSectionScore: 75,
    minPackScore: 85,
    minFaqCount: 6,
  },
};

// ── Section quality criteria ─────────────────────────────

export interface SectionQualityCriteria {
  minContentLength: number;
  minWordCount: number;
  requiresNumbers: boolean;
  requiresListItems: boolean;
  minListItems: number;
  genericPhrasesPenalty: number;
  maxGenericRatio: number;
}

export const SECTION_QUALITY_CRITERIA: Record<string, SectionQualityCriteria> =
  {
    S1: {
      minContentLength: 100,
      minWordCount: 20,
      requiresNumbers: false,
      requiresListItems: false,
      minListItems: 0,
      genericPhrasesPenalty: 15,
      maxGenericRatio: 0.1,
    },
    S2: {
      minContentLength: 120,
      minWordCount: 25,
      requiresNumbers: true,
      requiresListItems: false,
      minListItems: 0,
      genericPhrasesPenalty: 10,
      maxGenericRatio: 0.1,
    },
    S2_DIAG: {
      minContentLength: 200,
      minWordCount: 40,
      requiresNumbers: false,
      requiresListItems: false,
      minListItems: 0,
      genericPhrasesPenalty: 10,
      maxGenericRatio: 0.05,
    },
    S3: {
      minContentLength: 150,
      minWordCount: 30,
      requiresNumbers: false,
      requiresListItems: true,
      minListItems: 3,
      genericPhrasesPenalty: 12,
      maxGenericRatio: 0.1,
    },
    S4_DEPOSE: {
      minContentLength: 200,
      minWordCount: 40,
      requiresNumbers: false,
      requiresListItems: true,
      minListItems: 3,
      genericPhrasesPenalty: 8,
      maxGenericRatio: 0.05,
    },
    S4_REPOSE: {
      minContentLength: 200,
      minWordCount: 40,
      requiresNumbers: false,
      requiresListItems: true,
      minListItems: 3,
      genericPhrasesPenalty: 8,
      maxGenericRatio: 0.05,
    },
    S5: {
      minContentLength: 120,
      minWordCount: 25,
      requiresNumbers: false,
      requiresListItems: true,
      minListItems: 3,
      genericPhrasesPenalty: 12,
      maxGenericRatio: 0.1,
    },
    S6: {
      minContentLength: 100,
      minWordCount: 20,
      requiresNumbers: false,
      requiresListItems: true,
      minListItems: 2,
      genericPhrasesPenalty: 8,
      maxGenericRatio: 0.1,
    },
    S_GARAGE: {
      minContentLength: 150,
      minWordCount: 30,
      requiresNumbers: false,
      requiresListItems: false,
      minListItems: 0,
      genericPhrasesPenalty: 10,
      maxGenericRatio: 0.05,
    },
    S7: {
      minContentLength: 80,
      minWordCount: 15,
      requiresNumbers: false,
      requiresListItems: true,
      minListItems: 2,
      genericPhrasesPenalty: 5,
      maxGenericRatio: 0.2,
    },
    S8: {
      minContentLength: 200,
      minWordCount: 50,
      requiresNumbers: false,
      requiresListItems: false,
      minListItems: 0,
      genericPhrasesPenalty: 10,
      maxGenericRatio: 0.1,
    },
    META: {
      minContentLength: 50,
      minWordCount: 10,
      requiresNumbers: false,
      requiresListItems: false,
      minListItems: 0,
      genericPhrasesPenalty: 5,
      maxGenericRatio: 0.3,
    },
  };

// ── Generic phrases (shared with blog-seo.service.ts cleanWeakPhrases) ──

export const GENERIC_PHRASES: RegExp[] = [
  /n['']hésitez pas à consulter un professionnel/gi,
  /pour améliorer la fiabilité de votre véhicule/gi,
  /il est important de vérifier régulièrement/gi,
  /changez[- ]les s['']ils sont morts?/gi,
  /qualité premium/gi,
  /large choix/gi,
  /prix imbattable/gi,
  /rôle essentiel/gi,
  /bon fonctionnement/gi,
  /entretien régulier/gi,
  /pièce importante/gi,
  /il est recommandé/gi,
  /il est conseillé/gi,
  /en bon état/gi,
  /pièce indispensable/gi,
  /pour (?:assurer|garantir) (?:la |le |un |une )?(?:sécurité|confort|performance)/gi,
  /n['']attendez pas/gi,
  /faites confiance à/gi,
];

// ── E-E-A-T markers ─────────────────────────────────────

export const EEAT_SOURCE_TYPES = [
  'rag',
  'oem',
  'glossaire',
  'reference',
] as const;

export type EeatSourceType = (typeof EEAT_SOURCE_TYPES)[number];

export interface EeatSource {
  type: EeatSourceType;
  ref: string;
  label: string;
}
