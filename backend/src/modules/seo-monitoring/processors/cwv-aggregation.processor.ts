/**
 * CWV Aggregation Processor — Bloc 4 / CWV Runtime Observability.
 *
 * 2 jobs BullMQ sur la queue mutualisée `seo-monitor` :
 *   - `cwv-aggregation-hourly` : agrège l'heure J-1H (exécuté @ xx:05)
 *   - `cwv-aggregation-daily`  : agrège la journée UTC J-1 (exécuté @ 03:15 UTC)
 *
 * Pattern mirror `SeoDailyFetchProcessor` (READ_ONLY gate, logs structurés).
 */
import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../config/app.config';
import { getErrorMessage } from '../../../common/utils/error.utils';
import {
  CwvAggregationService,
  type AggregationResult,
} from '../services/cwv-aggregation.service';

export const CWV_AGG_HOURLY_JOB = 'cwv-aggregation-hourly';
export const CWV_AGG_DAILY_JOB = 'cwv-aggregation-daily';

export interface CwvAggHourlyJobData {
  /** Override de l'heure cible (ISO). Si absent, prend l'heure J-1H au run. */
  targetHourOverride?: string;
  triggeredBy: 'scheduler' | 'manual';
}

export interface CwvAggDailyJobData {
  /** Override de la date cible (YYYY-MM-DD UTC). Si absent, prend J-1 au run. */
  targetDateOverride?: string;
  triggeredBy: 'scheduler' | 'manual';
}

@Processor('seo-monitor')
export class CwvAggregationProcessor {
  private readonly logger = new Logger(CwvAggregationProcessor.name);
  private readonly readOnly: boolean;
  private lastQueueErrorLog = 0;

  constructor(private readonly cwvAgg: CwvAggregationService) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process(CWV_AGG_HOURLY_JOB)
  async runHourly(job: Job<CwvAggHourlyJobData>): Promise<AggregationResult> {
    const data = job.data;
    if (this.readOnly) {
      this.logger.log('READ_ONLY=true — cwv-aggregation-hourly skipped');
      return {
        ok: false,
        rows_upserted: 0,
        target: '',
        skipped: 'read_only',
      };
    }

    const target = data.targetHourOverride
      ? new Date(data.targetHourOverride)
      : this.previousHour();
    this.logger.log(
      `🕐 cwv-aggregation-hourly start (target=${target.toISOString()} triggeredBy=${data.triggeredBy})`,
    );
    return this.cwvAgg.aggregateHour(target);
  }

  @Process(CWV_AGG_DAILY_JOB)
  async runDaily(job: Job<CwvAggDailyJobData>): Promise<AggregationResult> {
    const data = job.data;
    if (this.readOnly) {
      this.logger.log('READ_ONLY=true — cwv-aggregation-daily skipped');
      return {
        ok: false,
        rows_upserted: 0,
        target: '',
        skipped: 'read_only',
      };
    }

    const target = data.targetDateOverride
      ? new Date(`${data.targetDateOverride}T00:00:00Z`)
      : this.yesterdayUtc();
    this.logger.log(
      `📅 cwv-aggregation-daily start (target=${target.toISOString().slice(0, 10)} triggeredBy=${data.triggeredBy})`,
    );
    return this.cwvAgg.aggregateDay(target);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `❌ cwv-aggregation job ${job.name} (id=${job.id}) failed: ${err.message}`,
    );
  }

  @OnQueueError()
  onQueueError(err: Error): void {
    // Backoff log (1 par minute max — Redis connection wobble peut spammer)
    const now = Date.now();
    if (now - this.lastQueueErrorLog > 60_000) {
      this.lastQueueErrorLog = now;
      this.logger.error(
        `⚠️ cwv-aggregation queue error: ${getErrorMessage(err)}`,
      );
    }
  }

  private previousHour(): Date {
    const d = new Date();
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() - 1);
    return d;
  }

  private yesterdayUtc(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
}
