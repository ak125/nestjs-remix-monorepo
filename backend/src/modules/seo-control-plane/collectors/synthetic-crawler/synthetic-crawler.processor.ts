/**
 * SyntheticCrawlerProcessor — BullMQ consumer du job `seo-cp-synthetic-crawl`.
 *
 * ADR-064 PR-2A-1. Scheduled by `SyntheticCrawlerSchedulerService` (q15min
 * repeatable). READ_ONLY gate au processor (pattern canon
 * `feedback_readonly_gate_at_processor_not_scheduler`). Preprod miroir
 * prod doit valider le wiring BullMQ sans hammerer le sitemap PROD ni
 * écrire dans Supabase.
 *
 * Queue dédiée `seo-crawler-monitor` (ADR-064 §Architecture L1 :
 * "BullMQ queue dédiée seo-crawler-monitor — ne pas mutualiser seo-monitor
 * pour éviter contention"). Cf. feedback_schedulemodule_disabled_use_bullmq.
 */

import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../../config/app.config';
import { SyntheticCrawlerService } from './synthetic-crawler.service';
import {
  SYNTHETIC_CRAWL_JOB_NAME,
  SYNTHETIC_QUEUE_NAME,
  type SyntheticCrawlJobData,
  type SyntheticRunResult,
} from '../../types';

@Processor(SYNTHETIC_QUEUE_NAME)
export class SyntheticCrawlerProcessor {
  private readonly logger = new Logger(SyntheticCrawlerProcessor.name);
  private readonly readOnly: boolean;
  private lastQueueErrorLog = 0;

  constructor(private readonly crawler: SyntheticCrawlerService) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process(SYNTHETIC_CRAWL_JOB_NAME)
  async handle(job: Job<SyntheticCrawlJobData>): Promise<SyntheticRunResult> {
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const triggeredBy = job.data?.triggeredBy ?? 'scheduler';

    if (this.readOnly) {
      this.logger.log(
        `[READ_ONLY] Skipping synthetic-crawler run (triggeredBy=${triggeredBy}) — preprod miroir`,
      );
      return {
        run_id: 'read-only-skip',
        started_at: startedAtIso,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAtMs,
        triggered_by: triggeredBy,
        sample_size_requested: 0,
        sample_size_effective: 0,
        seed: 0,
        totals: {
          http_2xx: 0,
          http_3xx: 0,
          http_4xx: 0,
          http_5xx: 0,
          error: 0,
        },
        by_tier: {
          tier0: { probed: 0, rate_5xx: 0 },
          tier1: { probed: 0, rate_5xx: 0 },
          tier2: { probed: 0, rate_5xx: 0 },
        },
        skipped: 'read_only',
      };
    }

    return this.crawler.run({
      triggeredBy,
      sampleSize: job.data?.sampleSize,
      seed: job.data?.seed,
    });
  }

  @OnQueueError()
  onQueueError(err: Error): void {
    // Throttle to once per minute to avoid log spam if Redis flaps.
    const now = Date.now();
    if (now - this.lastQueueErrorLog < 60_000) return;
    this.lastQueueErrorLog = now;
    this.logger.error(
      `Queue error (${SYNTHETIC_QUEUE_NAME}): ${err.message}`,
      err.stack,
    );
  }

  @OnQueueFailed()
  onJobFailed(job: Job<SyntheticCrawlJobData>, err: Error): void {
    if (job.name !== SYNTHETIC_CRAWL_JOB_NAME) return;
    this.logger.error(
      `synthetic-crawler job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }
}
