/**
 * SitemapV10FreshnessService — observable SLO source for sitemap freshness.
 *
 * Pourquoi ce service existe
 * --------------------------
 * Avant l'incident traffic-drop 2026-04-22 → 2026-05-13, on n'avait aucun
 * moyen de savoir si le sitemap était stale (`<lastmod>` figé) avant que
 * Google ne décide de réduire son crawl budget. La cause racine
 * (`@nestjs/schedule` désactivé + zéro alternative) était silencieuse
 * pendant 21 jours. Ce service expose la fraîcheur en données structurées
 * qu'un check CI ou un dashboard peut consommer.
 *
 * Sources de vérité (par ordre de fiabilité)
 * -------------------------------------------
 * 1. `fs.stat(SITEMAP_OUTPUT_DIR/sitemap.xml)` — `mtime` = dernière écriture
 *    physique. Source la plus fiable, ne dépend ni de Redis ni de DB.
 * 2. Parsing du premier `<lastmod>` dans `sitemap.xml` — ce que Google voit
 *    réellement. Source de vérité côté SEO.
 * 3. BullMQ queue `seo-monitor` — présence du repeatable job
 *    `sitemap-regenerate-all`. Source de vérité côté pipeline.
 *
 * Le service expose les 3 ; le verdict global (`isHealthy`, `staleHours`)
 * est calculé à partir de la source 1 (filesystem), qui est aussi ce qui
 * est servi sur le web.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getErrorMessage } from '@common/utils/error.utils';
import { SITEMAP_REGENERATE_JOB_NAME } from './sitemap-v10-scheduler.service';

export interface SitemapFreshnessReport {
  /** ISO-8601 of `fs.stat(sitemap.xml).mtime`. null if file missing. */
  fileLastModifiedAt: string | null;
  /** ISO-8601 of the first `<lastmod>` parsed inside `sitemap.xml`. */
  indexLastmod: string | null;
  /** Hours between `fileLastModifiedAt` and now. null if file missing. */
  staleHours: number | null;
  /** True if the BullMQ repeatable job is registered (scheduler healthy). */
  schedulerRegistered: boolean;
  /** Absolute path of the file used as primary source. */
  sitemapPath: string;
  /** Whether `staleHours <= warnThresholdHours` (typically 36 h). */
  isHealthy: boolean;
  /** Threshold used for `isHealthy`, configurable via SEO_SITEMAP_FRESHNESS_WARN_HOURS. */
  warnThresholdHours: number;
  /** Optional explanation if `isHealthy` is false. */
  reason?: string;
}

@Injectable()
export class SitemapV10FreshnessService {
  private readonly logger = new Logger(SitemapV10FreshnessService.name);
  private readonly outputDir: string;
  private readonly warnHours: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue('seo-monitor')
    private readonly seoMonitorQueue: Queue | null,
  ) {
    this.outputDir =
      this.configService.get<string>('SITEMAP_OUTPUT_DIR') ||
      '/var/www/sitemaps';
    this.warnHours = parseInt(
      this.configService.get<string>('SEO_SITEMAP_FRESHNESS_WARN_HOURS') ||
        '36',
      10,
    );
  }

  async getFreshness(): Promise<SitemapFreshnessReport> {
    const sitemapPath = path.join(this.outputDir, 'sitemap.xml');
    const warnThresholdHours = this.warnHours;

    let fileLastModifiedAt: string | null = null;
    let staleHours: number | null = null;
    let indexLastmod: string | null = null;
    let reason: string | undefined;

    try {
      const stat = await fs.stat(sitemapPath);
      fileLastModifiedAt = stat.mtime.toISOString();
      staleHours = (Date.now() - stat.mtimeMs) / 3_600_000;
    } catch (err) {
      const message = getErrorMessage(err);
      this.logger.warn(`fs.stat(${sitemapPath}) failed: ${message}`);
      reason = `sitemap.xml unreadable (${message})`;
    }

    if (fileLastModifiedAt) {
      try {
        const xml = await fs.readFile(sitemapPath, 'utf8');
        // Parse the FIRST <lastmod> in the index (cheapest reliable extraction).
        const match = xml.match(/<lastmod>([^<]+)<\/lastmod>/);
        indexLastmod = match ? match[1].trim() : null;
      } catch (err) {
        this.logger.warn(
          `read sitemap.xml for lastmod failed: ${getErrorMessage(err)}`,
        );
      }
    }

    const schedulerRegistered = await this.checkSchedulerRegistered();

    const isHealthy =
      staleHours !== null &&
      staleHours <= warnThresholdHours &&
      fileLastModifiedAt !== null;
    if (!isHealthy && !reason) {
      if (staleHours === null) {
        reason = 'sitemap.xml missing';
      } else {
        reason = `staleHours=${staleHours.toFixed(2)} > warnThresholdHours=${warnThresholdHours}`;
      }
    }

    return {
      fileLastModifiedAt,
      indexLastmod,
      staleHours: staleHours !== null ? Number(staleHours.toFixed(2)) : null,
      schedulerRegistered,
      sitemapPath,
      isHealthy,
      warnThresholdHours,
      reason,
    };
  }

  private async checkSchedulerRegistered(): Promise<boolean> {
    if (!this.seoMonitorQueue) return false;
    try {
      const jobs = await this.seoMonitorQueue.getRepeatableJobs();
      return jobs.some((j) => j.name === SITEMAP_REGENERATE_JOB_NAME);
    } catch (err) {
      this.logger.warn(
        `getRepeatableJobs failed: ${getErrorMessage(err)} — assuming scheduler not registered`,
      );
      return false;
    }
  }
}
