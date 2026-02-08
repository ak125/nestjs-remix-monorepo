import {
  Controller,
  Get,
  Logger,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SystemService } from './services/system.service';
import { MetricsService } from './services/metrics.service';
import { DatabaseMonitorService } from './services/database-monitor.service';
import { HealthCheckService } from './services/health-check.service';
import { IsAdminGuard } from '../../auth/is-admin.guard';
import { getErrorMessage } from '../../common/utils/error.utils';

@Controller('system')
@UseGuards(IsAdminGuard)
export class SystemController {
  private readonly logger = new Logger(SystemController.name);

  constructor(
    private readonly systemService: SystemService,
    private readonly metricsService: MetricsService,
    private readonly databaseMonitorService: DatabaseMonitorService,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  /**
   * ⚡ GET /api/system/health/quick
   * Health check rapide pour load balancers
   */
  @Get('health/quick')
  async quickHealthCheck() {
    try {
      const health = await this.healthCheckService.quickHealthCheck();
      return {
        success: true,
        ...health,
      };
    } catch (error) {
      this.logger.error('❌ Quick health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  }

  /**
   * 🏥 GET /api/system/health/detailed
   * Health check complet du système
   */
  @Get('health/detailed')
  async detailedHealthCheck() {
    try {
      this.logger.log('🏥 Detailed health check requested');
      const health = await this.healthCheckService.performHealthCheck();

      this.logger.log(
        `💚 Health check completed - Overall: ${health.overall} (${health.services.length} services)`,
      );

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      this.logger.error('❌ Detailed health check failed:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 GET /api/system/status
   * État général du système
   */
  @Get('status')
  async getSystemStatus() {
    try {
      this.logger.log('📊 System status requested');
      const status = await this.systemService.getSystemStatus();

      this.logger.log(
        `✅ System status: ${status.overall} (${status.alerts.length} alerts)`,
      );
      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting system status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📈 GET /api/system/metrics
   * Métriques détaillées
   */
  @Get('metrics')
  async getSystemMetrics() {
    try {
      this.logger.log('📈 System metrics requested');
      const metrics = await this.metricsService.getAllMetrics();

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting system metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🏥 GET /api/system/health
   * Santé de la base de données
   */
  @Get('health')
  async getDatabaseHealth() {
    try {
      this.logger.log('🏥 Database health check requested');
      const health = await this.databaseMonitorService.getHealthReport();

      this.logger.log(`💚 Database health: ${health.database.status}`);
      return {
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error checking database health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧠 GET /api/system/insights
   * Insights et recommandations
   */
  @Get('insights')
  async getSystemInsights() {
    try {
      this.logger.log('🧠 System insights requested');
      const insights = await this.systemService.getSystemInsights();

      this.logger.log(
        `💡 Generated ${insights.recommendations.length} recommendations`,
      );
      return {
        success: true,
        data: insights,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting system insights:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 GET /api/system/dashboard
   * Dashboard complet de monitoring
   */
  @Get('dashboard')
  async getMonitoringDashboard() {
    try {
      this.logger.log('📊 Monitoring dashboard requested');
      const dashboard = await this.systemService.getMonitoringDashboard();

      this.logger.log(
        `📊 Dashboard generated - Status: ${dashboard.system.overall}`,
      );
      return {
        success: true,
        data: dashboard,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error building monitoring dashboard:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * ⚠️ GET /api/system/alerts
   * Alertes actives
   */
  @Get('alerts')
  async getActiveAlerts() {
    try {
      this.logger.log('⚠️ Active alerts requested');
      const alerts = this.databaseMonitorService.getActiveAlerts();

      const criticalCount = alerts.filter((a) => a.level === 'critical').length;
      const warningCount = alerts.filter((a) => a.level === 'warning').length;

      this.logger.log(
        `🚨 Active alerts: ${criticalCount} critical, ${warningCount} warning, ${alerts.length} total`,
      );

      return {
        success: true,
        data: {
          alerts,
          summary: {
            total: alerts.length,
            critical: criticalCount,
            warning: warningCount,
            info: alerts.filter((a) => a.level === 'info').length,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting active alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔧 POST /api/system/maintenance
   * Exécuter les tâches de maintenance
   */
  @Post('maintenance')
  async performMaintenance() {
    try {
      this.logger.log('🔧 Manual maintenance requested');
      const result = await this.systemService.performMaintenanceTasks();

      this.logger.log(
        `🛠️ Maintenance completed: ${result.executed.length} tasks executed, ${result.failed.length} failed`,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error performing maintenance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 GET /api/system/performance/:table
   * Performance d'une table spécifique
   */
  @Get('performance/:table')
  async getTablePerformance(@Param('table') tableName: string) {
    try {
      this.logger.log(`🔍 Table performance requested for: ${tableName}`);

      // Valider le nom de table pour la sécurité
      const allowedTables = [
        '___xtr_customer',
        '___xtr_order',
        '___xtr_product',
        '__sitemap_p_link',
        '___META_TAGS_ARIANE',
      ];

      if (!allowedTables.includes(tableName)) {
        return {
          success: false,
          error: 'Table not allowed for monitoring',
          timestamp: new Date().toISOString(),
        };
      }

      const performance =
        await this.databaseMonitorService.monitorTablePerformance(tableName);

      this.logger.log(
        `📊 Table ${tableName} performance: ${performance.queryTime}ms, ${performance.recordCount} records`,
      );

      return {
        success: true,
        data: performance,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting table performance for ${tableName}:`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
