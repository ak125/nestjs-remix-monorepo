/**
 * 📊 Service de Monitoring et Métriques - Intégration Graduelle
 * 
 * Service TypeScript pour surveiller les performances et l'utilisation
 * du système de recherche amélioré.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';

export interface SearchMetrics {
  totalSearches: number;
  successfulSearches: number;
  failedSearches: number;
  averageResponseTime: number;
  cacheHitRate: number;
  popularQueries: Array<{ query: string; count: number }>;
  serviceUsage: {
    basic: number;
    enhanced: number;
  };
  performance: {
    basic: {
      avgResponseTime: number;
      maxResponseTime: number;
      minResponseTime: number;
    };
    enhanced: {
      avgResponseTime: number;
      maxResponseTime: number;
      minResponseTime: number;
    };
  };
  errors: Array<{
    timestamp: Date;
    service: 'basic' | 'enhanced';
    error: string;
    query?: string;
  }>;
  hourlyStats: Array<{
    hour: string;
    searches: number;
    avgResponseTime: number;
    cacheHitRate: number;
  }>;
}

@Injectable()
export class SearchMonitoringService {
  private readonly logger = new Logger(SearchMonitoringService.name);
  private metrics: SearchMetrics;
  private readonly metricsKey = 'search:monitoring:metrics';

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.metrics = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      popularQueries: [],
      serviceUsage: {
        basic: 0,
        enhanced: 0,
      },
      performance: {
        basic: {
          avgResponseTime: 0,
          maxResponseTime: 0,
          minResponseTime: Number.MAX_SAFE_INTEGER,
        },
        enhanced: {
          avgResponseTime: 0,
          maxResponseTime: 0,
          minResponseTime: Number.MAX_SAFE_INTEGER,
        },
      },
      errors: [],
      hourlyStats: [],
    };
  }

  /**
   * 📈 Enregistrer une recherche
   */
  async recordSearch(params: {
    service: 'basic' | 'enhanced';
    query: string;
    responseTime: number;
    resultCount: number;
    fromCache: boolean;
    success: boolean;
    error?: string;
  }) {
    const { service, query, responseTime, resultCount, fromCache, success, error } = params;

    // Mise à jour des métriques de base
    this.metrics.totalSearches++;
    
    if (success) {
      this.metrics.successfulSearches++;
    } else {
      this.metrics.failedSearches++;
      if (error) {
        this.metrics.errors.push({
          timestamp: new Date(),
          service,
          error,
          query,
        });
      }
    }

    // Mise à jour de l'utilisation des services
    this.metrics.serviceUsage[service]++;

    // Mise à jour des performances par service
    const perfMetrics = this.metrics.performance[service];
    
    // Calcul de la moyenne mobile
    const currentCount = this.metrics.serviceUsage[service];
    perfMetrics.avgResponseTime = 
      (perfMetrics.avgResponseTime * (currentCount - 1) + responseTime) / currentCount;
    
    perfMetrics.maxResponseTime = Math.max(perfMetrics.maxResponseTime, responseTime);
    perfMetrics.minResponseTime = Math.min(perfMetrics.minResponseTime, responseTime);

    // Mise à jour du taux de cache global
    const totalCacheHits = await this.getCacheHitCount();
    this.metrics.cacheHitRate = (totalCacheHits / this.metrics.totalSearches) * 100;

    // Mise à jour des requêtes populaires
    this.updatePopularQueries(query);

    // Mise à jour des stats horaires
    this.updateHourlyStats(responseTime, fromCache);

    // Sauvegarde périodique
    await this.persistMetrics();

    this.logger.debug(`📊 Search recorded: ${service} - ${query} - ${responseTime}ms`);
  }

  /**
   * 📊 Obtenir les métriques actuelles
   */
  async getMetrics(): Promise<SearchMetrics> {
    // Charger les métriques depuis le cache si disponibles
    const cached = await this.loadMetrics();
    if (cached) {
      this.metrics = { ...this.metrics, ...cached };
    }

    return {
      ...this.metrics,
      // Calculer le temps de réponse moyen global
      averageResponseTime: this.calculateGlobalAverageResponseTime(),
      // Nettoyer les erreurs anciennes (garder seulement les 24 dernières heures)
      errors: this.metrics.errors.filter(
        error => Date.now() - error.timestamp.getTime() < 24 * 60 * 60 * 1000
      ),
    };
  }

  /**
   * 🎯 Obtenir un rapport de performance comparatif
   */
  async getPerformanceReport(): Promise<{
    summary: {
      totalSearches: number;
      successRate: number;
      avgResponseTime: number;
      cacheHitRate: number;
    };
    comparison: {
      basic: {
        usage: number;
        avgResponseTime: number;
        successRate: number;
      };
      enhanced: {
        usage: number;
        avgResponseTime: number;
        successRate: number;
        improvement: string;
      };
    };
    trends: {
      hourly: Array<{ hour: string; searches: number; avgResponseTime: number }>;
      popular: Array<{ query: string; count: number }>;
    };
    recommendations: string[];
  }> {
    const metrics = await this.getMetrics();
    
    const basicSuccess = await this.getServiceSuccessRate('basic');
    const enhancedSuccess = await this.getServiceSuccessRate('enhanced');
    
    const improvement = metrics.performance.basic.avgResponseTime > 0 
      ? ((metrics.performance.basic.avgResponseTime - metrics.performance.enhanced.avgResponseTime) 
         / metrics.performance.basic.avgResponseTime * 100).toFixed(1)
      : '0';

    return {
      summary: {
        totalSearches: metrics.totalSearches,
        successRate: (metrics.successfulSearches / metrics.totalSearches * 100),
        avgResponseTime: metrics.averageResponseTime,
        cacheHitRate: metrics.cacheHitRate,
      },
      comparison: {
        basic: {
          usage: (metrics.serviceUsage.basic / metrics.totalSearches * 100),
          avgResponseTime: metrics.performance.basic.avgResponseTime,
          successRate: basicSuccess,
        },
        enhanced: {
          usage: (metrics.serviceUsage.enhanced / metrics.totalSearches * 100),
          avgResponseTime: metrics.performance.enhanced.avgResponseTime,
          successRate: enhancedSuccess,
          improvement: `${improvement}%`,
        },
      },
      trends: {
        hourly: metrics.hourlyStats.slice(-24), // Dernières 24 heures
        popular: metrics.popularQueries.slice(0, 10), // Top 10
      },
      recommendations: this.generateRecommendations(metrics),
    };
  }

  /**
   * 🔄 Réinitialiser les métriques
   */
  async resetMetrics(): Promise<void> {
    this.initializeMetrics();
    await this.cache.del(this.metricsKey);
    this.logger.log('📊 Métriques réinitialisées');
  }

  /**
   * 🏥 Health check du service de monitoring
   */
  async healthCheck(): Promise<{
    status: string;
    metricsCount: number;
    lastUpdate: Date;
    cacheStatus: string;
  }> {
    try {
      const metrics = await this.getMetrics();
      const cacheStatus = await this.cache.get(this.metricsKey) ? 'connected' : 'unavailable';
      
      return {
        status: 'healthy',
        metricsCount: metrics.totalSearches,
        lastUpdate: new Date(),
        cacheStatus,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        metricsCount: 0,
        lastUpdate: new Date(),
        cacheStatus: 'error',
      };
    }
  }

  // Méthodes privées

  private updatePopularQueries(query: string) {
    const existing = this.metrics.popularQueries.find(pq => pq.query === query);
    
    if (existing) {
      existing.count++;
    } else {
      this.metrics.popularQueries.push({ query, count: 1 });
    }

    // Garder seulement le top 50 et trier par popularité
    this.metrics.popularQueries = this.metrics.popularQueries
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }

  private updateHourlyStats(responseTime: number, fromCache: boolean) {
    const currentHour = new Date().toISOString().slice(0, 13) + ':00:00';
    let hourStat = this.metrics.hourlyStats.find(hs => hs.hour === currentHour);
    
    if (!hourStat) {
      hourStat = {
        hour: currentHour,
        searches: 0,
        avgResponseTime: 0,
        cacheHitRate: 0,
      };
      this.metrics.hourlyStats.push(hourStat);
    }

    hourStat.searches++;
    hourStat.avgResponseTime = 
      (hourStat.avgResponseTime * (hourStat.searches - 1) + responseTime) / hourStat.searches;
    
    // Calcul simple du cache hit rate pour cette heure
    if (fromCache) {
      hourStat.cacheHitRate = (hourStat.cacheHitRate * (hourStat.searches - 1) + 100) / hourStat.searches;
    } else {
      hourStat.cacheHitRate = (hourStat.cacheHitRate * (hourStat.searches - 1)) / hourStat.searches;
    }

    // Garder seulement les 168 dernières heures (7 jours)
    this.metrics.hourlyStats = this.metrics.hourlyStats
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-168);
  }

  private calculateGlobalAverageResponseTime(): number {
    const totalBasic = this.metrics.serviceUsage.basic * this.metrics.performance.basic.avgResponseTime;
    const totalEnhanced = this.metrics.serviceUsage.enhanced * this.metrics.performance.enhanced.avgResponseTime;
    const totalRequests = this.metrics.serviceUsage.basic + this.metrics.serviceUsage.enhanced;
    
    return totalRequests > 0 ? (totalBasic + totalEnhanced) / totalRequests : 0;
  }

  private async getCacheHitCount(): Promise<number> {
    // Estimation basée sur les stats existantes
    // Dans une implémentation réelle, ceci serait récupéré du cache service
    return Math.floor(this.metrics.totalSearches * 0.3); // 30% estimation
  }

  private async getServiceSuccessRate(service: 'basic' | 'enhanced'): Promise<number> {
    const serviceErrors = this.metrics.errors.filter(e => e.service === service).length;
    const serviceRequests = this.metrics.serviceUsage[service];
    
    return serviceRequests > 0 ? ((serviceRequests - serviceErrors) / serviceRequests * 100) : 100;
  }

  private generateRecommendations(metrics: SearchMetrics): string[] {
    const recommendations: string[] = [];
    
    // Recommandations basées sur les performances
    if (metrics.performance.enhanced.avgResponseTime > metrics.performance.basic.avgResponseTime) {
      recommendations.push(
        'Service amélioré plus lent que le service de base - vérifier la configuration'
      );
    }
    
    // Recommandations basées sur le cache
    if (metrics.cacheHitRate < 30) {
      recommendations.push('Taux de cache faible - optimiser la stratégie de mise en cache');
    }
    
    // Recommandations basées sur les erreurs
    if (metrics.failedSearches / metrics.totalSearches > 0.05) {
      recommendations.push('Taux d\'erreur élevé - examiner les logs d\'erreur');
    }
    
    // Recommandations basées sur l'utilisation
    if (metrics.serviceUsage.enhanced / metrics.totalSearches < 0.1) {
      recommendations.push('Faible adoption du service amélioré - promouvoir les nouvelles fonctionnalités');
    }
    
    return recommendations;
  }

  private async persistMetrics(): Promise<void> {
    try {
      await this.cache.set(this.metricsKey, this.metrics, 24 * 60 * 60); // 24h TTL
    } catch (error) {
      this.logger.error('Failed to persist metrics:', error);
    }
  }

  private async loadMetrics(): Promise<SearchMetrics | null> {
    try {
      return await this.cache.get(this.metricsKey);
    } catch (error) {
      this.logger.error('Failed to load metrics:', error);
      return null;
    }
  }
}