export type PageType =
  | 'R1_pieces'
  | 'R3_conseils'
  | 'R3_guide_achat'
  | 'R4_reference'
  | 'R5_diagnostic';

/** Job data for gamme-based refresh (R1, R3, R4) */
export interface ContentRefreshJobData {
  refreshLogId: number;
  pgId: number;
  pgAlias: string;
  pageType: Exclude<PageType, 'R5_diagnostic'>;
  /** Absolute paths of supplementary RAG files that triggered this refresh */
  supplementaryFiles?: string[];
}

/** Job data for diagnostic refresh (R5) — keyed by diagnosticSlug, NOT pgAlias */
export interface ContentRefreshJobDataR5 {
  refreshLogId: number;
  diagnosticSlug: string;
  pageType: 'R5_diagnostic';
}

/** Union of all job data types */
export type AnyContentRefreshJobData =
  | ContentRefreshJobData
  | ContentRefreshJobDataR5;

export interface ContentRefreshResult {
  status: 'draft' | 'failed' | 'skipped' | 'auto_published';
  qualityScore: number | null;
  qualityFlags: string[];
  errorMessage?: string;
}

// ── RAG Overlay Contract ──

/** Outcome of attempting to load RAG data for an enrichment job */
export type RagPatchStatus =
  | 'SUCCESS' // RAG file found, parsed, valid data extracted
  | 'SKIPPED_NO_RAG' // No RAG file exists for this gamme (NORMAL)
  | 'SKIPPED_INVALID_RAG' // RAG file exists but content is unparseable/too short
  | 'ERROR'; // Unexpected error during RAG loading

export interface RagPatchResult {
  status: RagPatchStatus;
  /** Raw content if status=SUCCESS */
  content?: string;
  /** Human-readable reason for non-SUCCESS statuses */
  reason?: string;
  /** Source path for provenance tracking */
  sourcePath?: string;
}
