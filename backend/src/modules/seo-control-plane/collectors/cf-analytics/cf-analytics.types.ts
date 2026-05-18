/**
 * Cloudflare Analytics Collector — types & constants.
 *
 * ADR-064 §Architecture L1 — PR-2A-2.
 *
 * Une row par bucket 5-min × tier dans __seo_snapshot_cf_analytics.
 * `tier='total'` capture le grand total non-stratifié (sanity check / fallback
 * si classifyRoute() ne couvre pas une route mais elle existe en edge).
 */

import type { TierId } from '@repo/registry';

export type CfTierBucket = TierId | 'total';
export type CfTriggeredBy = 'scheduler' | 'manual' | 'test';

export interface CfAnalyticsJobData {
  triggeredBy: CfTriggeredBy;
  /** Override de fenêtre — par défaut les 60 dernières min (12 buckets de 5 min). */
  windowMinutes?: number;
}

/** Row insérée dans __seo_snapshot_cf_analytics. */
export interface CfAnalyticsSnapshot {
  bucket_start: string; // ISO timestamp from CF GraphQL
  tier: CfTierBucket;
  total_requests: number;
  http_2xx: number;
  http_3xx: number;
  http_4xx: number;
  http_5xx: number;
  cache_hits: number;
  cache_misses: number;
  bytes_served: number;
  origin_p50_ms: number | null;
  origin_p95_ms: number | null;
  run_id: string;
  zone_tag: string;
  fetched_at: string; // ISO timestamp
}

export interface CfAnalyticsRunResult {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  triggered_by: CfTriggeredBy;
  window_minutes: number;
  buckets_received: number;
  rows_upserted: number;
  totals_period: {
    total_requests: number;
    http_5xx: number;
    rate_5xx: number; // computed across the whole window
  };
  skipped?: 'read_only' | 'disabled' | 'no_token' | 'cf_api_error';
  errorMessage?: string;
}

export const CF_ANALYTICS_JOB_NAME = 'seo-cp-cf-analytics-fetch';
export const CF_ANALYTICS_JOB_ID = 'seo-cp-cf-analytics-q5min';
export const CF_ANALYTICS_QUEUE_NAME = 'seo-crawler-monitor';
