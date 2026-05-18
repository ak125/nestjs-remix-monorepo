import type { DomainId } from '@repo/registry';

/**
 * EditorialPort — DiagnosticDomain (D4/D7) → EditorialDomain (D6 RAG & AI Engine) handoff.
 *
 * Single intent-based method : enrich diagnosed causes with editorial knowledge
 * (RAG facts, astuces, wiki references). Graceful degradation : empty array if
 * editorial unavailable, jamais throw (canon `feedback_no_silent_skip_on_governance_critical_jobs.md`
 * ne s'applique PAS — editorial enrichment est best-effort, pas critical).
 *
 * Implementation lives in `backend/src/modules/rag/` (D6). Until PR-D extraction,
 * adapter from `diagnostic-engine/engines/rag-enrichment.engine.ts`.
 *
 * Contract stability : any signature change = bump registry version + ADR L4.
 */

export interface EditorialCause {
  readonly cause_slug: string;
  readonly confidence: number;
}

export interface EditorialFact {
  readonly fact_id: string;
  readonly title: string;
  readonly content_snippet: string;
  readonly source_uri?: string;
}

export interface EditorialPort {
  enrich(causes: readonly EditorialCause[]): Promise<readonly EditorialFact[]>;
}

export const EDITORIAL_PORT = Symbol.for('DiagnosticDomain.EditorialPort');

export const TARGET_DOMAIN: DomainId = 'D6';
