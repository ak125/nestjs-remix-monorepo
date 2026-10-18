/**
 * Types for Video Execution Pipeline (P2).
 *
 * BullMQ job data and result types for the video-render queue.
 * Pattern: content-refresh.types.ts
 */

// ─────────────────────────────────────────────────────────────
// Job data (submitted to BullMQ queue)
// ─────────────────────────────────────────────────────────────

export interface VideoExecutionJobData {
  /** FK to __video_execution_log.id */
  executionLogId: number;
  /** FK to __video_productions.brief_id */
  briefId: string;
  /** What triggered this execution */
  triggerSource: 'manual' | 'api' | 'retry';
  /** Parent job ID if this is a retry */
  triggerJobId?: string;
}

// ─────────────────────────────────────────────────────────────
// Execution result (returned by processor)
// ─────────────────────────────────────────────────────────────

import type { ExecutionOutcome } from '../../modules/media-factory/render/execution-outcome';

export interface VideoExecutionResult {
  status: ExecutionOutcome;
  canPublish: boolean | null;
  qualityScore: number | null;
  qualityFlags: string[];
  errorMessage?: string;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────
// Legacy execution log lifecycle (DB column values; not render success)
// ─────────────────────────────────────────────────────────────

export type VideoExecutionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';
