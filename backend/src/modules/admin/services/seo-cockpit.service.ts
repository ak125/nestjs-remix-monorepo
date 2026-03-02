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

    // Content gap alerts — active gammes (pieces_gamme level 1-2) missing SEO metadata
    const [totalGammesRes, seoCompletenessRes] = await Promise.all([
      this.supabase
        .from('pieces_gamme')
        .select('pg_id', { count: 'exact', head: true })
        .eq('pg_display', '1')
        .in('pg_level', ['1', '2']),
      this.callRpc<{ with_title: number; with_desc: number }[]>(
        'get_gamme_seo_completeness',
        {},
        { source: 'admin' },
      ),
    ]);

    const totalGammes = totalGammesRes.count || 0;
    const gammesWithSeo = seoCompletenessRes.data?.[0]?.with_title || 0;
    const gammesMissingSeo = totalGammes - gammesWithSeo;
    const now = new Date().toISOString();

    if (gammesMissingSeo > 0) {
      alerts.push({
        id: 'content-gap-gammes',
        type: 'CONTENT_GAP',
        severity: gammesMissingSeo > 50 ? 'HIGH' : 'MEDIUM',
        message: `${gammesMissingSeo} gammes actives sans metadata SEO (title/h1/description)`,
        url: '/admin/gammes-seo',
        timestamp: now,
      });
    }

    // Alertes de risk flags - from confusion pairs (actual data)
    const { data: confusionAlerts } = await this.supabase
      .from('__seo_confusion_pairs')
      .select(
        'scp_id, scp_piece_a, scp_piece_b, scp_category, scp_severity, scp_penalty_critical, scp_message_fr, scp_created_at',
      )
      .eq('scp_enabled', true)
      .order('scp_penalty_critical', { ascending: false, nullsFirst: false })
      .limit(20);

    if (confusionAlerts) {
      for (const pair of confusionAlerts) {
        alerts.push({
          id: `confusion-${pair.scp_id}`,
          type: 'RISK',
          severity: (pair.scp_penalty_critical || 0) >= 15 ? 'HIGH' : 'MEDIUM',
          message: `Confusion ${pair.scp_category}: ${pair.scp_piece_a} ↔ ${pair.scp_piece_b} (${pair.scp_severity})`,
          url: undefined,
          timestamp: pair.scp_created_at,
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
        'scp_id, scp_piece_a, scp_piece_b, scp_category, scp_severity, scp_penalty_critical, scp_created_at',
      )
      .eq('scp_enabled', true)
      .order('scp_penalty_critical', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (!data) return [];

    return data.map((row) => {
      const slug = (row.scp_piece_a || 'unknown')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      return {
        url: `/pieces/${slug}`,
        riskType: `CONFUSION_${(row.scp_category || 'UNKNOWN').toUpperCase()}`,
        urgencyScore: row.scp_penalty_critical || 5,
        lastCrawled: row.scp_created_at,
        pageType: 'gamme' as const,
      };
    });
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
   * Mesure la complétude SEO des gammes actives
   * Base: pieces_gamme (pg_display='1', level 1-2) = 232 gammes actives
   * Couverture: JOIN __seo_gamme pour titre/description manuels (140/232 ≈ 60%)
   */
  private async getContentCompleteness(): Promise<{
    totalPages: number;
    withTitle: number;
    withDescription: number;
    completionPct: number;
  }> {
    // Total gammes actives (categories level 1-2 affichées)
    const { count: total } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id', { count: 'exact', head: true })
      .eq('pg_display', '1')
      .in('pg_level', ['1', '2']);

    // Gammes avec metadata SEO (JOIN pieces_gamme ↔ __seo_gamme via RPC)
    const { data: seoData } = await this.callRpc<
      { with_title: number; with_desc: number }[]
    >('get_gamme_seo_completeness', {}, { source: 'admin' });

    const totalPages = total || 0;
    const withTitle = seoData?.[0]?.with_title || 0;
    const withDescription = seoData?.[0]?.with_desc || 0;
    const completionPct =
      totalPages > 0
        ? Math.round(((withTitle + withDescription) / (totalPages * 2)) * 100)
        : 0;

    return { totalPages, withTitle, withDescription, completionPct };
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
      .select('scp_category')
      .eq('scp_enabled', true);

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
    // Crawl tracking not active yet (__seo_crawl_log is empty, no Googlebot middleware)
    // Don't penalize health score for missing crawl data
    return {
      last24h: 0,
      last7d: 0,
      avgResponseMs: 0,
      googlebotAbsent14d: false,
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

    // Content completeness (30%) — gamme SEO coverage (140/232 ≈ 60%)
    score -= Math.round((1 - contentCompletionPct / 100) * 30);

    // Confusion risk (30%) — actual risk data from __seo_confusion_pairs
    if (totalUrls > 0) {
      const riskRatio = urlsAtRisk / totalUrls;
      score -= Math.min(30, Math.round(riskRatio * 1000));
    }

    // Googlebot crawl (20%) — only penalize when tracking is active
    if (googlebotAbsent) {
      score -= 20;
    }

    // Queue failures (20%)
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
