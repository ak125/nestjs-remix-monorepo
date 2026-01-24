/**
 * KeywordsDashboardController - API endpoints pour visualiser les keywords SEO par gamme
 *
 * Endpoints:
 * - GET /api/seo/keywords/gammes - Liste toutes les gammes avec stats
 * - GET /api/seo/keywords/gamme/:gamme - Keywords d'une gamme avec pagination
 * - GET /api/seo/keywords/gamme/:gamme/stats - Distribution V-Level pour une gamme
 * - GET /api/seo/keywords/top - Top keywords global par volume
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  KeywordsDashboardService,
  GammeStats,
  KeywordItem,
  GammeDetailStats,
  TopKeyword,
} from '../services/keywords-dashboard.service';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    timestamp?: string;
  };
}

@Controller('api/seo/keywords')
export class KeywordsDashboardController {
  private readonly logger = new Logger(KeywordsDashboardController.name);

  constructor(
    private readonly keywordsDashboardService: KeywordsDashboardService,
  ) {}

  /**
   * GET /api/seo/keywords/gammes
   * Liste toutes les gammes avec leurs statistiques
   */
  @Get('gammes')
  async listGammes(): Promise<ApiResponse<GammeStats[]>> {
    try {
      this.logger.log('GET /api/seo/keywords/gammes');
      const gammes = await this.keywordsDashboardService.listGammes();

      return {
        success: true,
        data: gammes,
        meta: {
          total: gammes.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to list gammes: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve gammes',
      };
    }
  }

  /**
   * GET /api/seo/keywords/gamme/:gamme
   * Keywords d'une gamme avec pagination et filtres
   */
  @Get('gamme/:gamme')
  async getKeywordsByGamme(
    @Param('gamme') gamme: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('v_level') vLevel?: string,
    @Query('model') model?: string,
    @Query('order_by') orderBy?: 'volume' | 'keyword',
    @Query('order_dir') orderDir?: 'asc' | 'desc',
  ): Promise<ApiResponse<KeywordItem[]>> {
    try {
      this.logger.log(`GET /api/seo/keywords/gamme/${gamme}`);

      const decodedGamme = decodeURIComponent(gamme);

      const { items, total } =
        await this.keywordsDashboardService.getKeywordsByGamme(decodedGamme, {
          limit: Math.min(limit, 200), // Max 200 per request
          offset,
          vLevel,
          model,
          orderBy: orderBy || 'volume',
          orderDir: orderDir || 'desc',
        });

      return {
        success: true,
        data: items,
        meta: {
          total,
          limit,
          offset,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get keywords for gamme ${gamme}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: `Failed to retrieve keywords for gamme: ${gamme}`,
      };
    }
  }

  /**
   * GET /api/seo/keywords/gamme/:gamme/stats
   * Statistiques détaillées pour une gamme (distribution V-Level, top models)
   */
  @Get('gamme/:gamme/stats')
  async getGammeStats(
    @Param('gamme') gamme: string,
  ): Promise<ApiResponse<GammeDetailStats>> {
    try {
      this.logger.log(`GET /api/seo/keywords/gamme/${gamme}/stats`);

      const decodedGamme = decodeURIComponent(gamme);
      const stats =
        await this.keywordsDashboardService.getGammeStats(decodedGamme);

      if (!stats) {
        return {
          success: false,
          error: `Gamme not found: ${decodedGamme}`,
        };
      }

      return {
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get stats for gamme ${gamme}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: `Failed to retrieve stats for gamme: ${gamme}`,
      };
    }
  }

  /**
   * GET /api/seo/keywords/top
   * Top keywords global par volume
   */
  @Get('top')
  async getTopKeywords(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<TopKeyword[]>> {
    try {
      this.logger.log(`GET /api/seo/keywords/top?limit=${limit}`);

      const keywords = await this.keywordsDashboardService.getTopKeywords(
        Math.min(limit, 500), // Max 500
      );

      return {
        success: true,
        data: keywords,
        meta: {
          total: keywords.length,
          limit,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get top keywords: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve top keywords',
      };
    }
  }
}
