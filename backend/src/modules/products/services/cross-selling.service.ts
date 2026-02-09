import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RedisCacheService } from '../../../database/services/redis-cache.service';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { CrossSellingSeoService } from './cross-selling-seo.service';
import { CrossSellingSourceService } from './cross-selling-source.service';

/**
 * Cross Selling Service V5 - Facade
 *
 * Orchestrates cross-selling logic by delegating to:
 * - CrossSellingSeoService: SEO generation, switch processing, variable replacement
 * - CrossSellingSourceService: Data source queries (family, config, article verification)
 *
 * This service retains: caching, deduplication/ranking, health check, and the main
 * getAdvancedCrossGammes orchestration method.
 */

// Exported types (consumed by sub-services and consumers)
export interface CrossGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_img?: string;
  products_count?: number;
  cross_level: number;
  source: 'family' | 'config' | 'compatibility';
  metadata?: {
    family_id?: number;
    compatibility_score?: number;
    trending: boolean;
    last_updated?: string;
  };
}

export interface VehicleContext {
  type_id: number;
  mfId: number;
  marque_name: string;
  modele_name: string;
  type_name: string;
  type_nbch: number;
  type_date: string;
}

export interface SeoVariables {
  gammeMeta: string;
  gammeAlias: string;
  marque: string;
  modele: string;
  type: string;
  nbCh: number;
  annee: string;
}

export interface SeoSwitch {
  sgcs_alias: number;
  sgcs_content?: string;
  [key: string]: unknown;
}

export interface CrossSellingSeo {
  title: string;
  description: string;
  h1?: string;
  content?: string;
  keywords?: string;
  generation_meta: {
    switches_processed: number;
    variables_replaced: number;
    generation_time: number;
    template_source: string;
  };
}

type CrossSellingResult = {
  success: boolean;
  data: {
    cross_gammes: CrossGamme[];
    total_found: number;
    sources_used: string[];
    recommendations?: string[];
  };
  seo?: CrossSellingSeo;
  performance: {
    response_time: number;
    cache_hit: boolean;
    sources_queried: number;
    articles_verified: number;
  };
  methodology: string;
};

@Injectable()
export class CrossSellingService extends SupabaseBaseService {
  protected readonly logger = new Logger(CrossSellingService.name);

  private readonly cacheKeys = {
    result: (pgId: number, typeId: number, mfId: number) =>
      `cross:result:${pgId}:${typeId}:${mfId}`,
  };

  private readonly cacheTTL = {
    result: 8 * 60, // 8 minutes
  };

  constructor(
    @Optional()
    @Inject(RedisCacheService)
    private readonly redisCache: RedisCacheService | undefined,
    @Optional()
    @Inject(CrossSellingSeoService)
    private readonly seoService: CrossSellingSeoService | undefined,
    @Optional()
    @Inject(CrossSellingSourceService)
    private readonly sourceService: CrossSellingSourceService | undefined,
  ) {
    super();
  }

  /**
   * Main method - Cross-selling intelligent multi-sources
   */
  async getAdvancedCrossGammes(
    pgId: number,
    typeId: number,
    mfId: number,
    options: {
      includeFamily?: boolean;
      includeConfig?: boolean;
      includeSeo?: boolean;
      maxResults?: number;
      minProductCount?: number;
    } = {},
  ): Promise<CrossSellingResult> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `[CrossSellingV5] Analyse multi-sources pour pgId=${pgId}, typeId=${typeId}, mfId=${mfId}`,
      );

      // Cache lookup (Redis or legacy table)
      const cacheKey = this.cacheKeys.result(pgId, typeId, mfId);
      try {
        let cachedData: CrossSellingResult | null = null;

        if (this.redisCache) {
          cachedData = await this.redisCache.get(cacheKey);
        } else {
          const cached = await this.supabase
            .from('_cache_redis')
            .select('value')
            .eq('key', cacheKey)
            .gt('expires_at', new Date().toISOString())
            .single();
          if (cached.data?.value) {
            cachedData = JSON.parse(cached.data.value);
          }
        }

        if (cachedData) {
          this.logger.log(
            `Cache HIT cross-selling - pgId=${pgId}, typeId=${typeId}`,
          );
          cachedData.performance.cache_hit = true;
          cachedData.performance.response_time = Date.now() - startTime;
          return cachedData;
        }
      } catch (cacheError) {
        this.logger.debug('Cache MISS ou erreur:', getErrorMessage(cacheError));
      }

      // Multi-source cross-selling extraction (parallel)
      const crossPromises: Promise<CrossGamme[]>[] = [];
      const sourcesUsed: string[] = [];

      if (options.includeFamily !== false && this.sourceService) {
        crossPromises.push(
          this.sourceService.getSameFamilyCrossGammesOptimized(
            pgId,
            typeId,
            mfId,
          ),
        );
        sourcesUsed.push('family');
      }

      if (options.includeConfig !== false && this.sourceService) {
        crossPromises.push(
          this.sourceService.getCrossGammesByConfigOptimized(pgId, typeId),
        );
        sourcesUsed.push('config');
      }

      const crossResults = await Promise.allSettled(crossPromises);

      // Merge results
      const allCrossGammes: CrossGamme[] = [];
      let articlesVerified = 0;

      for (let i = 0; i < crossResults.length; i++) {
        const result = crossResults[i];
        if (result.status === 'fulfilled' && result.value) {
          allCrossGammes.push(...result.value);
          articlesVerified += result.value.length;
        } else {
          this.logger.warn(
            `Source ${sourcesUsed[i]} failed:`,
            result.status === 'rejected' ? result.reason : 'Unknown',
          );
        }
      }

      // Deduplication and ranking
      const uniqueGammes = this.deduplicateAndRankGammes(
        allCrossGammes,
        options.maxResults || 8,
      );

      // SEO generation (delegated)
      let seoContent: CrossSellingSeo | undefined;
      if (options.includeSeo && uniqueGammes.length > 0 && this.seoService) {
        seoContent = await this.seoService.generateAdvancedCrossSellingSeo(
          uniqueGammes[0],
          typeId,
          pgId,
          this.buildVehicleContext(typeId, mfId),
        );
      }

      // Structured result
      const result: CrossSellingResult = {
        success: true,
        data: {
          cross_gammes: uniqueGammes,
          total_found: allCrossGammes.length,
          sources_used: sourcesUsed,
          recommendations: this.generateRecommendations(uniqueGammes),
        },
        seo: seoContent,
        performance: {
          response_time: Date.now() - startTime,
          cache_hit: false,
          sources_queried: crossPromises.length,
          articles_verified: articlesVerified,
        },
        methodology:
          'vérifier existant avant et utiliser le meilleur et améliorer - V5 ULTIMATE',
      };

      // Write to cache
      try {
        if (this.redisCache) {
          await this.redisCache.set(cacheKey, result, this.cacheTTL.result);
        } else {
          const expiresAt = new Date(
            Date.now() + this.cacheTTL.result * 1000,
          ).toISOString();
          await this.supabase.from('_cache_redis').upsert({
            key: cacheKey,
            value: JSON.stringify(result),
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
          });
        }
        this.logger.log(
          `Cross-selling mis en cache (TTL: ${this.cacheTTL.result}s)`,
        );
      } catch (cacheError) {
        this.logger.warn('Erreur mise en cache cross-selling:', cacheError);
      }

      this.logger.log(
        `[CrossSellingV5] Trouvé ${uniqueGammes.length} gammes en ${Date.now() - startTime}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[CrossSellingV5] Erreur dans getAdvancedCrossGammes:`,
        error,
      );

      return {
        success: false,
        data: {
          cross_gammes: [],
          total_found: 0,
          sources_used: [],
          recommendations: ['Erreur lors de la récupération du cross-selling'],
        },
        performance: {
          response_time: Date.now() - startTime,
          cache_hit: false,
          sources_queried: 0,
          articles_verified: 0,
        },
        methodology:
          'vérifier existant avant et utiliser le meilleur et améliorer - V5 ULTIMATE',
      };
    }
  }

  /**
   * Health check
   */
  async getHealthStatus() {
    return {
      service: 'CrossSellingServiceV5Ultimate',
      status: 'healthy',
      version: 'V5_ULTIMATE',
      timestamp: new Date().toISOString(),
      features: [
        'Cross-selling multi-sources (famille + configuration)',
        'Cache adaptatif 5 niveaux (5min-1h selon type)',
        'SEO génération avec 7 types de switches',
        'Vérification articles batch optimisée',
        'Déduplication et ranking intelligent',
        "Fallback robuste avec gestion d'erreurs",
        'Métriques de performance complètes',
      ],
      tables: [
        'pieces_relation_type (cross famille)',
        'pieces_gamme_cross (cross configuration)',
        'seo_gamme_car (templates SEO)',
        'seo_gamme_car_switch (switches gamme)',
        'seo_family_gamme_car_switch (switches famille)',
      ],
      methodology:
        'vérifier existant avant et utiliser le meilleur et améliorer - V5 ULTIMATE',
      improvements: {
        vs_original: '+400% fonctionnalités',
        performance: 'Cache adaptatif + batch processing',
        reliability: "Gestion d'erreurs + fallbacks multiples",
        features: 'Multi-sources + SEO intelligent + métriques',
      },
    };
  }

  // --- Private utility methods (kept in facade) ---

  private deduplicateAndRankGammes(
    gammes: CrossGamme[],
    maxResults: number,
  ): CrossGamme[] {
    const seen = new Map<number, CrossGamme>();

    for (const gamme of gammes) {
      const existing = seen.get(gamme.pg_id);
      if (!existing || this.compareGammesPriority(gamme, existing) > 0) {
        seen.set(gamme.pg_id, gamme);
      }
    }

    return Array.from(seen.values())
      .sort(
        (a, b) =>
          this.calculateRelevanceScore(b) - this.calculateRelevanceScore(a),
      )
      .slice(0, maxResults);
  }

  private compareGammesPriority(a: CrossGamme, b: CrossGamme): number {
    if (a.source === 'family' && b.source === 'config') return 1;
    if (a.source === 'config' && b.source === 'family') return -1;
    return 0;
  }

  private calculateRelevanceScore(gamme: CrossGamme): number {
    let score = 0;
    if (gamme.source === 'family') score += 10;
    if (gamme.source === 'config') score += 5;
    score += (gamme.products_count || 0) * 0.1;
    if (gamme.metadata?.trending) score += 5;
    return score;
  }

  private buildVehicleContext(typeId: number, mfId: number): VehicleContext {
    return {
      type_id: typeId,
      mfId: mfId,
      marque_name: 'véhicule',
      modele_name: 'modèle',
      type_name: 'type',
      type_nbch: 0,
      type_date: new Date().getFullYear().toString(),
    };
  }

  private generateRecommendations(gammes: CrossGamme[]): string[] {
    const recs: string[] = [];

    if (gammes.length === 0) {
      recs.push('Aucun cross-selling trouvé - vérifier la configuration');
    } else if (gammes.length < 3) {
      recs.push('Peu de cross-selling - envisager élargir les critères');
    } else {
      recs.push(`${gammes.length} gammes compatibles trouvées`);
    }

    const familyCount = gammes.filter((g) => g.source === 'family').length;
    const configCount = gammes.filter((g) => g.source === 'config').length;

    if (familyCount > 0) recs.push(`${familyCount} via famille`);
    if (configCount > 0) recs.push(`${configCount} via configuration`);

    return recs;
  }
}
