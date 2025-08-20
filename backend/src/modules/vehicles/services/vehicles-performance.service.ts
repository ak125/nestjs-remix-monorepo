import { Injectable, Logger } from '@nestjs/common';

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  dataSize?: number;
  cacheHit?: boolean;
}

export interface EndpointStats {
  endpoint: string;
  totalCalls: number;
  averageResponseTime: number;
  successRate: number;
  lastCall: Date;
  errorCount: number;
}

/**
 * 📊 Service de monitoring des performances des API véhicules
 * 
 * ✨ Fonctionnalités:
 * - Collecte des métriques en temps réel
 * - Calcul des statistiques de performance
 * - Détection des anomalies
 * - Rapports de santé des endpoints
 */
@Injectable()
export class VehiclesPerformanceService {
  private readonly logger = new Logger(VehiclesPerformanceService.name);
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 10000; // Limiter en mémoire
  
  /**
   * 📝 Enregistrer une métrique de performance
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>) {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date(),
    };
    
    this.metrics.push(fullMetric);
    
    // Maintenir une taille maximale
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS / 2);
    }
    
    // Log des performances anormales
    if (metric.duration > 2000) { // Plus de 2 secondes
      this.logger.warn(
        `🐌 Slow response detected: ${metric.endpoint} took ${metric.duration}ms`,
      );
    }
    
    if (!metric.success) {
      this.logger.error(
        `❌ API Error: ${metric.endpoint} failed - ${metric.errorMessage}`,
      );
    }
  }
  
  /**
   * 📈 Obtenir les statistiques d'un endpoint
   */
  getEndpointStats(endpoint: string): EndpointStats | null {
    const endpointMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    
    if (endpointMetrics.length === 0) return null;
    
    const totalCalls = endpointMetrics.length;
    const successfulCalls = endpointMetrics.filter(m => m.success);
    const averageResponseTime = endpointMetrics.reduce((sum, m) => sum + m.duration, 0) / totalCalls;
    const successRate = (successfulCalls.length / totalCalls) * 100;
    const errorCount = totalCalls - successfulCalls.length;
    const lastCall = new Date(Math.max(...endpointMetrics.map(m => m.timestamp.getTime())));
    
    return {
      endpoint,
      totalCalls,
      averageResponseTime: Math.round(averageResponseTime),
      successRate: Math.round(successRate * 100) / 100,
      lastCall,
      errorCount,
    };
  }
  
  /**
   * 📊 Rapport global de performance
   */
  getPerformanceReport() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= lastHour);
    
    const endpoints = [...new Set(this.metrics.map(m => m.endpoint))];
    const endpointStats = endpoints.map(endpoint => this.getEndpointStats(endpoint)).filter(Boolean);
    
    const globalStats = {
      totalRequests: this.metrics.length,
      recentRequests: recentMetrics.length,
      averageResponseTime: Math.round(
        recentMetrics.reduce((sum, m) => sum + m.duration, 0) / (recentMetrics.length || 1)
      ),
      overallSuccessRate: Math.round(
        (recentMetrics.filter(m => m.success).length / (recentMetrics.length || 1)) * 10000
      ) / 100,
      slowestEndpoint: endpointStats.reduce(
        (slowest, current) => 
          current.averageResponseTime > (slowest?.averageResponseTime || 0) ? current : slowest,
        null as EndpointStats | null
      ),
      healthStatus: this.getHealthStatus(),
    };
    
    return {
      timestamp: now.toISOString(),
      global: globalStats,
      endpoints: endpointStats,
      alerts: this.generateAlerts(endpointStats),
    };
  }
  
  /**
   * 🏥 État de santé du système
   */
  private getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const recentMetrics = this.metrics.filter(
      m => m.timestamp >= new Date(Date.now() - 5 * 60 * 1000) // 5 dernières minutes
    );
    
    if (recentMetrics.length === 0) return 'healthy';
    
    const errorRate = (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
    
    if (errorRate > 10 || avgResponseTime > 3000) return 'critical';
    if (errorRate > 5 || avgResponseTime > 1500) return 'warning';
    
    return 'healthy';
  }
  
  /**
   * 🚨 Génération d'alertes
   */
  private generateAlerts(endpointStats: EndpointStats[]): string[] {
    const alerts: string[] = [];
    
    endpointStats.forEach(stat => {
      if (stat.successRate < 95) {
        alerts.push(`⚠️ ${stat.endpoint}: Taux de succès faible (${stat.successRate}%)`);
      }
      
      if (stat.averageResponseTime > 2000) {
        alerts.push(`🐌 ${stat.endpoint}: Temps de réponse élevé (${stat.averageResponseTime}ms)`);
      }
      
      if (stat.errorCount > 10) {
        alerts.push(`❌ ${stat.endpoint}: Nombreuses erreurs (${stat.errorCount})`);
      }
    });
    
    return alerts;
  }
  
  /**
   * 🧹 Nettoyer les anciennes métriques
   */
  cleanup(olderThanDays: number = 7) {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const beforeCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffDate);
    
    const removedCount = beforeCount - this.metrics.length;
    if (removedCount > 0) {
      this.logger.log(`🧹 Cleaned up ${removedCount} old performance metrics`);
    }
  }
}
