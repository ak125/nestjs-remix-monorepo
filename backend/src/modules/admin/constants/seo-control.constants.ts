/**
 * PR-SBD-1 — Constants for SEO Business Control Dashboard.
 *
 * Shared between SeoControlService, SeoControlRefresherService, and
 * SeoControlRefreshProcessor to avoid magic string drift.
 */

export const SEO_CONTROL_REFRESH_QUEUE = 'seo-control-refresh' as const;

/**
 * Static job name for the per-block SWR refresh jobs.
 *
 * Legacy `bull` requires a named processor (`@Process(name)`) to match named
 * jobs; a single static name keeps the processor handler DRY (block/range live
 * in `job.data`, idempotency via per-(block,range) `jobId`).
 */
export const SEO_CONTROL_REFRESH_JOB = 'seo-control-refresh-block' as const;
