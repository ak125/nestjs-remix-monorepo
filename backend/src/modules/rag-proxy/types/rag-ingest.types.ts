/**
 * RAG Ingestion types — decision pipeline for RagCleanupService.
 *
 * Used by: rag-cleanup.service.ts, rag-proxy.controller.ts
 *
 * Phase 1: re-exports from new type files for backward compat.
 */

// Re-export Phase 1 types for consumers that import from this file
export type {
  RagJobStatus,
  DocumentLifecycleStatus,
  PostPublishStatus,
} from './rag-state.types';
export type {
  RagErrorCode,
  RagErrorFamily,
  RagRetryClass,
  RagPipelineError,
} from './rag-error-codes.types';
export type {
  FingerprintPack,
  IdempotenceDecision,
  RagProvenance,
  ValidationReport,
  IngestionReceipt,
} from './rag-contracts.types';
export type { Phase1Status } from './rag-state.types';

export type TruthLevel = 'L1' | 'L2' | 'L3' | 'L4';

/** Input document for ingestion decision pipeline. */
export interface RagDocInput {
  title: string;
  content: string;
  source: string;
  truth_level: TruthLevel;
  domain: string;
  category: string;
  /** Phase 1: optional provenance metadata */
  source_url?: string;
  gamme_aliases?: string[];
  job_origin?: string;
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
  /** Phase 1: full fingerprint pack for traceability */
  fingerprintPack?: import('./rag-contracts.types').FingerprintPack;
  /** Phase 1: write safety check result */
  writeSafety?: { safe: boolean; reason?: string };
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
