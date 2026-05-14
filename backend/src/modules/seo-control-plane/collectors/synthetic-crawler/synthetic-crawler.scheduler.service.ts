/**
 * SyntheticCrawlerSchedulerService — BullMQ repeatable scheduler.
 *
 * Enregistre le job `seo-cp-synthetic-crawl` toutes les 15 min sur la
 * queue dédiée `seo-crawler-monitor`. Pattern aligné
 * `SitemapV10SchedulerService` + `SeoMonitorSchedulerService`.
 *
 * ADR-064 §Architecture L1 — fréquence q15min :
 *   - MTTD cible 15 min pour breach SLO tier0 (vs J-7 actuel via email GSC)
 *   - 500 URLs × 4 runs/h = 2 000 req/h, distribué sur 24h = 48k req/jour
 *   - UA identifiable AutoMecanikSyntheticBot/1.0 (Cloudflare Analytics filtre)
 *
 * Discipline backend.md § Non-blocking onModuleInit : sync, fire-and-forget,
 * pattern `void this.configureRepeatableJob()`.
 *
 * Garde `SEO_CP_SYNTHETIC_ENABLED=false` désactive l'enregistrement
 * (default = true). Cohérent pattern toggle SEO_SITEMAP_CRON_ENABLED.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { getErrorMessage } from '../../../../common/utils/error.utils';
import {
  SYNTHETIC_CRAWL_JOB_NAME,
  SYNTHETIC_CRAWL_JOB_ID,
  SYNTHETIC_QUEUE_NAME,
  type SyntheticCrawlJobData,
} from '../../types';

@Injectable()
export class SyntheticCrawlerSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyntheticCrawlerSchedulerService.name);

  constructor(
    @InjectQueue(SYNTHETIC_QUEUE_NAME) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log(
        'SEO_CP_SYNTHETIC_ENABLED=false — synthetic-crawler scheduler skipped',
      );
      return;
    }
    void this.configureRepeatableJob();
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJob();

      await this.queue.add(
        SYNTHETIC_CRAWL_JOB_NAME,
        { triggeredBy: 'scheduler' } satisfies SyntheticCrawlJobData,
        {
          repeat: { cron: this.getCron(), tz: 'UTC' },
          jobId: SYNTHETIC_CRAWL_JOB_ID,
          // Keep 4 days of completions (96 runs × 4/h × 24h = ~384 jobs).
          removeOnComplete: 400,
          removeOnFail: 100,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 30_000, // 30s puis 1min — sitemap/HTTP transitoires courts
          },
        },
      );

      this.logger.log(
        `✅ synthetic-crawler scheduled on queue "${SYNTHETIC_QUEUE_NAME}" (cron="${this.getCron()}" UTC)`,
      );
    } catch (err) {
      this.logger.error(
        '❌ Failed to configure synthetic-crawler repeatable job',
        getErrorMessage(err),
      );
    }
  }

  /**
   * Idempotence : supprimer l'ancien repeatable job avant réinsertion
   * (BullMQ persiste les anciens cron strings au redeploy sinon).
   */
  private async removeStaleRepeatableJob(): Promise<void> {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === SYNTHETIC_CRAWL_JOB_NAME) {
          await this.queue.removeRepeatableByKey(job.key);
          this.logger.log(
            `🗑️ Removed stale synthetic-crawler repeatable job: ${job.key}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not enumerate stale synthetic-crawler jobs: ${getErrorMessage(err)}`,
      );
    }
  }

  // Default "*/15 * * * *" (q15min). Surridable via SEO_CP_SYNTHETIC_CRON.
  // En PROD : 15min = compromise entre MTTD et load (2 000 req/h).
  private getCron(): string {
    return this.configService.get<string>(
      'SEO_CP_SYNTHETIC_CRON',
      '*/15 * * * *',
    );
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('SEO_CP_SYNTHETIC_ENABLED');
    if (raw === undefined || raw === null) return true;
    return raw.toLowerCase() !== 'false' && raw !== '0';
  }
}
