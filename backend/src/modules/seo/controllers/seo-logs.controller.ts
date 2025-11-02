import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { LogIngestionService } from '../services/log-ingestion.service';

@Controller('seo-logs')
export class SeoLogsController {
  constructor(private readonly logIngestionService: LogIngestionService) {}

  /**
   * GET /seo-logs/search
   * Rechercher dans les logs SEO avec facettes e-commerce
   */
  @Get('search')
  async searchLogs(
    @Query('q') q?: string,
    @Query('status', new ParseIntPipe({ optional: true })) status?: number,
    @Query('method') method?: string,
    @Query('day') day?: string,
    @Query('country') country?: string,
    @Query('brand') brand?: string,
    @Query('gamme') gamme?: string,
    @Query('bot') bot?: string,
    @Query('from', new ParseIntPipe({ optional: true })) from?: number,
    @Query('to', new ParseIntPipe({ optional: true })) to?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    const results = await this.logIngestionService.searchSeoLogs({
      q,
      status,
      method,
      day,
      country,
      brand,
      gamme,
      bot,
      from,
      to,
      limit,
      offset,
    });

    return {
      success: true,
      data: results,
    };
  }

  /**
   * GET /seo-logs/top-crawled
   * Top URLs crawlées par les bots
   */
  @Get('top-crawled')
  async getTopCrawled(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const urls = await this.logIngestionService.getTopCrawledUrls(limit);
    return {
      success: true,
      data: urls,
    };
  }

  /**
   * GET /seo-logs/top-bots
   * Top bots qui crawlent le site
   */
  @Get('top-bots')
  async getTopBots(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const bots = await this.logIngestionService.getTopBots(limit);
    return {
      success: true,
      data: bots,
    };
  }

  /**
   * GET /seo-logs/errors
   * Erreurs 4xx/5xx récentes
   */
  @Get('errors')
  async getRecentErrors(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    const errors = await this.logIngestionService.getRecentErrors(limit);
    return {
      success: true,
      data: errors,
    };
  }

  /**
   * GET /seo-logs/stats
   * Statistiques de la dernière ingestion
   */
  @Get('stats')
  async getIngestionStats() {
    // Trigger manual ingestion et retourner stats
    const stats = await this.logIngestionService.ingestCaddyLogs();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /seo-logs/analytics/traffic
   * Dashboard analytics trafic e-commerce (brand, gamme, country, bots)
   */
  @Get('analytics/traffic')
  async getTrafficAnalytics(
    @Query('period') period?: 'today' | 'yesterday' | '7days' | '30days',
  ) {
    const analytics = await this.logIngestionService.getTrafficAnalytics(
      period || 'today',
    );
    return {
      success: true,
      data: analytics,
    };
  }

  /**
   * GET /seo-logs/analytics/slow-paths
   * Chemins lents (> seuil latence)
   */
  @Get('analytics/slow-paths')
  async getSlowPaths(
    @Query('threshold', new ParseIntPipe({ optional: true }))
    threshold = 800,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('day') day?: string,
  ) {
    const slowPaths = await this.logIngestionService.getSlowPaths(
      threshold,
      limit,
      day,
    );
    return {
      success: true,
      data: slowPaths,
    };
  }

  /**
   * GET /seo-logs/analytics/bot-hits
   * Liste des hits par bot
   */
  @Get('analytics/bot-hits')
  async getBotHits(
    @Query('bot') bot?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 100,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
  ) {
    const botHits = await this.logIngestionService.getBotHits(
      bot,
      limit,
      offset,
    );
    return {
      success: true,
      data: botHits,
    };
  }
}
