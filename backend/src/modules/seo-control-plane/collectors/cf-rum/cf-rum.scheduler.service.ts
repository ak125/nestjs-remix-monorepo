/**
 * CfRumSchedulerService — BullMQ repeatable scheduler q-daily (01:00 UTC).
 *
 * ADR-064 §Architecture L1 — PR-2A-2.5.
 *
 * Cadence q-daily (≠ Q5min cf-analytics) :
 *   - Web Vitals RUM buffered ~30 min après l'heure côté CF.
 *   - ABR (Adaptive Bit Rate) ramène la résolution à 1 j pour fenêtres > 7 j.
 *   - 1 run/jour à 01:00 UTC → capture le jour J-1 complet, marge de 1 h sur
 *     le buffer.
 *   - Polling plus fréquent gaspille le quota GraphQL et fournit du bruit
 *     sur les faibles échantillons RUM (~710 visites/sem sur automecanik.com
 *     d'après l'email CF du 17 mai).
 *
 * Volume : 1 job/jour × ~10 path_groups × 4 tiers = 40 rows/jour upsertées.
 * Storage 90j négligeable (~3 600 rows max).
 *
 * `SEO_CP_CF_RUM_ENABLED=false` désactive le scheduler (kill switch).
 * Default ENABLED=`false` → opt-in explicite par environnement (preprod-only
 * jusqu'à validation du token Account.Analytics:Read + AccountID).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { getErrorMessage } from '../../../../common/utils/error.utils';
import {
  CF_RUM_JOB_ID,
  CF_RUM_JOB_NAME,
  CF_RUM_QUEUE_NAME,
  type CfRumJobData,
} from './cf-rum.types';

@Injectable()
export class CfRumSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CfRumSchedulerService.name);

  constructor(
    @InjectQueue(CF_RUM_QUEUE_NAME) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('SEO_CP_CF_RUM_ENABLED=false — cf-rum scheduler skipped');
      return;
    }
    void this.configureRepeatableJob();
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJob();

      await this.queue.add(
        CF_RUM_JOB_NAME,
        { triggeredBy: 'scheduler' } satisfies CfRumJobData,
        {
          repeat: { cron: this.getCron(), tz: 'UTC' },
          jobId: CF_RUM_JOB_ID,
          // 1 run/jour → keep 30 completions (1 mois d'historique BullMQ).
          removeOnComplete: 30,
          removeOnFail: 30,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 60_000, // 1 min — RUM buffer côté CF rend un retry rapide inutile
          },
        },
      );

      this.logger.log(
        `✅ cf-rum scheduled on queue "${CF_RUM_QUEUE_NAME}" (cron="${this.getCron()}" UTC)`,
      );
    } catch (err) {
      this.logger.error(
        '❌ Failed to configure cf-rum repeatable job',
        getErrorMessage(err),
      );
    }
  }

  private async removeStaleRepeatableJob(): Promise<void> {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === CF_RUM_JOB_NAME) {
          await this.queue.removeRepeatableByKey(job.key);
          this.logger.log(`🗑️ Removed stale cf-rum repeatable job: ${job.key}`);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not enumerate stale cf-rum jobs: ${getErrorMessage(err)}`,
      );
    }
  }

  /**
   * Default "0 1 * * *" UTC = 01:00 UTC chaque jour.
   * Override via SEO_CP_CF_RUM_CRON.
   *
   * Rationale 01:00 UTC : RUM buffer CF ~30 min après l'heure → 00:30 UTC
   * marge de 1 h. Conservative.
   */
  private getCron(): string {
    return this.configService.get<string>('SEO_CP_CF_RUM_CRON', '0 1 * * *');
  }

  /**
   * Default disabled (opt-in explicite). Cohérent canon `feedback_check_secret_propagation_when_adding_fail_fast`
   * — l'activation suppose AccountID + token scopé Account.Analytics:Read OK.
   */
  private isEnabled(): boolean {
    const raw = this.configService.get<string>('SEO_CP_CF_RUM_ENABLED');
    if (raw === undefined || raw === null) return false;
    const v = raw.toLowerCase();
    return v === 'true' || v === '1';
  }
}
