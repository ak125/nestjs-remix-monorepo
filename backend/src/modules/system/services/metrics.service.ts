import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { MetaTagsArianeDataService } from '../../../database/services/meta-tags-ariane-data.service';

export interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: 'performance' | 'business' | 'system' | 'seo';
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  responseTime: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  requestsPerMinute: number;
  errorRate: number;
  databaseConnections: number;
}

@Injectable()
export class MetricsService extends SupabaseBaseService {
  protected readonly logger = new Logger(MetricsService.name);
  private metricsCache = new Map<string, SystemMetric>();
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(
    configService: ConfigService,
    private readonly metaTagsData: MetaTagsArianeDataService,
  ) {
    super(configService);
  }

  /**
   * 📊 Collecte des métriques de performance système
   */
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      this.logger.log('🔍 Collecting system performance metrics');

      const startTime = Date.now();

      // Test de connectivité base de données
      const dbTest = await this.testDatabaseConnection();
      const responseTime = Date.now() - startTime;

      // Métriques système basiques (simulées en environnement containerisé)
      const metrics: PerformanceMetrics = {
        responseTime,
        uptime: process.uptime(),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        cpuUsage: await this.getCpuUsage(),
        requestsPerMinute: await this.getRequestsPerMinute(),
        errorRate: await this.getErrorRate(),
        databaseConnections: dbTest ? 1 : 0,
      };

      // Stocker les métriques
      await this.storeMetric({
        id: `perf_${Date.now()}`,
        name: 'performance_snapshot',
        value: responseTime,
        unit: 'ms',
        timestamp: new Date(),
        category: 'performance',
        metadata: metrics,
      });

      this.logger.log('✅ Performance metrics collected:', metrics);
      return metrics;
    } catch (error) {
      this.logger.error('❌ Error collecting performance metrics:', error);
      return {
        responseTime: -1,
        uptime: process.uptime(),
        memoryUsage: -1,
        cpuUsage: -1,
        requestsPerMinute: -1,
        errorRate: -1,
        databaseConnections: 0,
      };
    }
  }

  /**
   * 📈 Métriques business combinées avec dashboard existant
   */
  async collectBusinessMetrics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalOrders: number;
    revenue24h: number;
    conversionRate: number;
    averageOrderValue: number;
  }> {
    try {
      this.logger.log('💼 Collecting business metrics');

      // Utiliser les requêtes existantes optimisées
      const [usersCount, activeUsersCount] = await Promise.all([
        this.supabase
          .from(TABLES.xtr_customer)
          .select('*', { count: 'exact', head: true }),
        this.supabase
          .from(TABLES.xtr_customer)
          .select('*', { count: 'exact', head: true })
          .eq('cst_activ', '1'),
      ]);

      // Ordres des dernières 24h
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: recentOrders } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_total_ttc, ord_is_pay')
        .gte('ord_date_order', yesterday.toISOString());

      const totalOrders = recentOrders?.length || 0;
      const paidOrders =
        recentOrders?.filter((o) => o.ord_is_pay === '1') || [];
      const revenue24h = paidOrders.reduce(
        (sum, order) => sum + parseFloat(order.ord_total_ttc || '0'),
        0,
      );
      const averageOrderValue =
        paidOrders.length > 0 ? revenue24h / paidOrders.length : 0;
      const conversionRate =
        totalOrders > 0 ? (paidOrders.length / totalOrders) * 100 : 0;

      const metrics = {
        totalUsers: usersCount.count || 0,
        activeUsers: activeUsersCount.count || 0,
        totalOrders,
        revenue24h,
        conversionRate,
        averageOrderValue,
      };

      await this.storeMetric({
        id: `business_${Date.now()}`,
        name: 'business_snapshot',
        value: revenue24h,
        unit: 'EUR',
        timestamp: new Date(),
        category: 'business',
        metadata: metrics,
      });

      this.logger.log('💰 Business metrics collected:', metrics);
      return metrics;
    } catch (error) {
      this.logger.error('❌ Error collecting business metrics:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalOrders: 0,
        revenue24h: 0,
        conversionRate: 0,
        averageOrderValue: 0,
      };
    }
  }

  /**
   * 🎯 Métriques SEO intégrées avec module existant
   */
  async collectSeoMetrics(): Promise<{
    totalPages: number;
    indexedPages: number;
    optimizedPages: number;
    averageLoadTime: number;
    sitemapHealth: number;
  }> {
    try {
      this.logger.log('🔍 Collecting SEO metrics from production tables');

      const [sitemapCount, optimizedPages] = await Promise.all([
        this.supabase
          .from(TABLES.sitemap_p_link)
          .select('*', { count: 'exact', head: true }),
        this.metaTagsData.countOptimized(),
      ]);

      const metrics = {
        totalPages: sitemapCount.count || 0,
        indexedPages: sitemapCount.count || 0,
        optimizedPages: optimizedPages,
        averageLoadTime: Math.random() * 200 + 100, // Simulé pour le moment
        sitemapHealth: sitemapCount.count
          ? Math.round((optimizedPages / sitemapCount.count) * 100)
          : 0,
      };

      await this.storeMetric({
        id: `seo_${Date.now()}`,
        name: 'seo_snapshot',
        value: metrics.sitemapHealth,
        unit: '%',
        timestamp: new Date(),
        category: 'seo',
        metadata: metrics,
      });

      this.logger.log('🎯 SEO metrics collected:', metrics);
      return metrics;
    } catch (error) {
      this.logger.error('❌ Error collecting SEO metrics:', error);
      return {
        totalPages: 0,
        indexedPages: 0,
        optimizedPages: 0,
        averageLoadTime: 0,
        sitemapHealth: 0,
      };
    }
  }

  /**
   * 💾 Stocker une métrique (avec cache)
   */
  private async storeMetric(metric: SystemMetric): Promise<void> {
    try {
      // Cache local
      this.metricsCache.set(metric.id, metric);

      // Nettoyage automatique du cache
      setTimeout(() => {
        this.metricsCache.delete(metric.id);
      }, this.CACHE_TTL);

      // Stockage en base (optionnel, peut être activé plus tard)
      // await this.supabase.from('system_metrics').insert(metric);

      this.logger.debug(
        `📊 Metric stored: ${metric.name} = ${metric.value}${metric.unit}`,
      );
    } catch (error) {
      this.logger.error('❌ Error storing metric:', error);
    }
  }

  /**
   * 🔍 Récupérer les métriques récentes
   */
  getRecentMetrics(category?: SystemMetric['category']): SystemMetric[] {
    const metrics = Array.from(this.metricsCache.values());
    return category ? metrics.filter((m) => m.category === category) : metrics;
  }

  /**
   * 🚀 Métriques complètes pour dashboard
   */
  async getAllMetrics(): Promise<{
    performance: PerformanceMetrics;
    business: any;
    seo: any;
    timestamp: string;
  }> {
    try {
      this.logger.log('📊 Collecting all system metrics');

      const [performance, business, seo] = await Promise.all([
        this.collectPerformanceMetrics(),
        this.collectBusinessMetrics(),
        this.collectSeoMetrics(),
      ]);

      return {
        performance,
        business,
        seo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error collecting all metrics:', error);
      throw error;
    }
  }

  // Méthodes utilitaires privées
  private async testDatabaseConnection(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('cst_id')
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  private async getCpuUsage(): Promise<number> {
    // Simulation CPU usage (en environnement réel, utiliser 'os' module)
    return Math.random() * 100;
  }

  private async getRequestsPerMinute(): Promise<number> {
    // Simulation - en réel, utiliser un compteur global
    return Math.floor(Math.random() * 1000) + 100;
  }

  private async getErrorRate(): Promise<number> {
    // Simulation - en réel, compter les erreurs/total requests
    return Math.random() * 5;
  }
}
