/**
 * 🗜️ CONTRÔLEUR STREAMING SITEMAP
 * API simplifiée pour générer et servir les sitemaps compressés
 */

import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { SitemapStreamingService } from '../services/sitemap-streaming.service';
import {
  StreamingGenerationResult,
  GenerationOptions,
  DownloadInfo,
  StreamingConfig,
} from '../interfaces/sitemap-streaming.interface';
import { RateLimitSitemap } from '../../../common/decorators/rate-limit.decorator';

@RateLimitSitemap() // 🛡️ 3 req/min - Sitemaps are memory-intensive
@Controller('sitemap-v2/streaming')
export class SitemapStreamingController {
  private readonly logger = new Logger(SitemapStreamingController.name);

  constructor(private readonly streamingService: SitemapStreamingService) {}

  /**
   * GET /sitemap-v2/streaming/generate
   * Générer tous les sitemaps avec streaming
   *
   * Query params:
   * - type: 'pages' | 'products' | 'blog' | 'catalog' | 'all'
   * - forceRegeneration: true | false
   * - includeHreflang: true | false
   * - includeImages: true | false
   * - maxUrls: number (pour limiter en dev)
   * - dryRun: true | false (simulation sans écriture)
   */
  @Post('generate')
  async generate(
    @Query('type') type?: string,
    @Query('forceRegeneration') forceRegeneration?: string,
    @Query('includeHreflang') includeHreflang?: string,
    @Query('includeImages') includeImages?: string,
    @Query('maxUrls') maxUrls?: string,
    @Query('dryRun') dryRun?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: StreamingGenerationResult;
  }> {
    try {
      const options: Partial<GenerationOptions> = {
        sitemapType: (type as any) || 'all',
        forceRegeneration: forceRegeneration === 'true',
        includeHreflang: includeHreflang !== 'false',
        includeImages: includeImages !== 'false',
        maxUrls: maxUrls ? parseInt(maxUrls, 10) : undefined,
        dryRun: dryRun === 'true',
      };

      this.logger.log(
        `🚀 Starting streaming generation with type="${options.sitemapType}"`,
      );

      const result = await this.streamingService.generateAll(options);

      return {
        success: result.success,
        message: result.success
          ? `Successfully generated ${result.stats.totalShards} shards with ${result.stats.totalUrls} URLs`
          : 'Generation completed with errors',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`❌ Generation failed: ${error.message}`);
      return {
        success: false,
        message: `Generation failed: ${error.message}`,
      };
    }
  }

  /**
   * GET /sitemap-v2/streaming/files
   * Lister tous les fichiers sitemaps disponibles
   */
  @Get('files')
  async listFiles(): Promise<{
    success: boolean;
    data: DownloadInfo[];
  }> {
    try {
      const files = await this.streamingService.listAvailableFiles();

      return {
        success: true,
        data: files,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to list files: ${error.message}`);
      return {
        success: false,
        data: [],
      };
    }
  }

  /**
   * GET /sitemap-v2/streaming/config
   * Obtenir la configuration actuelle
   */
  @Get('config')
  getConfig(): {
    success: boolean;
    data: StreamingConfig;
  } {
    return {
      success: true,
      data: this.streamingService.getConfig(),
    };
  }

  /**
   * POST /sitemap-v2/streaming/cleanup
   * Nettoyer tous les fichiers sitemaps
   */
  @Post('cleanup')
  async cleanup(): Promise<{
    success: boolean;
    message: string;
    deletedCount: number;
  }> {
    try {
      const deletedCount = await this.streamingService.cleanup();

      return {
        success: true,
        message: `Successfully deleted ${deletedCount} sitemap files`,
        deletedCount,
      };
    } catch (error: any) {
      this.logger.error(`❌ Cleanup failed: ${error.message}`);
      return {
        success: false,
        message: `Cleanup failed: ${error.message}`,
        deletedCount: 0,
      };
    }
  }

  /**
   * POST /sitemap-v2/streaming/generate-static
   * @deprecated Utiliser POST /api/sitemap/generate-all à la place
   *
   * Cette route est dépréciée et redirige vers le nouveau service unifié.
   */
  @Post('generate-static')
  async generateStaticSitemaps(): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.warn(
      '⚠️ DEPRECATED: /sitemap-v2/streaming/generate-static is deprecated. Use POST /api/sitemap/generate-all instead.',
    );

    return {
      success: false,
      message:
        'DEPRECATED: Cette route est obsolète. Utilisez POST /api/sitemap/generate-all à la place pour générer tous les sitemaps (categories, vehicules, produits, blog, pages).',
    };
  }
}
