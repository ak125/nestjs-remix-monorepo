/**
 * SitemapRegenerateProcessor — consume du job `sitemap-regenerate-all`.
 *
 * Scheduled by `SitemapV10SchedulerService` (BullMQ repeatable, 03:00 UTC).
 * Delegate `SitemapV10Service.generateAll()` qui régénère tous les buckets
 * (racine, categories, vehicules, blog, pages, diagnostic, reference, brands,
 * pieces-1..N, hubs). Aucun changement de comportement métier — uniquement
 * fraîcheur du `<lastmod>` (suit la date de génération côté
 * `sitemap-v10-xml.service.ts:75-77`).
 *
 * READ_ONLY gate ici (pas au scheduler) — mémoire
 * `feedback_readonly_gate_at_processor_not_scheduler.md` et pattern
 * `SeoDailyFetchProcessor`. Preprod miroir prod doit pouvoir valider le
 * wiring BullMQ sans exécuter la génération qui écrit des fichiers.
 */

import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../config/app.config';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { SitemapV10Service } from '../services/sitemap-v10.service';
import {
  SITEMAP_REGENERATE_JOB_NAME,
  SitemapRegenerateJobData,
} from '../services/sitemap-v10-scheduler.service';

export interface SitemapRegenerateResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  triggeredBy: SitemapRegenerateJobData['triggeredBy'];
  success: boolean;
  skipped?: 'read_only';
  totalUrls?: number;
  totalFiles?: number;
  indexPath?: string;
  errorMessage?: string;
}

@Processor('seo-monitor')
export class SitemapRegenerateProcessor {
  private readonly logger = new Logger(SitemapRegenerateProcessor.name);
  private readonly readOnly: boolean;
  private lastQueueErrorLog = 0;

  constructor(private readonly sitemapService: SitemapV10Service) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process(SITEMAP_REGENERATE_JOB_NAME)
  async handleRegenerate(
    job: Job<SitemapRegenerateJobData>,
  ): Promise<SitemapRegenerateResult> {
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const triggeredBy = job.data?.triggeredBy ?? 'scheduler';

    // ADR-028 Option D — READ_ONLY gate au processor.
    // Le scheduler reste enregistré pour valider le wiring BullMQ en preprod
    // miroir prod, mais le handler court-circuite sans écrire de fichiers.
    if (this.readOnly) {
      this.logger.log(
        `[READ_ONLY] Skipping sitemap regeneration (triggeredBy=${triggeredBy})`,
      );
      return {
        startedAt: startedAtIso,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtMs,
        triggeredBy,
        success: true,
        skipped: 'read_only',
      };
    }

    this.logger.log(
      `🌙 Sitemap V10 regeneration starting (triggeredBy=${triggeredBy})`,
    );

    try {
      const result = await this.sitemapService.generateAll();
      const durationMs = Date.now() - startedAtMs;

      const log = result.success
        ? this.logger.log.bind(this.logger)
        : this.logger.error.bind(this.logger);
      log(
        `${result.success ? '✅' : '❌'} Sitemap V10 regeneration done in ${durationMs}ms — ` +
          `${result.totalUrls} URLs across ${result.totalFiles} files`,
      );

      return {
        startedAt: startedAtIso,
        finishedAt: new Date().toISOString(),
        durationMs,
        triggeredBy,
        success: result.success,
        totalUrls: result.totalUrls,
        totalFiles: result.totalFiles,
        indexPath: result.indexPath,
      };
    } catch (err) {
      const message = getErrorMessage(err);
      this.logger.error(
        `❌ Sitemap V10 regeneration threw: ${message}`,
        err instanceof Error ? err.stack : String(err),
      );
      return {
        startedAt: startedAtIso,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtMs,
        triggeredBy,
        success: false,
        errorMessage: message,
      };
    }
  }

  @OnQueueError()
  onQueueError(err: Error): void {
    // Throttle to once per minute to avoid log spam if Redis flaps
    const now = Date.now();
    if (now - this.lastQueueErrorLog < 60_000) return;
    this.lastQueueErrorLog = now;
    this.logger.error(`Queue error (seo-monitor): ${err.message}`, err.stack);
  }

  @OnQueueFailed()
  onJobFailed(job: Job<SitemapRegenerateJobData>, err: Error): void {
    if (job.name !== SITEMAP_REGENERATE_JOB_NAME) return;
    this.logger.error(
      `Sitemap regeneration job ${job.id} failed: ${err.message}`,
      err.stack,
    );
  }
}
