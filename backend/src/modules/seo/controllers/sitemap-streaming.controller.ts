/**
 * 🗜️ CONTRÔLEUR STREAMING SITEMAP
 * API simplifiée pour générer et servir les sitemaps compressés
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { SitemapStreamingService } from '../services/sitemap-streaming.service';
import {
  StreamingGenerationResult,
  GenerationOptions,
  DownloadInfo,
  StreamingConfig,
} from '../interfaces/sitemap-streaming.interface';
import { RateLimitSitemap } from '../../../common/decorators/rate-limit.decorator';
import { AdminOrInternalKeyGuard } from '../../../auth/admin-or-internal-key.guard';

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
  @UseGuards(AdminOrInternalKeyGuard)
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
        sitemapType: (type as GenerationOptions['sitemapType']) || 'all',
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Generation failed: ${message}`);
      return {
        success: false,
        message: `Generation failed: ${message}`,
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to list files: ${message}`);
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
  @UseGuards(AdminOrInternalKeyGuard)
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Cleanup failed: ${message}`);
      return {
        success: false,
        message: `Cleanup failed: ${message}`,
        deletedCount: 0,
      };
    }
  }
}
