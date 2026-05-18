/**
 * CfAnalyticsSchedulerService — BullMQ repeatable scheduler q5min.
 *
 * ADR-064 §Architecture L1 — PR-2A-2.
 *
 * Cadence q5min : Cloudflare GraphQL httpRequestsAdaptiveGroups produit des
 * buckets de 5 min de granularité. Polling à q5min capture le bucket précédent
 * dès qu'il est disponible (CF retient ~30s de latence post-bucket).
 *
 * Volume : 12 buckets/heure × 288 buckets/jour. À l'échelle journalière,
 * ~5 min × 365 jours = 105k buckets/an. Storage négligeable.
 *
 * `SEO_CP_CF_ANALYTICS_ENABLED=false` désactive le scheduler (kill switch).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { getErrorMessage } from '../../../../common/utils/error.utils';
import {
  CF_ANALYTICS_JOB_NAME,
  CF_ANALYTICS_JOB_ID,
  CF_ANALYTICS_QUEUE_NAME,
  type CfAnalyticsJobData,
} from './cf-analytics.types';

@Injectable()
export class CfAnalyticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CfAnalyticsSchedulerService.name);

  constructor(
    @InjectQueue(CF_ANALYTICS_QUEUE_NAME) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log(
        'SEO_CP_CF_ANALYTICS_ENABLED=false — cf-analytics scheduler skipped',
      );
      return;
    }
    void this.configureRepeatableJob();
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJob();

      await this.queue.add(
        CF_ANALYTICS_JOB_NAME,
        { triggeredBy: 'scheduler' } satisfies CfAnalyticsJobData,
        {
          repeat: { cron: this.getCron(), tz: 'UTC' },
          jobId: CF_ANALYTICS_JOB_ID,
          // 24h × 12 runs/h = 288 → keep 300 completions.
          removeOnComplete: 300,
          removeOnFail: 100,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 30_000,
          },
        },
      );

      this.logger.log(
        `✅ cf-analytics scheduled on queue "${CF_ANALYTICS_QUEUE_NAME}" (cron="${this.getCron()}" UTC)`,
      );
    } catch (err) {
      this.logger.error(
        '❌ Failed to configure cf-analytics repeatable job',
        getErrorMessage(err),
      );
    }
  }

  private async removeStaleRepeatableJob(): Promise<void> {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === CF_ANALYTICS_JOB_NAME) {
          await this.queue.removeRepeatableByKey(job.key);
          this.logger.log(
            `🗑️ Removed stale cf-analytics repeatable job: ${job.key}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not enumerate stale cf-analytics jobs: ${getErrorMessage(err)}`,
      );
    }
  }

  // Default "*/5 * * * *" (q5min). Surridable via SEO_CP_CF_ANALYTICS_CRON.
  // CF GraphQL bucket granularity = 5 min, so polling faster is wasteful.
  private getCron(): string {
    return this.configService.get<string>(
      'SEO_CP_CF_ANALYTICS_CRON',
      '*/5 * * * *',
    );
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('SEO_CP_CF_ANALYTICS_ENABLED');
    if (raw === undefined || raw === null) return true;
    return raw.toLowerCase() !== 'false' && raw !== '0';
  }
}
