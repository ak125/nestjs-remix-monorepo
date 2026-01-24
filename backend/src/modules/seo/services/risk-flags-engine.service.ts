/**
 * RiskFlagsEngine - Calcul des risk flags pour le dashboard SEO Enterprise
 *
 * Risk Flags:
 * - CONFUSION: confusion_risk >= 50 (BLOQUANT)
 * - ORPHAN: inbound_links = 0 (va sauter)
 * - DUPLICATE: duplication_risk > 50 (instable)
 * - WEAK_CLUSTER: cluster_size < 3 (fragile)
 * - LOW_CRAWL: crawl_frequency < 0.5/week (ignoré)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type RiskFlag =
  | 'CONFUSION'
  | 'ORPHAN'
  | 'DUPLICATE'
  | 'WEAK_CLUSTER'
  | 'LOW_CRAWL';

export type AlertType =
  | 'BLOQUANT'
  | 'DANGER'
  | 'DESINDEXATION_PROBABLE'
  | 'RISQUE'
  | 'INSTABLE'
  | 'FRAGILE'
  | 'SURVEILLANCE';

export interface EntityMetrics {
  url: string;
  entityId?: number;
  confusionRisk: number;
  inboundLinks: number;
  duplicationRisk: number;
  clusterSize: number;
  crawlFrequency: number;
}

export interface EntityHealth {
  url: string;
  entityScore: number;
  clusterSize: number;
  crawlFrequency: number;
  indexStability: number;
  riskFlag: RiskFlag | null;
  riskLevel: number;
  alertType: AlertType;
}

export interface RiskAlert {
  url: string;
  riskFlag: RiskFlag | null;
  urgencyScore: number;
  alertType: AlertType;
  crawlFrequency: number;
  indexStability: number;
  clusterSize: number;
  isIndexed: boolean;
  lastCrawlAt: Date | null;
}

export interface DashboardStats {
  totalUrls: number;
  indexedUrls: number;
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
    googlebotAbsent14d: number;
  };
}

export interface RefreshResult {
  updated: number;
  orphanCount: number;
  duplicateCount: number;
  weakClusterCount: number;
  lowCrawlCount: number;
  confusionCount: number;
}

@Injectable()
export class RiskFlagsEngineService {
  private readonly logger = new Logger(RiskFlagsEngineService.name);
  private readonly supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '');
  }

  /**
   * Calculate risk flag from entity metrics
   * Priority order: CONFUSION > ORPHAN > DUPLICATE > WEAK_CLUSTER > LOW_CRAWL
   */
  calculateRiskFlag(metrics: EntityMetrics): RiskFlag | null {
    // CONFUSION is BLOCKING - highest priority
    if (metrics.confusionRisk >= 50) return 'CONFUSION';

    // ORPHAN - no inbound links, will be dropped
    if (metrics.inboundLinks === 0) return 'ORPHAN';

    // DUPLICATE - high duplication risk, unstable
    if (metrics.duplicationRisk > 50) return 'DUPLICATE';

    // WEAK_CLUSTER - small cluster, fragile
    if (metrics.clusterSize < 3) return 'WEAK_CLUSTER';

    // LOW_CRAWL - low crawl frequency, being ignored
    if (metrics.crawlFrequency < 0.5) return 'LOW_CRAWL';

    return null;
  }

  /**
   * Calculate risk level (0-100) from metrics
   */
  calculateRiskLevel(metrics: EntityMetrics, flag: RiskFlag | null): number {
    if (!flag) return 0;

    switch (flag) {
      case 'CONFUSION':
        return 100; // Always max urgency
      case 'ORPHAN':
        return 90; // Very high urgency
      case 'DUPLICATE':
        return Math.min(100, 50 + Math.floor(metrics.duplicationRisk / 2));
      case 'WEAK_CLUSTER':
        return Math.max(40, 60 - metrics.clusterSize * 10);
      case 'LOW_CRAWL':
        return Math.max(
          50,
          70 - Math.floor((metrics.crawlFrequency || 0) * 100),
        );
      default:
        return 0;
    }
  }

  /**
   * Get alert type from risk flag
   */
  getAlertType(flag: RiskFlag | null, isStale: boolean = false): AlertType {
    if (flag === 'CONFUSION') return 'BLOQUANT';
    if (flag === 'ORPHAN') return 'DANGER';
    if (isStale) return 'DESINDEXATION_PROBABLE';
    if (flag === 'LOW_CRAWL' || flag === 'WEAK_CLUSTER') return 'RISQUE';
    if (flag === 'DUPLICATE') return 'INSTABLE';
    return 'SURVEILLANCE';
  }

  /**
   * Evaluate health for a single entity
   */
  async evaluateEntityHealth(url: string): Promise<EntityHealth | null> {
    try {
      // Get metrics from __seo_entity_score_v10
      const { data: scoreData, error: scoreError } = await this.supabase
        .from('__seo_entity_score_v10')
        .select('*')
        .eq('url', url)
        .single();

      if (scoreError || !scoreData) {
        return null;
      }

      const metrics: EntityMetrics = {
        url,
        entityId: scoreData.entity_id,
        confusionRisk: scoreData.confusion_risk || 0,
        inboundLinks: scoreData.inbound_links || 0,
        duplicationRisk: scoreData.duplication_risk || 0,
        clusterSize: scoreData.cluster_size || 0,
        crawlFrequency: 0, // Will be calculated from crawl_log
      };

      const riskFlag = this.calculateRiskFlag(metrics);
      const riskLevel = this.calculateRiskLevel(metrics, riskFlag);

      return {
        url,
        entityScore: scoreData.score_total || 0,
        clusterSize: metrics.clusterSize,
        crawlFrequency: metrics.crawlFrequency,
        indexStability: 0, // Calculated from index_status
        riskFlag,
        riskLevel,
        alertType: this.getAlertType(riskFlag),
      };
    } catch (error) {
      this.logger.error(
        `Error evaluating entity health: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return null;
    }
  }

  /**
   * Refresh all risk flags using SQL function
   */
  async refreshAllRiskFlags(): Promise<RefreshResult> {
    try {
      this.logger.log('Starting risk flags refresh...');

      // First sync from entity_score_v10
      const { data: syncResult, error: syncError } = await this.supabase.rpc(
        'sync_entity_health_from_scores',
      );

      if (syncError) {
        this.logger.warn(`Sync error: ${syncError.message}`);
      } else {
        this.logger.log(`Synced ${syncResult} entities from scores`);
      }

      // Then calculate risk flags
      const { data, error } = await this.supabase.rpc('calculate_risk_flags');

      if (error) {
        this.logger.error(`Failed to refresh risk flags: ${error.message}`);
        return {
          updated: 0,
          orphanCount: 0,
          duplicateCount: 0,
          weakClusterCount: 0,
          lowCrawlCount: 0,
          confusionCount: 0,
        };
      }

      const result = data?.[0] || {};
      this.logger.log(
        `Risk flags refreshed: ${result.updated || 0} entities updated`,
      );

      return {
        updated: result.updated || 0,
        orphanCount: result.orphan_count || 0,
        duplicateCount: result.duplicate_count || 0,
        weakClusterCount: result.weak_cluster_count || 0,
        lowCrawlCount: result.low_crawl_count || 0,
        confusionCount: result.confusion_count || 0,
      };
    } catch (error) {
      this.logger.error(
        `Error refreshing risk flags: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        updated: 0,
        orphanCount: 0,
        duplicateCount: 0,
        weakClusterCount: 0,
        lowCrawlCount: 0,
        confusionCount: 0,
      };
    }
  }

  /**
   * Get URLs at risk with pagination
   */
  async getUrlsAtRisk(
    limit: number = 100,
    offset: number = 0,
    riskFlag?: RiskFlag,
  ): Promise<RiskAlert[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_urls_at_risk', {
        p_limit: limit,
        p_offset: offset,
        p_risk_flag: riskFlag || null,
      });

      if (error) {
        this.logger.error(`Failed to get URLs at risk: ${error.message}`);
        return [];
      }

      return (data || []).map((row: Record<string, unknown>) => ({
        url: row.url as string,
        riskFlag: row.risk_flag as RiskFlag | null,
        urgencyScore: row.urgency_score as number,
        alertType: row.alert_type as AlertType,
        crawlFrequency: row.crawl_frequency as number,
        indexStability: row.index_stability as number,
        clusterSize: row.cluster_size as number,
        isIndexed: row.is_indexed as boolean,
        lastCrawlAt: row.last_crawl_at
          ? new Date(row.last_crawl_at as string)
          : null,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting URLs at risk: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return [];
    }
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Use the view for stats
      const { data, error } = await this.supabase
        .from('v_seo_dashboard_stats')
        .select('*')
        .single();

      if (error) {
        // If view doesn't exist, calculate manually
        this.logger.warn(
          `Stats view error, calculating manually: ${error.message}`,
        );
        return this.calculateStatsManually();
      }

      return {
        totalUrls: data.total_urls || 0,
        indexedUrls: data.indexed_urls || 0,
        urlsAtRisk: data.urls_at_risk || 0,
        riskBreakdown: {
          CONFUSION: data.risk_confusion || 0,
          ORPHAN: data.risk_orphan || 0,
          DUPLICATE: data.risk_duplicate || 0,
          WEAK_CLUSTER: data.risk_weak_cluster || 0,
          LOW_CRAWL: data.risk_low_crawl || 0,
        },
        crawlHealth: {
          last24h: data.crawls_24h || 0,
          last7d: data.crawls_7d || 0,
          googlebotAbsent14d: data.googlebot_absent_14d || 0,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting dashboard stats: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return this.getEmptyStats();
    }
  }

  /**
   * Calculate stats manually if view doesn't exist
   */
  private async calculateStatsManually(): Promise<DashboardStats> {
    const stats = this.getEmptyStats();

    try {
      // Total URLs
      const { count: totalUrls } = await this.supabase
        .from('__seo_index_status')
        .select('*', { count: 'exact', head: true });
      stats.totalUrls = totalUrls || 0;

      // Indexed URLs
      const { count: indexedUrls } = await this.supabase
        .from('__seo_index_status')
        .select('*', { count: 'exact', head: true })
        .eq('is_indexed', true);
      stats.indexedUrls = indexedUrls || 0;

      // URLs at risk
      const { count: atRisk } = await this.supabase
        .from('__seo_entity_health')
        .select('*', { count: 'exact', head: true })
        .not('risk_flag', 'is', null);
      stats.urlsAtRisk = atRisk || 0;

      // Risk breakdown
      const riskFlags: RiskFlag[] = [
        'CONFUSION',
        'ORPHAN',
        'DUPLICATE',
        'WEAK_CLUSTER',
        'LOW_CRAWL',
      ];
      for (const flag of riskFlags) {
        const { count } = await this.supabase
          .from('__seo_entity_health')
          .select('*', { count: 'exact', head: true })
          .eq('risk_flag', flag);
        stats.riskBreakdown[flag] = count || 0;
      }

      // Crawl health
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const { count: crawls24h } = await this.supabase
        .from('__seo_crawl_log')
        .select('*', { count: 'exact', head: true })
        .eq('is_googlebot', true)
        .gte('crawled_at', yesterday.toISOString());
      stats.crawlHealth.last24h = crawls24h || 0;

      const { count: crawls7d } = await this.supabase
        .from('__seo_crawl_log')
        .select('*', { count: 'exact', head: true })
        .eq('is_googlebot', true)
        .gte('crawled_at', lastWeek.toISOString());
      stats.crawlHealth.last7d = crawls7d || 0;

      const { count: absent14d } = await this.supabase
        .from('__seo_index_status')
        .select('*', { count: 'exact', head: true })
        .eq('is_indexed', true)
        .lt('last_crawl_at', twoWeeksAgo.toISOString());
      stats.crawlHealth.googlebotAbsent14d = absent14d || 0;
    } catch (error) {
      this.logger.error(
        `Error calculating stats: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }

    return stats;
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): DashboardStats {
    return {
      totalUrls: 0,
      indexedUrls: 0,
      urlsAtRisk: 0,
      riskBreakdown: {
        CONFUSION: 0,
        ORPHAN: 0,
        DUPLICATE: 0,
        WEAK_CLUSTER: 0,
        LOW_CRAWL: 0,
      },
      crawlHealth: {
        last24h: 0,
        last7d: 0,
        googlebotAbsent14d: 0,
      },
    };
  }

  /**
   * Get crawl activity for last 30 days
   */
  async getCrawlActivity(): Promise<
    {
      date: string;
      totalCrawls: number;
      googlebotCrawls: number;
      uniqueUrls: number;
      avgResponseMs: number;
      errors: number;
    }[]
  > {
    try {
      const { data, error } = await this.supabase
        .from('v_seo_crawl_activity')
        .select('*')
        .order('crawl_date', { ascending: false })
        .limit(30);

      if (error) {
        this.logger.error(`Failed to get crawl activity: ${error.message}`);
        return [];
      }

      return (data || []).map((row) => ({
        date: row.crawl_date,
        totalCrawls: row.total_crawls || 0,
        googlebotCrawls: row.googlebot_crawls || 0,
        uniqueUrls: row.unique_urls || 0,
        avgResponseMs: Math.round(row.avg_response_ms || 0),
        errors: row.errors || 0,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting crawl activity: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return [];
    }
  }

  /**
   * Get index changes (recent first_seen or changes)
   */
  async getIndexChanges(limit: number = 50): Promise<
    {
      url: string;
      isIndexed: boolean;
      firstSeenAt: Date | null;
      change: string;
    }[]
  > {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('__seo_index_status')
        .select('url, is_indexed, first_seen_at, updated_at')
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(`Failed to get index changes: ${error.message}`);
        return [];
      }

      return (data || []).map((row) => ({
        url: row.url,
        isIndexed: row.is_indexed,
        firstSeenAt: row.first_seen_at ? new Date(row.first_seen_at) : null,
        change: row.is_indexed ? 'INDEXED' : 'DROPPED',
      }));
    } catch (error) {
      this.logger.error(
        `Error getting index changes: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return [];
    }
  }
}
