/**
 * Sitemap V10 — retrait de la planification interne et signal de vie du
 * worker de régénération.
 *
 * Producteur unique de la régénération
 * ------------------------------------
 * La régénération quotidienne des sitemaps a un seul déclencheur : le
 * workflow GitHub `.github/workflows/sitemap-daily-regen.yml` (03:00 UTC). Il
 * appelle, authentifié par OIDC, `POST /api/sitemap/v10/generate-all` en
 * PROD seulement ; le contrôleur met en file la tâche `sitemap-regenerate-all`
 * (`triggeredBy: 'api'`), que `SitemapRegenerateProcessor` exécute. Un échec
 * du workflow ouvre une issue `incident-sitemap-cron` ; une génération
 * manquante déclenche l'alerte `SITEMAP_STALE_V1` (`__seo_event_log`).
 *
 * Ce service armait aussi une tâche répétable Bull à 03:00 UTC, dans toute
 * instance de l'application qui démarre, DEV et PREPROD compris : un second
 * producteur possible, sur une base partagée entre les environnements. Il ne
 * régénérait rien en pratique : toutes les générations journalisées depuis
 * juin 2026 portent `triggeredBy: 'api'`, aucune `scheduler`. Décision de
 * l'owner du 2026-11-12 : le workflow reste le seul producteur, la
 * planification interne est supprimée.
 *
 * Ce qui reste ici
 * ----------------
 * - Au démarrage, retrait de toute tâche répétable `sitemap-regenerate-all`
 *   encore inscrite dans Redis : Bull la conserve d'un démarrage à l'autre, et
 *   une instance déployée avant ce retrait l'y a laissée. Les tâches
 *   ponctuelles mises en file par l'API ne sont pas répétables : elles ne sont
 *   pas touchées.
 * - Le signal de vie du processus qui consomme la queue `seo-monitor`
 *   (clé Redis à durée de vie courte, rafraîchie toutes les 30 s).
 * - `onModuleInit` non bloquant (`void` + fire-and-forget), pattern canon
 *   `.claude/rules/backend.md` § Non-blocking onModuleInit.
 *
 * Le nom du service est conservé : ses exports sont importés par le
 * contrôleur, le processeur et leurs tests.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as os from 'node:os';
import { getErrorMessage } from '@common/utils/error.utils';

export const SITEMAP_REGENERATE_JOB_NAME = 'sitemap-regenerate-all';

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
  triggeredBy: 'api' | 'manual';
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
  ) {}

  /**
   * Init non-bloquant — fire-and-forget. Pattern canon backend.md.
   * Bloquer ici stallerait `app.listen()` (cf. PR #224 / run 25166916535).
   *
   * Phase 7 : starts the per-process heartbeat (Redis SET with TTL 60s
   * refreshed every 30s) so worker liveness can be observed without
   * depending on bull's `getWorkers()` (not in @types/bull v4.10.4).
   */
  onModuleInit(): void {
    this.logger.log({
      event: 'sitemap_scheduler_worker_online',
      pid: process.pid,
      hostname: os.hostname(),
      queue: 'seo-monitor',
      startedAt: this.startedAt.toISOString(),
    });
    void this.removeRetiredRepeatableJobs();
    this.heartbeatTimer = setInterval(
      () => void this.writeHeartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );
    void this.writeHeartbeat();
  }

  /**
   * Phase 7 : symmetric shutdown — stop the interval, delete heartbeat key,
   * emit lifecycle log. Permits observers to tell a clean worker shutdown
   * from a crash (silent disappearance of heartbeat key after TTL expiry).
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
   * HEARTBEAT_TTL_SECONDS.
   *
   * Failure is non-fatal : logs a warning, does not crash the service.
   * The next interval tick will retry.
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

  /**
   * Retire les tâches répétables `sitemap-regenerate-all` que la
   * planification interne supprimée a pu laisser dans Redis. Bull retire avec
   * elles leur prochaine exécution différée. Les tâches répétables des autres
   * services de la queue ne sont pas touchées.
   *
   * Un échec est journalisé et n'interrompt pas le démarrage : la tâche
   * restante serait retirée au démarrage suivant.
   */
  private async removeRetiredRepeatableJobs(): Promise<void> {
    try {
      const jobs = await this.seoMonitorQueue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name !== SITEMAP_REGENERATE_JOB_NAME) continue;
        await this.seoMonitorQueue.removeRepeatableByKey(job.key);
        this.logger.log(
          `🗑️ Retired sitemap repeatable job removed: ${job.key}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Could not remove retired sitemap repeatable jobs: ${getErrorMessage(err)}`,
      );
    }
  }
}
