/**
 * 🎯 SEO COCKPIT CONTROLLER - Point d'entrée unifié SEO Admin
 *
 * Consolidation de:
 * - /api/seo/dashboard (SeoDashboardController) - Risk flags
 * - /seo-logs/kpi (SeoKpiController) - Crawl KPIs Loki
 *
 * Structure unifiée:
 * - GET /api/admin/seo-cockpit/dashboard - KPIs unifiés
 * - GET /api/admin/seo-cockpit/monitoring/* - Crawl + Index + Alerts
 * - GET /api/admin/seo-cockpit/content/* - R4 + R5 + Blog stats
 * - GET /api/admin/seo-cockpit/audit/* - Historique unifié
 */

import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { SeoCockpitService } from '../services/seo-cockpit.service';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    timestamp?: string;
    sources?: string[];
  };
}

@Controller('api/admin/seo-cockpit')
export class SeoCockpitController {
  private readonly logger = new Logger(SeoCockpitController.name);

  constructor(private readonly seoCockpitService: SeoCockpitService) {}

  // ============================================================
  // DASHBOARD UNIFIÉ
  // ============================================================

  /**
   * 📊 GET /api/admin/seo-cockpit/dashboard
   * Dashboard unifié avec KPIs de toutes les sources
   */
  @Get('dashboard')
  async getDashboard(): Promise<ApiResponse<any>> {
    try {
      const dashboard = await this.seoCockpitService.getUnifiedDashboard();

      return {
        success: true,
        data: dashboard,
        meta: {
          timestamp: new Date().toISOString(),
          sources: ['queue-monitor', 'risk-flags', 'crawl-stats'],
        },
      };
    } catch (error) {
      this.logger.error(
        `Dashboard error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve unified dashboard',
      };
    }
  }

  /**
   * 📈 GET /api/admin/seo-cockpit/summary
   * Résumé exécutif pour affichage rapide (status global)
   */
  @Get('summary')
  async getSummary(): Promise<ApiResponse<any>> {
    try {
      const summary = await this.seoCockpitService.getExecutiveSummary();

      return {
        success: true,
        data: summary,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Summary error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve summary',
      };
    }
  }

  // ============================================================
  // MONITORING (Crawl + Index + Alerts)
  // ============================================================

  /**
   * 🤖 GET /api/admin/seo-cockpit/monitoring/crawl
   * Activité de crawl consolidée
   */
  @Get('monitoring/crawl')
  async getCrawlActivity(
    @Query('days') days?: string,
  ): Promise<ApiResponse<any>> {
    try {
      const parsedDays = Math.min(parseInt(days || '30', 10), 90);
      const activity =
        await this.seoCockpitService.getCrawlActivity(parsedDays);

      return {
        success: true,
        data: activity,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Crawl activity error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve crawl activity',
      };
    }
  }

  /**
   * 📑 GET /api/admin/seo-cockpit/monitoring/index
   * Changements d'indexation récents
   */
  @Get('monitoring/index')
  async getIndexChanges(
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    try {
      const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);
      const changes = await this.seoCockpitService.getIndexChanges(parsedLimit);

      return {
        success: true,
        data: changes,
        meta: {
          total: changes.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Index changes error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve index changes',
      };
    }
  }

  /**
   * ⚠️ GET /api/admin/seo-cockpit/monitoring/alerts
   * Alertes consolidées (risk flags + interpolation + queue errors)
   */
  @Get('monitoring/alerts')
  async getAlerts(@Query('limit') limit?: string): Promise<ApiResponse<any>> {
    try {
      const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);
      const alerts =
        await this.seoCockpitService.getConsolidatedAlerts(parsedLimit);

      return {
        success: true,
        data: alerts,
        meta: {
          total: alerts.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Alerts error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve alerts',
      };
    }
  }

  /**
   * 🔍 GET /api/admin/seo-cockpit/monitoring/at-risk
   * URLs à risque triées par urgency_score
   */
  @Get('monitoring/at-risk')
  async getUrlsAtRisk(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ApiResponse<any>> {
    try {
      const parsedLimit = Math.min(parseInt(limit || '100', 10), 500);
      const parsedOffset = parseInt(offset || '0', 10);

      const urls = await this.seoCockpitService.getUrlsAtRisk(
        parsedLimit,
        parsedOffset,
      );

      return {
        success: true,
        data: urls,
        meta: {
          total: urls.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `URLs at risk error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve URLs at risk',
      };
    }
  }

  // ============================================================
  // CONTENT STATS (R4 + R5 + Blog)
  // ============================================================

  /**
   * 📝 GET /api/admin/seo-cockpit/content/stats
   * Stats de contenu SEO (R4 References, R5 Diagnostics, Blog)
   */
  @Get('content/stats')
  async getContentStats(): Promise<ApiResponse<any>> {
    try {
      const stats = await this.seoCockpitService.getContentStats();

      return {
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Content stats error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve content stats',
      };
    }
  }

  // ============================================================
  // AUDIT UNIFIÉ
  // ============================================================

  /**
   * 📜 GET /api/admin/seo-cockpit/audit/history
   * Historique d'audit unifié (gammes + sitemap + preview)
   */
  @Get('audit/history')
  async getAuditHistory(
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ): Promise<ApiResponse<any>> {
    try {
      const parsedLimit = Math.min(parseInt(limit || '50', 10), 200);
      const history = await this.seoCockpitService.getAuditHistory(
        parsedLimit,
        type,
      );

      return {
        success: true,
        data: history,
        meta: {
          total: history.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Audit history error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve audit history',
      };
    }
  }

  /**
   * 📊 GET /api/admin/seo-cockpit/audit/stats
   * Stats d'audit (actions/jour, par admin)
   */
  @Get('audit/stats')
  async getAuditStats(): Promise<ApiResponse<any>> {
    try {
      const stats = await this.seoCockpitService.getAuditStats();

      return {
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Audit stats error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve audit stats',
      };
    }
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  /**
   * 🔄 POST /api/admin/seo-cockpit/actions/refresh-risks
   * Recalculer tous les risk flags
   */
  @Post('actions/refresh-risks')
  async refreshRisks(): Promise<ApiResponse<any>> {
    try {
      this.logger.log('Manual risk flags refresh requested via cockpit');
      const result = await this.seoCockpitService.refreshAllRisks();

      return {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Refresh risks error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to refresh risks',
      };
    }
  }

  /**
   * 🔄 POST /api/admin/seo-cockpit/actions/trigger-monitor
   * Déclencher manuellement le monitoring SEO
   */
  @Post('actions/trigger-monitor')
  async triggerMonitor(): Promise<ApiResponse<any>> {
    try {
      this.logger.log('Manual SEO monitor triggered via cockpit');
      const result = await this.seoCockpitService.triggerMonitor();

      return {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Trigger monitor error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to trigger monitor',
      };
    }
  }
}
