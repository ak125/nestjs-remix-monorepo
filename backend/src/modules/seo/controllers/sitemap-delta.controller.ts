/**
 * 🔄 CONTRÔLEUR SITEMAP DELTA
 * Endpoints pour gérer le diff journalier et sitemap-latest.xml
 */

import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { SitemapDeltaService } from '../services/sitemap-delta.service';

@Controller('sitemap-v2/delta')
export class SitemapDeltaController {
  private readonly logger = new Logger(SitemapDeltaController.name);

  constructor(private readonly deltaService: SitemapDeltaService) {
    this.logger.log('🔄 SitemapDeltaController initialized');
  }

  /**
   * GET /sitemap-v2/delta/latest.xml
   * Génère sitemap-latest.xml depuis le delta d'aujourd'hui
   */
  @Get('latest.xml')
  async getLatestSitemap() {
    this.logger.log('📥 Request: sitemap-latest.xml');

    const xml = await this.deltaService.generateLatestSitemap();

    if (!xml) {
      return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <!-- No changes today -->\n</urlset>';
    }

    return xml;
  }

  /**
   * GET /sitemap-v2/delta/stats
   * Obtenir les statistiques du delta d'aujourd'hui
   */
  @Get('stats')
  async getDeltaStats() {
    this.logger.log('📊 Request: delta stats');

    const stats = await this.deltaService.getDeltaStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /sitemap-v2/delta/stats/:date
   * Obtenir les statistiques d'une date spécifique (YYYY-MM-DD)
   */
  @Get('stats/:date')
  async getDeltaStatsByDate(@Param('date') date: string) {
    this.logger.log(`📊 Request: delta stats for ${date}`);

    const stats = await this.deltaService.getDeltaStats(date);

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /sitemap-v2/delta/:date/urls
   * Obtenir toutes les URLs du delta d'une date spécifique
   */
  @Get(':date/urls')
  async getDeltaUrls(@Param('date') date: string) {
    this.logger.log(`📋 Request: delta URLs for ${date}`);

    const urls = await this.deltaService.getDeltaByDate(date);

    return {
      success: true,
      date,
      count: urls.length,
      urls,
    };
  }

  /**
   * POST /sitemap-v2/delta/generate
   * Déclencher manuellement la génération de sitemap-latest.xml
   */
  @Post('generate')
  async triggerGeneration() {
    this.logger.log('🔄 Manual trigger: delta sitemap generation');

    await this.deltaService.nightlyDeltaGeneration();

    return {
      success: true,
      message: 'Delta sitemap generation triggered',
    };
  }

  /**
   * POST /sitemap-v2/delta/cleanup
   * Nettoyer les deltas expirés
   */
  @Post('cleanup')
  async cleanupExpired() {
    this.logger.log('🧹 Manual trigger: cleanup expired deltas');

    const deleted = await this.deltaService.cleanupExpiredDeltas();

    return {
      success: true,
      message: `Cleaned up ${deleted} expired deltas`,
      deleted,
    };
  }

  /**
   * GET /sitemap-v2/delta/config
   * Obtenir la configuration actuelle du système de delta
   */
  @Get('config')
  async getConfig() {
    const config = this.deltaService.getConfig();

    return {
      success: true,
      config,
    };
  }
}
