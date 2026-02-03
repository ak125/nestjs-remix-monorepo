/**
 * 🚀 SEO COCKPIT SERVICE - Service unifié pour le dashboard SEO Admin
 *
 * Agrège les données de:
 * - SeoMonitorSchedulerService (queue monitoring)
 * - RiskFlagsEngineService (risk flags)
 * - GooglebotDetectorService (crawl stats)
 * - GammeSeoAuditService (audit history)
 *
 * Pattern: Étend SupabaseBaseService (pas d'injection)
 */

import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { SeoMonitorSchedulerService } from '../../../workers/services/seo-monitor-scheduler.service';
import { RiskFlagsEngineService } from '../../seo/services/risk-flags-engine.service';
import { GooglebotDetectorService } from '../../seo/services/googlebot-detector.service';
import { GammeSeoAuditService } from './gamme-seo-audit.service';

// Types pour le dashboard unifié
export interface DashboardKpis {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  healthScore: number;
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  totalUrls: number;
  urlsAtRisk: number;
  riskBreakdown: {
    CONFUSION: number;
    ORPHAN: number;
    DUPLICATE: number;
    WEAK_CLUSTER: number;
    LOW_CRAWL: number;
  };
  crawlHealth: {
    last24h: number;
    last7d: number;
    avgResponseMs: number;
    googlebotAbsent14d: boolean;
  };
  contentStats: {
    r4References: number;
    r5Diagnostics: number;
    blogArticles: number;
  };
}

export interface ExecutiveSummary {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  healthScore: number;
  urlsAtRisk: number;
  message: string;
  lastUpdated: string;
}

export interface CrawlActivityDay {
  date: string;
  count: number;
  avgResponseMs: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
}

export interface IndexChange {
  url: string;
  oldStatus: string;
  newStatus: string;
  changedAt: string;
}

export interface Alert {
  id: string;
  type: 'RISK' | 'INTERPOLATION' | 'QUEUE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  url?: string;
  timestamp: string;
}

export interface UrlAtRisk {
  url: string;
  riskType: string;
  urgencyScore: number;
  lastCrawled: string | null;
  pageType: string;
}

@Injectable()
export class SeoCockpitService extends SupabaseBaseService {
  constructor(
    private readonly schedulerService: SeoMonitorSchedulerService,
    private readonly riskFlagsEngine: RiskFlagsEngineService,
    private readonly googlebotDetector: GooglebotDetectorService,
    private readonly gammeSeoAudit: GammeSeoAuditService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  // ============================================================
  // DASHBOARD UNIFIÉ
  // ============================================================

  /**
   * Récupère le dashboard unifié avec tous les KPIs
   */
  async getUnifiedDashboard(): Promise<DashboardKpis> {
    // Récupérer les stats en parallèle
    const [queueStats, riskStats, crawlStats, contentStats] = await Promise.all(
      [
        this.getQueueStats(),
        this.getRiskStats(),
        this.getCrawlStats(),
        this.getContentStats(),
      ],
    );

    // Calculer le health score
    const healthScore = this.calculateHealthScore(
      riskStats.urlsAtRisk,
      riskStats.totalUrls,
      crawlStats.googlebotAbsent14d,
      queueStats.failed,
    );

    // Déterminer le status
    const status = this.determineStatus(healthScore);

    return {
      status,
      healthScore,
      queueStats,
      totalUrls: riskStats.totalUrls,
      urlsAtRisk: riskStats.urlsAtRisk,
      riskBreakdown: riskStats.breakdown,
      crawlHealth: crawlStats,
      contentStats,
    };
  }

  /**
   * Résumé exécutif pour affichage rapide
   */
  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const dashboard = await this.getUnifiedDashboard();

    let message = 'SEO health is good';
    if (dashboard.status === 'WARNING') {
      message = `${dashboard.urlsAtRisk} URLs need attention`;
    } else if (dashboard.status === 'CRITICAL') {
      message = `Critical: ${dashboard.urlsAtRisk} URLs at risk, immediate action required`;
    }

    return {
      status: dashboard.status,
      healthScore: dashboard.healthScore,
      urlsAtRisk: dashboard.urlsAtRisk,
      message,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ============================================================
  // MONITORING
  // ============================================================

  /**
   * Récupère l'activité de crawl sur N jours
   */
  async getCrawlActivity(days: number = 30): Promise<CrawlActivityDay[]> {
    // 🛡️ RPC Safety Gate
    const { data } = await this.callRpc<any[]>(
      'get_crawl_activity_by_day',
      {
        p_days: days,
      },
      { source: 'admin' },
    );

    if (!data) return [];

    return data.map((row: any) => ({
      date: row.crawl_date,
      count: row.request_count || 0,
      avgResponseMs: Math.round(row.avg_response_ms || 0),
      status2xx: row.status_2xx || 0,
      status3xx: row.status_3xx || 0,
      status4xx: row.status_4xx || 0,
      status5xx: row.status_5xx || 0,
    }));
  }

  /**
   * Récupère les changements d'indexation récents
   */
  async getIndexChanges(limit: number = 50): Promise<IndexChange[]> {
    const { data } = await this.supabase
      .from('__seo_index_history')
      .select('url, old_status, new_status, changed_at')
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((row: any) => ({
      url: row.url,
      oldStatus: row.old_status || 'UNKNOWN',
      newStatus: row.new_status || 'UNKNOWN',
      changedAt: row.changed_at,
    }));
  }

  /**
   * Récupère les alertes consolidées
   */
  async getConsolidatedAlerts(limit: number = 50): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // Alertes d'interpolation
    const { data: interpAlerts } = await this.supabase
      .from('__seo_interpolation_alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (interpAlerts) {
      for (const alert of interpAlerts) {
        alerts.push({
          id: `interp-${alert.id}`,
          type: 'INTERPOLATION',
          severity: alert.severity || 'MEDIUM',
          message: alert.message || 'Variable interpolation issue',
          url: alert.url,
          timestamp: alert.created_at,
        });
      }
    }

    // Alertes de risk flags (URLs critiques)
    const { data: riskAlerts } = await this.supabase
      .from('__seo_entity_health')
      .select('url, risk_flag, urgency_score, updated_at')
      .gte('urgency_score', 80)
      .order('urgency_score', { ascending: false })
      .limit(20);

    if (riskAlerts) {
      for (const alert of riskAlerts) {
        alerts.push({
          id: `risk-${alert.url}`,
          type: 'RISK',
          severity: alert.urgency_score >= 90 ? 'HIGH' : 'MEDIUM',
          message: `${alert.risk_flag}: urgency score ${alert.urgency_score}%`,
          url: alert.url,
          timestamp: alert.updated_at,
        });
      }
    }

    // Trier par timestamp et limiter
    return alerts
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Récupère les URLs à risque triées par urgence
   */
  async getUrlsAtRisk(
    limit: number = 100,
    offset: number = 0,
  ): Promise<UrlAtRisk[]> {
    const { data } = await this.supabase
      .from('__seo_entity_health')
      .select('url, risk_flag, urgency_score, last_crawled, page_type')
      .not('risk_flag', 'is', null)
      .order('urgency_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!data) return [];

    return data.map((row: any) => ({
      url: row.url,
      riskType: row.risk_flag,
      urgencyScore: row.urgency_score || 0,
      lastCrawled: row.last_crawled,
      pageType: row.page_type || 'unknown',
    }));
  }

  // ============================================================
  // CONTENT STATS
  // ============================================================

  /**
   * Récupère les stats de contenu SEO
   */
  async getContentStats(): Promise<{
    r4References: number;
    r5Diagnostics: number;
    blogArticles: number;
  }> {
    const [r4Count, r5Count, blogCount] = await Promise.all([
      this.supabase
        .from('__seo_reference')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('__seo_observable')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('__blog_advice')
        .select('id', { count: 'exact', head: true }),
    ]);

    return {
      r4References: r4Count.count || 0,
      r5Diagnostics: r5Count.count || 0,
      blogArticles: blogCount.count || 0,
    };
  }

  // ============================================================
  // AUDIT
  // ============================================================

  /**
   * Récupère l'historique d'audit unifié
   */
  async getAuditHistory(limit: number = 50, type?: string): Promise<any[]> {
    let query = this.supabase
      .from('gamme_seo_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('action_type', type);
    }

    const { data } = await query;

    if (!data) return [];

    return data.map((entry: any) => ({
      id: entry.id,
      adminEmail: entry.admin_email,
      actionType: entry.action_type,
      entityType: entry.entity_type,
      entityIds: entry.entity_ids,
      impactSummary: entry.impact_summary,
      createdAt: entry.created_at,
      details: entry.old_values || entry.new_values,
    }));
  }

  /**
   * Récupère les stats d'audit
   */
  async getAuditStats(): Promise<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    byAdmin: { email: string; count: number }[];
    byType: { type: string; count: number }[];
  }> {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const startOfWeek = new Date(
      now.setDate(now.getDate() - now.getDay()),
    ).toISOString();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();

    // 🛡️ RPC Safety Gate
    const [todayRes, weekRes, monthRes, byAdminRes, byTypeRes] =
      await Promise.all([
        this.supabase
          .from('gamme_seo_audit')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfDay),
        this.supabase
          .from('gamme_seo_audit')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfWeek),
        this.supabase
          .from('gamme_seo_audit')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        this.callRpc<any[]>(
          'get_audit_stats_by_admin',
          {},
          { source: 'admin' },
        ),
        this.callRpc<any[]>('get_audit_stats_by_type', {}, { source: 'admin' }),
      ]);

    return {
      today: todayRes.count || 0,
      thisWeek: weekRes.count || 0,
      thisMonth: monthRes.count || 0,
      byAdmin: (byAdminRes.data || []).map((r: any) => ({
        email: r.admin_email,
        count: r.count,
      })),
      byType: (byTypeRes.data || []).map((r: any) => ({
        type: r.action_type,
        count: r.count,
      })),
    };
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  /**
   * Rafraîchit tous les risk flags
   */
  async refreshAllRisks(): Promise<{ message: string; count: number }> {
    try {
      await this.riskFlagsEngine.refreshAllRiskFlags();
      return { message: 'Risk flags refreshed successfully', count: 0 };
    } catch (error) {
      this.logger.error('Failed to refresh risk flags', error);
      return { message: 'Failed to refresh risk flags', count: 0 };
    }
  }

  /**
   * Déclenche le monitoring SEO manuellement
   */
  async triggerMonitor(): Promise<{ message: string }> {
    try {
      await this.schedulerService.triggerManualCheck();
      return { message: 'SEO monitor triggered successfully' };
    } catch (error) {
      this.logger.error('Failed to trigger monitor', error);
      return { message: 'Failed to trigger monitor' };
    }
  }

  // ============================================================
  // HELPERS PRIVÉS
  // ============================================================

  private async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    try {
      const stats = await this.schedulerService.getQueueStats();
      return {
        waiting: stats?.waiting || 0,
        active: stats?.active || 0,
        completed: stats?.completed || 0,
        failed: stats?.failed || 0,
      };
    } catch {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }
  }

  private async getRiskStats(): Promise<{
    totalUrls: number;
    urlsAtRisk: number;
    breakdown: DashboardKpis['riskBreakdown'];
  }> {
    const { data, count } = await this.supabase
      .from('__seo_entity_health')
      .select('risk_flag', { count: 'exact' });

    const breakdown = {
      CONFUSION: 0,
      ORPHAN: 0,
      DUPLICATE: 0,
      WEAK_CLUSTER: 0,
      LOW_CRAWL: 0,
    };

    let urlsAtRisk = 0;
    if (data) {
      for (const row of data) {
        if (row.risk_flag && breakdown.hasOwnProperty(row.risk_flag)) {
          breakdown[row.risk_flag as keyof typeof breakdown]++;
          urlsAtRisk++;
        }
      }
    }

    return {
      totalUrls: count || 0,
      urlsAtRisk,
      breakdown,
    };
  }

  private async getCrawlStats(): Promise<DashboardKpis['crawlHealth']> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 🛡️ RPC Safety Gate
    const [last24hRes, last7dRes, avgRes, lastCrawlRes] = await Promise.all([
      this.supabase
        .from('__seo_crawl_log')
        .select('id', { count: 'exact', head: true })
        .gte('crawled_at', yesterday.toISOString()),
      this.supabase
        .from('__seo_crawl_log')
        .select('id', { count: 'exact', head: true })
        .gte('crawled_at', lastWeek.toISOString()),
      this.callRpc<number>(
        'get_avg_crawl_response_time',
        {},
        { source: 'admin' },
      ),
      this.supabase
        .from('__seo_crawl_log')
        .select('crawled_at')
        .order('crawled_at', { ascending: false })
        .limit(1),
    ]);

    const lastCrawl = lastCrawlRes.data?.[0]?.crawled_at;
    const googlebotAbsent14d = lastCrawl
      ? new Date(lastCrawl) < twoWeeksAgo
      : true;

    return {
      last24h: last24hRes.count || 0,
      last7d: last7dRes.count || 0,
      avgResponseMs: avgRes.data || 0,
      googlebotAbsent14d,
    };
  }

  private calculateHealthScore(
    urlsAtRisk: number,
    totalUrls: number,
    googlebotAbsent: boolean,
    queueFailed: number,
  ): number {
    let score = 100;

    // Pénalité pour URLs à risque
    if (totalUrls > 0) {
      const riskRatio = urlsAtRisk / totalUrls;
      score -= Math.min(40, riskRatio * 100);
    }

    // Pénalité si Googlebot absent
    if (googlebotAbsent) {
      score -= 20;
    }

    // Pénalité pour échecs de queue
    score -= Math.min(20, queueFailed * 2);

    return Math.max(0, Math.round(score));
  }

  private determineStatus(
    healthScore: number,
  ): 'HEALTHY' | 'WARNING' | 'CRITICAL' {
    if (healthScore >= 80) return 'HEALTHY';
    if (healthScore >= 50) return 'WARNING';
    return 'CRITICAL';
  }
}
