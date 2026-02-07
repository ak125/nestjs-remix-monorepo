import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { MetricsService } from './metrics.service';

export interface DatabaseHealth {
  status: 'healthy' | 'warning' | 'critical';
  connections: number;
  responseTime: number;
  tableStatus: Record<
    string,
    {
      accessible: boolean;
      recordCount: number;
      lastUpdated?: Date;
    }
  >;
}

export interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class DatabaseMonitorService extends SupabaseBaseService {
  protected readonly logger = new Logger(DatabaseMonitorService.name);
  private alerts: SystemAlert[] = [];

  // Tables critiques à surveiller
  private readonly CRITICAL_TABLES = [
    '___xtr_customer',
    '___xtr_order',
    '___xtr_product',
    '__sitemap_p_link',
    '___META_TAGS_ARIANE',
  ];

  constructor(
    configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    super(configService);
  }

  /**
   * 🏥 Vérification complète de la santé de la base de données
   */
  async checkDatabaseHealth(): Promise<DatabaseHealth> {
    try {
      this.logger.log('🔍 Checking database health');
      const startTime = Date.now();

      // Vérifier chaque table critique
      const tableResults: DatabaseHealth['tableStatus'] = {};
      let totalConnections = 0;

      for (const table of this.CRITICAL_TABLES) {
        try {
          const { count, error } = await this.supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (!error && count !== null) {
            tableResults[table] = {
              accessible: true,
              recordCount: count,
              lastUpdated: new Date(),
            };
            totalConnections++;
          } else {
            tableResults[table] = {
              accessible: false,
              recordCount: 0,
            };
            await this.createAlert(
              'warning',
              `Table ${table} inaccessible`,
              error?.message || 'Unknown error',
            );
          }

          // Alerter si table vide de façon inattendue
          if (
            count === 0 &&
            ['___xtr_customer', '___xtr_product'].includes(table)
          ) {
            await this.createAlert(
              'critical',
              `Table ${table} appears empty`,
              `Expected data but found 0 records`,
            );
          }
        } catch (error) {
          this.logger.error(
            `\u274C Erreur monitoring table ${table}:`,
            getErrorMessage(error),
          );
          tableResults[table] = {
            accessible: false,
            recordCount: 0,
          };
          await this.createAlert(
            'error',
            `Failed to check table ${table}`,
            getErrorMessage(error),
          );
        }
      }

      const totalResponseTime = Date.now() - startTime;

      // Déterminer le statut global
      const failedTables = Object.values(tableResults).filter(
        (t) => !t.accessible,
      ).length;
      let status: DatabaseHealth['status'] = 'healthy';

      if (failedTables > 0) {
        status =
          failedTables >= this.CRITICAL_TABLES.length / 2
            ? 'critical'
            : 'warning';
      } else if (totalResponseTime > 5000) {
        status = 'warning';
        await this.createAlert(
          'warning',
          'Slow database response',
          `Database took ${totalResponseTime}ms to respond`,
        );
      }

      const healthStatus: DatabaseHealth = {
        status,
        connections: totalConnections,
        responseTime: totalResponseTime,
        tableStatus: tableResults,
      };

      this.logger.log(`💚 Database health check completed:`, {
        status,
        connections: totalConnections,
        responseTime: `${totalResponseTime}ms`,
        tablesOk: this.CRITICAL_TABLES.length - failedTables,
        tablesTotal: this.CRITICAL_TABLES.length,
      });

      return healthStatus;
    } catch (error) {
      this.logger.error('❌ Critical error in database health check:', error);
      await this.createAlert(
        'critical',
        'Database health check failed',
        getErrorMessage(error),
      );

      return {
        status: 'critical',
        connections: 0,
        responseTime: -1,
        tableStatus: {},
      };
    }
  }

  /**
   * 📊 Surveillance des performances spécifiques
   */
  async monitorTablePerformance(tableName: string): Promise<{
    queryTime: number;
    recordCount: number;
    indexHealth: 'good' | 'slow' | 'critical';
    recommendations: string[];
  }> {
    try {
      this.logger.log(`🔍 Monitoring performance for table: ${tableName}`);

      const startTime = Date.now();
      const { count, error } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      const queryTime = Date.now() - startTime;
      const recordCount = count || 0;

      // Analyser les performances
      let indexHealth: 'good' | 'slow' | 'critical' = 'good';
      const recommendations: string[] = [];

      if (queryTime > 2000) {
        indexHealth = 'critical';
        recommendations.push(
          'Query time > 2s: Consider adding indexes or optimizing queries',
        );
      } else if (queryTime > 1000) {
        indexHealth = 'slow';
        recommendations.push(
          'Query time > 1s: Monitor for potential optimization',
        );
      }

      if (recordCount > 1000000) {
        recommendations.push(
          'Large table detected: Consider partitioning or archiving old data',
        );
      }

      // Stocker la métrique
      await this.metricsService['storeMetric']({
        id: `table_perf_${tableName}_${Date.now()}`,
        name: `table_performance_${tableName}`,
        value: queryTime,
        unit: 'ms',
        timestamp: new Date(),
        category: 'system' as any,
        metadata: { recordCount, indexHealth, recommendations },
      });

      return {
        queryTime,
        recordCount,
        indexHealth,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`❌ Error monitoring table ${tableName}:`, error);
      return {
        queryTime: -1,
        recordCount: -1,
        indexHealth: 'critical',
        recommendations: [`Failed to monitor table: ${getErrorMessage(error)}`],
      };
    }
  }

  /**
   * ⚠️ Gestion des alertes système
   */
  private async createAlert(
    level: SystemAlert['level'],
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const alert: SystemAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      title,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata,
    };

    this.alerts.push(alert);

    // Garder seulement les 100 dernières alertes
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.logger.log(
      `🚨 ${level.toUpperCase()} Alert created: ${title}`,
      message,
    );
  }

  /**
   * 📋 Récupérer les alertes actives
   */
  getActiveAlerts(level?: SystemAlert['level']): SystemAlert[] {
    let alerts = this.alerts.filter((a) => !a.resolved);
    if (level) {
      alerts = alerts.filter((a) => a.level === level);
    }
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * ✅ Résoudre une alerte
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.logger.log(`✅ Alert resolved: ${alert.title}`);
      return true;
    }
    return false;
  }

  /**
   * 🔄 Surveillance automatique (à lancer périodiquement)
   */
  async startPeriodicMonitoring(intervalMs: number = 300000): Promise<void> {
    this.logger.log(
      `🔄 Starting periodic database monitoring every ${intervalMs / 1000}s`,
    );

    const monitor = async () => {
      try {
        await this.checkDatabaseHealth();

        // Surveillance spécifique des tables critiques
        for (const table of this.CRITICAL_TABLES) {
          await this.monitorTablePerformance(table);
        }
      } catch (error) {
        this.logger.error('❌ Error in periodic monitoring:', error);
      }
    };

    // Premier run immédiat
    await monitor();

    // Puis périodique
    setInterval(monitor, intervalMs);
  }

  /**
   * 📊 Rapport de santé complet
   */
  async getHealthReport(): Promise<{
    database: DatabaseHealth;
    alerts: SystemAlert[];
    uptime: number;
    lastCheck: string;
  }> {
    const database = await this.checkDatabaseHealth();
    const alerts = this.getActiveAlerts();

    return {
      database,
      alerts,
      uptime: process.uptime(),
      lastCheck: new Date().toISOString(),
    };
  }
}
