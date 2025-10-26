import { Controller, Get, Post, Body } from '@nestjs/common';
import { SeoMonitoringService } from '../services/seo-monitoring.service';

@Controller('seo-monitoring')
export class SeoMonitoringController {
  constructor(private readonly monitoringService: SeoMonitoringService) {}

  /**
   * GET /seo-monitoring/report
   * Obtenir le rapport de monitoring actuel
   */
  @Get('report')
  async getMonitoringReport() {
    const report = await this.monitoringService.getCurrentReport();
    return {
      success: true,
      data: report,
    };
  }

  /**
   * GET /seo-monitoring/sitemaps/verify
   * Vérifier que tous les sitemaps sont accessibles
   */
  @Get('sitemaps/verify')
  async verifySitemaps() {
    const result = await this.monitoringService.verifySitemapsAccessibility();
    return {
      success: true,
      data: result,
      message: `${result.accessible} sitemaps accessibles, ${result.failed.length} échecs`,
    };
  }

  /**
   * POST /seo-monitoring/sitemaps/submit
   * Soumettre un sitemap spécifique à Search Console
   */
  @Post('sitemaps/submit')
  async submitSitemap(@Body('url') url: string) {
    const success =
      await this.monitoringService.submitSitemapToSearchConsole(url);
    return {
      success,
      message: success
        ? `Sitemap ${url} soumis avec succès`
        : `Échec soumission sitemap ${url}`,
    };
  }

  /**
   * POST /seo-monitoring/sitemaps/submit-all
   * Soumettre tous les sitemaps à Search Console
   */
  @Post('sitemaps/submit-all')
  async submitAllSitemaps() {
    await this.monitoringService.submitAllSitemaps();
    return {
      success: true,
      message: 'Tous les sitemaps ont été soumis',
    };
  }
}
