/**
 * SEO COCKPIT CONTROLLER - Point d'entree unifie SEO Admin
 *
 * Consolidation de:
 * - /api/seo/dashboard (SeoDashboardController) - Risk flags
 * - /seo-logs/kpi (SeoKpiController) - Crawl KPIs Loki
 *
 * Structure unifiee:
 * - GET /api/admin/seo-cockpit/dashboard - KPIs unifies
 * - GET /api/admin/seo-cockpit/monitoring/* - Crawl + Index + Alerts
 * - GET /api/admin/seo-cockpit/content/* - R4 + R5 + Blog stats
 * - GET /api/admin/seo-cockpit/audit/* - Historique unifie
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Logger,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import type { AdminApiResponse } from '@repo/database-types';
import { SeoCockpitService } from '../services/seo-cockpit.service';

@Controller('api/admin/seo-cockpit')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class SeoCockpitController {
  private readonly logger = new Logger(SeoCockpitController.name);

  constructor(private readonly seoCockpitService: SeoCockpitService) {}

  // ============================================================
  // DASHBOARD UNIFIE
  // ============================================================

  @Get('dashboard')
  async getDashboard(): Promise<AdminApiResponse<unknown>> {
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
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  @Get('summary')
  async getSummary(): Promise<AdminApiResponse<unknown>> {
    try {
      const summary = await this.seoCockpitService.getExecutiveSummary();
      return {
        success: true,
        data: summary,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error(
        `Summary error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve summary',
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  // ============================================================
  // MONITORING (Crawl + Index + Alerts)
  // ============================================================

  @Get('monitoring/crawl')
  async getCrawlActivity(
    @Query('days') days?: string,
  ): Promise<AdminApiResponse<unknown>> {
    try {
      const parsedDays = Math.min(parseInt(days || '30', 10), 90);
      const activity =
        await this.seoCockpitService.getCrawlActivity(parsedDays);
      return {
        success: true,
        data: activity,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error(
        `Crawl activity error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve crawl activity',
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  @Get('monitoring/index')
  async getIndexChanges(
    @Query('limit') limit?: string,
  ): Promise<AdminApiResponse<unknown>> {
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
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  @Get('monitoring/alerts')
  async getAlerts(
    @Query('limit') limit?: string,
  ): Promise<AdminApiResponse<unknown>> {
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
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  @Get('monitoring/at-risk')
  async getUrlsAtRisk(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AdminApiResponse<unknown>> {
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
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  // ============================================================
  // CONTENT STATS (R4 + R5 + Blog)
  // ============================================================

  @Get('content/stats')
  async getContentStats(): Promise<AdminApiResponse<unknown>> {
    try {
      const stats = await this.seoCockpitService.getContentStats();
      return {
        success: true,
        data: stats,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error(
        `Content stats error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve content stats',
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  // ============================================================
  // AUDIT UNIFIE
  // ============================================================

  @Get('audit/history')
  async getAuditHistory(
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ): Promise<AdminApiResponse<unknown>> {
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
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  @Get('audit/stats')
  async getAuditStats(): Promise<AdminApiResponse<unknown>> {
    try {
      const stats = await this.seoCockpitService.getAuditStats();
      return {
        success: true,
        data: stats,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error(
        `Audit stats error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to retrieve audit stats',
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  @Post('actions/refresh-risks')
  async refreshRisks(): Promise<AdminApiResponse<unknown>> {
    try {
      this.logger.log('Manual risk flags refresh requested via cockpit');
      const result = await this.seoCockpitService.refreshAllRisks();
      return {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error(
        `Refresh risks error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to refresh risks',
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }

  @Post('actions/trigger-monitor')
  async triggerMonitor(): Promise<AdminApiResponse<unknown>> {
    try {
      this.logger.log('Manual SEO monitor triggered via cockpit');
      const result = await this.seoCockpitService.triggerMonitor();
      return {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error(
        `Trigger monitor error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        success: false,
        error: 'Failed to trigger monitor',
        meta: { timestamp: new Date().toISOString() },
      };
    }
  }
}
