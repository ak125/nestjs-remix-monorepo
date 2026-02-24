/**
 * SeoDashboardController - API endpoints pour le Dashboard SEO Enterprise
 *
 * Endpoints:
 * - GET /api/seo/dashboard/stats - KPIs globaux
 * - GET /api/seo/dashboard/at-risk - URLs à risque
 * - GET /api/seo/dashboard/risk/:flag - URLs par type de risque
 * - GET /api/seo/dashboard/crawl-activity - Activité crawl 30 jours
 * - GET /api/seo/dashboard/index-changes - Changements indexation récents
 * - POST /api/seo/dashboard/refresh-risks - Recalculer les risk flags
 */

import { Controller, Get, Post, Param, Query, Logger } from '@nestjs/common';
import {
  RiskFlagsEngineService,
  RiskFlag,
  DashboardStats,
  RiskAlert,
  RefreshResult,
} from '../services/risk-flags-engine.service';
import { GooglebotDetectorService } from '../services/googlebot-detector.service';
import type { AdminApiResponse } from '@repo/database-types';

@Controller('api/seo/dashboard')
export class SeoDashboardController {
  private readonly logger = new Logger(SeoDashboardController.name);

  constructor(
    private readonly riskFlagsEngine: RiskFlagsEngineService,
    private readonly googlebotDetector: GooglebotDetectorService,
  ) {}

  /**
   * GET /api/seo/dashboard/stats
   * KPIs globaux du dashboard
   */
  @Get('stats')
  async getStats(): Promise<AdminApiResponse<DashboardStats>> {
    try {
      const stats = await this.riskFlagsEngine.getDashboardStats();

      return {
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve dashboard stats',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/at-risk
   * URLs à risque triées par urgency_score
   */
  @Get('at-risk')
  async getUrlsAtRisk(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AdminApiResponse<RiskAlert[]>> {
    try {
      const parsedLimit = Math.min(parseInt(limit || '100', 10), 500);
      const parsedOffset = parseInt(offset || '0', 10);

      const urls = await this.riskFlagsEngine.getUrlsAtRisk(
        parsedLimit,
        parsedOffset,
      );

      return {
        success: true,
        data: urls,
        meta: {
          total: urls.length,
          limit: parsedLimit,
          offset: parsedOffset,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get URLs at risk: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve URLs at risk',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/risk/:flag
   * URLs par type de risque spécifique
   */
  @Get('risk/:flag')
  async getUrlsByRiskFlag(
    @Param('flag') flag: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AdminApiResponse<RiskAlert[]>> {
    // Validate risk flag
    const validFlags: RiskFlag[] = [
      'CONFUSION',
      'ORPHAN',
      'DUPLICATE',
      'WEAK_CLUSTER',
      'LOW_CRAWL',
    ];
    const upperFlag = flag.toUpperCase() as RiskFlag;

    if (!validFlags.includes(upperFlag)) {
      return {
        success: false,
        error: `Invalid risk flag. Valid values: ${validFlags.join(', ')}`,
      };
    }

    try {
      const parsedLimit = Math.min(parseInt(limit || '100', 10), 500);
      const parsedOffset = parseInt(offset || '0', 10);

      const urls = await this.riskFlagsEngine.getUrlsAtRisk(
        parsedLimit,
        parsedOffset,
        upperFlag,
      );

      return {
        success: true,
        data: urls,
        meta: {
          total: urls.length,
          limit: parsedLimit,
          offset: parsedOffset,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get URLs by risk flag: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve URLs by risk flag',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/crawl-activity
   * Activité de crawl sur les 30 derniers jours
   */
  @Get('crawl-activity')
  async getCrawlActivity(): Promise<
    AdminApiResponse<
      {
        date: string;
        totalCrawls: number;
        googlebotCrawls: number;
        uniqueUrls: number;
        avgResponseMs: number;
        errors: number;
      }[]
    >
  > {
    try {
      const activity = await this.riskFlagsEngine.getCrawlActivity();

      return {
        success: true,
        data: activity,
        meta: {
          total: activity.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get crawl activity: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve crawl activity',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/index-changes
   * Changements d'indexation récents (7 derniers jours)
   */
  @Get('index-changes')
  async getIndexChanges(@Query('limit') limit?: string): Promise<
    AdminApiResponse<
      {
        url: string;
        isIndexed: boolean;
        firstSeenAt: Date | null;
        change: string;
      }[]
    >
  > {
    try {
      const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);
      const changes = await this.riskFlagsEngine.getIndexChanges(parsedLimit);

      return {
        success: true,
        data: changes,
        meta: {
          total: changes.length,
          limit: parsedLimit,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get index changes: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve index changes',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/crawl-stats
   * Statistiques de crawl Googlebot
   */
  @Get('crawl-stats')
  async getCrawlStats(): Promise<
    AdminApiResponse<{
      last24h: number;
      last7d: number;
      uniqueUrls24h: number;
      avgResponseMs: number;
    }>
  > {
    try {
      const stats = await this.googlebotDetector.getCrawlStats();

      return {
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get crawl stats: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve crawl stats',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/recent-crawls
   * Derniers crawls Googlebot
   */
  @Get('recent-crawls')
  async getRecentCrawls(@Query('limit') limit?: string): Promise<
    AdminApiResponse<
      {
        url: string;
        userAgent: string;
        botName: string | null;
        statusCode: number;
        responseMs?: number;
      }[]
    >
  > {
    try {
      const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);
      const crawls = await this.googlebotDetector.getRecentCrawls(parsedLimit);

      return {
        success: true,
        data: crawls,
        meta: {
          total: crawls.length,
          limit: parsedLimit,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recent crawls: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve recent crawls',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/not-crawled
   * URLs non crawlées depuis X jours
   */
  @Get('not-crawled')
  async getUrlsNotCrawled(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ): Promise<
    AdminApiResponse<
      { url: string; lastCrawlAt: Date | null; daysSinceLastCrawl: number }[]
    >
  > {
    try {
      const parsedDays = Math.min(parseInt(days || '14', 10), 90);
      const parsedLimit = Math.min(parseInt(limit || '100', 10), 500);

      const urls = await this.googlebotDetector.getUrlsNotCrawled(
        parsedDays,
        parsedLimit,
      );

      return {
        success: true,
        data: urls,
        meta: {
          total: urls.length,
          limit: parsedLimit,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get uncrawled URLs: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve uncrawled URLs',
      };
    }
  }

  /**
   * POST /api/seo/dashboard/refresh-risks
   * Recalculer tous les risk flags (manuel, pas automatique)
   */
  @Post('refresh-risks')
  async refreshRiskFlags(): Promise<AdminApiResponse<RefreshResult>> {
    try {
      this.logger.log('Manual risk flags refresh requested');
      const result = await this.riskFlagsEngine.refreshAllRiskFlags();

      return {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh risk flags: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to refresh risk flags',
      };
    }
  }

  /**
   * GET /api/seo/dashboard/summary
   * Résumé exécutif pour affichage rapide
   */
  @Get('summary')
  async getSummary(): Promise<
    AdminApiResponse<{
      status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
      headline: string;
      topIssues: { flag: string; count: number; severity: string }[];
      crawlTrend: 'UP' | 'DOWN' | 'STABLE';
    }>
  > {
    try {
      const stats = await this.riskFlagsEngine.getDashboardStats();

      // Determine overall status
      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
      let headline = 'SEO health is good';

      if (stats.riskBreakdown.CONFUSION > 0) {
        status = 'CRITICAL';
        headline = `${stats.riskBreakdown.CONFUSION} URLs with CONFUSION risk (BLOCKING)`;
      } else if (stats.crawlHealth.googlebotAbsent14d > 1000) {
        status = 'CRITICAL';
        headline = `${stats.crawlHealth.googlebotAbsent14d} indexed URLs not crawled in 14+ days`;
      } else if (stats.riskBreakdown.ORPHAN > 500) {
        status = 'WARNING';
        headline = `${stats.riskBreakdown.ORPHAN} orphan URLs at risk`;
      } else if (stats.urlsAtRisk > stats.totalUrls * 0.05) {
        status = 'WARNING';
        headline = `${stats.urlsAtRisk} URLs at risk (${((stats.urlsAtRisk / stats.totalUrls) * 100).toFixed(1)}%)`;
      }

      // Top issues sorted by severity
      const topIssues = [
        {
          flag: 'CONFUSION',
          count: stats.riskBreakdown.CONFUSION,
          severity: 'CRITICAL',
        },
        {
          flag: 'ORPHAN',
          count: stats.riskBreakdown.ORPHAN,
          severity: 'HIGH',
        },
        {
          flag: 'GOOGLEBOT_ABSENT_14D',
          count: stats.crawlHealth.googlebotAbsent14d,
          severity: 'HIGH',
        },
        {
          flag: 'LOW_CRAWL',
          count: stats.riskBreakdown.LOW_CRAWL,
          severity: 'MEDIUM',
        },
        {
          flag: 'WEAK_CLUSTER',
          count: stats.riskBreakdown.WEAK_CLUSTER,
          severity: 'MEDIUM',
        },
        {
          flag: 'DUPLICATE',
          count: stats.riskBreakdown.DUPLICATE,
          severity: 'LOW',
        },
      ]
        .filter((i) => i.count > 0)
        .slice(0, 5);

      // Crawl trend (simplified - would need historical data for real trend)
      let crawlTrend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
      const avgDaily = stats.crawlHealth.last7d / 7;
      if (stats.crawlHealth.last24h > avgDaily * 1.2) {
        crawlTrend = 'UP';
      } else if (stats.crawlHealth.last24h < avgDaily * 0.8) {
        crawlTrend = 'DOWN';
      }

      return {
        success: true,
        data: {
          status,
          headline,
          topIssues,
          crawlTrend,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get summary: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve summary',
      };
    }
  }
}
