import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { GammeDataTransformerService } from './gamme-data-transformer.service';
import { CacheService } from '../../cache/cache.service';

/**
 * 🚀 Service pour les appels RPC optimisés avec cache Redis
 * 
 * STRATÉGIES D'OPTIMISATION:
 * 1. Cache Redis avec TTL 1h pour données gamme (statiques)
 * 2. Pattern "stale-while-revalidate" pour éviter les blocages
 * 3. Fallback sur cache expiré si RPC timeout
 * 4. Métriques de performance intégrées
 */
@Injectable()
export class GammeRpcService extends SupabaseBaseService {
  protected override readonly logger = new Logger(GammeRpcService.name);
  
  // TTL Cache: 1 heure pour données gamme (quasi-statiques)
  private readonly CACHE_TTL_SECONDS = 3600;
  // TTL Stale: 24h - données expirées mais utilisables en fallback
  private readonly STALE_TTL_SECONDS = 86400;
  // Timeout RPC avant fallback sur cache stale
  private readonly RPC_TIMEOUT_MS = 5000;

  constructor(
    private readonly transformer: GammeDataTransformerService,
    private readonly cacheService: CacheService,
  ) {
    super();
  }

  /**
   * 🔑 Génère la clé de cache pour une gamme
   */
  private getCacheKey(pgId: string): string {
    return `gamme:rpc:v2:${pgId}`;
  }

  /**
   * 🔑 Génère la clé de cache stale (fallback)
   */
  private getStaleCacheKey(pgId: string): string {
    return `gamme:rpc:v2:stale:${pgId}`;
  }

  /**
   * ⚡ Récupère les données avec cache intelligent
   * Pattern: Cache-first avec stale-while-revalidate
   */
  async getPageDataRpcV2(pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(pgId);

    // Redirection spéciale
    if (pgIdNum === 3940) {
      return { redirect: '/pieces/corps-papillon-158.html' };
    }

    // 1. Vérifier le cache Redis d'abord
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      const cacheTime = performance.now() - startTime;
      this.logger.debug(`🎯 CACHE HIT gamme ${pgIdNum} en ${cacheTime.toFixed(1)}ms`);
      return {
        ...cached,
        timings: {
          ...cached.timings,
          cacheHit: true,
          cacheTime,
          totalTime: cacheTime,
        },
      };
    }

    // 2. Cache miss → Appel RPC avec timeout
    this.logger.debug(`❌ CACHE MISS gamme ${pgIdNum}, appel RPC...`);
    
    try {
      const result = await this.fetchRpcWithTimeout(pgId, startTime);
      
      // 3. Stocker en cache (async, non-bloquant)
      this.cacheResult(pgId, result).catch(err => 
        this.logger.error(`Erreur cache gamme ${pgIdNum}:`, err)
      );

      return result;
    } catch (error) {
      // 4. Fallback sur cache stale si disponible
      return this.handleRpcError(pgId, error, startTime);
    }
  }

  /**
   * 🔄 Appel RPC avec timeout strict
   */
  private async fetchRpcWithTimeout(pgId: string, startTime: number) {
    const pgIdNum = parseInt(pgId, 10);
    
    // Créer une Promise avec timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), this.RPC_TIMEOUT_MS);
    });

    const rpcPromise = this.client.rpc(
      'get_gamme_page_data_optimized',
      { p_pg_id: pgIdNum },
    );

    // Race entre RPC et timeout
    const { data: aggregatedData, error: rpcError } = await Promise.race([
      rpcPromise,
      timeoutPromise,
    ]) as any;

    if (rpcError) {
      throw rpcError;
    }

    const rpcTime = performance.now();
    this.logger.log(`✅ RPC gamme ${pgIdNum} en ${(rpcTime - startTime).toFixed(1)}ms`);

    // Extraction page_info depuis le RPC
    const pageInfo = aggregatedData?.page_info;
    if (!pageInfo) {
      throw new Error('Gamme non trouvée');
    }

    return {
      aggregatedData,
      pageData: pageInfo,
      timings: {
        rpcTime: rpcTime - startTime,
        totalTime: performance.now() - startTime,
        cacheHit: false,
      },
    };
  }

  /**
   * 💾 Stocke le résultat en cache (double cache: frais + stale)
   */
  private async cacheResult(pgId: string, result: any): Promise<void> {
    const cacheKey = this.getCacheKey(pgId);
    const staleCacheKey = this.getStaleCacheKey(pgId);

    // Cache frais (1h)
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);
    
    // Cache stale (24h) pour fallback
    await this.cacheService.set(staleCacheKey, result, this.STALE_TTL_SECONDS);
    
    this.logger.debug(`💾 Cache stocké pour gamme ${pgId} (TTL: ${this.CACHE_TTL_SECONDS}s)`);
  }

  /**
   * ⚠️ Gestion erreur RPC avec fallback sur cache stale
   */
  private async handleRpcError(pgId: string, error: any, startTime: number) {
    const pgIdNum = parseInt(pgId, 10);
    const staleCacheKey = this.getStaleCacheKey(pgId);
    
    this.logger.warn(`⚠️ RPC gamme ${pgIdNum} failed: ${error.message}`);

    // Tenter le cache stale
    const staleData = await this.cacheService.get<any>(staleCacheKey);
    
    if (staleData) {
      this.logger.log(`📦 STALE CACHE utilisé pour gamme ${pgIdNum}`);
      return {
        ...staleData,
        timings: {
          ...staleData.timings,
          staleCache: true,
          totalTime: performance.now() - startTime,
        },
        _stale: true,
        _staleReason: error.message,
      };
    }

    // Pas de cache disponible → propager l'erreur
    throw error;
  }

  /**
   * 🔄 Préchauffe le cache pour les gammes populaires
   */
  async warmCache(pgIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    this.logger.log(`🔥 Warm cache pour ${pgIds.length} gammes...`);

    for (const pgId of pgIds) {
      try {
        await this.getPageDataRpcV2(pgId);
        success++;
      } catch (error) {
        this.logger.error(`❌ Warm cache failed pour gamme ${pgId}`);
        failed++;
      }
    }

    this.logger.log(`✅ Warm cache terminé: ${success} succès, ${failed} échecs`);
    return { success, failed };
  }

  /**
   * 🗑️ Invalide le cache d'une gamme
   */
  async invalidateCache(pgId: string): Promise<void> {
    const cacheKey = this.getCacheKey(pgId);
    const staleCacheKey = this.getStaleCacheKey(pgId);
    
    await this.cacheService.del(cacheKey);
    await this.cacheService.del(staleCacheKey);
    
    this.logger.log(`🗑️ Cache invalidé pour gamme ${pgId}`);
  }

  /**
   * Obtient des fragments SEO par type_id avec meilleure distribution
   */
  getSeoFragmentsByTypeId(
    typeId: number,
    seoFragments1: any[],
    seoFragments2: any[],
  ): { fragment1: string; fragment2: string } {
    // Hash pour meilleure distribution des fragments (évite répétitions avec typeId consécutifs)
    const hashTypeId = (id: number): number => {
      let hash = id;
      hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
      hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
      hash = (hash >> 16) ^ hash;
      return Math.abs(hash);
    };

    const hash = hashTypeId(typeId);
    const fragment1 =
      seoFragments1.length > 0
        ? seoFragments1[hash % seoFragments1.length]?.sis_content || ''
        : '';
    const fragment2 =
      seoFragments2.length > 0
        ? seoFragments2[(hash + 1) % seoFragments2.length]?.sis_content || ''
        : '';
    return { fragment1, fragment2 };
  }
}
