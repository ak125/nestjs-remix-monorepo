import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

/**
 * 🚀 Service RPC optimisé pour les pages marques constructeurs
 *
 * STRATÉGIES D'OPTIMISATION:
 * 1. Cache Redis avec TTL 10min pour données marque
 * 2. Single RPC call remplace 6 appels API séquentiels
 * 3. NO fallback - retourne erreur 500 si RPC échoue
 *
 * Remplace 6 appels API (400-800ms) par 1 RPC (<100ms)
 *
 * Endpoints remplacés:
 * - /api/vehicles/brands/{id}
 * - /api/seo/marque/{id}
 * - /api/vehicles/brand/{alias}/bestsellers (vehicles)
 * - /api/vehicles/brand/{alias}/bestsellers (parts)
 * - /api/blog/marque/{id}
 * - /api/vehicles/brand/{id}/maillage
 */
@Injectable()
export class BrandRpcService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BrandRpcService.name);

  // TTL Cache: 10 minutes pour données marque
  private readonly CACHE_TTL_SECONDS = 600;
  // Timeout RPC
  private readonly RPC_TIMEOUT_MS = 2000;

  constructor(
    private readonly cacheService: CacheService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 🔑 Génère la clé de cache pour une marque
   */
  private getCacheKey(marqueId: number): string {
    return `brand:rpc:v1:${marqueId}`;
  }

  /**
   * ⚡ Récupère les données page marque avec cache
   */
  async getBrandPageDataOptimized(marqueId: number) {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(marqueId);

    // 1. Vérifier le cache Redis d'abord
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      const cacheTime = performance.now() - startTime;
      this.logger.debug(
        `🎯 CACHE HIT brand ${marqueId} en ${cacheTime.toFixed(1)}ms`,
      );
      return {
        ...cached,
        _cache: {
          hit: true,
          time: cacheTime,
        },
      };
    }

    // 2. Cache miss → Appel RPC
    this.logger.debug(`❌ CACHE MISS brand ${marqueId}, appel RPC...`);

    const result = await this.fetchRpcWithTimeout(marqueId, startTime);

    // 3. Stocker en cache (async, non-bloquant)
    this.cacheResult(marqueId, result).catch((err) =>
      this.logger.error(`Erreur cache brand ${marqueId}:`, err),
    );

    return result;
  }

  /**
   * 🔄 Appel RPC avec timeout strict
   */
  private async fetchRpcWithTimeout(marqueId: number, startTime: number) {
    // Créer une Promise avec timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), this.RPC_TIMEOUT_MS);
    });

    // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
    const rpcPromise = this.callRpc<any>(
      'get_brand_page_data_optimized',
      { p_marque_id: marqueId },
      { source: 'api' },
    );

    // Race entre RPC et timeout
    const { data, error: rpcError } = (await Promise.race([
      rpcPromise,
      timeoutPromise,
    ])) as any;

    if (rpcError) {
      this.logger.error(`RPC brand ${marqueId} error:`, rpcError);
      throw rpcError;
    }

    const rpcTime = performance.now() - startTime;
    this.logger.log(`✅ RPC brand ${marqueId} en ${rpcTime.toFixed(1)}ms`);

    // Vérifier que les données sont valides
    if (!data?.success) {
      throw new DatabaseException({
        code: ErrorCodes.VEHICLE.BRAND_RPC_FAILED,
        message: data?.error || 'Brand RPC returned invalid data',
      });
    }

    return {
      ...data,
      _performance: {
        rpcTime,
        totalTime: performance.now() - startTime,
        cacheHit: false,
      },
    };
  }

  /**
   * 💾 Stocke le résultat en cache
   */
  private async cacheResult(marqueId: number, result: any): Promise<void> {
    const cacheKey = this.getCacheKey(marqueId);
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);
    this.logger.debug(
      `💾 Cache stocké pour brand ${marqueId} (TTL: ${this.CACHE_TTL_SECONDS}s)`,
    );
  }

  /**
   * 🗑️ Invalide le cache d'une marque
   */
  async invalidateCache(marqueId: number): Promise<void> {
    const cacheKey = this.getCacheKey(marqueId);
    await this.cacheService.del(cacheKey);
    this.logger.log(`🗑️ Cache invalidé pour brand ${marqueId}`);
  }

  /**
   * 🔥 Préchauffe le cache pour les marques populaires
   */
  async warmCache(
    marqueIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    this.logger.log(`🔥 Warm cache pour ${marqueIds.length} marques...`);

    for (const marqueId of marqueIds) {
      try {
        await this.getBrandPageDataOptimized(marqueId);
        success++;
      } catch {
        this.logger.error(`❌ Warm cache failed pour brand ${marqueId}`);
        failed++;
      }
    }

    this.logger.log(
      `✅ Warm cache terminé: ${success} succès, ${failed} échecs`,
    );
    return { success, failed };
  }
}
