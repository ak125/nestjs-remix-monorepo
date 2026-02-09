/**
 * KeywordsDashboardService - Dashboard pour visualiser les keywords SEO par gamme
 *
 * Permet de:
 * - Lister toutes les gammes avec leurs stats
 * - Voir les keywords d'une gamme avec pagination
 * - Analyser la distribution V-Level par gamme
 * - Top keywords par volume
 */

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { RedisCacheService } from '../../../database/services/redis-cache.service';

export interface GammeStats {
  gamme: string;
  total: number;
  v2Count: number;
  v3Count: number;
  v4Count: number;
  totalVolume: number;
}

export interface KeywordItem {
  id: number;
  keyword: string;
  gamme: string;
  type: string;
  vLevel: string | null;
  volume: number;
  model: string | null;
  generation: string | null;
  variant: string | null;
  energy: string | null;
}

export interface GammeDetailStats {
  gamme: string;
  total: number;
  distribution: {
    V2: number;
    V3: number;
    V4: number;
  };
  topModels: {
    model: string;
    count: number;
    v2: number;
    v3: number;
    v4: number;
  }[];
  volumeStats: {
    total: number;
    avgV2: number;
    avgV3: number;
    avgV4: number;
  };
}

export interface TopKeyword {
  keyword: string;
  gamme: string;
  volume: number;
  vLevel: string | null;
  model: string | null;
}

@Injectable()
export class KeywordsDashboardService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    KeywordsDashboardService.name,
  );

  // 🚀 P7.3 PERF: Cache TTL en secondes (15 minutes)
  private readonly CACHE_TTL = 900;

  constructor(
    rpcGate: RpcGateService,
    @Optional()
    @Inject(RedisCacheService)
    private readonly redisCache?: RedisCacheService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Liste toutes les gammes avec leurs statistiques
   * 🚀 P7.3 PERF: Cache Redis 15min (table 500k+ rows)
   */
  async listGammes(): Promise<GammeStats[]> {
    // 🚀 P7.3: Cache wrapper
    if (this.redisCache) {
      return this.redisCache.cached(
        'gammes',
        () => this.listGammesInternal(),
        this.CACHE_TTL,
        'seo:keywords',
      );
    }
    return this.listGammesInternal();
  }

  /**
   * Implementation interne sans cache
   */
  private async listGammesInternal(): Promise<GammeStats[]> {
    this.logger.log('Fetching all gammes stats');

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<any[]>(
      'get_seo_keywords_gammes',
      {},
      { source: 'admin' },
    );

    if (error) {
      this.logger.error(`Error fetching gammes: ${error.message}`);
      // Fallback to direct query if RPC doesn't exist
      return this.listGammesFallback();
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      gamme: row.gamme as string,
      total: Number(row.total) || 0,
      v2Count: Number(row.v2_count) || 0,
      v3Count: Number(row.v3_count) || 0,
      v4Count: Number(row.v4_count) || 0,
      totalVolume: Number(row.total_volume) || 0,
    }));
  }

  /**
   * Fallback: Liste gammes via requête directe
   */
  private async listGammesFallback(): Promise<GammeStats[]> {
    const { data, error } = await this.supabase
      .from('__seo_keywords')
      .select('gamme, v_level, volume')
      .not('gamme', 'is', null);

    if (error) {
      this.logger.error(`Fallback error: ${error.message}`);
      return [];
    }

    // Aggregate in memory
    const gammeMap = new Map<
      string,
      { total: number; v2: number; v3: number; v4: number; volume: number }
    >();

    for (const row of data || []) {
      const gamme = row.gamme as string;
      if (!gammeMap.has(gamme)) {
        gammeMap.set(gamme, { total: 0, v2: 0, v3: 0, v4: 0, volume: 0 });
      }
      const stats = gammeMap.get(gamme)!;
      stats.total++;
      stats.volume += (row.volume as number) || 0;
      if (row.v_level === 'V2') stats.v2++;
      else if (row.v_level === 'V3') stats.v3++;
      else if (row.v_level === 'V4') stats.v4++;
    }

    return Array.from(gammeMap.entries()).map(([gamme, stats]) => ({
      gamme,
      total: stats.total,
      v2Count: stats.v2,
      v3Count: stats.v3,
      v4Count: stats.v4,
      totalVolume: stats.volume,
    }));
  }

  /**
   * Récupère les keywords d'une gamme avec pagination
   */
  async getKeywordsByGamme(
    gamme: string,
    options: {
      limit?: number;
      offset?: number;
      vLevel?: string;
      model?: string;
      orderBy?: 'volume' | 'keyword';
      orderDir?: 'asc' | 'desc';
    } = {},
  ): Promise<{ items: KeywordItem[]; total: number }> {
    const {
      limit = 50,
      offset = 0,
      vLevel,
      model,
      orderBy = 'volume',
      orderDir = 'desc',
    } = options;

    this.logger.log(`Fetching keywords for gamme: ${gamme}`);

    let query = this.supabase
      .from('__seo_keywords')
      .select('*', { count: 'exact' })
      .eq('gamme', gamme);

    if (vLevel) {
      query = query.eq('v_level', vLevel);
    }
    if (model) {
      query = query.eq('model', model);
    }

    query = query
      .order(orderBy === 'volume' ? 'volume' : 'keyword', {
        ascending: orderDir === 'asc',
      })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Error fetching keywords: ${error.message}`);
      return { items: [], total: 0 };
    }

    const items: KeywordItem[] = (data || []).map(
      (row: Record<string, unknown>) => ({
        id: row.id as number,
        keyword: row.keyword as string,
        gamme: row.gamme as string,
        type: row.type as string,
        vLevel: row.v_level as string | null,
        volume: (row.volume as number) || 0,
        model: row.model as string | null,
        generation: row.generation as string | null,
        variant: row.variant as string | null,
        energy: row.energy as string | null,
      }),
    );

    return { items, total: count || 0 };
  }

  /**
   * Statistiques détaillées pour une gamme
   * 🚀 P7.3 PERF: Cache Redis 15min par gamme
   */
  async getGammeStats(gamme: string): Promise<GammeDetailStats | null> {
    // 🚀 P7.3: Cache wrapper
    if (this.redisCache) {
      return this.redisCache.cached(
        `stats:${gamme}`,
        () => this.getGammeStatsInternal(gamme),
        this.CACHE_TTL,
        'seo:keywords',
      );
    }
    return this.getGammeStatsInternal(gamme);
  }

  /**
   * Implementation interne sans cache
   */
  private async getGammeStatsInternal(
    gamme: string,
  ): Promise<GammeDetailStats | null> {
    this.logger.log(`Fetching detailed stats for gamme: ${gamme}`);

    const { data, error } = await this.supabase
      .from('__seo_keywords')
      .select('v_level, volume, model')
      .eq('gamme', gamme);

    if (error) {
      this.logger.error(`Error fetching gamme stats: ${error.message}`);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Calculate distribution
    const distribution = { V2: 0, V3: 0, V4: 0 };
    const volumeByLevel = { V2: 0, V3: 0, V4: 0 };
    const modelStats = new Map<
      string,
      { count: number; v2: number; v3: number; v4: number }
    >();

    for (const row of data) {
      const vLevel = row.v_level as string;
      const volume = (row.volume as number) || 0;
      const model = (row.model as string) || 'unknown';

      if (vLevel === 'V2') {
        distribution.V2++;
        volumeByLevel.V2 += volume;
      } else if (vLevel === 'V3') {
        distribution.V3++;
        volumeByLevel.V3 += volume;
      } else if (vLevel === 'V4') {
        distribution.V4++;
        volumeByLevel.V4 += volume;
      }

      if (!modelStats.has(model)) {
        modelStats.set(model, { count: 0, v2: 0, v3: 0, v4: 0 });
      }
      const ms = modelStats.get(model)!;
      ms.count++;
      if (vLevel === 'V2') ms.v2++;
      else if (vLevel === 'V3') ms.v3++;
      else if (vLevel === 'V4') ms.v4++;
    }

    // Top models sorted by count
    const topModels = Array.from(modelStats.entries())
      .map(([model, stats]) => ({ model, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const totalVolume = volumeByLevel.V2 + volumeByLevel.V3 + volumeByLevel.V4;

    return {
      gamme,
      total: data.length,
      distribution,
      topModels,
      volumeStats: {
        total: totalVolume,
        avgV2:
          distribution.V2 > 0
            ? Math.round(volumeByLevel.V2 / distribution.V2)
            : 0,
        avgV3:
          distribution.V3 > 0
            ? Math.round(volumeByLevel.V3 / distribution.V3)
            : 0,
        avgV4:
          distribution.V4 > 0
            ? Math.round(volumeByLevel.V4 / distribution.V4)
            : 0,
      },
    };
  }

  /**
   * Top keywords global par volume
   * 🚀 P7.3 PERF: Cache Redis 15min
   */
  async getTopKeywords(limit = 100): Promise<TopKeyword[]> {
    // 🚀 P7.3: Cache wrapper
    if (this.redisCache) {
      return this.redisCache.cached(
        `top:${limit}`,
        () => this.getTopKeywordsInternal(limit),
        this.CACHE_TTL,
        'seo:keywords',
      );
    }
    return this.getTopKeywordsInternal(limit);
  }

  /**
   * Implementation interne sans cache
   */
  private async getTopKeywordsInternal(limit = 100): Promise<TopKeyword[]> {
    this.logger.log(`Fetching top ${limit} keywords by volume`);

    const { data, error } = await this.supabase
      .from('__seo_keywords')
      .select('keyword, gamme, volume, v_level, model')
      .gt('volume', 0)
      .order('volume', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Error fetching top keywords: ${error.message}`);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      keyword: row.keyword as string,
      gamme: row.gamme as string,
      volume: (row.volume as number) || 0,
      vLevel: row.v_level as string | null,
      model: row.model as string | null,
    }));
  }
}
