/**
 * Cloudflare RUM Collector — types & constants.
 *
 * ADR-064 §Architecture L1 — PR-2A-2.5 (Web Vitals edge-RUM).
 *
 * Une row par (bucket_start jour UTC, tier, path_group) dans __seo_snapshot_cf_rum.
 *   - tier='total'        → rollup sans stratification criticality
 *   - path_group='total'  → rollup sans stratification section
 *   - (tier='total', path_group='total') = grand total quotidien (sanity baseline)
 *
 * Source GraphQL CF :
 *   - rumPageloadEventsAdaptiveGroups → visits, pageviews (volume)
 *   - rumPerformanceEventsAdaptiveGroups → LCP/CLS/INP/FCP/TTFB percentiles (UX)
 *
 * Discipline 4-layer : aucune lecture L2/L3, aucune écriture L4. Pure ingestion.
 *
 * @see feedback_seo_control_plane_layered_architecture
 * @see feedback_slo_must_be_multi_source (source C' = edge-RUM utilisateur réel)
 * @see feedback_gsc_is_secondary_signal_only (CF RUM = monitoring primaire CWV)
 */

import type { TierId } from '@repo/registry';

export type CfRumTierBucket = TierId | 'total';
export type CfRumTriggeredBy = 'scheduler' | 'manual' | 'test';

/** Path-group sentinel pour le rollup grand total. */
export const PATH_GROUP_TOTAL = 'total';
/** Path-group fallback pour les paths non couverts par la normalisation. */
export const PATH_GROUP_OTHER = '/other';

export interface CfRumJobData {
  triggeredBy: CfRumTriggeredBy;
  /**
   * Override de la fenêtre — par défaut le jour UTC précédent complet
   * (00:00 UTC J-1 → 00:00 UTC J). Utile pour backfill manuel ou tests.
   */
  bucketDateOverride?: string; // 'YYYY-MM-DD' UTC
}

/** Row insérée dans __seo_snapshot_cf_rum. */
export interface CfRumSnapshot {
  bucket_start: string; // ISO timestamp aligné minuit UTC du jour mesuré
  tier: CfRumTierBucket;
  path_group: string; // '/pieces/*', '/blog/*', '/', '/other', 'total'

  // Volume
  visit_count: number;
  pageview_count: number;
  sample_count: number;

  // Core Web Vitals (LCP/FCP/INP/TTFB en ms ; CLS × 1000 entier — voir migration)
  lcp_p50_ms: number | null;
  lcp_p75_ms: number | null;
  lcp_p95_ms: number | null;
  cls_p50_milli: number | null;
  cls_p75_milli: number | null;
  cls_p95_milli: number | null;
  inp_p50_ms: number | null;
  inp_p75_ms: number | null;
  inp_p95_ms: number | null;
  fcp_p75_ms: number | null;
  ttfb_p75_ms: number | null;

  // Breakdowns souples
  metrics_extra: Record<string, unknown>;

  // Audit-trail
  run_id: string;
  account_tag: string;
  fetched_at: string;
}

export interface CfRumRunResult {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  triggered_by: CfRumTriggeredBy;
  bucket_date: string; // jour UTC mesuré ('YYYY-MM-DD')
  pageload_events: number; // nb de lignes GraphQL pageload reçues
  performance_events: number; // nb de lignes GraphQL performance reçues
  rows_upserted: number;
  totals_period: {
    visits: number;
    pageviews: number;
    lcp_p75_ms: number | null; // p75 LCP du rollup total/total
    cls_p75_milli: number | null;
    inp_p75_ms: number | null;
  };
  skipped?:
    | 'read_only'
    | 'disabled'
    | 'no_token'
    | 'no_account_id'
    | 'cf_api_error';
  errorMessage?: string;
}

export const CF_RUM_JOB_NAME = 'seo-cp-cf-rum-fetch';
export const CF_RUM_JOB_ID = 'seo-cp-cf-rum-q-daily';
/** Queue mutualisée L1 (cf. SYNTHETIC_QUEUE_NAME / CF_ANALYTICS_QUEUE_NAME). */
export const CF_RUM_QUEUE_NAME = 'seo-crawler-monitor';
