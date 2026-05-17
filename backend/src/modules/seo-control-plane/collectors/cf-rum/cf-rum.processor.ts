/**
 * CfRumProcessor — BullMQ consumer du job `seo-cp-cf-rum-fetch`.
 *
 * ADR-064 PR-2A-2.5. Scheduled by `CfRumSchedulerService` (q-daily repeatable
 * à 01:00 UTC). READ_ONLY gate au processor (cf. pattern canon — preprod miroir).
 *
 * Queue mutualisée `seo-crawler-monitor` (même que synthetic-crawler, cf-analytics,
 * runtime-logs). Volume cf-rum = 1 job/jour, contention nulle.
 */

import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../../config/app.config';
import { CfRumCollectorService } from './cf-rum.service';
import {
  CF_RUM_JOB_NAME,
  CF_RUM_QUEUE_NAME,
  type CfRumJobData,
  type CfRumRunResult,
} from './cf-rum.types';

@Processor(CF_RUM_QUEUE_NAME)
export class CfRumProcessor {
  private readonly logger = new Logger(CfRumProcessor.name);
  private readonly readOnly: boolean;
  private lastQueueErrorLog = 0;

  constructor(private readonly collector: CfRumCollectorService) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process(CF_RUM_JOB_NAME)
  async handle(job: Job<CfRumJobData>): Promise<CfRumRunResult> {
    const startedAtMs = Date.now();
    const triggeredBy = job.data?.triggeredBy ?? 'scheduler';

    if (this.readOnly) {
      this.logger.log(
        `[READ_ONLY] Skipping cf-rum fetch (triggeredBy=${triggeredBy})`,
      );
      return {
        run_id: 'read-only-skip',
        started_at: new Date(startedAtMs).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAtMs,
        triggered_by: triggeredBy,
        bucket_date: '',
        pageload_events: 0,
        performance_events: 0,
        rows_upserted: 0,
        totals_period: {
          visits: 0,
          pageviews: 0,
          lcp_p75_ms: null,
          cls_p75_milli: null,
          inp_p75_ms: null,
        },
        skipped: 'read_only',
      };
    }

    return this.collector.run({
      triggeredBy,
      bucketDateOverride: job.data?.bucketDateOverride,
    });
  }

  @OnQueueError()
  onQueueError(err: Error): void {
    const now = Date.now();
    if (now - this.lastQueueErrorLog < 60_000) return;
    this.lastQueueErrorLog = now;
    this.logger.error(
      `Queue error (${CF_RUM_QUEUE_NAME}): ${err.message}`,
      err.stack,
    );
  }

  @OnQueueFailed()
  onJobFailed(job: Job<CfRumJobData>, err: Error): void {
    if (job.name !== CF_RUM_JOB_NAME) return;
    this.logger.error(
      `cf-rum job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }
}
