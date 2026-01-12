import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpStatus,
  HttpCode,
  PreconditionFailedException,
  UseGuards,
} from '@nestjs/common';
import { ErrorService } from '../services/error.service';
import { RedirectService } from '../services/redirect.service';
import { ErrorLogService } from '../services/error-log.service';
import { IsAdminGuard } from '../../../auth/is-admin.guard';

@Controller('api/errors')
export class ErrorController {
  constructor(
    private readonly errorService: ErrorService,
    private readonly redirectService: RedirectService,
    private readonly errorLogService: ErrorLogService,
  ) {}

  /**
   * Récupère la liste des erreurs avec pagination
   */
  @Get()
  async getErrors(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: string,
  ) {
    const options = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      severity,
      resolved:
        resolved === 'true' ? true : resolved === 'false' ? false : undefined,
    };

    return this.errorService.getErrors(options);
  }

  /**
   * Récupère les métriques d'erreurs
   */
  @Get('metrics')
  async getMetrics(@Query('period') period?: '24h' | '7d' | '30d') {
    return this.errorService.getErrorMetrics(period || '24h');
  }

  /**
   * 🔒 Dashboard Admin - Erreurs 400/404/500 agrégées par URL
   * Endpoint sécurisé pour monitoring des erreurs en temps réel
   */
  @Get('admin/dashboard')
  @UseGuards(IsAdminGuard)
  async getAdminDashboard(@Query('hours') hours?: string) {
    const hoursNum = hours ? parseInt(hours, 10) : 24;
    const recentErrors = await this.errorLogService.getRecentErrors(500);

    // Filtrer par période
    const cutoffTime = Date.now() - hoursNum * 3600000;
    const filteredErrors = recentErrors.filter(
      (err: any) => new Date(err.created_at).getTime() > cutoffTime,
    );

    // Agréger par code et URL
    const stats: Record<
      string,
      { error_code: string; url: string; count: number; last_seen: string }
    > = {};

    for (const err of filteredErrors) {
      const code = err.error_code?.toString() || 'unknown';
      const url = err.url || 'unknown';
      const key = `${code}:${url}`;

      if (!stats[key]) {
        stats[key] = {
          error_code: code,
          url,
          count: 0,
          last_seen: err.created_at,
        };
      }
      stats[key].count++;
      if (new Date(err.created_at) > new Date(stats[key].last_seen)) {
        stats[key].last_seen = err.created_at;
      }
    }

    // Compter par code
    const byCode = filteredErrors.reduce(
      (acc: Record<string, number>, err: any) => {
        const code = err.error_code?.toString() || 'unknown';
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      },
      {},
    );

    return {
      period_hours: hoursNum,
      total: filteredErrors.length,
      by_code: byCode,
      top_urls: Object.values(stats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  }

  /**
   * Récupère le rapport des erreurs fréquentes
   */
  @Get('frequent')
  async getFrequentErrors() {
    return this.errorService.getFrequentErrorsReport();
  }

  /**
   * Marque une erreur comme résolue
   */
  @Put(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveError(
    @Param('id') id: string,
    @Body('resolved_by') resolvedBy: string,
  ) {
    const success = await this.errorService.resolveError(id, resolvedBy);
    return { success };
  }

  /**
   * Récupère toutes les règles de redirection
   */
  @Get('redirects')
  async getRedirects() {
    return this.redirectService.getAllRedirectRules();
  }

  /**
   * Crée une nouvelle règle de redirection
   */
  @Post('redirects')
  async createRedirect(@Body() redirectData: any) {
    return this.redirectService.createRedirectRule(redirectData);
  }

  /**
   * Met à jour une règle de redirection
   */
  @Put('redirects/:id')
  async updateRedirect(@Param('id') id: string, @Body() updates: any) {
    const success = await this.redirectService.updateRedirectRule(id, updates);
    return { success };
  }

  /**
   * Supprime une règle de redirection
   */
  @Delete('redirects/:id')
  async deleteRedirect(@Param('id') id: string) {
    const success = await this.redirectService.deleteRedirectRule(id);
    return { success };
  }

  /**
   * Récupère les statistiques de redirection
   */
  @Get('redirects/stats')
  async getRedirectStats() {
    return this.redirectService.getRedirectStats();
  }

  /**
   * Nettoie les anciens logs d'erreur
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupLogs(@Body('retention_days') retentionDays?: number) {
    const deletedCount = await this.errorLogService.cleanupOldLogs(
      retentionDays || 90,
    );
    return { deleted_count: deletedCount };
  }

  /**
   * Test une règle de redirection
   */
  @Post('redirects/test')
  async testRedirect(@Body('path') path: string) {
    const redirect = await this.redirectService.findRedirect(path);
    return {
      has_redirect: !!redirect,
      redirect: redirect || null,
    };
  }

  /**
   * Endpoint de test pour déclencher une erreur 412
   */
  @Get('test/412')
  async test412(
    @Query('condition') condition?: string,
    @Query('requirement') requirement?: string,
  ) {
    throw new PreconditionFailedException({
      message: 'Test de condition préalable échouée',
      condition: condition || 'Version du cache obsolète',
      requirement: requirement || 'ETag correspondant requis',
    });
  }

  /**
   * Endpoint de test pour valider la détection des anciens formats
   */
  @Get('test/old-link-detection/:path')
  async testOldLinkDetection(@Param('path') path: string) {
    // Import du GlobalErrorFilter pour tester la méthode
    const patterns = [
      /^\/old-format-/i,
      /^\/legacy-/i,
      /^\/v1\//i,
      /^\/v2\//i,
      /\.php$/i,
      /\.asp$/i,
      /\.jsp$/i,
      /\/index\.html?$/i,
      /\/default\.html?$/i,
      /^\/app\//i,
      /^\/old\//i,
      /^\/archive\//i,
      /\/product-(\d+)\.html$/i,
      /\/category-(\d+)\.html$/i,
      /\/page-(\d+)\.html$/i,
      /\?id=\d+/,
      /\/content\.php/i,
      /\/show\.php/i,
    ];

    const testPath = `/${path}`;
    const detectedPatterns = patterns
      .map((pattern, index) => ({
        index,
        pattern: pattern.toString(),
        matches: pattern.test(testPath),
      }))
      .filter((result) => result.matches);

    return {
      path: testPath,
      isOldLink: detectedPatterns.length > 0,
      matchedPatterns: detectedPatterns,
      allPatterns: patterns.map((p, i) => ({
        index: i,
        pattern: p.toString(),
      })),
    };
  }
}
