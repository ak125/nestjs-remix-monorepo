/**
 * CfAnalyticsProcessor — BullMQ consumer du job `seo-cp-cf-analytics-fetch`.
 *
 * ADR-064 PR-2A-2. Scheduled by `CfAnalyticsSchedulerService` (q5min repeatable).
 * READ_ONLY gate au processor (cf. pattern canon — preprod miroir).
 *
 * Queue mutualisée `seo-crawler-monitor` (même que synthetic-crawler). Le
 * volume CF Analytics est négligeable (1 job/5min vs synthetic q15min) donc
 * mutualisation OK ici — pas de risque de contention.
 */

import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../../config/app.config';
import { CfAnalyticsCollectorService } from './cf-analytics.service';
import {
  CF_ANALYTICS_JOB_NAME,
  CF_ANALYTICS_QUEUE_NAME,
  type CfAnalyticsJobData,
  type CfAnalyticsRunResult,
} from './cf-analytics.types';

@Processor(CF_ANALYTICS_QUEUE_NAME)
export class CfAnalyticsProcessor {
  private readonly logger = new Logger(CfAnalyticsProcessor.name);
  private readonly readOnly: boolean;
  private lastQueueErrorLog = 0;

  constructor(private readonly collector: CfAnalyticsCollectorService) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process(CF_ANALYTICS_JOB_NAME)
  async handle(job: Job<CfAnalyticsJobData>): Promise<CfAnalyticsRunResult> {
    const startedAtMs = Date.now();
    const triggeredBy = job.data?.triggeredBy ?? 'scheduler';

    if (this.readOnly) {
      this.logger.log(
        `[READ_ONLY] Skipping cf-analytics fetch (triggeredBy=${triggeredBy})`,
      );
      return {
        run_id: 'read-only-skip',
        started_at: new Date(startedAtMs).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAtMs,
        triggered_by: triggeredBy,
        window_minutes: 0,
        buckets_received: 0,
        rows_upserted: 0,
        totals_period: { total_requests: 0, http_5xx: 0, rate_5xx: 0 },
        skipped: 'read_only',
      };
    }

    return this.collector.run({
      triggeredBy,
      windowMinutes: job.data?.windowMinutes,
    });
  }

  @OnQueueError()
  onQueueError(err: Error): void {
    const now = Date.now();
    if (now - this.lastQueueErrorLog < 60_000) return;
    this.lastQueueErrorLog = now;
    this.logger.error(
      `Queue error (${CF_ANALYTICS_QUEUE_NAME}): ${err.message}`,
      err.stack,
    );
  }

  @OnQueueFailed()
  onJobFailed(job: Job<CfAnalyticsJobData>, err: Error): void {
    if (job.name !== CF_ANALYTICS_JOB_NAME) return;
    this.logger.error(
      `cf-analytics job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }
}
