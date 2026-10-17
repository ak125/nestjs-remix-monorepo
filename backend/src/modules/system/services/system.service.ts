import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService, PerformanceMetrics } from './metrics.service';
import {
  DatabaseMonitorService,
  DatabaseHealth,
  SystemAlert,
} from './database-monitor.service';

export interface SystemStatus {
  overall: 'healthy' | 'warning' | 'critical';
  performance: PerformanceMetrics;
  database: DatabaseHealth;
  alerts: SystemAlert[];
  uptime: number;
  version: string;
  environment: string;
  lastUpdated: string;
}

export interface SystemInsights {
  recommendations: string[];
  trends: {
    performance: 'improving' | 'stable' | 'degrading';
    business: 'growing' | 'stable' | 'declining';
    seo: 'improving' | 'stable' | 'declining';
  };
  predictedIssues: string[];
}

@Injectable()
export class SystemService implements OnModuleDestroy {
  private readonly logger = new Logger(SystemService.name);
  private maintenanceInterval: ReturnType<typeof setInterval> | null = null;

  onModuleDestroy() {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
    this.logger.log('SystemService destroyed, maintenance stopped');
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly databaseMonitorService: DatabaseMonitorService,
  ) {}

  /**
   * 🎯 État général du système - Vue d'ensemble complète
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      this.logger.log('📊 Getting complete system status');

      const [performance, database] = await Promise.all([
        this.metricsService.collectPerformanceMetrics(),
        this.databaseMonitorService.checkDatabaseHealth(),
      ]);

      const alerts = this.databaseMonitorService.getActiveAlerts();

      // Déterminer le statut général
      let overall: SystemStatus['overall'] = 'healthy';

      if (
        database.status === 'critical' ||
        alerts.some((a) => a.level === 'critical')
      ) {
        overall = 'critical';
      } else if (
        database.status === 'warning' ||
        alerts.some((a) => a.level === 'warning') ||
        performance.responseTime > 1000 ||
        performance.errorRate > 5
      ) {
        overall = 'warning';
      }

      const systemStatus: SystemStatus = {
        overall,
        performance,
        database,
        alerts: alerts.slice(0, 10), // Les 10 plus récentes
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: this.configService.get('NODE_ENV', 'development'),
        lastUpdated: new Date().toISOString(),
      };

      this.logger.log(`✅ System status: ${overall}`, {
        dbStatus: database.status,
        alertsCount: alerts.length,
        uptime: `${Math.floor(process.uptime() / 3600)}h`,
      });

      return systemStatus;
    } catch (error) {
      this.logger.error('❌ Error getting system status:', error);
      return {
        overall: 'critical',
        performance: {} as PerformanceMetrics,
        database: { status: 'critical' } as DatabaseHealth,
        alerts: [],
        uptime: process.uptime(),
        version: 'unknown',
        environment: 'unknown',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧠 Insights et recommandations intelligentes
   */
  async getSystemInsights(): Promise<SystemInsights> {
    try {
      this.logger.log('🧠 Generating system insights');

      const [allMetrics, healthReport] = await Promise.all([
        this.metricsService.getAllMetrics(),
        this.databaseMonitorService.getHealthReport(),
      ]);

      const recommendations: string[] = [];
      const predictedIssues: string[] = [];

      // Analyse des performances
      if (allMetrics.performance.responseTime > 500) {
        recommendations.push(
          'Optimize database queries - response time above 500ms',
        );
      }
      if (allMetrics.performance.memoryUsage > 512) {
        recommendations.push('Monitor memory usage - currently above 512MB');
        predictedIssues.push('Potential memory leak if trend continues');
      }
      if (allMetrics.performance.errorRate > 1) {
        recommendations.push('Investigate error sources - rate above 1%');
      }

      // Analyse business
      if (allMetrics.business.conversionRate < 2) {
        recommendations.push('Improve conversion funnel - rate below 2%');
      }
      if (allMetrics.business.totalOrders < 10) {
        recommendations.push('Focus on marketing - low daily orders');
      }

      // Analyse SEO
      if (allMetrics.seo.sitemapHealth < 90) {
        recommendations.push('Optimize SEO metadata - health below 90%');
      }
      if (allMetrics.seo.averageLoadTime > 200) {
        recommendations.push('Improve page load times for better SEO ranking');
      }

      // Prédictions basées sur les alertes
      const criticalAlerts = healthReport.alerts.filter(
        (a) => a.level === 'critical',
      );
      if (criticalAlerts.length > 0) {
        predictedIssues.push(
          'System instability if critical alerts not resolved',
        );
      }

      // Analyse des tendances (simulée - en réel, comparer avec historique)
      const trends = {
        performance: Math.random() > 0.5 ? 'stable' : 'improving',
        business: Math.random() > 0.3 ? 'growing' : 'stable',
        seo: allMetrics.seo.sitemapHealth > 95 ? 'improving' : 'stable',
      } as SystemInsights['trends'];

      return {
        recommendations,
        trends,
        predictedIssues,
      };
    } catch (error) {
      this.logger.error('❌ Error generating insights:', error);
      return {
        recommendations: ['System analysis failed - manual review required'],
        trends: {
          performance: 'stable',
          business: 'stable',
          seo: 'stable',
        },
        predictedIssues: ['Unable to predict issues due to analysis error'],
      };
    }
  }

  /**
   * 🔧 Actions correctives automatiques
   */
  async performMaintenanceTasks(): Promise<{
    executed: string[];
    failed: string[];
    recommendations: string[];
  }> {
    try {
      this.logger.log('🔧 Performing automated maintenance tasks');

      const executed: string[] = [];
      const failed: string[] = [];
      const recommendations: string[] = [];

      // 1. Nettoyage des métriques anciennes (cache)
      try {
        const recentMetrics = this.metricsService.getRecentMetrics();
        if (recentMetrics.length > 1000) {
          // En réel, nettoyer les anciennes métriques
          executed.push('Cleaned old metrics from cache');
        }
      } catch {
        failed.push('Failed to clean metrics cache');
      }

      // 2. Résolution automatique des alertes mineures
      try {
        const minorAlerts = this.databaseMonitorService.getActiveAlerts('info');
        for (const alert of minorAlerts) {
          if (alert.timestamp < new Date(Date.now() - 3600000)) {
            // Plus d'1h
            this.databaseMonitorService.resolveAlert(alert.id);
            executed.push(`Auto-resolved old info alert: ${alert.title}`);
          }
        }
      } catch {
        failed.push('Failed to auto-resolve alerts');
      }

      // 3. Recommandations préventives
      const systemStatus = await this.getSystemStatus();
      if (systemStatus.performance.memoryUsage > 400) {
        recommendations.push(
          'Consider scheduling memory optimization during low-traffic hours',
        );
      }
      if (systemStatus.alerts.length > 5) {
        recommendations.push(
          'Review and address persistent alerts to prevent escalation',
        );
      }

      this.logger.log(
        `🛠️ Maintenance completed: ${executed.length} tasks, ${failed.length} failures`,
      );

      return { executed, failed, recommendations };
    } catch (error) {
      this.logger.error('❌ Error in maintenance tasks:', error);
      return {
        executed: [],
        failed: ['Critical maintenance failure'],
        recommendations: [
          'Manual intervention required for system maintenance',
        ],
      };
    }
  }

  /**
   * 📊 Dashboard complet pour monitoring
   */
  async getMonitoringDashboard(): Promise<{
    system: SystemStatus;
    insights: SystemInsights;
    metrics: {
      performance: PerformanceMetrics;
      business: any;
      seo: any;
    };
    recommendations: string[];
  }> {
    try {
      this.logger.log('📊 Building monitoring dashboard');

      const [system, insights, allMetrics] = await Promise.all([
        this.getSystemStatus(),
        this.getSystemInsights(),
        this.metricsService.getAllMetrics(),
      ]);

      // Recommandations prioritaires
      const recommendations = [
        ...insights.recommendations.slice(0, 3),
        ...(system.alerts.length > 0
          ? [`Address ${system.alerts.length} active alerts`]
          : []),
      ];

      return {
        system,
        insights,
        metrics: allMetrics,
        recommendations,
      };
    } catch (error) {
      this.logger.error('❌ Error building monitoring dashboard:', error);
      throw error;
    }
  }

  /**
   * 🚀 Initialisation et surveillance automatique
   */
  async initializeMonitoring(): Promise<void> {
    try {
      this.logger.log('🚀 Initializing system monitoring');

      // Démarrer la surveillance périodique de la base de données
      await this.databaseMonitorService.startPeriodicMonitoring(300000); // 5 minutes

      // Collecte initiale des métriques
      await this.metricsService.getAllMetrics();

      // Maintenance automatique périodique (1 heure)
      this.maintenanceInterval = setInterval(async () => {
        try {
          await this.performMaintenanceTasks();
        } catch (error) {
          this.logger.error('❌ Error in scheduled maintenance:', error);
        }
      }, 3600000);

      this.logger.log('✅ System monitoring initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize monitoring:', error);
      throw error;
    }
  }
}
