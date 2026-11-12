import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  SeoPilotageService,
  AutoDiagnosticsReport,
} from '../services/seo-pilotage.service';
import {
  WeeklyReport,
  MonthlyReport,
  formatWeeklySummary,
  formatMonthlySummary,
  ClusterHealthScore,
  ClusterHealthSummary,
} from '../types/seo-pilotage.types';

/**
 * Contrôleur API pour le Pilotage SEO
 *
 * Endpoints:
 * - GET /api/seo/pilotage/weekly - Rapport hebdomadaire
 * - GET /api/seo/pilotage/monthly - Rapport mensuel
 * - GET /api/seo/pilotage/diagnostics - Diagnostics automatiques
 * - GET /api/seo/pilotage/cluster/:gammeId/health - Score santé d'un cluster
 * - GET /api/seo/pilotage/clusters/health - Scores santé de tous les clusters
 */
@Controller('api/seo/pilotage')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class SeoPilotageController {
  private readonly logger = new Logger(SeoPilotageController.name);

  constructor(private readonly pilotageService: SeoPilotageService) {}

  /**
   * Rapport hebdomadaire SEO (30 min review)
   * GET /api/seo/pilotage/weekly
   */
  @Get('weekly')
  async getWeeklyReport(
    @Query('format') format?: 'json' | 'slack',
  ): Promise<WeeklyReport | { text: string }> {
    this.logger.log('📊 GET /api/seo/pilotage/weekly');

    const report = await this.pilotageService.generateWeeklyReport();

    if (format === 'slack') {
      return { text: formatWeeklySummary(report) };
    }

    return report;
  }

  /**
   * Rapport mensuel SEO (2-3h review)
   * GET /api/seo/pilotage/monthly
   */
  @Get('monthly')
  async getMonthlyReport(
    @Query('format') format?: 'json' | 'slack',
  ): Promise<MonthlyReport | { text: string }> {
    this.logger.log('📊 GET /api/seo/pilotage/monthly');

    const report = await this.pilotageService.generateMonthlyReport();

    if (format === 'slack') {
      return { text: formatMonthlySummary(report) };
    }

    return report;
  }

  /**
   * Diagnostics automatiques SEO
   * Détecte : pages conseil sans impressions, pages gamme contaminées,
   * pages référence sous-performantes
   * GET /api/seo/pilotage/diagnostics
   */
  @Get('diagnostics')
  async getAutoDiagnostics(): Promise<AutoDiagnosticsReport> {
    this.logger.log('🔍 GET /api/seo/pilotage/diagnostics');
    return this.pilotageService.generateAutoDiagnosticsReport();
  }

  /**
   * Diagnostic d'une URL spécifique
   * GET /api/seo/pilotage/diagnose?url=/pieces/freinage-1.html
   */
  @Get('diagnose')
  async diagnoseUrl(@Query('url') url: string): Promise<{
    url: string;
    diagnostics: Awaited<ReturnType<SeoPilotageService['diagnoseUrl']>>;
  }> {
    this.logger.log(`🔍 GET /api/seo/pilotage/diagnose?url=${url}`);

    if (!url) {
      return { url: '', diagnostics: [] };
    }

    const diagnostics = await this.pilotageService.diagnoseUrl(url);
    return { url, diagnostics };
  }

  /**
   * Score santé d'un cluster spécifique (gamme)
   * GET /api/seo/pilotage/cluster/:gammeId/health
   *
   * Note: Phase 3.6 - à implémenter dans SeoPilotageService
   */
  @Get('cluster/:gammeId/health')
  async getClusterHealth(
    @Param('gammeId') gammeId: string,
  ): Promise<ClusterHealthScore | { message: string }> {
    this.logger.log(`📊 GET /api/seo/pilotage/cluster/${gammeId}/health`);

    // TODO: Implémenter calculateClusterHealth() dans SeoPilotageService
    // Pour l'instant, retourner un placeholder
    return {
      message: `Cluster health pour gamme ${gammeId} - À implémenter avec intégration GSC`,
    };
  }

  /**
   * Scores santé de tous les clusters (top critiques)
   * GET /api/seo/pilotage/clusters/health?limit=20&sort=score
   *
   * Note: Phase 3.6 - à implémenter dans SeoPilotageService
   */
  @Get('clusters/health')
  async getAllClustersHealth(
    @Query('limit') limit = '20',
    @Query('sort') sort: 'score' | 'impressions' = 'score',
  ): Promise<ClusterHealthSummary | { message: string }> {
    this.logger.log(
      `📊 GET /api/seo/pilotage/clusters/health?limit=${limit}&sort=${sort}`,
    );

    // TODO: Implémenter calculateAllClustersHealth() dans SeoPilotageService
    // Pour l'instant, retourner un placeholder
    return {
      message: `Santé de tous les clusters - À implémenter avec intégration GSC`,
    };
  }

  /**
   * Résumé rapide pour dashboard
   * GET /api/seo/pilotage/summary
   */
  @Get('summary')
  async getSummary(): Promise<{
    weekly: {
      health: string;
      alertsCount: number;
      indexationErrorsCount: number;
    };
    diagnostics: {
      totalCount: number;
      criticalCount: number;
    };
    generatedAt: Date;
  }> {
    this.logger.log('📊 GET /api/seo/pilotage/summary');

    const [weeklyReport, diagnosticsReport] = await Promise.all([
      this.pilotageService.generateWeeklyReport(),
      this.pilotageService.generateAutoDiagnosticsReport(),
    ]);

    return {
      weekly: {
        health: weeklyReport.summary.health,
        alertsCount: weeklyReport.alerts.length,
        indexationErrorsCount: weeklyReport.indexationErrors.length,
      },
      diagnostics: {
        totalCount: diagnosticsReport.totalDiagnostics,
        criticalCount: diagnosticsReport.bySeverity.critical,
      },
      generatedAt: new Date(),
    };
  }
}
