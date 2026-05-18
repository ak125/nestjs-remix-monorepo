/**
 * ADR-072 PR 2D-3 — R8 seed-run BullMQ queue constants.
 *
 * Single-flight admin-job queue (concurrency 1) — the seed walks the whole
 * `auto_type` table sequentially; parallel runs would only contend with each
 * other while writing the same UNIQUE(version_sha) rows.
 */

export const R8_SEED_RUN_QUEUE_NAME = 'r8-seed-run';
export const R8_SEED_RUN_JOB_NAME = 'r8-seed-run-execute';

export interface R8SeedRunJobData {
  jobId: string; // __seo_admin_job.job_id (UUID)
  dryRun: boolean;
  batchSize: number | null;
  sinceTypeId: number | null;
  maxBatches: number | null;
}
