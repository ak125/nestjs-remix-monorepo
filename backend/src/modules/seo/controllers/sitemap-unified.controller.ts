/**
 * 🗺️ CONTRÔLEUR UNIFIÉ SITEMAP SEO 2026
 *
 * Endpoint principal pour générer tous les sitemaps thématiques:
 * - sitemap-categories.xml
 * - sitemap-vehicules.xml
 * - sitemap-produits-*.xml (shardé)
 * - sitemap-blog.xml
 * - sitemap-pages.xml
 */

import { Controller, Post, Get, Query, Logger } from '@nestjs/common';
import {
  SitemapUnifiedService,
  AllSitemapsResult,
} from '../services/sitemap-unified.service';

@Controller('api/sitemap')
export class SitemapUnifiedController {
  private readonly logger = new Logger(SitemapUnifiedController.name);

  constructor(private readonly sitemapUnifiedService: SitemapUnifiedService) {}

  /**
   * POST /api/sitemap/generate-all
   *
   * Génère tous les sitemaps (5 thématiques + index)
   *
   * @param outputDir - Répertoire de sortie (défaut: /srv/sitemaps)
   * @returns Résultat avec liste des fichiers générés
   */
  @Post('generate-all')
  async generateAll(@Query('outputDir') outputDir?: string): Promise<{
    success: boolean;
    message: string;
    data?: AllSitemapsResult;
  }> {
    try {
      const dir = outputDir || '/srv/sitemaps';

      this.logger.log(`🚀 Starting unified sitemap generation to ${dir}`);

      const result = await this.sitemapUnifiedService.generateAllSitemaps(dir);

      if (result.success) {
        return {
          success: true,
          message: `Generated ${result.files.length} sitemaps with ${result.totalUrls} total URLs in ${result.duration}ms`,
          data: result,
        };
      } else {
        return {
          success: false,
          message: `Generation failed: ${result.errors.join(', ')}`,
          data: result,
        };
      }
    } catch (error: any) {
      this.logger.error(`❌ Sitemap generation error: ${error.message}`);
      return {
        success: false,
        message: `Error: ${error.message}`,
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
  }> {
    return {
      available: true,
      message:
        'SitemapUnifiedService is ready. Use POST /api/sitemap/generate-all to generate sitemaps.',
    };
  }
}
