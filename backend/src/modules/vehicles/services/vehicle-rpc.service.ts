import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import {
  DomainNotFoundException,
  ErrorCodes,
} from '../../../common/exceptions';

/**
 * 🚀 Service RPC optimisé pour les pages véhicules /constructeurs/.../type.html
 *
 * STRATÉGIES D'OPTIMISATION:
 * 1. Cache Redis avec TTL 1h pour données véhicule (quasi-statiques)
 * 2. Pattern "stale-while-revalidate" pour éviter les blocages
 * 3. Fallback sur cache expiré si RPC timeout
 * 4. Métriques de performance intégrées
 *
 * Remplace 4 appels API séquentiels (800-1600ms) par 1 RPC (<100ms)
 */
@Injectable()
export class VehicleRpcService extends SupabaseBaseService {
  protected override readonly logger = new Logger(VehicleRpcService.name);

  // TTL Cache: 1 heure pour données véhicule (quasi-statiques)
  private readonly CACHE_TTL_SECONDS = 3600;
  // TTL Stale: 24h - données expirées mais utilisables en fallback
  private readonly STALE_TTL_SECONDS = 86400;
  // Timeout RPC avant fallback sur cache stale (optimisé pour LCP)
  private readonly RPC_TIMEOUT_MS = 1500;

  constructor(
    private readonly cacheService: CacheService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 🔑 Génère la clé de cache pour un véhicule
   */
  private getCacheKey(typeId: number): string {
    return `vehicle:rpc:v1:${typeId}`;
  }

  /**
   * 🔑 Génère la clé de cache stale (fallback)
   */
  private getStaleCacheKey(typeId: number): string {
    return `vehicle:rpc:v1:stale:${typeId}`;
  }

  /**
   * ⚡ Récupère les données avec cache intelligent
   * Pattern: Cache-first avec stale-while-revalidate
   */
  async getVehiclePageDataOptimized(typeId: number) {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(typeId);

    // 1. Vérifier le cache Redis d'abord
    const cached =
      await this.cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      const cacheTime = performance.now() - startTime;
      this.logger.debug(
        `🎯 CACHE HIT vehicle ${typeId} en ${cacheTime.toFixed(1)}ms`,
      );
      return {
        ...cached,
        _cache: {
          hit: true,
          time: cacheTime,
        },
      };
    }

    // 2. Cache miss → Appel RPC avec timeout
    this.logger.debug(`❌ CACHE MISS vehicle ${typeId}, appel RPC...`);

    try {
      const result = await this.fetchRpcWithTimeout(typeId, startTime);

      // 3. Stocker en cache (async, non-bloquant)
      this.cacheResult(typeId, result).catch((err) =>
        this.logger.error(`Erreur cache vehicle ${typeId}:`, err),
      );

      return result;
    } catch (error) {
      // 4. Fallback sur cache stale si disponible
      return this.handleRpcError(typeId, error, startTime);
    }
  }

  /**
   * 🔄 Appel RPC avec timeout strict
   */
  private async fetchRpcWithTimeout(typeId: number, startTime: number) {
    // Créer une Promise avec timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), this.RPC_TIMEOUT_MS);
    });

    // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
    const rpcPromise = this.callRpc<any>(
      'get_vehicle_page_data_optimized',
      { p_type_id: typeId },
      { source: 'api' },
    );

    // Race entre RPC et timeout
    const { data, error: rpcError } = await Promise.race([
      rpcPromise,
      timeoutPromise,
    ]);

    if (rpcError) {
      throw rpcError;
    }

    const rpcTime = performance.now() - startTime;
    this.logger.log(`✅ RPC vehicle ${typeId} en ${rpcTime.toFixed(1)}ms`);

    // Vérifier que le véhicule existe
    if (!data?.vehicle || !data?.success) {
      throw new DomainNotFoundException({
        code: ErrorCodes.VEHICLE.NOT_FOUND,
        message: `Vehicle not found: type_id=${typeId}`,
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
   * 💾 Stocke le résultat en cache (double cache: frais + stale)
   */
  private async cacheResult(typeId: number, result: unknown): Promise<void> {
    const cacheKey = this.getCacheKey(typeId);
    const staleCacheKey = this.getStaleCacheKey(typeId);

    // Cache frais (1h)
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);

    // Cache stale (24h) pour fallback
    await this.cacheService.set(staleCacheKey, result, this.STALE_TTL_SECONDS);

    this.logger.debug(
      `💾 Cache stocké pour vehicle ${typeId} (TTL: ${this.CACHE_TTL_SECONDS}s)`,
    );
  }

  /**
   * ⚠️ Gestion erreur RPC avec fallback sur cache stale
   */
  private async handleRpcError(
    typeId: number,
    error: unknown,
    startTime: number,
  ) {
    const staleCacheKey = this.getStaleCacheKey(typeId);

    const errorMsg = error instanceof Error ? error.message : String(error);
    this.logger.warn(`⚠️ RPC vehicle ${typeId} failed: ${errorMsg}`);

    // Tenter le cache stale
    const staleData =
      await this.cacheService.get<Record<string, unknown>>(staleCacheKey);

    if (staleData) {
      this.logger.log(`📦 STALE CACHE utilisé pour vehicle ${typeId}`);
      return {
        ...staleData,
        _stale: true,
        _staleReason: errorMsg,
        _performance: {
          totalTime: performance.now() - startTime,
          staleCache: true,
        },
      };
    }

    // Pas de cache disponible → propager l'erreur (500)
    throw error;
  }

  /**
   * 🔄 Préchauffe le cache pour les véhicules populaires
   */
  async warmCache(
    typeIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    this.logger.log(`🔥 Warm cache pour ${typeIds.length} véhicules...`);

    for (const typeId of typeIds) {
      try {
        await this.getVehiclePageDataOptimized(typeId);
        success++;
      } catch {
        this.logger.error(`❌ Warm cache failed pour vehicle ${typeId}`);
        failed++;
      }
    }

    this.logger.log(
      `✅ Warm cache terminé: ${success} succès, ${failed} échecs`,
    );
    return { success, failed };
  }

  /**
   * 🚗 Récupère le contenu R8 enrichi pour un véhicule (si INDEX).
   * Retourne null si pas de contenu R8 ou si seo_decision != INDEX.
   */
  async getR8Content(typeId: number): Promise<{
    h1: string;
    metaTitle: string;
    metaDescription: string;
    blocks: Array<{
      id: string;
      type: string;
      title: string;
      renderedText: string;
      specificityWeight: number;
    }>;
    seoDecision: string;
    diversityScore: number;
  } | null> {
    const { data, error } = await this.client
      .from('__seo_r8_pages')
      .select(
        'h1, meta_title, meta_description, rendered_json, seo_decision, diversity_score',
      )
      .eq('type_id', String(typeId))
      .in('seo_decision', ['INDEX', 'REVIEW_REQUIRED'])
      .filter('rendered_json->blocks', 'not.is', null)
      .order('diversity_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      h1: data.h1,
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      blocks: data.rendered_json?.blocks || [],
      seoDecision: data.seo_decision,
      diversityScore: data.diversity_score,
    };
  }

  /**
   * 🗑️ Invalide le cache d'un véhicule
   */
  async invalidateCache(typeId: number): Promise<void> {
    const cacheKey = this.getCacheKey(typeId);
    const staleCacheKey = this.getStaleCacheKey(typeId);

    await this.cacheService.del(cacheKey);
    await this.cacheService.del(staleCacheKey);

    this.logger.log(`🗑️ Cache invalidé pour vehicle ${typeId}`);
  }
}
