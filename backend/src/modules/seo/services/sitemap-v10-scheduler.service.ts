/**
 * Sitemap V10 — régénération automatique nocturne via BullMQ.
 *
 * Pourquoi ce service existe
 * --------------------------
 * Avant ce fix, la génération des sitemaps n'avait AUCUN déclencheur
 * automatique : `SitemapV10Service.generateAll()` n'était appelable que
 * manuellement via `POST /api/sitemap/v10/generate-all`. La dernière
 * régénération manuelle datait du 2026-04-23 (post PR #135 — filtre
 * TecDoc orphans). Conséquence : `<lastmod>2026-04-23</lastmod>` figé
 * pendant 21 jours sur ~102 000 URLs `/pieces/*`, signal de site stagnant
 * pour Googlebot → érosion progressive du crawl budget → −40 % impressions
 * `/pieces/*` GSC entre W17 et W19 (cf. `audit-reports/seo-smoke/2026-05-13/`).
 *
 * Pourquoi BullMQ et pas `@Cron`
 * ------------------------------
 * Le `ScheduleModule` de `@nestjs/schedule` est désactivé monorepo
 * (cf. app.module.ts:10, conflit version `@nestjs/common@^10` ×
 * `@nestjs/schedule@^6`). Tous les `@Cron` du codebase sont inertes.
 * Le pattern canonique du monorepo est BullMQ avec repeatable jobs
 * (cf. `SeoMonitorSchedulerService`, `AbandonedCartService:58`).
 *
 * Garde-fous
 * ----------
 * - Job repeatable BullMQ avec `jobId` stable → pas de doublon
 * - Nettoyage des anciens jobs au boot (pattern repeated dans
 *   `SeoMonitorSchedulerService.cleanOldRepeatableJobs`)
 * - READ_ONLY gate au processor (mémoire
 *   `feedback_readonly_gate_at_processor_not_scheduler.md`)
 * - `SEO_SITEMAP_CRON_ENABLED=false` désactive l'enregistrement
 * - `onModuleInit` non-bloquant (`void` + fire-and-forget), pattern canon
 *   `.claude/rules/backend.md` § Non-blocking onModuleInit
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import * as os from 'node:os';
import { getErrorMessage } from '@common/utils/error.utils';

export const SITEMAP_REGENERATE_JOB_NAME = 'sitemap-regenerate-all';
export const SITEMAP_REGENERATE_JOB_ID = 'sitemap-v10-nightly-regeneration';

/**
 * Redis key prefix for per-process worker heartbeats (Phase 7 observability).
 * Format : `worker:seo-monitor:heartbeat:<pid>`. TTL = 60s sliding (refreshed
 * every 30s). Co-located with Bull's DB 0 since this is queue worker
 * observability, namespaced separately from `bull:*` keys.
 */
export const HEARTBEAT_KEY_PREFIX = 'worker:seo-monitor:heartbeat:';
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_TTL_SECONDS = 60;

export interface SitemapWorkerHeartbeat {
  pid: number;
  hostname: string;
  queue: string;
  bullVersion: string;
  startedAt: string;
  lastHeartbeatAt: string;
  uptimeSec: number;
}

export interface SitemapRegenerateJobData {
  triggeredBy: 'scheduler' | 'api' | 'manual';
}

@Injectable()
export class SitemapV10SchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SitemapV10SchedulerService.name);
  private readonly heartbeatKey = `${HEARTBEAT_KEY_PREFIX}${process.pid}`;
  private readonly startedAt = new Date();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    @InjectQueue('seo-monitor') private readonly seoMonitorQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Init non-bloquant — fire-and-forget. Pattern canon backend.md.
   * Bloquer ici stallerait `app.listen()` (cf. PR #224 / run 25166916535).
   *
   * Phase 7 : starts the per-process heartbeat (Redis SET with TTL 60s
   * refreshed every 30s) so the diagnostic endpoint (Phase 8) can detect
   * worker liveness without depending on bull's `getWorkers()` (not in
   * @types/bull v4.10.4).
   */
  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log(
        'SEO_SITEMAP_CRON_ENABLED=false — sitemap regeneration scheduler skipped',
      );
      return;
    }
    this.logger.log({
      event: 'sitemap_scheduler_worker_online',
      pid: process.pid,
      hostname: os.hostname(),
      queue: 'seo-monitor',
      cron: this.getCron(),
      timezone: 'UTC',
      startedAt: this.startedAt.toISOString(),
    });
    void this.configureRepeatableJob();
    this.heartbeatTimer = setInterval(
      () => void this.writeHeartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );
    void this.writeHeartbeat();
  }

  /**
   * Phase 7 : symmetric shutdown — stop the interval, delete heartbeat key,
   * emit lifecycle log. Permits the diagnostic endpoint to observe a clean
   * worker shutdown vs a crash (silent disappearance of heartbeat key after
   * TTL expiry).
   */
  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    const uptimeSec = Math.floor(
      (Date.now() - this.startedAt.getTime()) / 1000,
    );
    this.logger.log({
      event: 'sitemap_scheduler_worker_offline',
      pid: process.pid,
      hostname: os.hostname(),
      queue: 'seo-monitor',
      uptimeSec,
      reason: 'shutdown',
    });
    try {
      await this.seoMonitorQueue.client.del(this.heartbeatKey);
    } catch (err) {
      this.logger.warn(
        `Failed to delete heartbeat key on shutdown: ${getErrorMessage(err)}`,
      );
    }
  }

  /**
   * Write the current process's heartbeat to Redis. Idempotent + cheap
   * (~1ms intra-VPS) — re-written every HEARTBEAT_INTERVAL_MS to refresh
   * the TTL. If the worker crashes, the key expires after
   * HEARTBEAT_TTL_SECONDS, disappearing from the diagnostic endpoint.
   *
   * Failure is non-fatal : logs a warning, does not crash the scheduler.
   * The next interval tick will retry. The diagnostic endpoint will simply
   * see a stale heartbeat (timestamp gap) or absent key.
   */
  private async writeHeartbeat(): Promise<void> {
    const now = new Date();
    const payload: SitemapWorkerHeartbeat = {
      pid: process.pid,
      hostname: os.hostname(),
      queue: 'seo-monitor',
      bullVersion: '4.16.5',
      startedAt: this.startedAt.toISOString(),
      lastHeartbeatAt: now.toISOString(),
      uptimeSec: Math.floor((now.getTime() - this.startedAt.getTime()) / 1000),
    };
    try {
      await this.seoMonitorQueue.client.set(
        this.heartbeatKey,
        JSON.stringify(payload),
        'EX',
        HEARTBEAT_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Heartbeat write failed: ${getErrorMessage(err)}`);
    }
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJob();

      await this.seoMonitorQueue.add(
        SITEMAP_REGENERATE_JOB_NAME,
        {
          triggeredBy: 'scheduler',
        } satisfies SitemapRegenerateJobData,
        {
          repeat: {
            cron: this.getCron(),
            tz: 'UTC',
          },
          jobId: SITEMAP_REGENERATE_JOB_ID,
          removeOnComplete: 14, // 2 semaines d'historique
          removeOnFail: 30,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 60_000, // 1 min puis 2 min
          },
        },
      );

      this.logger.log(
        `✅ Sitemap V10 nightly regeneration scheduled (cron="${this.getCron()}" UTC)`,
      );
    } catch (err) {
      this.logger.error(
        '❌ Failed to configure sitemap regeneration repeatable job',
        getErrorMessage(err),
      );
    }
  }

  /**
   * Idempotence : supprime l'ancien repeatable job avant de le réinsérer
   * (sinon BullMQ stocke les anciens cron strings au redeploy).
   */
  private async removeStaleRepeatableJob(): Promise<void> {
    try {
      const jobs = await this.seoMonitorQueue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === SITEMAP_REGENERATE_JOB_NAME) {
          await this.seoMonitorQueue.removeRepeatableByKey(job.key);
          this.logger.log(
            `🗑️ Removed stale sitemap repeatable job: ${job.key}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not enumerate stale sitemap jobs: ${getErrorMessage(err)}`,
      );
    }
  }

  /**
   * 03:00 UTC = ~05:00 Paris, creux trafic FR, AVANT le job daily-fetch
   * (04:00 UTC GSC/GA4) pour que sitemap soit frais avant l'ingestion KPI.
   */
  private getCron(): string {
    return this.configService.get<string>('SEO_SITEMAP_CRON', '0 3 * * *');
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('SEO_SITEMAP_CRON_ENABLED');
    if (raw === undefined || raw === null) return true;
    return raw.toLowerCase() !== 'false' && raw !== '0';
  }
}
