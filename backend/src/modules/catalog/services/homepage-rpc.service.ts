import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';

/**
 * 🚀 Service RPC optimisé pour la page d'accueil
 *
 * STRATÉGIES D'OPTIMISATION:
 * 1. Cache Redis avec TTL 5min pour données homepage (changent peu)
 * 2. Single RPC call remplace 4 appels API séquentiels
 * 3. NO fallback - retourne erreur 500 si RPC échoue
 *
 * Remplace 4 appels API séquentiels (400-800ms) par 1 RPC (<150ms)
 *
 * Endpoints remplacés:
 * - /api/catalog/equipementiers
 * - /api/blog/advice?limit=6
 * - /api/catalog/gammes/hierarchy
 * - /api/brands/brands-logos
 */
@Injectable()
export class HomepageRpcService extends SupabaseBaseService {
  protected override readonly logger = new Logger(HomepageRpcService.name);

  // TTL Cache: 5 minutes pour données homepage
  private readonly CACHE_TTL_SECONDS = 300;
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
   * 🔑 Génère la clé de cache pour homepage
   */
  private getCacheKey(): string {
    return 'homepage:rpc:v1';
  }

  /**
   * ⚡ Récupère les données homepage avec cache
   */
  async getHomepageDataOptimized() {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey();

    // 1. Vérifier le cache Redis d'abord
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      const cacheTime = performance.now() - startTime;
      this.logger.debug(`🎯 CACHE HIT homepage en ${cacheTime.toFixed(1)}ms`);
      return {
        ...cached,
        _cache: {
          hit: true,
          time: cacheTime,
        },
      };
    }

    // 2. Cache miss → Appel RPC
    this.logger.debug('❌ CACHE MISS homepage, appel RPC...');

    const result = await this.fetchRpcWithTimeout(startTime);

    // 3. Stocker en cache (async, non-bloquant)
    this.cacheResult(result).catch((err) =>
      this.logger.error('Erreur cache homepage:', err),
    );

    return result;
  }

  /**
   * 🔄 Appel RPC avec timeout strict via RPC Safety Gate
   */
  private async fetchRpcWithTimeout(startTime: number) {
    // Créer une Promise avec timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), this.RPC_TIMEOUT_MS);
    });

    // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
    const rpcPromise = this.callRpc<any>(
      'get_homepage_data_optimized',
      {},
      {
        source: 'api',
        role: 'service_role',
      },
    );

    // Race entre RPC et timeout
    const { data, error: rpcError } = await Promise.race([
      rpcPromise,
      timeoutPromise.then(() => ({
        data: null,
        error: new Error('RPC_TIMEOUT'),
      })),
    ]);

    if (rpcError) {
      this.logger.error('RPC homepage error:', rpcError);
      throw rpcError;
    }

    const rpcTime = performance.now() - startTime;
    this.logger.log(`✅ RPC homepage en ${rpcTime.toFixed(1)}ms`);

    // Vérifier que les données sont valides
    if (!data?.success) {
      throw new Error('Homepage RPC returned invalid data');
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
  private async cacheResult(result: any): Promise<void> {
    const cacheKey = this.getCacheKey();
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);
    this.logger.debug(
      `💾 Cache stocké pour homepage (TTL: ${this.CACHE_TTL_SECONDS}s)`,
    );
  }

  /**
   * 🗑️ Invalide le cache homepage
   */
  async invalidateCache(): Promise<void> {
    const cacheKey = this.getCacheKey();
    await this.cacheService.del(cacheKey);
    this.logger.log('🗑️ Cache invalidé pour homepage');
  }

  /**
   * 🔥 Préchauffe le cache homepage
   */
  async warmCache(): Promise<{ success: boolean; time: number }> {
    const startTime = performance.now();
    try {
      await this.getHomepageDataOptimized();
      const time = performance.now() - startTime;
      this.logger.log(`🔥 Warm cache homepage terminé en ${time.toFixed(1)}ms`);
      return { success: true, time };
    } catch (error) {
      this.logger.error('❌ Warm cache homepage failed:', error);
      return { success: false, time: performance.now() - startTime };
    }
  }
}
