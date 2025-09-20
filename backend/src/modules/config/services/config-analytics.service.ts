import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';

/**
 * 📊 ENHANCED ANALYTICS SERVICE FOR CONFIG MODULE
 * 
 * Service spécialisé pour l'intégration analytics dans le module de configuration
 * ✅ Heritage SupabaseBaseService pour consistance
 * ✅ Cache intégré pour performances
 * ✅ Configuration spécifique au module config
 * ✅ Tracking des configurations et métadonnées
 * ✅ Analytics comportementales des utilisateurs
 */

export interface ConfigAnalyticsEvent {
  id: string;
  type: 'config_change' | 'metadata_update' | 'breadcrumb_generated' | 'config_access';
  category: 'configuration' | 'metadata' | 'navigation' | 'security';
  action: string;
  label?: string;
  value?: number;
  userId?: string;
  sessionId?: string;
  configId?: string;
  route?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export interface ConfigAnalyticsMetrics {
  totalConfigChanges: number;
  metadataUpdates: number;
  breadcrumbGenerations: number;
  uniqueUsers: number;
  popularConfigs: Array<{
    configId: string;
    accessCount: number;
    lastAccessed: Date;
  }>;
  performanceMetrics: {
    avgResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
  };
}

@Injectable()
export class ConfigAnalyticsService extends SupabaseBaseService {
  protected readonly logger = new Logger(ConfigAnalyticsService.name);
  private readonly cachePrefix = 'config_analytics:';
  private readonly cacheTTL = 1800; // 30 minutes

  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
    @Inject('ANALYTICS_ENABLED') private readonly analyticsEnabled: boolean = true,
  ) {
    super(configService);
  }

  /**
   * Enregistrer un événement analytics lié à la configuration
   */
  async trackConfigEvent(event: Omit<ConfigAnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    if (!this.analyticsEnabled) {
      return;
    }

    try {
      const fullEvent: ConfigAnalyticsEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date(),
      };

      // Enregistrer en base de données
      await this.executeQuery(
        `INSERT INTO ___analytics_config_events (
          event_id, type, category, action, label, value,
          user_id, session_id, config_id, route,
          metadata, timestamp, ip, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          fullEvent.id,
          fullEvent.type,
          fullEvent.category,
          fullEvent.action,
          fullEvent.label,
          fullEvent.value,
          fullEvent.userId,
          fullEvent.sessionId,
          fullEvent.configId,
          fullEvent.route,
          JSON.stringify(fullEvent.metadata || {}),
          fullEvent.timestamp,
          fullEvent.ip,
          fullEvent.userAgent,
        ],
      );

      // Mettre à jour le cache des métriques
      await this.updateCachedMetrics();

      this.logger.debug(`Analytics event tracked: ${fullEvent.type} - ${fullEvent.action}`);
    } catch (error) {
      this.logger.error('Failed to track analytics event:', error);
    }
  }

  /**
   * Récupérer les métriques analytics du module de configuration
   */
  async getConfigMetrics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<ConfigAnalyticsMetrics> {
    try {
      const cacheKey = `${this.cachePrefix}metrics:${timeframe}`;
      
      // Vérifier le cache
      const cached = await this.cacheService.get<ConfigAnalyticsMetrics>(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculer les métriques
      const timeframeSql = this.getTimeframeSql(timeframe);
      
      const metrics: ConfigAnalyticsMetrics = {
        totalConfigChanges: await this.getEventCount('config_change', timeframeSql),
        metadataUpdates: await this.getEventCount('metadata_update', timeframeSql),
        breadcrumbGenerations: await this.getEventCount('breadcrumb_generated', timeframeSql),
        uniqueUsers: await this.getUniqueUsersCount(timeframeSql),
        popularConfigs: await this.getPopularConfigs(timeframeSql),
        performanceMetrics: await this.getPerformanceMetrics(timeframeSql),
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, metrics, this.cacheTTL);

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get config metrics:', error);
      throw error;
    }
  }

  /**
   * Tracker l'accès à une configuration spécifique
   */
  async trackConfigAccess(configId: string, userId?: string, route?: string): Promise<void> {
    await this.trackConfigEvent({
      type: 'config_access',
      category: 'configuration',
      action: 'access',
      label: configId,
      userId,
      configId,
      route,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Tracker les changements de métadonnées
   */
  async trackMetadataUpdate(
    route: string,
    changes: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    await this.trackConfigEvent({
      type: 'metadata_update',
      category: 'metadata',
      action: 'update',
      label: route,
      userId,
      route,
      metadata: {
        changes,
        changeCount: Object.keys(changes).length,
      },
    });
  }

  /**
   * Tracker la génération de breadcrumbs
   */
  async trackBreadcrumbGeneration(
    route: string,
    breadcrumbCount: number,
    cacheHit: boolean,
    userId?: string,
  ): Promise<void> {
    await this.trackConfigEvent({
      type: 'breadcrumb_generated',
      category: 'navigation',
      action: cacheHit ? 'cache_hit' : 'generated',
      label: route,
      value: breadcrumbCount,
      userId,
      route,
      metadata: {
        cacheHit,
        breadcrumbCount,
      },
    });
  }

  /**
   * Obtenir les configurations les plus populaires
   */
  private async getPopularConfigs(timeframeSql: string): Promise<ConfigAnalyticsMetrics['popularConfigs']> {
    const result = await this.executeQuery(
      `SELECT 
        config_id,
        COUNT(*) as access_count,
        MAX(timestamp) as last_accessed
      FROM ___analytics_config_events 
      WHERE type = 'config_access' 
        AND config_id IS NOT NULL 
        AND ${timeframeSql}
      GROUP BY config_id 
      ORDER BY access_count DESC 
      LIMIT 10`,
    );

    return result.data.map(row => ({
      configId: row.config_id,
      accessCount: parseInt(row.access_count),
      lastAccessed: new Date(row.last_accessed),
    }));
  }

  /**
   * Obtenir les métriques de performance
   */
  private async getPerformanceMetrics(timeframeSql: string): Promise<ConfigAnalyticsMetrics['performanceMetrics']> {
    // Cette méthode devrait être implémentée selon vos besoins spécifiques
    // Pour l'instant, on retourne des valeurs par défaut
    return {
      avgResponseTime: 150, // ms
      cacheHitRate: 0.85, // 85%
      errorRate: 0.02, // 2%
    };
  }

  /**
   * Obtenir le nombre d'événements d'un type donné
   */
  private async getEventCount(eventType: string, timeframeSql: string): Promise<number> {
    const result = await this.executeQuery(
      `SELECT COUNT(*) as count 
      FROM ___analytics_config_events 
      WHERE type = $1 AND ${timeframeSql}`,
      [eventType],
    );

    return parseInt(result.data[0]?.count || '0');
  }

  /**
   * Obtenir le nombre d'utilisateurs uniques
   */
  private async getUniqueUsersCount(timeframeSql: string): Promise<number> {
    const result = await this.executeQuery(
      `SELECT COUNT(DISTINCT user_id) as count 
      FROM ___analytics_config_events 
      WHERE user_id IS NOT NULL AND ${timeframeSql}`,
    );

    return parseInt(result.data[0]?.count || '0');
  }

  /**
   * Générer une clause SQL pour la plage temporelle
   */
  private getTimeframeSql(timeframe: 'day' | 'week' | 'month'): string {
    switch (timeframe) {
      case 'day':
        return "timestamp >= NOW() - INTERVAL '1 day'";
      case 'week':
        return "timestamp >= NOW() - INTERVAL '1 week'";
      case 'month':
        return "timestamp >= NOW() - INTERVAL '1 month'";
      default:
        return "timestamp >= NOW() - INTERVAL '1 week'";
    }
  }

  /**
   * Générer un ID unique pour l'événement
   */
  private generateEventId(): string {
    return `config_evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Mettre à jour les métriques en cache
   */
  private async updateCachedMetrics(): Promise<void> {
    // Invalider le cache des métriques pour forcer le recalcul
    const timeframes = ['day', 'week', 'month'];
    for (const timeframe of timeframes) {
      const cacheKey = `${this.cachePrefix}metrics:${timeframe}`;
      await this.cacheService.del(cacheKey);
    }
  }
}