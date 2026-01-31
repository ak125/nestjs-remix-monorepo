/**
 * 🎯 SEO COCKPIT SERVICE - Agrégation unifiée des données SEO
 *
 * Sources de données:
 * - SeoMonitorSchedulerService (workers queue monitoring)
 * - RiskFlagsEngineService (risk flags engine)
 * - GooglebotDetectorService (crawl detection)
 * - GammeSeoAuditService (gammes audit)
 * - SupabaseService (direct queries for content stats)
 */

import { Injectable } from '@nestjs/common';
import { SeoMonitorSchedulerService } from '../../../workers/services/seo-monitor-scheduler.service';
import { RiskFlagsEngineService } from '../../seo/services/risk-flags-engine.service';
import { GooglebotDetectorService } from '../../seo/services/googlebot-detector.service';
import { GammeSeoAuditService } from './gamme-seo-audit.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

// Types for unified dashboard
export interface UnifiedDashboardKpis {
  // Global health
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  healthScore: number;

  // Queue monitoring (from AdminSeoController)
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  lastCheckTimestamp: string | null;
  checksLast24h: number;
  failedChecksLast24h: number;

  // Risk flags (from SeoDashboardController)
  totalUrls: number;
  urlsAtRisk: number;
  riskBreakdown: {
    CONFUSION: number;
    ORPHAN: number;
    DUPLICATE: number;
    WEAK_CLUSTER: number;
    LOW_CRAWL: number;
  };

  // Crawl health (from GooglebotDetector)
  crawlHealth: {
    last24h: number;
    last7d: number;
    avgResponseMs: number;
    googlebotAbsent14d: number;
  };

  // Content stats (from Supabase)
  contentStats: {
    r4References: { total: number; published: number; draft: number };
    r5Diagnostics: { total: number; published: number; draft: number };
    blogArticles: { total: number; published: number };
  };
}

export interface ExecutiveSummary {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  headline: string;
  topIssues: { flag: string; count: number; severity: string }[];
  crawlTrend: 'UP' | 'DOWN' | 'STABLE';
  recommendations: string[];
}

export interface ConsolidatedAlert {
  id: string;
  type: 'risk_flag' | 'queue_error' | 'interpolation' | 'index_change';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  url?: string;
  details?: Record<string, any>;
  timestamp: string;
}

@Injectable()
export class SeoCockpitService extends SupabaseBaseService {
  constructor(
    private readonly schedulerService: SeoMonitorSchedulerService,
    private readonly riskFlagsEngine: RiskFlagsEngineService,
    private readonly googlebotDetector: GooglebotDetectorService,
    private readonly gammeSeoAudit: GammeSeoAuditService,
  ) {
    super();
  }

  /**
   * 📊 Dashboard unifié - Agrège toutes les sources
   */
  async getUnifiedDashboard(): Promise<UnifiedDashboardKpis> {
    // Exécuter toutes les requêtes en parallèle
    const [queueData, riskData, crawlStats, contentStats] = await Promise.all([
      this.getQueueMonitoringData(),
      this.getRiskFlagsData(),
      this.getCrawlHealthData(),
      this.getContentStats(),
    ]);

    // Calculer le health score global
    const healthScore = this.calculateHealthScore(
      queueData,
      riskData,
      crawlStats,
    );

    // Déterminer le status global
    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (healthScore < 60) {
      status = 'CRITICAL';
    } else if (healthScore < 80) {
      status = 'WARNING';
    }

    return {
      status,
      healthScore,
      queueStats: queueData.queueStats,
      lastCheckTimestamp: queueData.lastCheckTimestamp,
      checksLast24h: queueData.checksLast24h,
      failedChecksLast24h: queueData.failedChecksLast24h,
      totalUrls: riskData.totalUrls,
      urlsAtRisk: riskData.urlsAtRisk,
      riskBreakdown: riskData.riskBreakdown,
      crawlHealth: crawlStats,
      contentStats,
    };
  }

  /**
   * 📈 Résumé exécutif pour affichage rapide
   */
  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const [riskData, crawlStats] = await Promise.all([
      this.getRiskFlagsData(),
      this.getCrawlHealthData(),
    ]);

    // Déterminer le status et headline
    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    let headline = 'SEO health is good';
    const recommendations: string[] = [];

    if (riskData.riskBreakdown.CONFUSION > 0) {
      status = 'CRITICAL';
      headline = `${riskData.riskBreakdown.CONFUSION} URLs avec risque CONFUSION (BLOQUANT)`;
      recommendations.push('Résoudre les conflits de confusion en priorité');
    } else if (crawlStats.googlebotAbsent14d > 1000) {
      status = 'CRITICAL';
      headline = `${crawlStats.googlebotAbsent14d} URLs indexées non crawlées depuis 14+ jours`;
      recommendations.push('Vérifier robots.txt et sitemap');
      recommendations.push('Soumettre sitemap à Search Console');
    } else if (riskData.riskBreakdown.ORPHAN > 500) {
      status = 'WARNING';
      headline = `${riskData.riskBreakdown.ORPHAN} URLs orphelines à risque`;
      recommendations.push('Améliorer le maillage interne');
    } else if (riskData.urlsAtRisk > riskData.totalUrls * 0.05) {
      status = 'WARNING';
      headline = `${riskData.urlsAtRisk} URLs à risque (${((riskData.urlsAtRisk / riskData.totalUrls) * 100).toFixed(1)}%)`;
      recommendations.push('Analyser les pages à risque');
    }

    // Top issues
    const topIssues = [
      {
        flag: 'CONFUSION',
        count: riskData.riskBreakdown.CONFUSION,
        severity: 'CRITICAL',
      },
      {
        flag: 'ORPHAN',
        count: riskData.riskBreakdown.ORPHAN,
        severity: 'HIGH',
      },
      {
        flag: 'LOW_CRAWL',
        count: riskData.riskBreakdown.LOW_CRAWL,
        severity: 'MEDIUM',
      },
      {
        flag: 'WEAK_CLUSTER',
        count: riskData.riskBreakdown.WEAK_CLUSTER,
        severity: 'MEDIUM',
      },
      {
        flag: 'DUPLICATE',
        count: riskData.riskBreakdown.DUPLICATE,
        severity: 'LOW',
      },
    ]
      .filter((i) => i.count > 0)
      .slice(0, 5);

    // Crawl trend
    let crawlTrend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
    const avgDaily = crawlStats.last7d / 7;
    if (crawlStats.last24h > avgDaily * 1.2) {
      crawlTrend = 'UP';
    } else if (crawlStats.last24h < avgDaily * 0.8) {
      crawlTrend = 'DOWN';
      recommendations.push('Activité crawl en baisse - surveiller');
    }

    return { status, headline, topIssues, crawlTrend, recommendations };
  }

  /**
   * 🤖 Activité de crawl
   */
  async getCrawlActivity(_days: number = 30): Promise<any[]> {
    try {
      return await this.riskFlagsEngine.getCrawlActivity();
    } catch (error) {
      this.logger.error(`getCrawlActivity error: ${error}`);
      return [];
    }
  }

  /**
   * 📑 Changements d'indexation
   */
  async getIndexChanges(limit: number = 50): Promise<any[]> {
    try {
      return await this.riskFlagsEngine.getIndexChanges(limit);
    } catch (error) {
      this.logger.error(`getIndexChanges error: ${error}`);
      return [];
    }
  }

  /**
   * ⚠️ Alertes consolidées de toutes les sources
   */
  async getConsolidatedAlerts(
    limit: number = 50,
  ): Promise<ConsolidatedAlert[]> {
    const alerts: ConsolidatedAlert[] = [];

    try {
      // 1. Risk flags alerts
      const riskyUrls = await this.riskFlagsEngine.getUrlsAtRisk(20, 0);
      for (const url of riskyUrls) {
        alerts.push({
          id: `risk-${url.url?.slice(-20)}`,
          type: 'risk_flag',
          severity: url.riskFlag === 'CONFUSION' ? 'critical' : 'high',
          message: `URL à risque: ${url.riskFlag}`,
          url: url.url,
          details: { riskFlag: url.riskFlag, urgencyScore: url.urgencyScore },
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Queue errors (from scheduler)
      const recentJobs = await this.schedulerService.getRecentJobs(10);
      for (const job of recentJobs) {
        if (job.returnvalue?.errorCount > 0) {
          for (const alert of (job.returnvalue?.alerts || []).filter(
            (a: any) => a.status === 'error',
          )) {
            alerts.push({
              id: `queue-${job.id}-${alert.url?.slice(-10)}`,
              type: 'queue_error',
              severity: alert.piecesCount === 0 ? 'critical' : 'high',
              message: `Monitoring: ${alert.message || 'Error detected'}`,
              url: alert.url,
              details: { piecesCount: alert.piecesCount, typeId: alert.typeId },
              timestamp: new Date(job.finishedOn).toISOString(),
            });
          }
        }
      }

      // 3. Interpolation alerts (from Supabase)
      const { data: interpAlerts } = await this.supabase
        .from('__seo_interpolation_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      for (const alert of interpAlerts || []) {
        alerts.push({
          id: `interp-${alert.id}`,
          type: 'interpolation',
          severity: 'medium',
          message: `Variable non-interpolée: ${alert.field} - ${alert.uninterpolated_vars}`,
          details: {
            pgId: alert.pg_id,
            typeId: alert.type_id,
            field: alert.field,
          },
          timestamp: alert.created_at,
        });
      }

      // Trier par timestamp et limiter
      return alerts
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error(`getConsolidatedAlerts error: ${error}`);
      return [];
    }
  }

  /**
   * 🔍 URLs à risque
   */
  async getUrlsAtRisk(limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      return await this.riskFlagsEngine.getUrlsAtRisk(limit, offset);
    } catch (error) {
      this.logger.error(`getUrlsAtRisk error: ${error}`);
      return [];
    }
  }

  /**
   * 📝 Stats de contenu SEO
   */
  async getContentStats(): Promise<any> {
    try {
      const client = this.supabase;

      // Requêtes en parallèle
      const [
        r4Total,
        r4Published,
        r5Total,
        r5Published,
        blogTotal,
        blogPublished,
      ] = await Promise.all([
        client
          .from('__seo_reference')
          .select('id', { count: 'exact', head: true }),
        client
          .from('__seo_reference')
          .select('id', { count: 'exact', head: true })
          .eq('sr_status', 'published'),
        client
          .from('__seo_observable')
          .select('id', { count: 'exact', head: true }),
        client
          .from('__seo_observable')
          .select('id', { count: 'exact', head: true })
          .eq('so_status', 'published'),
        client
          .from('__blog_advice')
          .select('ba_id', { count: 'exact', head: true }),
        client
          .from('__blog_advice')
          .select('ba_id', { count: 'exact', head: true })
          .eq('ba_status', 'published'),
      ]);

      return {
        r4References: {
          total: r4Total.count || 0,
          published: r4Published.count || 0,
          draft: (r4Total.count || 0) - (r4Published.count || 0),
        },
        r5Diagnostics: {
          total: r5Total.count || 0,
          published: r5Published.count || 0,
          draft: (r5Total.count || 0) - (r5Published.count || 0),
        },
        blogArticles: {
          total: blogTotal.count || 0,
          published: blogPublished.count || 0,
        },
      };
    } catch (error) {
      this.logger.error(`getContentStats error: ${error}`);
      return {
        r4References: { total: 0, published: 0, draft: 0 },
        r5Diagnostics: { total: 0, published: 0, draft: 0 },
        blogArticles: { total: 0, published: 0 },
      };
    }
  }

  /**
   * 📜 Historique d'audit unifié
   */
  async getAuditHistory(limit: number = 50, _type?: string): Promise<any[]> {
    try {
      // Gammes SEO audit
      const result = await this.gammeSeoAudit.getAuditHistory({ limit });
      const gammeAudit = result.data;

      // Mapper vers format unifié
      return gammeAudit.map((a: any) => ({
        id: a.id,
        type: 'gamme_seo',
        action: a.action,
        target: `pg_id: ${a.pg_id}`,
        admin: a.admin_email,
        details: a.details,
        timestamp: a.created_at,
      }));
    } catch (error) {
      this.logger.error(`getAuditHistory error: ${error}`);
      return [];
    }
  }

  /**
   * 📊 Stats d'audit
   */
  async getAuditStats(): Promise<any> {
    try {
      return await this.gammeSeoAudit.getAuditStats();
    } catch (error) {
      this.logger.error(`getAuditStats error: ${error}`);
      return { actionsToday: 0, actionsThisWeek: 0, topAdmins: [] };
    }
  }

  /**
   * 🔄 Refresh all risks
   */
  async refreshAllRisks(): Promise<any> {
    return await this.riskFlagsEngine.refreshAllRiskFlags();
  }

  /**
   * 🔄 Trigger monitor
   */
  async triggerMonitor(): Promise<any> {
    await this.schedulerService.triggerManualCheck();
    return { triggered: true, timestamp: new Date().toISOString() };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async getQueueMonitoringData(): Promise<any> {
    try {
      const stats = await this.schedulerService.getQueueStats();
      const recentJobs = await this.schedulerService.getRecentJobs(50);

      const checksLast24h = recentJobs.filter((j) => {
        const jobTime = new Date(j.finishedOn).getTime();
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return jobTime > dayAgo;
      }).length;

      const failedChecksLast24h = recentJobs.filter((j) => {
        const jobTime = new Date(j.finishedOn).getTime();
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return jobTime > dayAgo && j.returnvalue?.errorCount > 0;
      }).length;

      const lastJob = recentJobs[0];

      return {
        queueStats: stats,
        lastCheckTimestamp: lastJob
          ? new Date(lastJob.finishedOn).toISOString()
          : null,
        checksLast24h,
        failedChecksLast24h,
      };
    } catch (error) {
      this.logger.error(`getQueueMonitoringData error: ${error}`);
      return {
        queueStats: { waiting: 0, active: 0, completed: 0, failed: 0 },
        lastCheckTimestamp: null,
        checksLast24h: 0,
        failedChecksLast24h: 0,
      };
    }
  }

  private async getRiskFlagsData(): Promise<any> {
    try {
      return await this.riskFlagsEngine.getDashboardStats();
    } catch (error) {
      this.logger.error(`getRiskFlagsData error: ${error}`);
      return {
        totalUrls: 0,
        urlsAtRisk: 0,
        riskBreakdown: {
          CONFUSION: 0,
          ORPHAN: 0,
          DUPLICATE: 0,
          WEAK_CLUSTER: 0,
          LOW_CRAWL: 0,
        },
      };
    }
  }

  private async getCrawlHealthData(): Promise<any> {
    try {
      const stats = await this.googlebotDetector.getCrawlStats();
      return {
        last24h: stats.last24h || 0,
        last7d: stats.last7d || 0,
        avgResponseMs: stats.avgResponseMs || 0,
        googlebotAbsent14d: 0, // TODO: Implement this query
      };
    } catch (error) {
      this.logger.error(`getCrawlHealthData error: ${error}`);
      return { last24h: 0, last7d: 0, avgResponseMs: 0, googlebotAbsent14d: 0 };
    }
  }

  private calculateHealthScore(
    queueData: any,
    riskData: any,
    crawlStats: any,
  ): number {
    let score = 100;

    // Pénalités risk flags
    if (riskData.riskBreakdown?.CONFUSION > 0) score -= 30;
    if (riskData.riskBreakdown?.ORPHAN > 100) score -= 15;
    if (riskData.riskBreakdown?.ORPHAN > 500) score -= 10;

    // Pénalités queue
    if (queueData.failedChecksLast24h > 5) score -= 10;
    if (queueData.failedChecksLast24h > 20) score -= 10;

    // Pénalités crawl
    if (crawlStats.last24h < 100) score -= 10;
    if (crawlStats.avgResponseMs > 2000) score -= 5;

    return Math.max(0, score);
  }
}
