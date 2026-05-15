/**
 * RuntimeLogsSchedulerService — BullMQ repeatable scheduler.
 *
 * Enregistre le job `seo-cp-runtime-logs-collect` toutes les 5 min sur la
 * queue `seo-crawler-monitor` (mutualisée avec synthetic-crawler PR-2A-1).
 *
 * ADR-064 §Architecture L1 — fréquence q5min :
 *   - Bucket size = 5 min (aligné `__seo_snapshot_runtime_logs`).
 *   - Fenêtre query = 60 min → recalcule les 12 derniers buckets à chaque run
 *     pour absorber les latences d'écriture `__error_logs` (UPSERT idempotent).
 *   - Coût négligeable : SELECT avec index `idx_error_logs_created_at`.
 *
 * Discipline backend.md § Non-blocking onModuleInit : sync, fire-and-forget,
 * pattern `void this.configureRepeatableJob()`.
 *
 * Garde `SEO_CP_RUNTIME_LOGS_ENABLED=false` désactive l'enregistrement
 * (default = true). Cohérent pattern toggle SEO_CP_SYNTHETIC_ENABLED.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { getErrorMessage } from '../../../../common/utils/error.utils';
import {
  RUNTIME_LOGS_JOB_NAME,
  RUNTIME_LOGS_JOB_ID,
  RUNTIME_LOGS_QUEUE_NAME,
  type RuntimeLogsJobData,
} from './runtime-logs.types';

@Injectable()
export class RuntimeLogsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RuntimeLogsSchedulerService.name);

  constructor(
    @InjectQueue(RUNTIME_LOGS_QUEUE_NAME) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log(
        'SEO_CP_RUNTIME_LOGS_ENABLED=false — runtime-logs scheduler skipped',
      );
      return;
    }
    void this.configureRepeatableJob();
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJob();

      await this.queue.add(
        RUNTIME_LOGS_JOB_NAME,
        { triggeredBy: 'scheduler' } satisfies RuntimeLogsJobData,
        {
          repeat: { cron: this.getCron(), tz: 'UTC' },
          jobId: RUNTIME_LOGS_JOB_ID,
          // 12 runs/h × 24h × 4 jours = ~1150 jobs ; keep 1200.
          removeOnComplete: 1200,
          removeOnFail: 200,
          attempts: 2,
          backoff: { type: 'exponential', delay: 15_000 },
        },
      );

      this.logger.log(
        `✅ runtime-logs scheduled on queue "${RUNTIME_LOGS_QUEUE_NAME}" (cron="${this.getCron()}" UTC)`,
      );
    } catch (err) {
      this.logger.error(
        '❌ Failed to configure runtime-logs repeatable job',
        getErrorMessage(err),
      );
    }
  }

  private async removeStaleRepeatableJob(): Promise<void> {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === RUNTIME_LOGS_JOB_NAME) {
          await this.queue.removeRepeatableByKey(job.key);
          this.logger.log(
            `🗑️ Removed stale runtime-logs repeatable job: ${job.key}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not enumerate stale runtime-logs jobs: ${getErrorMessage(err)}`,
      );
    }
  }

  // Default "*/5 * * * *" (q5min, aligné bucket size). Surridable via SEO_CP_RUNTIME_LOGS_CRON.
  private getCron(): string {
    return this.configService.get<string>(
      'SEO_CP_RUNTIME_LOGS_CRON',
      '*/5 * * * *',
    );
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('SEO_CP_RUNTIME_LOGS_ENABLED');
    if (raw === undefined || raw === null) return true;
    return raw.toLowerCase() !== 'false' && raw !== '0';
  }
}
