/**
 * SEO Daily Fetch Processor
 *
 * Orchestre l'ingestion quotidienne des sources Google gratuites
 * (GSC, GA4, CWV, GSC Links) dans `__seo_*_daily` via les fetchers
 * existants du `SeoMonitoringModule`.
 *
 * Job BullMQ : `@Process('daily-fetch')` sur queue `seo-monitor`.
 * Schedule par `SeoMonitorSchedulerService.setupDailyFetchJob()` (cron 04:00 UTC).
 *
 * Refs:
 * - `.claude/plans/utiliser-la-meilleure-approche-zippy-waterfall.md` — V0.A
 * - ADR-025 SEO Department Architecture (governance-vault)
 * - ADR-028 Option D — READ_ONLY gate au processor (memory `feedback_readonly_gate_at_processor_not_scheduler.md`)
 * - `feedback_dual_fallback_env_vs_technical.md` — fallback env `[READ_ONLY]` séparé du technique
 */
import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../config/app.config';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { AdminJobHealthService } from '../../admin/services/admin-job-health.service';
import { Ga4DailyFetcherService } from '../services/ga4-daily-fetcher.service';
import { GscDailyFetcherService } from '../services/gsc-daily-fetcher.service';
import { GscLinksFetcherService } from '../services/gsc-links-fetcher.service';

export type DailyFetchTask = 'all' | 'gsc' | 'ga4' | 'gsc_links';

export interface SeoDailyFetchJobData {
  /** Date à fetcher au format ISO (YYYY-MM-DD). Si absent, J-3 par défaut (latence GSC/GA4). */
  date?: string;
  /**
   * Périmètre : `all` lance GSC + GA4 + GSC Links.
   * **CWV est exclu volontairement de V0.A** : `CwvFetcherService` exige une liste
   * `pages: string[]` (sample top 1k) qui sera produite par le `gsc-coverage-fetcher`
   * en V0.D. Tant que ce sample n'est pas calculé, CWV est déclenché à la demande
   * (route admin) avec une liste de pages explicite.
   * Défaut `all`.
   */
  task?: DailyFetchTask;
  /** Origine du déclenchement (audit trail). */
  triggeredBy: 'scheduler' | 'api' | 'manual';
}

export interface SeoDailyFetchPerSourceResult {
  source: 'gsc' | 'ga4' | 'gsc_links';
  status: 'ok' | 'skipped' | 'failed';
  rowsInserted: number;
  durationSeconds: number;
  message?: string;
}

export interface SeoDailyFetchResult {
  date: string;
  triggeredBy: SeoDailyFetchJobData['triggeredBy'];
  task: DailyFetchTask;
  perSource: SeoDailyFetchPerSourceResult[];
  totalRowsInserted: number;
  totalDurationSeconds: number;
  startedAt: string;
  finishedAt: string;
}

@Processor('seo-monitor')
export class SeoDailyFetchProcessor {
  private readonly logger = new Logger(SeoDailyFetchProcessor.name);
  private readonly readOnly: boolean;
  private lastQueueErrorLog = 0;

  constructor(
    private readonly gscFetcher: GscDailyFetcherService,
    private readonly ga4Fetcher: Ga4DailyFetcherService,
    private readonly gscLinksFetcher: GscLinksFetcherService,
    private readonly jobHealth: AdminJobHealthService,
  ) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process('daily-fetch')
  async handleDailyFetch(
    job: Job<SeoDailyFetchJobData>,
  ): Promise<SeoDailyFetchResult> {
    const startedAt = Date.now();
    const date = job.data.date ?? defaultFetchDate();
    const task: DailyFetchTask = job.data.task ?? 'all';

    // ADR-028 Option D : READ_ONLY gate au processor (pas au scheduler).
    // Le cron reste registered pour valider le wiring BullMQ en preprod miroir
    // prod, mais le handler court-circuite sans appel API/DB.
    if (this.readOnly) {
      this.logger.warn(
        {
          metric: 'readonly.skipped',
          operation: 'seo-daily-fetch',
          jobId: job.id,
          date,
          task,
        },
        `[READ_ONLY] Skip seo-daily-fetch (job #${job.id}, date=${date}, task=${task})`,
      );
      return emptyResult(date, job.data.triggeredBy, task, startedAt);
    }

    this.logger.log(
      `🛰️ [Job #${job.id}] daily-fetch démarrage (date=${date}, task=${task}, triggeredBy=${job.data.triggeredBy})`,
    );

    const perSource: SeoDailyFetchPerSourceResult[] = [];
    const tasks =
      task === 'all' ? (['gsc', 'ga4', 'gsc_links'] as const) : [task];

    let progressBase = 0;
    const progressStep = Math.floor(100 / tasks.length);

    for (const t of tasks) {
      try {
        const sourceStart = Date.now();
        let rowsInserted = 0;
        let status: SeoDailyFetchPerSourceResult['status'] = 'ok';
        let message: string | undefined;

        if (t === 'gsc') {
          const r = await this.gscFetcher.fetchAndPersist({ date });
          rowsInserted = r.rowsInserted;
          if (
            r.warnings.includes('monitoring_disabled') ||
            r.warnings.includes('credentials_missing')
          ) {
            status = 'skipped';
            message = r.warnings.join(',');
          }
        } else if (t === 'ga4') {
          const r = await this.ga4Fetcher.fetchAndPersist({ date });
          rowsInserted = r.rowsInserted;
          if (
            r.warnings.includes('monitoring_disabled') ||
            r.warnings.includes('credentials_missing')
          ) {
            status = 'skipped';
            message = r.warnings.join(',');
          }
        } else if (t === 'gsc_links') {
          const r = await this.gscLinksFetcher.fetchAndPersist({
            snapshotDate: date,
          });
          rowsInserted = r.rowsInserted;
          if (
            r.warnings.includes('monitoring_disabled') ||
            r.warnings.includes('credentials_missing')
          ) {
            status = 'skipped';
            message = r.warnings.join(',');
          }
        }

        perSource.push({
          source: t,
          status,
          rowsInserted,
          durationSeconds: (Date.now() - sourceStart) / 1000,
          message,
        });
      } catch (error) {
        this.logger.error(
          `❌ [Job #${job.id}] daily-fetch ${t} failed: ${getErrorMessage(error)}`,
        );
        perSource.push({
          source: t,
          status: 'failed',
          rowsInserted: 0,
          durationSeconds: 0,
          message: getErrorMessage(error),
        });
        // Continue les autres sources : un échec GSC ne doit pas annuler GA4/CWV.
      }

      progressBase += progressStep;
      await job.progress(Math.min(progressBase, 100));
    }

    const totalDurationSeconds = (Date.now() - startedAt) / 1000;
    const totalRowsInserted = perSource.reduce((s, p) => s + p.rowsInserted, 0);
    const finishedAt = new Date().toISOString();

    this.logger.log(
      `✅ [Job #${job.id}] daily-fetch terminé en ${totalDurationSeconds.toFixed(1)}s — ${totalRowsInserted} rows insérés (${perSource.length} sources)`,
    );

    this.jobHealth
      .recordSuccess('seo-daily-fetch', Date.now() - startedAt)
      .catch(() => {});

    return {
      date,
      triggeredBy: job.data.triggeredBy,
      task,
      perSource,
      totalRowsInserted,
      totalDurationSeconds,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt,
    };
  }

  @OnQueueError()
  handleError(error: Error) {
    const now = Date.now();
    if (now - this.lastQueueErrorLog > 60_000) {
      this.logger.error(
        `❌ Erreur queue seo-monitor (daily-fetch): ${error.message}`,
      );
      this.lastQueueErrorLog = now;
    }
  }

  @OnQueueFailed()
  handleFailedJob(job: Job, error: Error) {
    if (job.name !== 'daily-fetch') {
      return; // pas notre handler — laisser SeoMonitorProcessor gérer
    }
    this.logger.error(
      `💥 [Job #${job.id}] daily-fetch échoué après ${job.attemptsMade} tentatives: ${error.message}`,
    );
    this.jobHealth
      .recordFailure('seo-daily-fetch', error.message)
      .catch(() => {});
  }
}

/**
 * J-3 par défaut : la latence GSC est de 2-3 jours, GA4 ~24-48h.
 * J-3 garantit que les données sont stabilisées côté Google avant fetch.
 */
function defaultFetchDate(): string {
  const d = new Date(Date.now() - 3 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function emptyResult(
  date: string,
  triggeredBy: SeoDailyFetchJobData['triggeredBy'],
  task: DailyFetchTask,
  startedAt: number,
): SeoDailyFetchResult {
  const now = new Date().toISOString();
  return {
    date,
    triggeredBy,
    task,
    perSource: [],
    totalRowsInserted: 0,
    totalDurationSeconds: (Date.now() - startedAt) / 1000,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: now,
  };
}
