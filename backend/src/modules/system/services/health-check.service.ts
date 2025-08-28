import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { MetricsService } from './metrics.service';
import { DatabaseMonitorService } from './database-monitor.service';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: Record<string, any>;
  timestamp: string;
}

export interface SystemHealthCheck {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheckResult[];
  uptime: number;
  version: string;
  environment: string;
  timestamp: string;
}

@Injectable()
export class HealthCheckService extends SupabaseBaseService {
  private readonly logger = new Logger(HealthCheckService.name);

  constructor(
    configService: ConfigService,
    private metricsService: MetricsService,
    private databaseMonitorService: DatabaseMonitorService,
  ) {
    super(configService);
  }

  /**
   * 🏥 Health check complet du système
   */
  async performHealthCheck(): Promise<SystemHealthCheck> {
    try {
      this.logger.log('🏥 Performing comprehensive health check');

      const checks = await Promise.allSettled([
        this.checkDatabase(),
        this.checkMetricsService(),
        this.checkMemoryUsage(),
        this.checkDiskSpace(),
        this.checkExternalServices(),
      ]);

      const services: HealthCheckResult[] = checks.map((check, index) => {
        const serviceNames = ['database', 'metrics', 'memory', 'disk', 'external'];
        
        if (check.status === 'fulfilled') {
          return check.value;
        } else {
          return {
            service: serviceNames[index],
            status: 'unhealthy',
            responseTime: -1,
            details: { error: check.reason?.message || 'Unknown error' },
            timestamp: new Date().toISOString(),
          };
        }
      });

      // Déterminer le statut global
      const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
      const degradedServices = services.filter(s => s.status === 'degraded').length;
      
      let overall: SystemHealthCheck['overall'] = 'healthy';
      if (unhealthyServices > 0) {
        overall = unhealthyServices > 1 ? 'unhealthy' : 'degraded';
      } else if (degradedServices > 0) {
        overall = 'degraded';
      }

      const healthCheck: SystemHealthCheck = {
        overall,
        services,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: this.configService.get('NODE_ENV', 'development'),
        timestamp: new Date().toISOString(),
      };

      this.logger.log(`💚 Health check completed: ${overall} (${services.length} services)`);
      return healthCheck;
    } catch (error) {
      this.logger.error('❌ Critical error in health check:', error);
      return {
        overall: 'unhealthy',
        services: [],
        uptime: process.uptime(),
        version: 'unknown',
        environment: 'unknown',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 💾 Vérification santé base de données
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const health = await this.databaseMonitorService.checkDatabaseHealth();
      const responseTime = Date.now() - startTime;
      
      let status: HealthCheckResult['status'] = 'healthy';
      if (health.status === 'critical') {
        status = 'unhealthy';
      } else if (health.status === 'warning') {
        status = 'degraded';
      }

      return {
        service: 'database',
        status,
        responseTime,
        details: {
          connections: health.connections,
          tablesChecked: Object.keys(health.tableStatus).length,
          failedTables: Object.values(health.tableStatus).filter(t => !t.accessible).length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 Vérification service métriques
   */
  private async checkMetricsService(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const metrics = await this.metricsService.collectPerformanceMetrics();
      const responseTime = Date.now() - startTime;
      
      let status: HealthCheckResult['status'] = 'healthy';
      if (metrics.responseTime < 0 || metrics.databaseConnections === 0) {
        status = 'unhealthy';
      } else if (metrics.responseTime > 1000 || metrics.errorRate > 5) {
        status = 'degraded';
      }

      return {
        service: 'metrics',
        status,
        responseTime,
        details: {
          performanceResponseTime: metrics.responseTime,
          errorRate: metrics.errorRate,
          requestsPerMinute: metrics.requestsPerMinute,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        service: 'metrics',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧠 Vérification utilisation mémoire
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const rssUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      let status: HealthCheckResult['status'] = 'healthy';
      if (heapUsedMB > 1024) { // Plus de 1GB
        status = 'unhealthy';
      } else if (heapUsedMB > 512) { // Plus de 512MB
        status = 'degraded';
      }

      return {
        service: 'memory',
        status,
        responseTime: Date.now() - startTime,
        details: {
          heapUsedMB,
          heapTotalMB,
          rssUsageMB,
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        service: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 💾 Vérification espace disque (simulé en container)
   */
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // En environnement containerisé, on simule un check d'espace disque
      // En production réelle, utiliser 'fs' pour vérifier l'espace disponible
      const simulatedDiskUsage = Math.random() * 100;
      
      let status: HealthCheckResult['status'] = 'healthy';
      if (simulatedDiskUsage > 90) {
        status = 'unhealthy';
      } else if (simulatedDiskUsage > 80) {
        status = 'degraded';
      }

      return {
        service: 'disk',
        status,
        responseTime: Date.now() - startTime,
        details: {
          usagePercentage: Math.round(simulatedDiskUsage),
          available: `${Math.round(100 - simulatedDiskUsage)}%`,
          note: 'Simulated in container environment',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        service: 'disk',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🌐 Vérification services externes
   */
  private async checkExternalServices(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test de connectivité réseau basique
      const networkTest = await this.testNetworkConnectivity();
      const responseTime = Date.now() - startTime;
      
      let status: HealthCheckResult['status'] = networkTest ? 'healthy' : 'degraded';

      return {
        service: 'external',
        status,
        responseTime,
        details: {
          networkConnectivity: networkTest,
          // Ici on peut ajouter d'autres services externes
          // comme APIs tierces, services de paiement, etc.
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        service: 'external',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔗 Test de connectivité réseau basique
   */
  private async testNetworkConnectivity(): Promise<boolean> {
    try {
      // Test simple de résolution DNS
      const { lookup } = await import('dns/promises');
      await lookup('google.com');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ⚡ Health check rapide pour endpoints
   */
  async quickHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
  }> {
    try {
      // Test rapide base de données
      const { error } = await this.supabase
        .from('___xtr_customer')
        .select('cst_id')
        .limit(1);

      return {
        status: error ? 'unhealthy' : 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  }
}
