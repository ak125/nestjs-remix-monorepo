/**
 * 🗺️ CONTRÔLEUR UNIFIÉ SITEMAP SEO 2026
 *
 * REDIRECTEUR vers V10 - Maintient la compatibilité avec l'endpoint legacy
 *
 * Endpoint legacy: POST /api/sitemap/generate-all
 * → Redirige vers SitemapV10Service.generateAll()
 */

import { Controller, Post, Get, Logger } from '@nestjs/common';
import { SitemapV10Service } from '../services/sitemap-v10.service';
import { RateLimitSitemap } from '../../../common/decorators/rate-limit.decorator';

@RateLimitSitemap() // 🛡️ 3 req/min - Sitemaps are memory-intensive
@Controller('api/sitemap')
export class SitemapUnifiedController {
  private readonly logger = new Logger(SitemapUnifiedController.name);

  constructor(private readonly sitemapV10Service: SitemapV10Service) {}

  /**
   * POST /api/sitemap/generate-all
   *
   * 🔄 REDIRECTEUR vers V10 - Endpoint legacy maintenu pour compatibilité
   *
   * Génère tous les sitemaps via SitemapV10Service.generateAll()
   * - 7 types de sitemaps (racine, categories, vehicules, blog, pages, pieces)
   * - 714k URLs via source __sitemap_p_link
   * - Temperature buckets (hot/stable/cold)
   */
  @Post('generate-all')
  async generateAll(): Promise<{
    success: boolean;
    message: string;
    data?: {
      totalUrls: number;
      totalFiles: number;
      durationMs: number;
      indexPath?: string;
      buckets: Array<{
        bucket: string;
        success: boolean;
        urlCount: number;
        filesGenerated: number;
        error?: string;
      }>;
    };
  }> {
    this.logger.log('🔄 POST /api/sitemap/generate-all → Redirecting to V10');

    try {
      const result = await this.sitemapV10Service.generateAll();

      return {
        success: result.success,
        message: result.success
          ? `Generated ${result.totalFiles} sitemaps with ${result.totalUrls.toLocaleString()} total URLs in ${result.totalDurationMs}ms`
          : 'Some sitemaps failed to generate',
        data: {
          totalUrls: result.totalUrls,
          totalFiles: result.totalFiles,
          durationMs: result.totalDurationMs,
          indexPath: result.indexPath,
          buckets: result.results.map((r) => ({
            bucket: r.bucket,
            success: r.success,
            urlCount: r.urlCount,
            filesGenerated: r.filesGenerated,
            error: r.error,
          })),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Sitemap generation error: ${message}`);
      return {
        success: false,
        message: `Error: ${message}`,
      };
    }
  }

  /**
   * GET /api/sitemap/unified-status
   *
   * Retourne le statut des sitemaps générés
   */
  @Get('unified-status')
  async getStatus(): Promise<{
    available: boolean;
    message: string;
    version: string;
  }> {
    return {
      available: true,
      message:
        'SitemapV10Service is active. Use POST /api/sitemap/generate-all to generate all sitemaps.',
      version: 'V10 Unified (replaces V9)',
    };
  }
}
