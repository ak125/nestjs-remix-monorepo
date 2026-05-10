import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';

import { SeoShadowObservatory } from '@modules/seo-shadow-observatory/seo-shadow-observatory.service';

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
    private readonly shadowObservatory: SeoShadowObservatory,
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
   * ⚡ Récupère les données page marque avec cache.
   *
   * `requestUrl` optionnel — si fourni, déclenche une observation shadow
   * (SeoShadowObservatory, PR-6). Sync, non-bloquant pour le chemin réponse.
   */
  async getBrandPageDataOptimized(marqueId: number, requestUrl?: string) {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(marqueId);

    // 1. Vérifier le cache Redis d'abord
    const cached =
      await this.cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      const cacheTime = performance.now() - startTime;
      this.logger.debug(
        `🎯 CACHE HIT brand ${marqueId} en ${cacheTime.toFixed(1)}ms`,
      );
      const result = {
        ...cached,
        _cache: {
          hit: true,
          time: cacheTime,
        },
      };
      this.fireShadowObservation(marqueId, requestUrl, result);
      return result;
    }

    // 2. Cache miss → Appel RPC
    this.logger.debug(`❌ CACHE MISS brand ${marqueId}, appel RPC...`);

    const result = await this.fetchRpcWithTimeout(marqueId, startTime);

    // 3. Stocker en cache (async, non-bloquant)
    this.cacheResult(marqueId, result).catch((err) =>
      this.logger.error(`Erreur cache brand ${marqueId}:`, err),
    );

    this.fireShadowObservation(marqueId, requestUrl, result);
    return result;
  }

  /**
   * Fire-and-forget shadow observation (PR-6).
   *
   * NE PAS `await` cette méthode — `observe()` est sync par contrat (validé
   * par `.ast-grep/rules/seo-shadow-no-await.yml`). La comparaison réelle
   * court via `setImmediate` dans le module observatory.
   */
  private fireShadowObservation(
    marqueId: number,
    requestUrl: string | undefined,
    result: Record<string, unknown>,
  ): void {
    if (!requestUrl) return;
    const brand =
      (result['brand'] as Record<string, unknown> | undefined) ?? undefined;
    const seo =
      (result['seo'] as Record<string, unknown> | undefined) ?? undefined;
    const brandAlias = String(brand?.['marque_alias'] ?? '');
    const marqueName = String(brand?.['marque_name'] ?? '');
    if (!brandAlias) return;
    this.shadowObservatory.observe({
      surface: 'R7_BRAND_HUB',
      legacy: {
        title: (seo?.['title'] as string | null | undefined) ?? null,
        description:
          (seo?.['description'] as string | null | undefined) ?? null,
        h1: (seo?.['h1'] as string | null | undefined) ?? null,
        content: (seo?.['content'] as string | null | undefined) ?? null,
        keywords: (seo?.['keywords'] as string | null | undefined) ?? null,
        canonical: (seo?.['canonical'] as string | null | undefined) ?? null,
        robots: (seo?.['robots'] as string | null | undefined) ?? null,
      },
      requestUrl,
      ids: {
        brandId: marqueId,
        brandAlias,
      },
      vars: {
        VMarque: marqueName,
      },
      entityId: String(marqueId),
    });
  }

  /**
   * 🔄 Appel RPC avec timeout strict
   */
  private async fetchRpcWithTimeout(marqueId: number, startTime: number) {
    // Créer une Promise avec timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), this.RPC_TIMEOUT_MS);
    });

    // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
    const rpcPromise = this.callRpc<Record<string, unknown>>(
      'get_brand_page_data_optimized',
      { p_marque_id: marqueId },
      { source: 'api' },
    );

    // Race entre RPC et timeout
    const { data, error: rpcError } = await Promise.race([
      rpcPromise,
      timeoutPromise,
    ]);

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
        message: String(data?.error || 'Brand RPC returned invalid data'),
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
  private async cacheResult(marqueId: number, result: unknown): Promise<void> {
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

  /**
   * 📄 Récupère le contenu R7 enrichi (si PUBLISH)
   */
  async getR7Content(pageKey: string): Promise<{
    h1: string;
    meta_title: string;
    meta_description: string;
    rendered_json: Record<string, unknown>;
    section_scores: Record<string, number>;
    diversity_score: number;
    seo_decision: string;
  } | null> {
    const { data, error } = await this.client
      .from('__seo_r7_pages')
      .select(
        'h1, meta_title, meta_description, rendered_json, section_scores, diversity_score, seo_decision',
      )
      .eq('page_key', pageKey)
      .eq('seo_decision', 'PUBLISH')
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }
}
