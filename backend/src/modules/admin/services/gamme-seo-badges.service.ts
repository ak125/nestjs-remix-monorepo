/**
 * 🏷️ GAMME SEO BADGES SERVICE
 *
 * Extracted from AdminGammesSeoService (DEC: reduce 2,064-line file)
 * Handles:
 * - V-Level global statistics dashboard
 * - Gamme aggregates refresh (RPC)
 * - Phase 2 badges (11 badges v2) retrieval
 * - Section K conformity metrics
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';

// ============== EXPORTED TYPES ==============

export interface GammeAggregatesResult {
  products_total: number;
  vehicles_total: number;
  content_words_total: number;
  products_direct: number;
  products_via_vehicles: number;
  products_via_family: number;
  vlevel_counts: {
    V1: number;
    V2: number;
    V3: number;
    V4: number;
    V5: number;
  };
  seo_content_raw_words: number;
  content_breakdown: {
    seo: number;
    conseil: number;
    switches: number;
    purchaseGuide: number;
  };
  computed_at: string | null;
  source_updated_at: string | null;
  // Phase 2 Badges
  priority_score: number;
  catalog_issues: string[];
  smart_actions: Array<{ action: string; priority: string }>;
  // ===== Badges v2 (11 badges) =====
  // Pilotage
  index_policy: 'INDEX' | 'SOFT-INDEX' | 'NOINDEX';
  final_priority: 'P1' | 'P1-PENDING' | 'P2' | 'P3' | 'SOFT-INDEX';
  // Potentiel
  potential_level: 'HIGH' | 'MID' | 'LOW';
  demand_level: 'HIGH' | 'MID' | 'LOW';
  difficulty_level: 'EASY' | 'MED' | 'HARD';
  intent_type: 'BUY' | 'COMPARE' | 'INFO' | 'MIXED';
  // Réalité Intra-Gamme
  catalog_status: 'OK' | 'LOW' | 'EMPTY';
  vehicle_coverage: 'COVERED' | 'PARTIAL' | 'EMPTY';
  content_depth: 'RICH' | 'OK' | 'THIN';
  freshness_status: 'FRESH' | 'STALE' | 'EXPIRED';
  cluster_health: 'STRONG' | 'MISSING' | 'ISOLATED' | 'CANNIBAL';
  topic_purity: 'PURE' | 'DILUTED';
  // Exécutabilité
  execution_status: 'PASS' | 'WARN' | 'FAIL';
}

@Injectable()
export class GammeSeoBadgesService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeSeoBadgesService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 📊 Statistiques globales V-Level pour le dashboard
   */
  async getVLevelGlobalStats(): Promise<{
    totalGammes: number;
    gammesWithVLevel: number;
    distribution: {
      v1: number;
      v2: number;
      v3: number;
      v4: number;
      v5: number;
      total: number;
    };
    freshness: {
      fresh: number;
      stale: number;
      old: number;
    };
    lastUpdated: string | null;
    g1Stats: {
      total: number;
      withV2: number;
      coverage: number;
    };
  }> {
    try {
      this.logger.log('📊 Fetching V-Level global stats');

      // 1. Total gammes
      const { count: totalGammes } = await this.supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true });

      // 2. Gammes avec V-Level data
      const { data: gammesWithData } = await this.supabase
        .from('gamme_seo_metrics')
        .select('gamme_id')
        .not('v_level', 'is', null);

      const uniqueGammes = new Set(
        (gammesWithData || []).map((g: any) => g.gamme_id),
      );

      // 3. Distribution par V-Level
      const { data: allVLevels } = await this.supabase
        .from('gamme_seo_metrics')
        .select('v_level, updated_at');

      const distribution = {
        v1: 0,
        v2: 0,
        v3: 0,
        v4: 0,
        v5: 0,
        total: 0,
      };

      const freshness = {
        fresh: 0,
        stale: 0,
        old: 0,
      };

      let lastUpdated: string | null = null;
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      for (const item of allVLevels || []) {
        distribution.total++;
        switch (item.v_level) {
          case 'V1':
            distribution.v1++;
            break;
          case 'V2':
            distribution.v2++;
            break;
          case 'V3':
            distribution.v3++;
            break;
          case 'V4':
            distribution.v4++;
            break;
          case 'V5':
            distribution.v5++;
            break;
        }

        // Freshness
        if (item.updated_at) {
          const updated = new Date(item.updated_at).getTime();
          const age = now - updated;
          if (age <= sevenDays) {
            freshness.fresh++;
          } else if (age <= thirtyDays) {
            freshness.stale++;
          } else {
            freshness.old++;
          }

          if (!lastUpdated || item.updated_at > lastUpdated) {
            lastUpdated = item.updated_at;
          }
        }
      }

      // 4. G1 stats
      const { count: g1Total } = await this.supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .eq('pg_top', '1');

      const { data: g1WithV2 } = await this.supabase
        .from('gamme_seo_metrics')
        .select('gamme_id')
        .eq('v_level', 'V2');

      const g1GammesWithV2 = new Set(
        (g1WithV2 || []).map((g: any) => g.gamme_id),
      );

      const stats = {
        totalGammes: totalGammes || 0,
        gammesWithVLevel: uniqueGammes.size,
        distribution,
        freshness,
        lastUpdated,
        g1Stats: {
          total: g1Total || 0,
          withV2: g1GammesWithV2.size,
          coverage: g1Total
            ? Math.round((g1GammesWithV2.size / g1Total) * 100)
            : 0,
        },
      };

      this.logger.log(
        `✅ V-Level global stats: ${distribution.total} entries, ${uniqueGammes.size} gammes`,
      );

      return stats;
    } catch (error) {
      this.logger.error('❌ Error in getVLevelGlobalStats():', error);
      throw error;
    }
  }

  /**
   * 🔄 Refresh les agrégats pour une ou toutes les gammes
   * Appelle la RPC refresh_gamme_aggregates
   */
  async refreshAggregates(pgId?: number): Promise<{
    success: boolean;
    refreshed: number;
    results: Array<{
      pg_id: number;
      products_total: number;
      vehicles_total: number;
      content_words_total: number;
      status: string;
    }>;
  }> {
    try {
      this.logger.log(
        `🔄 refreshAggregates(${pgId ? `pg_id=${pgId}` : 'all gammes'})`,
      );

      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any[]>(
        'refresh_gamme_aggregates',
        { p_pg_id: pgId || null },
        { source: 'admin' },
      );

      if (error) {
        this.logger.error('❌ Error calling refresh_gamme_aggregates:', error);
        throw error;
      }

      const results = data || [];
      this.logger.log(`✅ Aggregates refreshed: ${results.length} gammes`);

      return {
        success: true,
        refreshed: results.length,
        results,
      };
    } catch (error) {
      this.logger.error('❌ Error in refreshAggregates():', error);
      throw error;
    }
  }

  /**
   * 📊 Récupère les agrégats pour une gamme
   * Retourne null si pas encore calculés
   * v2: Inclut les 11 badges SEO
   */
  async getGammeAggregates(
    pgId: number,
  ): Promise<GammeAggregatesResult | null> {
    try {
      const { data, error } = await this.supabase
        .from('gamme_aggregates')
        .select('*')
        .eq('ga_pg_id', pgId)
        .single();

      if (error) {
        // Table might not exist yet or no data
        if (error.code === 'PGRST116') {
          return null; // No row found
        }
        this.logger.warn(
          `⚠️ Error fetching aggregates for pg_id=${pgId}:`,
          error,
        );
        return null;
      }

      return {
        products_total: data.products_total || 0,
        vehicles_total: data.vehicles_total || 0,
        content_words_total: data.content_words_total || 0,
        products_direct: data.products_direct || 0,
        products_via_vehicles: data.products_via_vehicles || 0,
        products_via_family: data.products_via_family || 0,
        vlevel_counts: data.vlevel_counts || {
          V1: 0,
          V2: 0,
          V3: 0,
          V4: 0,
          V5: 0,
        },
        seo_content_raw_words: data.seo_content_raw_words || 0,
        content_breakdown: data.content_breakdown || {
          seo: 0,
          conseil: 0,
          switches: 0,
          purchaseGuide: 0,
        },
        computed_at: data.computed_at,
        source_updated_at: data.source_updated_at,
        // Phase 2 Badges
        priority_score: data.priority_score || 0,
        catalog_issues: data.catalog_issues || [],
        smart_actions: data.smart_actions || [],
        // ===== Badges v2 (11 badges) =====
        // Pilotage
        index_policy: data.index_policy || 'NOINDEX',
        final_priority: data.final_priority || 'P3',
        // Potentiel
        potential_level: data.potential_level || 'LOW',
        demand_level: data.demand_level || 'LOW',
        difficulty_level: data.difficulty_level || 'MED',
        intent_type: data.intent_type || 'COMPARE',
        // Réalité Intra-Gamme
        catalog_status: data.catalog_status || 'EMPTY',
        vehicle_coverage: data.vehicle_coverage || 'EMPTY',
        content_depth: data.content_depth || 'THIN',
        freshness_status: data.freshness_status || 'EXPIRED',
        cluster_health: data.cluster_health || 'ISOLATED',
        topic_purity: data.topic_purity || 'PURE',
        // Exécutabilité
        execution_status: data.execution_status || 'FAIL',
      };
    } catch (error) {
      this.logger.error(`❌ Error in getGammeAggregates(${pgId}):`, error);
      return null;
    }
  }
}
