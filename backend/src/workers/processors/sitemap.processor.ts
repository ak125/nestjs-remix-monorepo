/**
 * 📊 PROCESSOR SITEMAP JOBS
 * Traitement asynchrone des générations de sitemaps
 */

import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SitemapStreamingService } from '../../modules/seo/services/sitemap-streaming.service';
import { SitemapDeltaService } from '../../modules/seo/services/sitemap-delta.service';

interface SitemapJobData {
  type: 'streaming' | 'delta' | 'cleanup';
  sitemapType?: string;
  options?: any;
}

@Processor('sitemap')
export class SitemapProcessor {
  private readonly logger = new Logger(SitemapProcessor.name);

  constructor(
    private readonly streamingService: SitemapStreamingService,
    private readonly deltaService: SitemapDeltaService,
  ) {}

  /**
   * Process job de génération streaming
   */
  @Process('generate-streaming')
  async handleStreamingGeneration(job: Job<SitemapJobData>) {
    this.logger.log(
      `🚀 Starting streaming sitemap generation (Job #${job.id})`,
    );

    try {
      const { sitemapType, options } = job.data;

      // Générer sitemaps
      const result = await this.streamingService.generateAll({
        sitemapType: sitemapType || 'all',
        ...options,
      });

      this.logger.log(
        `✅ Streaming generation complete: ${result.stats.totalUrls} URLs in ${result.stats.totalShards} shards`,
      );

      return {
        success: true,
        stats: result.stats,
        duration: result.totalDuration,
      };
    } catch (error: any) {
      this.logger.error(`❌ Streaming generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process job de génération delta
   */
  @Process('generate-delta')
  async handleDeltaGeneration(job: Job<SitemapJobData>) {
    this.logger.log(`🔄 Starting delta sitemap generation (Job #${job.id})`);

    try {
      // Récupérer delta du jour
      const delta = await this.deltaService.getTodayDelta();

      this.logger.log(`📊 Delta contains ${delta.length} changed URLs`);

      // Générer sitemap
      const xml = await this.deltaService.generateLatestSitemap();

      this.logger.log(`✅ Delta sitemap generated (${xml.length} bytes)`);

      return {
        success: true,
        urlCount: delta.length,
        size: xml.length,
      };
    } catch (error: any) {
      this.logger.error(`❌ Delta generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process job de cleanup
   */
  @Process('cleanup-deltas')
  async handleCleanup(job: Job<SitemapJobData>) {
    this.logger.log(`🧹 Starting delta cleanup (Job #${job.id})`);

    try {
      const deletedCount = await this.deltaService.cleanupExpiredDeltas();

      this.logger.log(`✅ Cleanup complete: ${deletedCount} deltas deleted`);

      return {
        success: true,
        deletedCount,
      };
    } catch (error: any) {
      this.logger.error(`❌ Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handler d'erreur global
   */
  @Process()
  async handleError(job: Job<SitemapJobData>) {
    this.logger.error(
      `❌ Unknown job type or error for job #${job.id}: ${JSON.stringify(job.data)}`,
    );
    throw new Error('Unknown job type');
  }
}
