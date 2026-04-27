import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { DomainNotFoundException, ErrorCodes } from '@common/exceptions';

/**
 * Service RPC pour les pages vehicule /constructeurs/{marque}/{modele}/{type}.html
 *
 * ADR-016 Phase 2 : single-path cache-first.
 *  - La source de verite rapide est la table `__vehicle_page_cache` (O(1) par type_id).
 *  - `get_vehicle_page_data_cached` lit le cache et reconstruit a la volee sur miss.
 *  - Un cache Redis courte duree (1h) evite le round-trip DB a chaud.
 *  - Plus de timeout adaptatif / stale / Caddy retry / hardcoded index.
 *  - Legacy `get_vehicle_page_data_optimized` supprimee, flag supprime.
 */
@Injectable()
export class VehicleRpcService extends SupabaseBaseService {
  protected override readonly logger = new Logger(VehicleRpcService.name);

  /** TTL Redis L1 — 1h, données quasi-statiques (TecDoc sync quotidien). */
  private readonly CACHE_TTL_SECONDS = 3600;
  /** Timeout unique sur la RPC cache-first. Cache hit = <10ms, rebuild on-miss = ~4s. */
  private readonly RPC_TIMEOUT_MS = 2000;
  /** Timeout dur sur l'overlay R8 (SEO bonus, non-bloquant). */
  private readonly R8_TIMEOUT_MS = 500;

  constructor(
    private readonly cacheService: CacheService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  private getCacheKey(typeId: number): string {
    return `vehicle:rpc:v2:${typeId}`;
  }

  /**
   * Récupère les données page véhicule. Redis L1 (1h) + DB cache-first.
   */
  async getVehiclePageDataOptimized(typeId: number) {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(typeId);

    // L1: Redis (évite round-trip DB pour les types hot)
    const cached =
      await this.cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return {
        ...cached,
        _cache: { hit: true, time: performance.now() - startTime },
      };
    }

    // L2: table __vehicle_page_cache via get_vehicle_page_data_cached (rebuild si miss)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), this.RPC_TIMEOUT_MS);
    });
    const rpcPromise = this.callRpc<any>(
      'get_vehicle_page_data_cached',
      { p_type_id: typeId },
      { source: 'api' },
    );

    const { data, error: rpcError } = await Promise.race([
      rpcPromise,
      timeoutPromise,
    ]);

    if (rpcError) throw rpcError;

    if (!data?.vehicle || !data?.success) {
      throw new DomainNotFoundException({
        code: ErrorCodes.VEHICLE.NOT_FOUND,
        message: `Vehicle not found: type_id=${typeId}`,
      });
    }

    // Persistance Redis L1 (non-bloquant)
    this.cacheService
      .set(cacheKey, data, this.CACHE_TTL_SECONDS)
      .catch((err) =>
        this.logger.warn(`L1 cache set failed for type ${typeId}: ${err}`),
      );

    return {
      ...data,
      _performance: {
        totalTime: performance.now() - startTime,
        cacheHit: false,
      },
    };
  }

  /**
   * Précharge Redis L1 pour les véhicules populaires.
   */
  async warmCache(
    typeIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    for (const typeId of typeIds) {
      try {
        await this.getVehiclePageDataOptimized(typeId);
        success++;
      } catch {
        failed++;
      }
    }
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
    const queryPromise = this.client
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

    const timeoutPromise = new Promise<{ data: null; error: Error }>(
      (resolve) => {
        setTimeout(
          () => resolve({ data: null, error: new Error('R8_OVERLAY_TIMEOUT') }),
          this.R8_TIMEOUT_MS,
        );
      },
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      if ((error as Error).message === 'R8_OVERLAY_TIMEOUT') {
        this.logger.warn(
          `⏱️ R8 overlay timeout (>${this.R8_TIMEOUT_MS}ms) pour vehicle ${typeId}`,
        );
      }
      return null;
    }
    if (!data) return null;

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
   * 🗑️ Invalide Redis L1 pour un type_id.
   * Pour invalider aussi la table DB : markDbCacheStale() ou rebuildDbCache().
   */
  async invalidateCache(typeId: number): Promise<void> {
    await this.cacheService.del(this.getCacheKey(typeId));
  }

  /**
   * 🔄 Résout un ancien type_id TecDoc (>= 100K) vers le nouveau massdoc.
   */
  async resolveRemappedTypeId(
    oldTypeId: number,
  ): Promise<{ newId: number; canonicalUrl: string } | null> {
    if (oldTypeId < 100000) return null;

    const cacheKey = `remap:type:${oldTypeId}`;
    const cached = await this.cacheService.get<{
      newId: number;
      canonicalUrl: string;
    }>(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.callRpc<any[]>(
      'resolve_type_id_remap',
      { p_old_id: oldTypeId },
      { source: 'api' },
    );
    if (error || !data || data.length === 0) return null;

    const row = data[0];
    const typeAlias =
      row.type_alias && row.type_alias !== 'null' && row.type_alias !== 'type'
        ? row.type_alias
        : row.type_name
            ?.normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'type';

    const canonicalUrl = `/constructeurs/${row.marque_alias}-${row.marque_id}/${row.modele_alias}-${row.modele_id}/${typeAlias}-${row.new_id}.html`;
    const result = { newId: row.new_id, canonicalUrl };

    await this.cacheService.set(cacheKey, result, 86400);
    return result;
  }

  // ========================================================================
  // ADR-016 — Vehicle Page DB cache (table __vehicle_page_cache)
  // ========================================================================

  /** Force un rebuild DB + invalide Redis L1 pour un type_id. */
  async rebuildDbCache(typeId: number): Promise<boolean> {
    const { data, error } = await this.callRpc<boolean>(
      'rebuild_vehicle_page_cache',
      { p_type_id: typeId },
      { source: 'api' },
    );
    if (error) throw error;
    await this.invalidateCache(typeId);
    return Boolean(data);
  }

  /** Marque N lignes comme stale (rebuild async via cron ou prochain hit). */
  async markDbCacheStale(
    typeIds: number[],
    reason: string,
  ): Promise<{ marked: number }> {
    if (!typeIds.length) return { marked: 0 };
    const { error, count } = await this.client
      .from('__vehicle_page_cache')
      .update({ stale: true, stale_reason: reason }, { count: 'exact' })
      .in('type_id', typeIds);
    if (error) throw error;
    for (const id of typeIds) await this.invalidateCache(id);
    return { marked: count ?? typeIds.length };
  }

  /** Stats du cache DB pour dashboard admin. */
  async getDbCacheStats(): Promise<{
    total: number;
    stale: number;
    oldest_built_at: string | null;
    newest_built_at: string | null;
  }> {
    const [{ count: total }, { count: stale }, { data: oldestRaw }] =
      await Promise.all([
        this.client
          .from('__vehicle_page_cache')
          .select('*', { count: 'exact', head: true }),
        this.client
          .from('__vehicle_page_cache')
          .select('*', { count: 'exact', head: true })
          .eq('stale', true),
        this.client
          .from('__vehicle_page_cache')
          .select('built_at')
          .order('built_at', { ascending: true })
          .limit(1),
      ]);
    const { data: newestRaw } = await this.client
      .from('__vehicle_page_cache')
      .select('built_at')
      .order('built_at', { ascending: false })
      .limit(1);
    return {
      total: total ?? 0,
      stale: stale ?? 0,
      oldest_built_at: oldestRaw?.[0]?.built_at ?? null,
      newest_built_at: newestRaw?.[0]?.built_at ?? null,
    };
  }
}
