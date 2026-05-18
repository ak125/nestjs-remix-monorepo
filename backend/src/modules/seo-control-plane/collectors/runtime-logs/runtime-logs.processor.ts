/**
 * RuntimeLogsProcessor — BullMQ consumer du job `seo-cp-runtime-logs-collect`.
 *
 * ADR-064 PR-2A-3. Scheduled by `RuntimeLogsSchedulerService` (q5min
 * repeatable). READ_ONLY gate au processor (pattern canon
 * `feedback_readonly_gate_at_processor_not_scheduler`). Preprod miroir prod
 * doit valider le wiring BullMQ sans écrire dans Supabase.
 *
 * Queue mutualisée `seo-crawler-monitor` (même que synthetic-crawler PR-2A-1) :
 * 12 runs/h × ~50ms/run = négligeable, pas de contention avec q15min synthetic.
 */

import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../../config/app.config';
import { RuntimeLogsCollectorService } from './runtime-logs.service';
import {
  RUNTIME_LOGS_JOB_NAME,
  RUNTIME_LOGS_QUEUE_NAME,
  type RuntimeLogsJobData,
  type RuntimeLogsRunResult,
} from './runtime-logs.types';

@Processor(RUNTIME_LOGS_QUEUE_NAME)
export class RuntimeLogsProcessor {
  private readonly logger = new Logger(RuntimeLogsProcessor.name);
  private readonly readOnly: boolean;
  private lastQueueErrorLog = 0;

  constructor(private readonly collector: RuntimeLogsCollectorService) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process(RUNTIME_LOGS_JOB_NAME)
  async handle(job: Job<RuntimeLogsJobData>): Promise<RuntimeLogsRunResult> {
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const triggeredBy = job.data?.triggeredBy ?? 'scheduler';
    const windowMinutes = job.data?.windowMinutes ?? 60;

    if (this.readOnly) {
      this.logger.log(
        `[READ_ONLY] Skipping runtime-logs run (triggeredBy=${triggeredBy}) — preprod miroir`,
      );
      return {
        run_id: 'read-only-skip',
        started_at: startedAtIso,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAtMs,
        triggered_by: triggeredBy,
        window_minutes: windowMinutes,
        rows_scanned: 0,
        buckets_emitted: 0,
        rows_upserted: 0,
        totals_period: { total_events: 0, http_5xx_count: 0 },
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
      `Queue error (${RUNTIME_LOGS_QUEUE_NAME}): ${err.message}`,
      err.stack,
    );
  }

  @OnQueueFailed()
  onJobFailed(job: Job<RuntimeLogsJobData>, err: Error): void {
    if (job.name !== RUNTIME_LOGS_JOB_NAME) return;
    this.logger.error(
      `runtime-logs job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }
}
