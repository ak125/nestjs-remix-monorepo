export interface ContentRefreshJobData {
  refreshLogId: number;
  pgId: number;
  pgAlias: string;
  pageType: 'R1_pieces' | 'R3_conseils' | 'R3_guide_achat' | 'R4_reference';
}

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
