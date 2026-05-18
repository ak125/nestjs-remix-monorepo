/**
 * Runtime Logs Collector — types & constants.
 *
 * ADR-064 §Architecture L1 — PR-2A-3. Source A du SLO multi-source pondéré.
 *
 * Une row par bucket 5-min × tier dans __seo_snapshot_runtime_logs.
 * `tier='total'` capture le grand total non-stratifié (sanity check).
 */

import type { TierId } from '@repo/registry';

export type RuntimeTierBucket = TierId | 'total';
export type RuntimeTriggeredBy = 'scheduler' | 'manual' | 'test';

export interface RuntimeLogsJobData {
  triggeredBy: RuntimeTriggeredBy;
  /** Fenêtre en minutes (default 60 — 12 buckets de 5 min). */
  windowMinutes?: number;
}

/** Row insérée dans __seo_snapshot_runtime_logs. */
export interface RuntimeLogsSnapshot {
  bucket_start: string; // ISO timestamp at 5-min boundary
  tier: RuntimeTierBucket;
  total_events: number;
  http_4xx_count: number;
  http_5xx_count: number;
  subjects_breakdown: Record<string, number>;
  run_id: string;
  fetched_at: string;
}

export interface RuntimeLogsRunResult {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  triggered_by: RuntimeTriggeredBy;
  window_minutes: number;
  rows_scanned: number;
  buckets_emitted: number;
  rows_upserted: number;
  totals_period: {
    total_events: number;
    http_5xx_count: number;
  };
  skipped?: 'read_only' | 'disabled' | 'no_supabase';
  errorMessage?: string;
}

export const RUNTIME_LOGS_JOB_NAME = 'seo-cp-runtime-logs-collect';
export const RUNTIME_LOGS_JOB_ID = 'seo-cp-runtime-logs-q5min';
export const RUNTIME_LOGS_QUEUE_NAME = 'seo-crawler-monitor';
