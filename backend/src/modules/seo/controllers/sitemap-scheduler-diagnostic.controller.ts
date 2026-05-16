/**
 * Diagnostic endpoint for the BullMQ-backed sitemap regeneration scheduler.
 *
 * Lit l'état réel du job repeatable `sitemap-v10-nightly-regeneration` enregistré
 * sur la queue `seo-monitor` et expose les compteurs Bull (waiting/delayed/active/
 * failed/completed) ainsi que le timing prévu vs. observé. Pas d'effet de bord :
 * lecture seule sur Redis via Bull.
 *
 * Cas d'usage : confirmer pourquoi le sitemap stagne en PROD malgré PR #487/488.
 * Signature attendue d'un système sain :
 *   - schedulerConfigured = true
 *   - repeatableJobs contient une entrée avec key `…sitemap-regenerate-all…`
 *   - delayed >= 1 (next run scheduled)
 *   - completed > 0 si déployé depuis > 24h
 *
 * Signature attendue d'un système cassé :
 *   - schedulerConfigured = false → env override (SEO_SITEMAP_CRON_ENABLED=false)
 *   - repeatableJobs vide → onModuleInit n'a pas tourné OU configureRepeatableJob a throw
 *   - delayed = 0 + repeatable absent → idem
 *   - completed = 0 et lastExpectedRun > 24h dans le passé → worker ne consomme pas
 *
 * Garde : AdminOrInternalKeyGuard — session admin (humain en incident response)
 * ou X-Internal-Key (script de monitoring).
 */

import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { AdminOrInternalKeyGuard } from '../../../auth/admin-or-internal-key.guard';
import { SITEMAP_REGENERATE_JOB_ID } from '../services/sitemap-v10-scheduler.service';

interface RepeatableJobInfo {
  key: string;
  name: string;
  id: string | null;
  cron: string | null;
  tz: string | null;
  next: string | null;
}

interface SchedulerStatusResponse {
  now: string;
  schedulerConfigured: boolean;
  cron: string;
  cronEnvOverride: string | null;
  expectedJobId: string;
  repeatableJobs: RepeatableJobInfo[];
  ourRepeatableFound: boolean;
  counts: {
    waiting: number;
    delayed: number;
    active: number;
    failed: number;
    completed: number;
    paused: boolean;
  };
  lastExpectedRunIso: string | null;
  hoursSinceLastExpectedRun: number | null;
}

@Controller('api/admin/sitemap')
@UseGuards(AdminOrInternalKeyGuard)
export class SitemapSchedulerDiagnosticController {
  private readonly logger = new Logger(
    SitemapSchedulerDiagnosticController.name,
  );

  constructor(
    @InjectQueue('seo-monitor') private readonly seoMonitorQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  @Get('scheduler-status')
  async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
    const cronEnvOverride =
      this.configService.get<string>('SEO_SITEMAP_CRON_ENABLED') ?? null;
    const cron = this.configService.get<string>(
      'SEO_SITEMAP_CRON',
      '0 3 * * *',
    );
    const schedulerConfigured = this.isEnabled(cronEnvOverride);

    const [rawRepeatable, waiting, delayed, active, failed, completed, paused] =
      await Promise.all([
        this.seoMonitorQueue.getRepeatableJobs(),
        this.seoMonitorQueue.getWaitingCount(),
        this.seoMonitorQueue.getDelayedCount(),
        this.seoMonitorQueue.getActiveCount(),
        this.seoMonitorQueue.getFailedCount(),
        this.seoMonitorQueue.getCompletedCount(),
        this.seoMonitorQueue.isPaused(),
      ]);

    const repeatableJobs: RepeatableJobInfo[] = rawRepeatable.map((j) => ({
      key: j.key,
      name: j.name,
      id: j.id ?? null,
      cron: (j as { cron?: string }).cron ?? null,
      tz: (j as { tz?: string }).tz ?? null,
      next: j.next ? new Date(j.next).toISOString() : null,
    }));

    const ourRepeatableFound = repeatableJobs.some(
      (j) => j.id === SITEMAP_REGENERATE_JOB_ID,
    );

    const lastExpectedRunIso = this.computeLastExpectedRun(cron);
    const hoursSinceLastExpectedRun = lastExpectedRunIso
      ? Math.round(
          ((Date.now() - new Date(lastExpectedRunIso).getTime()) / 36e5) * 100,
        ) / 100
      : null;

    return {
      now: new Date().toISOString(),
      schedulerConfigured,
      cron,
      cronEnvOverride,
      expectedJobId: SITEMAP_REGENERATE_JOB_ID,
      repeatableJobs,
      ourRepeatableFound,
      counts: { waiting, delayed, active, failed, completed, paused },
      lastExpectedRunIso,
      hoursSinceLastExpectedRun,
    };
  }

  private isEnabled(override: string | null): boolean {
    if (override === null) return true;
    return override.toLowerCase() !== 'false' && override !== '0';
  }

  /**
   * Compute the most recent past tick of a simple cron string (m h dom mon dow).
   * Only supports the schedule we ship (`0 3 * * *` daily fixed-time). For other
   * patterns returns null rather than guessing — keep diagnostic honest.
   */
  private computeLastExpectedRun(cron: string): string | null {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [m, h, dom, mon, dow] = parts;
    const isDaily =
      /^\d+$/.test(m) &&
      /^\d+$/.test(h) &&
      dom === '*' &&
      mon === '*' &&
      dow === '*';
    if (!isDaily) return null;

    const minute = parseInt(m, 10);
    const hour = parseInt(h, 10);
    if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;

    const now = new Date();
    const candidate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hour,
        minute,
        0,
        0,
      ),
    );
    if (candidate.getTime() > now.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() - 1);
    }
    return candidate.toISOString();
  }
}
