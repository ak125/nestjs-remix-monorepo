/**
 * RAG Pipeline State Machines — Phase 1 Ingestion Foundation.
 *
 * 3 separate state machines to avoid conflating:
 * - job execution lifecycle
 * - document publication lifecycle
 * - post-publish side-effects
 */

// ── Job Status (execution lifecycle) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _RAG_JOB_STATUSES = [
  'queued',
  'processing',
  'extracting',
  'classifying',
  'deduplicating',
  'validating',
  'persisting',
  'completed',
  'noop_completed',
  'failed',
  'cancelled',
] as const;

export type RagJobStatus = (typeof _RAG_JOB_STATUSES)[number];

// ── Document Lifecycle (publication state) ────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DOCUMENT_LIFECYCLE_STATUSES = [
  'ingested',
  'staged',
  'reviewed',
  'published',
  'activated',
  'archived',
  'rejected',
  'tombstoned',
] as const;

export type DocumentLifecycleStatus =
  (typeof _DOCUMENT_LIFECYCLE_STATUSES)[number];

// ── Post-Publish Actions (side-effects lifecycle) ─────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _POST_PUBLISH_STATUSES = [
  'not_requested',
  'queued',
  'running',
  'skipped',
  'completed',
  'failed',
] as const;

export type PostPublishStatus = (typeof _POST_PUBLISH_STATUSES)[number];

// ── Phase 1 Status (R4 — Phase Barrier) ─────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _PHASE1_STATUSES = ['passed', 'failed', 'quarantined'] as const;
export type Phase1Status = (typeof _PHASE1_STATUSES)[number];

// ── Phase 1.5 Status (Normalization Barrier) ────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _PHASE15_STATUSES = [
  'normalized',
  'normalized_with_warnings',
  'blocked',
  'quarantined',
  'review_required',
] as const;

export type Phase15Status = (typeof _PHASE15_STATUSES)[number];

// ── Phase 1.6 Status (Admissibility Gate) ──────────────

export const PHASE16_STATUSES = [
  'admissible',
  'admissible_with_limits',
  'enrichment_required',
  'blocked',
] as const;

export type Phase16Status = (typeof PHASE16_STATUSES)[number];

// ── Phase 2 Status (Exploitation Gate) ──────────────────

export const PHASE2_STATUSES = [
  'draft_generated',
  'partial',
  'qa_required',
  'ready_for_publish',
  'blocked',
] as const;

export type Phase2Status = (typeof PHASE2_STATUSES)[number];
