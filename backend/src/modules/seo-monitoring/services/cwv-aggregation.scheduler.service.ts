/**
 * CWV Aggregation Scheduler — Bloc 4 / CWV Runtime Observability.
 *
 * Configure 2 repeatable jobs BullMQ au boot (pattern `CfRumSchedulerService`) :
 *   - cwv-aggregation-hourly @ "5 * * * *"   (xx:05 UTC, agrège J-1H)
 *   - cwv-aggregation-daily  @ "15 3 * * *"  (03:15 UTC, agrège J-1 entier)
 *
 * Décalage horaire :
 *   - hourly @ xx:05 → laisse 5min pour que les beacons de l'heure terminée
 *     soient bien arrivés (sendBeacon = fire-on-pagehide, peut traîner).
 *   - daily @ 03:15 → après rotation partitions (02:55 raw, 03:00 hourly).
 *     Toutes les heures du jour précédent doivent être déjà agrégées en hourly.
 *
 * Kill switch : `SEO_CWV_AGGREGATION_ENABLED` (default false — opt-in).
 *
 * `onModuleInit` sync + `void warmer()` (canon backend.md §Non-blocking).
 */
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { getErrorMessage } from '../../../common/utils/error.utils';
import {
  CWV_AGG_DAILY_JOB,
  CWV_AGG_HOURLY_JOB,
  type CwvAggDailyJobData,
  type CwvAggHourlyJobData,
} from '../processors/cwv-aggregation.processor';

const CWV_AGG_QUEUE = 'seo-monitor';
const CWV_AGG_HOURLY_REPEAT_ID = 'cwv-agg-hourly-repeat';
const CWV_AGG_DAILY_REPEAT_ID = 'cwv-agg-daily-repeat';

@Injectable()
export class CwvAggregationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CwvAggregationSchedulerService.name);

  constructor(
    @InjectQueue(CWV_AGG_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.warn(
        'SEO_CWV_AGGREGATION_ENABLED not "true"/"1" — CWV RUM aggregation DORMANT ' +
          '(raw→hourly→daily_rum skipped). Set it in PREPROD/PROD to activate.',
      );
      return;
    }
    void this.configureRepeatableJobs();
  }

  private async configureRepeatableJobs(): Promise<void> {
    try {
      await this.removeStaleRepeatables();

      await this.queue.add(
        CWV_AGG_HOURLY_JOB,
        { triggeredBy: 'scheduler' } satisfies CwvAggHourlyJobData,
        {
          repeat: { cron: this.getHourlyCron(), tz: 'UTC' },
          jobId: CWV_AGG_HOURLY_REPEAT_ID,
          removeOnComplete: 50,
          removeOnFail: 50,
          attempts: 2,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      );

      await this.queue.add(
        CWV_AGG_DAILY_JOB,
        { triggeredBy: 'scheduler' } satisfies CwvAggDailyJobData,
        {
          repeat: { cron: this.getDailyCron(), tz: 'UTC' },
          jobId: CWV_AGG_DAILY_REPEAT_ID,
          removeOnComplete: 30,
          removeOnFail: 30,
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );

      this.logger.log(
        `✅ cwv-aggregation jobs scheduled (hourly="${this.getHourlyCron()}" daily="${this.getDailyCron()}" UTC)`,
      );
    } catch (err) {
      this.logger.error(
        '❌ Failed to configure cwv-aggregation repeatable jobs',
        getErrorMessage(err),
      );
    }
  }

  private async removeStaleRepeatables(): Promise<void> {
    try {
      const jobs = await this.queue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === CWV_AGG_HOURLY_JOB || job.name === CWV_AGG_DAILY_JOB) {
          await this.queue.removeRepeatableByKey(job.key);
          this.logger.log(`🗑️ Removed stale repeatable: ${job.key}`);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not enumerate stale cwv-aggregation jobs: ${getErrorMessage(err)}`,
      );
    }
  }

  private getHourlyCron(): string {
    return this.configService.get<string>(
      'SEO_CWV_AGG_HOURLY_CRON',
      '5 * * * *',
    );
  }

  private getDailyCron(): string {
    return this.configService.get<string>(
      'SEO_CWV_AGG_DAILY_CRON',
      '15 3 * * *',
    );
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('SEO_CWV_AGGREGATION_ENABLED');
    if (raw === undefined || raw === null) return false;
    const v = raw.toLowerCase();
    return v === 'true' || v === '1';
  }
}
