/**
 * 🔥 CONTRÔLEUR SITEMAP V10 - ENDPOINTS TEMPÉRATURE
 *
 * Endpoints:
 * - POST /api/sitemap/v10/generate-all     → Génère tous les buckets
 * - POST /api/sitemap/v10/generate/:bucket → Génère un bucket spécifique
 * - POST /api/sitemap/v10/refresh-scores   → Recalcule les scores
 * - POST /api/sitemap/v10/generate-hubs    → Génère les hubs de crawl (legacy)
 * - POST /api/sitemap/v10/generate-hubs-robust → 🚀 Hubs paginés (max 5k/file)
 * - GET  /api/sitemap/v10/stats            → Stats de distribution
 * - POST /api/sitemap/v10/ping             → Ping Google
 */

import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import {
  SitemapV10Service,
  TemperatureBucket,
} from '../services/sitemap-v10.service';
import { SitemapV10ScoringService } from '../services/sitemap-v10-scoring.service';
import { SitemapV10HubsService } from '../services/sitemap-v10-hubs.service';
import { RateLimitSitemap } from '../../../common/decorators/rate-limit.decorator';

@RateLimitSitemap() // 🛡️ 3 req/min - Sitemaps are memory-intensive
@Controller('api/sitemap/v10')
export class SitemapV10Controller {
  private readonly logger = new Logger(SitemapV10Controller.name);

  constructor(
    private readonly sitemapService: SitemapV10Service,
    private readonly scoringService: SitemapV10ScoringService,
    private readonly hubsService: SitemapV10HubsService,
  ) {}

  /**
   * POST /api/sitemap/v10/generate-all
   * Génère tous les sitemaps par température
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
    this.logger.log('📝 POST /api/sitemap/v10/generate-all');

    try {
      const result = await this.sitemapService.generateAll();

      return {
        success: result.success,
        message: result.success
          ? 'All V10 sitemaps generated successfully'
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
    } catch (error: any) {
      this.logger.error(`Generate all failed: ${error.message}`);
      return {
        success: false,
        message: `Generation failed: ${error.message}`,
      };
    }
  }

  /**
   * POST /api/sitemap/v10/generate-fusion
   * @deprecated Utilisez POST /api/sitemap/v10/generate-all à la place
   * Redirige maintenant vers generateAll()
   */
  @Post('generate-fusion')
  async generateFusion(): Promise<{
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
    this.logger.warn(
      '⚠️ DEPRECATED: /generate-fusion → Use /generate-all instead',
    );

    // Redirect to unified generateAll()
    return this.generateAll();
  }

  /**
   * POST /api/sitemap/v10/generate/:bucket
   * Génère le sitemap d'un bucket spécifique
   */
  @Post('generate/:bucket')
  async generateBucket(@Param('bucket') bucket: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      bucket: string;
      urlCount: number;
      filesGenerated: number;
      durationMs: number;
      filePaths: string[];
    };
  }> {
    this.logger.log(`📝 POST /api/sitemap/v10/generate/${bucket}`);

    const validBuckets: TemperatureBucket[] = ['hot', 'new', 'stable', 'cold'];
    if (!validBuckets.includes(bucket as TemperatureBucket)) {
      return {
        success: false,
        message: `Invalid bucket. Must be one of: ${validBuckets.join(', ')}`,
      };
    }

    try {
      const result = await this.sitemapService.generateByTemperature(
        bucket as TemperatureBucket,
      );

      return {
        success: result.success,
        message: `Sitemap for ${bucket} generated successfully`,
        data: {
          bucket: result.bucket,
          urlCount: result.urlCount,
          filesGenerated: result.filesGenerated,
          durationMs: result.durationMs,
          filePaths: result.filePaths,
        },
      };
    } catch (error: any) {
      this.logger.error(`Generate ${bucket} failed: ${error.message}`);
      return {
        success: false,
        message: `Generation failed: ${error.message}`,
      };
    }
  }

  /**
   * POST /api/sitemap/v10/refresh-scores
   * Recalcule les scores de toutes les pages
   */
  @Post('refresh-scores')
  async refreshScores(): Promise<{
    success: boolean;
    message: string;
    data?: {
      processed: number;
      updated: number;
      errors: number;
      durationMs: number;
    };
  }> {
    this.logger.log('📊 POST /api/sitemap/v10/refresh-scores');

    try {
      const result = await this.scoringService.refreshAllScores();

      return {
        success: result.success,
        message: result.success
          ? 'Scores refreshed successfully'
          : 'Score refresh completed with errors',
        data: {
          processed: result.processed,
          updated: result.updated,
          errors: result.errors,
          durationMs: result.durationMs,
        },
      };
    } catch (error: any) {
      this.logger.error(`Refresh scores failed: ${error.message}`);
      return {
        success: false,
        message: `Refresh failed: ${error.message}`,
      };
    }
  }

  /**
   * POST /api/sitemap/v10/generate-hubs
   * Génère les hubs de crawl (version legacy - non paginée)
   */
  @Post('generate-hubs')
  async generateHubs(): Promise<{
    success: boolean;
    message: string;
    data?: {
      totalHubs: number;
      successCount: number;
      totalUrls: number;
      hubs: Array<{
        type: string;
        success: boolean;
        urlCount: number;
        error?: string;
      }>;
    };
  }> {
    this.logger.log('🔗 POST /api/sitemap/v10/generate-hubs');

    try {
      const results = await this.hubsService.generateAllHubs();

      const successCount = results.filter((r) => r.success).length;
      const totalUrls = results.reduce((sum, r) => sum + r.urlCount, 0);

      return {
        success: successCount === results.length,
        message: `Generated ${successCount}/${results.length} hubs`,
        data: {
          totalHubs: results.length,
          successCount,
          totalUrls,
          hubs: results.map((r) => ({
            type: r.hubType,
            success: r.success,
            urlCount: r.urlCount,
            error: r.error,
          })),
        },
      };
    } catch (error: any) {
      this.logger.error(`Generate hubs failed: ${error.message}`);
      return {
        success: false,
        message: `Hub generation failed: ${error.message}`,
      };
    }
  }

  /**
   * POST /api/sitemap/v10/generate-hubs-robust
   * 🚀 Génère les hubs de crawl avec pagination robuste (max 5k URLs/fichier)
   *
   * Structure générée:
   * - clusters/{famille}/index.html + part-XXX.html
   * - hot/money.html (top 2k)
   * - risk/weak-cluster.html (pages à risque)
   */
  @Post('generate-hubs-robust')
  async generateHubsRobust(): Promise<{
    success: boolean;
    message: string;
    data?: {
      totalUrls: number;
      totalFiles: number;
      clusters: Array<{
        type: string;
        success: boolean;
        urlCount: number;
        error?: string;
      }>;
      transversal: Array<{
        type: string;
        success: boolean;
        urlCount: number;
        error?: string;
      }>;
    };
  }> {
    this.logger.log(
      '🚀 POST /api/sitemap/v10/generate-hubs-robust (paginated, max 5k/file)',
    );

    try {
      const result = await this.hubsService.generateAllHubsRobust();

      const allSuccess =
        result.clusters.every((r) => r.success) &&
        result.transversal.every((r) => r.success);

      return {
        success: allSuccess,
        message: allSuccess
          ? `✅ Robust hubs generated: ${result.summary.totalUrls.toLocaleString()} URLs in ${result.summary.totalFiles} files`
          : 'Some hubs failed to generate',
        data: {
          totalUrls: result.summary.totalUrls,
          totalFiles: result.summary.totalFiles,
          clusters: result.clusters.map((r) => ({
            type: r.hubType,
            success: r.success,
            urlCount: r.urlCount,
            error: r.error,
          })),
          transversal: result.transversal.map((r) => ({
            type: r.hubType,
            success: r.success,
            urlCount: r.urlCount,
            error: r.error,
          })),
        },
      };
    } catch (error: any) {
      this.logger.error(`Generate robust hubs failed: ${error.message}`);
      return {
        success: false,
        message: `Hub generation failed: ${error.message}`,
      };
    }
  }

  /**
   * GET /api/sitemap/v10/stats
   * Retourne les statistiques de distribution par température
   */
  @Get('stats')
  async getStats(): Promise<{
    success: boolean;
    data?: {
      temperature: Record<string, unknown>[];
      scoring: {
        byBucket: Record<string, number>;
        avgScore: number;
        totalScored: number;
      };
    };
    message?: string;
  }> {
    this.logger.log('📊 GET /api/sitemap/v10/stats');

    try {
      const [temperatureStats, scoreDistribution] = await Promise.all([
        this.sitemapService.getTemperatureStats(),
        this.scoringService.getScoreDistribution(),
      ]);

      return {
        success: true,
        data: {
          temperature: temperatureStats,
          scoring: scoreDistribution,
        },
      };
    } catch (error: any) {
      this.logger.error(`Get stats failed: ${error.message}`);
      return {
        success: false,
        message: `Failed to get stats: ${error.message}`,
      };
    }
  }

  /**
   * POST /api/sitemap/v10/ping
   * Ping Google pour le sitemap index
   */
  @Post('ping')
  async pingGoogle(): Promise<{
    success: boolean;
    message: string;
    data?: { status: number };
  }> {
    this.logger.log('🔔 POST /api/sitemap/v10/ping');

    try {
      const result = await this.sitemapService.pingGoogle();

      return {
        success: result.ok,
        message: result.ok
          ? 'Google pinged successfully'
          : `Google ping failed with status ${result.status}`,
        data: { status: result.status },
      };
    } catch (error: any) {
      this.logger.error(`Ping failed: ${error.message}`);
      return {
        success: false,
        message: `Ping failed: ${error.message}`,
      };
    }
  }

  /**
   * POST /api/sitemap/v10/ping/:bucket
   * Ping Google pour un bucket spécifique
   */
  @Post('ping/:bucket')
  async pingGoogleBucket(@Param('bucket') bucket: string): Promise<{
    success: boolean;
    message: string;
    data?: { bucket: string; status: number };
  }> {
    this.logger.log(`🔔 POST /api/sitemap/v10/ping/${bucket}`);

    const validBuckets: TemperatureBucket[] = ['hot', 'new', 'stable', 'cold'];
    if (!validBuckets.includes(bucket as TemperatureBucket)) {
      return {
        success: false,
        message: `Invalid bucket. Must be one of: ${validBuckets.join(', ')}`,
      };
    }

    try {
      const result = await this.sitemapService.pingGoogle(
        bucket as TemperatureBucket,
      );

      return {
        success: result.ok,
        message: result.ok
          ? `Google pinged successfully for ${bucket}`
          : `Google ping failed with status ${result.status}`,
        data: { bucket, status: result.status },
      };
    } catch (error: any) {
      this.logger.error(`Ping ${bucket} failed: ${error.message}`);
      return {
        success: false,
        message: `Ping failed: ${error.message}`,
      };
    }
  }
}
