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
  contentCompleteness: {
    totalPages: number;
    withTitle: number;
    withDescription: number;
    completionPct: number;
  };
  gscConnected: boolean;
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
  type: 'RISK' | 'INTERPOLATION' | 'QUEUE' | 'CONTENT_GAP';
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
    const [
      queueStats,
      riskStats,
      crawlStats,
      contentStats,
      contentCompleteness,
    ] = await Promise.all([
      this.getQueueStats(),
      this.getRiskStats(),
      this.getCrawlStats(),
      this.getContentStats(),
      this.getContentCompleteness(),
    ]);

    // Calculer le health score (inclut la complétude du contenu)
    const healthScore = this.calculateHealthScore(
      riskStats.urlsAtRisk,
      riskStats.totalUrls,
      crawlStats.googlebotAbsent14d,
      queueStats.failed,
      contentCompleteness.completionPct,
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
      contentCompleteness,
      gscConnected: false,
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
    const { data } = await this.callRpc<Record<string, unknown>[]>(
      'get_crawl_activity_by_day',
      {
        p_days: days,
      },
      { source: 'admin' },
    );

    if (!data) return [];

    return data.map((row) => ({
      date: String(row.crawl_date),
      count: Number(row.request_count) || 0,
      avgResponseMs: Math.round(Number(row.avg_response_ms) || 0),
      status2xx: Number(row.status_2xx) || 0,
      status3xx: Number(row.status_3xx) || 0,
      status4xx: Number(row.status_4xx) || 0,
      status5xx: Number(row.status_5xx) || 0,
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

    return data.map((row) => ({
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

    // Content gap alerts — pages missing title or meta_description
    const [missingTitleRes, missingDescRes] = await Promise.all([
      this.supabase
        .from('__seo_page')
        .select('id', { count: 'exact', head: true })
        .is('title', null),
      this.supabase
        .from('__seo_page')
        .select('id', { count: 'exact', head: true })
        .is('meta_description', null),
    ]);

    const missingTitle = missingTitleRes.count || 0;
    const missingDesc = missingDescRes.count || 0;
    const now = new Date().toISOString();

    if (missingTitle > 0) {
      alerts.push({
        id: 'content-gap-title',
        type: 'CONTENT_GAP',
        severity: missingTitle > 100000 ? 'HIGH' : 'MEDIUM',
        message: `${missingTitle.toLocaleString()} pages sans title`,
        url: undefined,
        timestamp: now,
      });
    }

    if (missingDesc > 0) {
      alerts.push({
        id: 'content-gap-description',
        type: 'CONTENT_GAP',
        severity: missingDesc > 100000 ? 'HIGH' : 'MEDIUM',
        message: `${missingDesc.toLocaleString()} pages sans meta_description`,
        url: undefined,
        timestamp: now,
      });
    }

    // Alertes de risk flags - from confusion pairs (actual data)
    const { data: confusionAlerts } = await this.supabase
      .from('__seo_confusion_pairs')
      .select(
        'id, gamme_a_name, gamme_b_name, pair_type, confusion_score, created_at',
      )
      .order('confusion_score', { ascending: false })
      .limit(20);

    if (confusionAlerts) {
      for (const pair of confusionAlerts) {
        alerts.push({
          id: `confusion-${pair.id}`,
          type: 'RISK',
          severity: (pair.confusion_score || 0) >= 80 ? 'HIGH' : 'MEDIUM',
          message: `Confusion ${pair.pair_type}: ${pair.gamme_a_name} ↔ ${pair.gamme_b_name} (score: ${pair.confusion_score}%)`,
          url: undefined,
          timestamp: pair.created_at,
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
    // Use confusion pairs as risk indicators (actual data exists)
    const { data } = await this.supabase
      .from('__seo_confusion_pairs')
      .select(
        'id, gamme_a_name, gamme_b_name, pair_type, confusion_score, created_at',
      )
      .order('confusion_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!data) return [];

    return data.map((row) => ({
      url: `/pieces/${row.gamme_a_name?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`,
      riskType: `CONFUSION_${row.pair_type?.toUpperCase() || 'UNKNOWN'}`,
      urgencyScore: row.confusion_score || 50,
      lastCrawled: row.created_at,
      pageType: 'gamme',
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

  /**
   * Mesure la complétude réelle du contenu SEO (titres, descriptions)
   */
  private async getContentCompleteness(): Promise<{
    totalPages: number;
    withTitle: number;
    withDescription: number;
    completionPct: number;
  }> {
    const [totalRes, titleRes, descRes] = await Promise.all([
      this.supabase
        .from('__seo_page')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('__seo_page')
        .select('id', { count: 'exact', head: true })
        .not('title', 'is', null),
      this.supabase
        .from('__seo_page')
        .select('id', { count: 'exact', head: true })
        .not('meta_description', 'is', null),
    ]);

    const total = totalRes.count || 0;
    const withTitle = titleRes.count || 0;
    const withDescription = descRes.count || 0;
    const completionPct =
      total > 0
        ? Math.round(((withTitle + withDescription) / (total * 2)) * 100)
        : 0;

    return { totalPages: total, withTitle, withDescription, completionPct };
  }

  // ============================================================
  // AUDIT
  // ============================================================

  /**
   * Récupère l'historique d'audit unifié
   */
  async getAuditHistory(
    limit: number = 50,
    type?: string,
  ): Promise<Record<string, unknown>[]> {
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

    return data.map((entry) => ({
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
        this.callRpc<Record<string, unknown>[]>(
          'get_audit_stats_by_admin',
          {},
          { source: 'admin' },
        ),
        this.callRpc<Record<string, unknown>[]>(
          'get_audit_stats_by_type',
          {},
          { source: 'admin' },
        ),
      ]);

    return {
      today: todayRes.count || 0,
      thisWeek: weekRes.count || 0,
      thisMonth: monthRes.count || 0,
      byAdmin: (byAdminRes.data || []).map((r) => ({
        email: String(r.admin_email),
        count: Number(r.count),
      })),
      byType: (byTypeRes.data || []).map((r) => ({
        type: String(r.action_type),
        count: Number(r.count),
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
    // Count total URLs from __seo_page (321K+ rows)
    const { count: totalUrls } = await this.supabase
      .from('__seo_page')
      .select('id', { count: 'exact', head: true });

    // Count confusion pairs as risk indicators
    const { data: confusions } = await this.supabase
      .from('__seo_confusion_pairs')
      .select('pair_type');

    const breakdown = {
      CONFUSION: 0,
      ORPHAN: 0,
      DUPLICATE: 0,
      WEAK_CLUSTER: 0,
      LOW_CRAWL: 0,
    };

    let urlsAtRisk = 0;
    if (confusions) {
      for (const _row of confusions) {
        breakdown.CONFUSION++;
        urlsAtRisk++;
      }
    }

    // ORPHAN stays at 0: __seo_page has no internal_links_count column yet

    return {
      totalUrls: totalUrls || 0,
      urlsAtRisk,
      breakdown,
    };
  }

  private async getCrawlStats(): Promise<DashboardKpis['crawlHealth']> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // __seo_crawl_hub schema: id, path, bucket, hub_type, urls_count, depth, generated_at
    const [hubRes, last24hRes, last7dRes] = await Promise.all([
      this.supabase
        .from('__seo_crawl_hub')
        .select('generated_at, urls_count, hub_type')
        .order('generated_at', { ascending: false })
        .limit(1),
      // Estimate recent activity from __seo_page updates
      this.supabase
        .from('__seo_page')
        .select('id', { count: 'exact', head: true })
        .gte('updated_at', yesterday.toISOString()),
      this.supabase
        .from('__seo_page')
        .select('id', { count: 'exact', head: true })
        .gte('updated_at', lastWeek.toISOString()),
    ]);

    const hub = hubRes.data?.[0];
    const lastGenerated = hub?.generated_at;
    const googlebotAbsent14d = lastGenerated
      ? new Date(lastGenerated) < twoWeeksAgo
      : true;

    return {
      last24h: last24hRes.count || 0,
      last7d: last7dRes.count || 0,
      avgResponseMs: 0, // Not measured yet — no response time data in crawl_hub
      googlebotAbsent14d,
    };
  }

  private calculateHealthScore(
    urlsAtRisk: number,
    totalUrls: number,
    googlebotAbsent: boolean,
    queueFailed: number,
    contentCompletionPct: number,
  ): number {
    let score = 100;

    // Content completeness (40% weight) - most important factor
    score -= Math.round((1 - contentCompletionPct / 100) * 40);

    // URLs at risk penalty (20% weight)
    if (totalUrls > 0) {
      const riskRatio = urlsAtRisk / totalUrls;
      score -= Math.min(20, riskRatio * 100);
    }

    // Googlebot absent penalty (20% weight)
    if (googlebotAbsent) {
      score -= 20;
    }

    // Queue failures penalty (20% weight)
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
