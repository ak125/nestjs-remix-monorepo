/**
 * Service d'Optimisation des Performances du Blog
 * Gestion avancée des performances, métriques et optimisations
 */

import { Injectable, Logger } from '@nestjs/common';
import { BlogCacheService } from './blog-cache.service';

export interface PerformanceMetrics {
  queryTime: number;
  cacheHitRate: number;
  totalQueries: number;
  avgResponseTime: number;
  slowQueries: Array<{
    query: string;
    time: number;
    timestamp: Date;
  }>;
}

export interface OptimizationReport {
  cacheEfficiency: number;
  recommendedActions: string[];
  performanceScore: number;
  bottlenecks: string[];
}

@Injectable()
export class BlogPerformanceService {
  private readonly logger = new Logger(BlogPerformanceService.name);
  private metrics: Map<string, number[]> = new Map();
  private slowQueryThreshold = 1000; // 1 seconde
  private slowQueries: Array<{ query: string; time: number; timestamp: Date }> =
    [];

  constructor(private readonly cacheService: BlogCacheService) {}

  /**
   * Enregistrer une métrique de performance
   */
  recordMetric(operation: string, executionTime: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const times = this.metrics.get(operation)!;
    times.push(executionTime);

    // Garder seulement les 100 dernières mesures
    if (times.length > 100) {
      times.shift();
    }

    // Enregistrer les requêtes lentes
    if (executionTime > this.slowQueryThreshold) {
      this.slowQueries.push({
        query: operation,
        time: executionTime,
        timestamp: new Date(),
      });

      // Garder seulement les 50 dernières requêtes lentes
      if (this.slowQueries.length > 50) {
        this.slowQueries.shift();
      }

      this.logger.warn(
        `Requête lente détectée: ${operation} (${executionTime}ms)`,
      );
    }
  }

  /**
   * Décorateur pour mesurer automatiquement les performances
   */
  measurePerformance<T>(operation: string) {
    return (
      target: any,
      propertyName: string,
      descriptor: PropertyDescriptor,
    ) => {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]): Promise<T> {
        const startTime = Date.now();

        try {
          const result = await method.apply(this, args);
          const executionTime = Date.now() - startTime;

          // Enregistrer la métrique via l'instance du service
          const performanceService =
            this.performanceService ||
            this.constructor.prototype.performanceService;

          if (performanceService) {
            performanceService.recordMetric(
              `${target.constructor.name}.${propertyName}`,
              executionTime,
            );
          }

          return result;
        } catch (error) {
          const executionTime = Date.now() - startTime;
          this.performanceService?.recordMetric(
            `${target.constructor.name}.${propertyName}:ERROR`,
            executionTime,
          );
          throw error;
        }
      };
    };
  }

  /**
   * Obtenir les métriques de performance
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    const cacheStats = await this.cacheService.getStats();
    const allTimes = Array.from(this.metrics.values()).flat();

    return {
      queryTime:
        allTimes.length > 0
          ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length
          : 0,
      cacheHitRate: cacheStats.hitRate,
      totalQueries: allTimes.length,
      avgResponseTime: this.calculateAverageResponseTime(),
      slowQueries: [...this.slowQueries].reverse(), // Plus récentes en premier
    };
  }

  /**
   * Générer un rapport d'optimisation
   */
  async generateOptimizationReport(): Promise<OptimizationReport> {
    const metrics = await this.getMetrics();
    const cacheStats = await this.cacheService.getStats();

    const recommendations: string[] = [];
    const bottlenecks: string[] = [];

    // Analyser le cache
    if (cacheStats.hitRate < 60) {
      recommendations.push(
        'Augmenter la durée de cache (TTL) pour améliorer le hit rate',
      );
      bottlenecks.push('Cache hit rate faible');
    }

    // Analyser les requêtes lentes
    if (metrics.slowQueries.length > 10) {
      recommendations.push('Optimiser les requêtes les plus lentes');
      bottlenecks.push('Trop de requêtes lentes');
    }

    // Analyser le temps de réponse moyen
    if (metrics.avgResponseTime > 500) {
      recommendations.push('Optimiser les requêtes base de données');
      bottlenecks.push('Temps de réponse élevé');
    }

    // Calculer le score de performance
    let performanceScore = 100;
    performanceScore -= Math.max(0, (500 - metrics.avgResponseTime) * 0.1);
    performanceScore -= Math.max(0, 80 - cacheStats.hitRate);
    performanceScore -= Math.min(30, metrics.slowQueries.length * 2);

    return {
      cacheEfficiency: cacheStats.hitRate,
      recommendedActions: recommendations,
      performanceScore: Math.max(0, Math.round(performanceScore)),
      bottlenecks,
    };
  }

  /**
   * Optimisation automatique du cache
   */
  async optimizeCache(): Promise<{
    actionsPerformed: string[];
    improvements: Record<string, number>;
  }> {
    const actions: string[] = [];
    const improvements: Record<string, number> = {};

    // Nettoyer le cache expiré
    await this.cacheService.cleanup();
    actions.push('Cache expiré nettoyé');

    // Analyser les patterns d'accès
    const operationStats = this.analyzeOperationPatterns();

    // Pré-charger les données populaires
    const popularOperations = Object.entries(operationStats)
      .sort(([, a], [, b]) => b.frequency - a.frequency)
      .slice(0, 5);

    for (const [operation, stats] of popularOperations) {
      if (stats.avgTime > 200) {
        // Plus de 200ms en moyenne
        // Cette opération pourrait bénéficier d'un cache plus long
        actions.push(`Optimisation suggérée pour: ${operation}`);
        improvements[operation] = stats.avgTime * 0.8; // Estimation 20% d'amélioration
      }
    }

    return { actionsPerformed: actions, improvements };
  }

  /**
   * Analyser les patterns d'opérations
   */
  private analyzeOperationPatterns(): Record<
    string,
    {
      frequency: number;
      avgTime: number;
      lastAccess: number;
    }
  > {
    const stats: Record<
      string,
      {
        frequency: number;
        avgTime: number;
        lastAccess: number;
      }
    > = {};

    for (const [operation, times] of this.metrics.entries()) {
      stats[operation] = {
        frequency: times.length,
        avgTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        lastAccess: Date.now() - times.length * 60000, // Estimation approximative
      };
    }

    return stats;
  }

  /**
   * Calculer le temps de réponse moyen
   */
  private calculateAverageResponseTime(): number {
    const allTimes = Array.from(this.metrics.values()).flat();
    return allTimes.length > 0
      ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length
      : 0;
  }

  /**
   * Réinitialiser les métriques
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.slowQueries = [];
    this.logger.log('Métriques de performance réinitialisées');
  }

  /**
   * Obtenir les opérations les plus lentes
   */
  getSlowestOperations(limit = 10): Array<{
    operation: string;
    avgTime: number;
    callCount: number;
  }> {
    const operations = Array.from(this.metrics.entries())
      .map(([operation, times]) => ({
        operation,
        avgTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        callCount: times.length,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);

    return operations;
  }

  /**
   * Surveillance en temps réel
   */
  startMonitoring(): void {
    // Surveillance toutes les 5 minutes
    setInterval(
      async () => {
        const report = await this.generateOptimizationReport();

        if (report.performanceScore < 70) {
          this.logger.warn(
            `Performance dégradée (Score: ${report.performanceScore}/100)`,
          );

          // Auto-optimisation si critique
          if (report.performanceScore < 50) {
            const optimization = await this.optimizeCache();
            this.logger.log(
              `Auto-optimisation effectuée: ${optimization.actionsPerformed.join(', ')}`,
            );
          }
        }
      },
      5 * 60 * 1000,
    );

    this.logger.log('Surveillance des performances démarrée');
  }
}
