/**
 * RAG Ingestion types — decision pipeline for RagCleanupService.
 *
 * Used by: rag-cleanup.service.ts, rag-proxy.controller.ts
 */

export type TruthLevel = 'L1' | 'L2' | 'L3' | 'L4';

/** Input document for ingestion decision pipeline. */
export interface RagDocInput {
  title: string;
  content: string;
  source: string;
  truth_level: TruthLevel;
  domain: string;
  category: string;
}

/** All possible decision outcomes from the ingestion pipeline. */
export type IngestDecisionType =
  | 'ACCEPT_UPSERT'
  | 'REJECT_QUARANTINE'
  | 'ARCHIVE_AS_DUPLICATE'
  | 'ARCHIVE_BY_QUOTA'
  | 'INTERNAL_ONLY'
  | 'NEEDS_REVIEW';

/** Result of the ingestion decision pipeline. */
export interface IngestDecision {
  decision: IngestDecisionType;
  reasons: string[];
  fingerprint: string;
  parent_source: string;
  proposed: {
    status: string;
    retrievable: boolean;
    duplicate_of_id?: string;
  };
}

/** Single action in a cleanup batch report. */
export interface CleanupAction {
  docId: string;
  action: 'ARCHIVE' | 'MERGE' | 'QUARANTINE' | 'INTERNAL_ONLY' | 'KEEP';
  reason: string;
  source?: string;
}

/** Full cleanup batch report. */
export interface CleanupReport {
  timestamp: string;
  dryRun: boolean;
  stats: {
    archived: number;
    merged: number;
    kept: number;
    quarantined: number;
    internal_only: number;
  };
  actions: CleanupAction[];
}
