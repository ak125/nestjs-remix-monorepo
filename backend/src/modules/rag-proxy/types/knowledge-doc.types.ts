/**
 * RAG Knowledge Document taxonomy.
 *
 * Families are stable classifications (what the doc IS).
 * Directories like web/ and web-catalog/ are intake zones (how it arrived),
 * NOT families — docs there get sorted into a real family or quarantined.
 */
export enum KnowledgeDocType {
  /** 1 doc per gamme — catalog source-of-truth. Enriches R1/R3/R4. */
  KB_GAMME = 'KB_GAMME',
  /** Transverse technical docs (OEM PDFs, comparisons). NOT 1-doc-per-page. */
  KB_REFERENCE = 'KB_REFERENCE',
  /** Symptom → fault trees. Enriches R5 via diagnosticSlug. */
  KB_DIAGNOSTIC = 'KB_DIAGNOSTIC',
  /** FAQ + policies + SAV. No automatic SEO enrichment. */
  KB_SUPPORT = 'KB_SUPPORT',
  /** Invalid / incomplete / untagged docs. Never indexed, never emits events. */
  QUARANTINE = 'QUARANTINE',
}

/** Maps on-disk directory name → KB family. */
export const DIR_TO_KB_TYPE: Record<string, KnowledgeDocType> = {
  gammes: KnowledgeDocType.KB_GAMME,
  diagnostic: KnowledgeDocType.KB_DIAGNOSTIC,
  guides: KnowledgeDocType.KB_REFERENCE,
  reference: KnowledgeDocType.KB_REFERENCE,
  faq: KnowledgeDocType.KB_SUPPORT,
  policies: KnowledgeDocType.KB_SUPPORT,
  _quarantine: KnowledgeDocType.QUARANTINE,
};

/**
 * Intake zones — NOT families. Docs land here from ingestion,
 * then get validated and moved to a real family directory.
 */
export const INTAKE_ZONES = ['web', 'web-catalog'] as const;

/** Directories that are never scanned or indexed. */
export const IGNORED_DIRS = [
  '_quarantine',
  '_raw',
  '_trash',
  'media',
  'structured',
  'tabular',
  'seo-data',
] as const;

/** Required frontmatter fields for ALL knowledge docs. */
export const REQUIRED_FRONTMATTER_FIELDS = [
  'title',
  'source_type',
  'doc_family',
  'truth_level',
] as const;

/** Valid source_type values. */
export const VALID_SOURCE_TYPES = [
  'gamme',
  'guide',
  'diagnostic',
  'faq',
  'policy',
  'general',
] as const;

/** Valid truth_level values. */
export const VALID_TRUTH_LEVELS = ['L1', 'L2', 'L3'] as const;

/** Valid doc_family values. */
export const VALID_DOC_FAMILIES = [
  'catalog',
  'diagnostic',
  'knowledge',
  'guide',
] as const;

export interface FrontmatterData {
  title?: string;
  source_type?: string;
  doc_family?: string;
  truth_level?: string;
  pg_alias?: string;
  pg_id?: string;
  slug?: string;
  category?: string;
  verification_status?: string;
  gamme?: string;
  [key: string]: string | undefined;
}

export interface ValidationResult {
  valid: boolean;
  kbType: KnowledgeDocType | null;
  errors: string[];
  frontmatter: FrontmatterData;
}

export interface QuarantineEntry {
  filename: string;
  originalPath: string;
  reason: string;
  details: string;
  quarantinedAt: string;
}
