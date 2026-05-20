import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { CacheService } from '@cache/cache.service';
import {
  SeoTemplateService,
  type SeoContext,
  type SeoTemplates,
} from '../../catalog/services/seo-template.service';
import { pickGammeKeywordModifier } from '../../catalog/services/vehicle-aware-description.composer';
import { SeoShadowObservatory } from '../../seo-shadow-observatory/seo-shadow-observatory.service';
import {
  RmProduct,
  RmListing,
  ProductsResponse,
  ListingPageData,
  GetProductsParams,
  GetListingParams,
  RmPageCompleteV2Response,
  GetPageV2Params,
} from '../rm.types';

// Cache TTL: 1 hour (3600 seconds)
const CACHE_TTL = 3600;

/**
 * 🏗️ RM Builder Service
 *
 * Service for building and retrieving Read Model listings.
 * Uses PostgreSQL RPC functions for efficient data access.
 * Redis caching for performance (~50ms hit vs ~1.4s RPC).
 *
 * Available RPCs:
 * - get_listing_products_for_build: Fetches raw products with scoring
 * - rm_get_listing_page: Retrieves cached listing page data
 *
 * Cache keys:
 * - rm:products:{gamme_id}:{vehicle_id}:{limit}
 * - rm:page:{gamme_id}:{vehicle_id}
 */
@Injectable()
export class RmBuilderService extends SupabaseBaseService {
  protected override readonly logger = new Logger(RmBuilderService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly seoTemplateService: SeoTemplateService,
    rpcGate: RpcGateService,
    private readonly shadowObservatory: SeoShadowObservatory,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 📦 Get products for a gamme+vehicle pair
   *
   * Calls get_listing_products_for_build RPC which:
   * - Joins pieces, pieces_price, pieces_marque
   * - Calculates quality (OE/EQUIV/ECO) and stock status
   * - Computes ranking score
   * - Returns sorted by score DESC, price ASC
   *
   * 🚀 Redis cache: ~50ms hit vs ~1.4s RPC miss
   *
   * @param params - gamme_id, vehicle_id, limit
   * @returns ProductsResponse with scored products
   */
  async getProducts(
    params: GetProductsParams,
  ): Promise<ProductsResponse & { cacheHit?: boolean }> {
    const startTime = performance.now();
    const { gamme_id, vehicle_id, limit = 500 } = params;
    const cacheKey = `rm:products:${gamme_id}:${vehicle_id}:${limit}`;

    // 1. Try cache first
    try {
      const cached = await this.cacheService.get<ProductsResponse>(cacheKey);
      if (cached) {
        const cacheDuration = Math.max(
          1,
          Math.round(performance.now() - startTime),
        );
        this.logger.debug(
          `Cache HIT for ${cacheKey} (${cached.count} products) in ${cacheDuration}ms`,
        );
        return { ...cached, cacheHit: true, duration_ms: cacheDuration };
      }
    } catch {
      // Cache error - continue to RPC
    }

    this.logger.debug(
      `Cache MISS - Fetching products for gamme=${gamme_id} vehicle=${vehicle_id} limit=${limit}`,
    );

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<RmProduct[]>(
        'get_listing_products_for_build_v2',
        {
          p_gamme_id: gamme_id,
          p_vehicle_id: vehicle_id,
          p_limit: limit,
        },
        { source: 'api' },
      );

      const duration_ms = Math.round(performance.now() - startTime);

      if (error) {
        this.logger.error(`RPC error: ${error.message}`);
        return {
          success: false,
          gamme_id,
          vehicle_id,
          count: 0,
          products: [],
          duration_ms,
          cacheHit: false,
        };
      }

      const rawProducts = (data || []) as RmProduct[];

      // 🚫 TEMPORAIRE: Masquer stock_status pour le moment
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const products = rawProducts.map(({ stock_status, ...rest }) => rest);

      this.logger.debug(
        `Found ${products.length} products in ${duration_ms}ms`,
      );

      const result: ProductsResponse = {
        success: true,
        gamme_id,
        vehicle_id,
        count: products.length,
        products: products as unknown as RmProduct[],
        duration_ms,
      };

      // 2. Store in cache (TTL: 1h)
      if (result.success && result.count > 0) {
        try {
          await this.cacheService.set(cacheKey, result, CACHE_TTL);
          this.logger.debug(`Cached ${cacheKey} for ${CACHE_TTL}s`);
        } catch {
          // Cache error - continue without caching
        }
      }

      return { ...result, cacheHit: false };
    } catch (err) {
      const duration_ms = Math.round(performance.now() - startTime);
      this.logger.error(
        `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      return {
        success: false,
        gamme_id,
        vehicle_id,
        count: 0,
        products: [],
        duration_ms,
        cacheHit: false,
      };
    }
  }

  /**
   * 📄 Get listing page data
   *
   * Calls rm_get_listing_page RPC which returns cached listing
   * if available, or an error if not found.
   *
   * @param params - gamme_id, vehicle_id
   * @returns ListingPageData with listing and products
   */
  async getListingPage(params: GetListingParams): Promise<ListingPageData> {
    const { gamme_id, vehicle_id } = params;

    this.logger.debug(
      `Getting listing page for gamme=${gamme_id} vehicle=${vehicle_id}`,
    );

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<ListingPageData>(
        'rm_get_listing_page',
        {
          p_gamme_id: gamme_id,
          p_vehicle_id: vehicle_id,
        },
        { source: 'api' },
      );

      if (error) {
        this.logger.error(`RPC error: ${error.message}`);
        return {
          valid: false,
          success: false,
          error: {
            code: 'RPC_ERROR',
            message: error.message,
          },
        };
      }

      // The RPC returns the result directly
      return data as ListingPageData;
    } catch (err) {
      this.logger.error(
        `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      return {
        valid: false,
        success: false,
        error: {
          code: 'EXCEPTION',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 📊 Get listing metadata
   *
   * Fetches listing metadata from rm_listing table directly.
   *
   * @param gamme_id - Product family ID
   * @param vehicle_id - Vehicle type ID
   * @returns RmListing or null if not found
   */
  async getListing(
    gamme_id: number,
    vehicle_id: number,
  ): Promise<RmListing | null> {
    try {
      const { data, error } = await this.supabase
        .from('rm_listing')
        .select('*')
        .eq('rml_gamme_id', gamme_id)
        .eq('rml_vehicle_id', vehicle_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        this.logger.error(`Query error: ${error.message}`);
        throw error;
      }

      return data as RmListing;
    } catch (err) {
      if (err instanceof Error && err.message.includes('PGRST116')) {
        return null;
      }
      throw err;
    }
  }

  /**
   * 🔍 Check if listing exists and is ready
   *
   * @param gamme_id - Product family ID
   * @param vehicle_id - Vehicle type ID
   * @returns true if listing exists and is READY
   */
  async isListingReady(gamme_id: number, vehicle_id: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('rm_listing')
      .select('rml_build_status')
      .eq('rml_gamme_id', gamme_id)
      .eq('rml_vehicle_id', vehicle_id)
      .single();

    if (error || !data) {
      return false;
    }

    return data.rml_build_status === 'READY';
  }

  /**
   * 📈 Get RM system health stats
   *
   * @returns Health metrics from rm_health RPC
   */
  async getHealth(): Promise<Record<string, unknown>> {
    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<Record<string, unknown>>(
        'rm_health',
        {},
        { source: 'admin' },
      );

      if (error) {
        return {
          status: 'error',
          message: error.message,
        };
      }

      return data || { status: 'unknown' };
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * 📊 Get listing statistics
   *
   * @returns Count of listings by status
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('rm_listing')
        .select('rml_build_status');

      if (error) {
        throw error;
      }

      const listings = data || [];
      const by_status: Record<string, number> = {};

      for (const listing of listings) {
        const status = listing.rml_build_status || 'UNKNOWN';
        by_status[status] = (by_status[status] || 0) + 1;
      }

      return {
        total: listings.length,
        by_status,
      };
    } catch (err) {
      this.logger.error(
        `Stats error: ${err instanceof Error ? err.message : 'Unknown'}`,
      );
      return {
        total: 0,
        by_status: {},
      };
    }
  }

  /**
   * 🚀 Get complete page data
   *
   * Calls rm_get_page_complete RPC which returns all data needed
   * for a product listing page in a single call (~350ms).
   *
   * 🚀 Redis cache: ~50ms hit vs ~1.4s RPC miss
   *
   * @param params - gamme_id, vehicle_id, limit
   * @returns Complete page data (products, vehicleInfo, gamme, filters)
   */
  async getPageComplete(params: {
    gamme_id: number;
    vehicle_id: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    products?: RmProduct[];
    count?: number;
    vehicleInfo?: Record<string, unknown>;
    gamme?: Record<string, unknown>;
    filters?: Record<string, unknown>;
    duration_ms?: number;
    error?: { code: string; message: string };
    cacheHit?: boolean;
  }> {
    const startTime = performance.now();
    const { gamme_id, vehicle_id, limit = 200 } = params;
    const cacheKey = `rm:page:${gamme_id}:${vehicle_id}`;

    // Response type for caching
    type PageResponse = {
      success: boolean;
      products?: RmProduct[];
      count?: number;
      vehicleInfo?: Record<string, unknown>;
      gamme?: Record<string, unknown>;
      filters?: Record<string, unknown>;
      duration_ms?: number;
      error?: { code: string; message: string };
    };

    // 1. Try cache first
    try {
      const cached = await this.cacheService.get<PageResponse>(cacheKey);
      if (cached && cached.success) {
        const cacheDuration = Math.max(
          1,
          Math.round(performance.now() - startTime),
        );
        this.logger.debug(
          `Cache HIT for ${cacheKey} (${cached.count} products) in ${cacheDuration}ms`,
        );
        return { ...cached, cacheHit: true, duration_ms: cacheDuration };
      }
    } catch {
      // Cache error - continue to RPC
    }

    this.logger.debug(
      `Cache MISS - Getting page complete for gamme=${gamme_id} vehicle=${vehicle_id} limit=${limit}`,
    );

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any>(
        'rm_get_page_complete',
        {
          p_gamme_id: gamme_id,
          p_vehicle_id: vehicle_id,
          p_limit: limit,
        },
        { source: 'api' },
      );

      const duration_ms = Math.round(performance.now() - startTime);

      if (error) {
        this.logger.error(`RPC error: ${error.message}`);
        return {
          success: false,
          error: {
            code: 'RPC_ERROR',
            message: error.message,
          },
          cacheHit: false,
        };
      }

      // RPC returns JSONB directly
      const result = data as PageResponse;

      // Override duration with actual timing
      result.duration_ms = duration_ms;

      if (result.success) {
        this.logger.debug(
          `Page complete: ${result.count} products in ${duration_ms}ms`,
        );

        // 2. Store in cache (TTL: 1h)
        if (result.count && result.count > 0) {
          try {
            await this.cacheService.set(cacheKey, result, CACHE_TTL);
            this.logger.debug(`Cached ${cacheKey} for ${CACHE_TTL}s`);
          } catch {
            // Cache error - continue without caching
          }
        }
      }

      return { ...result, cacheHit: false };
    } catch (err) {
      this.logger.error(
        `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      return {
        success: false,
        error: {
          code: 'EXCEPTION',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
        cacheHit: false,
      };
    }
  }

  /**
   * 🚀 V2: Get complete page data with ALL features
   *
   * Calls rm_get_page_complete_v2 RPC which returns ALL data needed
   * for a product listing page including:
   * - Products with RM scoring (OE/EQUIV/ECO, stock status)
   * - Grouped pieces with OEM refs per group
   * - Complete vehicle info with motor/mine/cnit codes
   * - Fully processed SEO (all switches resolved)
   * - Cross-selling gammes
   * - Filters with counts
   * - Validation/data quality metrics
   *
   * 🚀 Redis cache: ~50ms hit vs ~400ms RPC miss
   *
   * @param params - gamme_id, vehicle_id, limit
   * @returns Complete page data for frontend
   */
  async getPageCompleteV2(
    params: GetPageV2Params,
  ): Promise<RmPageCompleteV2Response> {
    const startTime = performance.now();
    const { gamme_id, vehicle_id, limit = 200 } = params;
    const cacheKey = `rm:page-v2:${gamme_id}:${vehicle_id}`;

    // 1. Try cache first
    try {
      const cached =
        await this.cacheService.get<RmPageCompleteV2Response>(cacheKey);
      if (cached && cached.success) {
        const cacheDuration = Math.max(
          1,
          Math.round(performance.now() - startTime),
        );
        this.logger.debug(
          `Cache HIT for ${cacheKey} (${cached.count} products) in ${cacheDuration}ms`,
        );
        return { ...cached, cacheHit: true, duration_ms: cacheDuration };
      }
    } catch {
      // Cache error - continue to RPC
    }

    this.logger.debug(
      `Cache MISS - Getting page v2 for gamme=${gamme_id} vehicle=${vehicle_id} limit=${limit}`,
    );

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<RmPageCompleteV2Response>(
        'rm_get_page_complete_v2',
        {
          p_gamme_id: gamme_id,
          p_vehicle_id: vehicle_id,
          p_limit: limit,
        },
        { source: 'api' },
      );

      const duration_ms = Math.round(performance.now() - startTime);

      if (error) {
        this.logger.error(`RPC v2 error: ${error.message}`);
        return {
          success: false,
          products: [],
          count: 0,
          minPrice: null,
          grouped_pieces: [],
          vehicleInfo: {} as RmPageCompleteV2Response['vehicleInfo'],
          gamme: {} as RmPageCompleteV2Response['gamme'],
          seo: { h1: '', title: '', description: '', content: '', preview: '' },
          oemRefs: [],
          crossSelling: [],
          filters: {
            brands: [],
            qualities: [],
            sides: [],
            price_range: { min: null, max: null },
          },
          validation: {
            valid: false,
            relationsCount: 0,
            dataQuality: {
              quality: 0,
              pieces_with_brand_percent: 0,
              pieces_with_image_percent: 0,
              pieces_with_price_percent: 0,
            },
          },
          duration_ms,
          cacheHit: false,
          error: {
            code: 'RPC_ERROR',
            message: error.message,
          },
        };
      }

      // RPC returns JSONB directly
      const result = data as RmPageCompleteV2Response;
      result.cacheHit = false;

      if (result.success) {
        // v2.2.0: Process SEO templates via NestJS (replaces PL/pgSQL)
        const raw = data as unknown as Record<string, unknown>;
        const seoTemplates = raw.seo_raw as SeoTemplates | null;
        const seoCtx = raw.seo_context as Record<string, string> | null;

        if (seoTemplates && seoCtx) {
          try {
            const ctx: SeoContext = {
              type_id: Number(seoCtx.type_id),
              pg_id: Number(seoCtx.pg_id),
              mf_id: Number(seoCtx.mf_id),
              marque_name: seoCtx.marque_name || '',
              marque_alias: seoCtx.marque_alias || '',
              modele_name: seoCtx.modele_name || '',
              modele_alias: seoCtx.modele_alias || '',
              type_name: seoCtx.type_name || '',
              type_alias: seoCtx.type_alias || '',
              gamme_name: result.gamme?.pg_name || '',
              gamme_alias: result.gamme?.pg_alias || '',
              min_price: result.minPrice ?? undefined,
              count: result.count,
              power_ps: seoCtx.type_power_ps || '',
              // Fragments switch PAR GAMME (legacy) pour résoudre #CompSwitch_alias#
              // (sinon strippés à vide → meta dégénérée). Chargé caché.
              comp_switches: await this.loadCompSwitches(Number(seoCtx.pg_id)),
              // Modifieur mot-clé GATÉ (ex. « avant ») depuis __seo_keywords —
              // ajouté au terme produit dans la description composée. Gate
              // anti-contamination (mot-clé doit contenir les mots-cœur gamme).
              gamme_keyword_modifier: await this.loadGammeKeywordModifier(
                Number(seoCtx.pg_id),
                result.gamme?.pg_name || '',
              ),
            };

            const processed = await this.seoTemplateService.processTemplates(
              seoTemplates,
              ctx,
            );
            const legacySeo = {
              h1: processed.h1,
              title: processed.title,
              description: processed.description,
              content: processed.content,
              preview: processed.preview,
            };

            // Retrofit ADR-055 — shadow observation via SeoShadowObservatoryModule (I1).
            // Observatory.observe() est sync : retour immédiat, comparaison réelle
            // dispatchée via setImmediate. Aucune mutation de result.seo possible
            // depuis ce module (I3 — pas de branche mode === 'on').
            result.seo = legacySeo;
            this.fireShadowObservation(ctx, legacySeo);
          } catch (seoErr) {
            this.logger.warn(
              `SEO processing failed, fallback to raw: ${seoErr}`,
            );
            if (seoTemplates) {
              result.seo = { ...seoTemplates };
            }
          }
        }

        // Clean internal fields before caching
        delete (raw as Record<string, unknown>).seo_raw;
        delete (raw as Record<string, unknown>).seo_context;

        // Measure total duration including SEO processing
        result.duration_ms = Math.round(performance.now() - startTime);

        this.logger.debug(
          `Page v2 complete: ${result.count} products, ${result.grouped_pieces?.length || 0} groups, ` +
            `${result.oemRefs?.length || 0} OEM refs in ${result.duration_ms}ms`,
        );

        // 2. Store in cache (TTL: 1h)
        if (result.count && result.count > 0) {
          try {
            await this.cacheService.set(cacheKey, result, CACHE_TTL);
            this.logger.debug(`Cached ${cacheKey} for ${CACHE_TTL}s`);
          } catch {
            // Cache error - continue without caching
          }
        }
      } else {
        result.duration_ms = duration_ms;
      }

      return result;
    } catch (err) {
      const duration_ms = Math.round(performance.now() - startTime);
      this.logger.error(
        `Exception v2: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      return {
        success: false,
        products: [],
        count: 0,
        minPrice: null,
        grouped_pieces: [],
        vehicleInfo: {} as RmPageCompleteV2Response['vehicleInfo'],
        gamme: {} as RmPageCompleteV2Response['gamme'],
        seo: { h1: '', title: '', description: '', content: '', preview: '' },
        oemRefs: [],
        crossSelling: [],
        filters: {
          brands: [],
          qualities: [],
          sides: [],
          price_range: { min: null, max: null },
        },
        validation: {
          valid: false,
          relationsCount: 0,
          dataQuality: {
            quality: 0,
            pieces_with_brand_percent: 0,
            pieces_with_image_percent: 0,
            pieces_with_price_percent: 0,
          },
        },
        duration_ms,
        cacheHit: false,
        error: {
          code: 'EXCEPTION',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Charge les fragments switch PAR GAMME (`__seo_gamme_car_switch`) pour un
   * pg_id, groupés par alias → résolus dans #CompSwitch_alias[_pgid]# par
   * `SeoTemplateService` (sinon strippés à vide = meta dégénérée). Caché 24h
   * (quasi-statique). Décode les entités HTML legacy (`&rsquo;` etc.).
   */
  private async loadCompSwitches(
    pgId: number,
  ): Promise<Record<string, string[]>> {
    if (!pgId || Number.isNaN(pgId)) return {};
    const cacheKey = `seo:comp_switches:${pgId}`;
    const cached =
      await this.cacheService.get<Record<string, string[]>>(cacheKey);
    if (cached) return cached;

    const grouped: Record<string, string[]> = {};
    try {
      const { data, error } = await this.supabase
        .from('__seo_gamme_car_switch')
        .select('sgcs_alias, sgcs_content')
        .eq('sgcs_pg_id', String(pgId));
      if (!error && Array.isArray(data)) {
        for (const row of data as Array<{
          sgcs_alias: string | null;
          sgcs_content: string | null;
        }>) {
          const alias = (row.sgcs_alias ?? '').trim();
          const content = this.decodeHtmlEntities(
            (row.sgcs_content ?? '').trim(),
          );
          if (alias && content) {
            (grouped[alias] ??= []).push(content);
          }
        }
      }
    } catch (e) {
      this.logger.warn(`loadCompSwitches(${pgId}) failed: ${String(e)}`);
    }
    // Cache même si vide (évite re-query répétée). TTL 24h.
    await this.cacheService
      .set(cacheKey, grouped, 86400)
      .catch(() => undefined);
    return grouped;
  }

  /**
   * Choisit un modifieur mot-clé SÛR pour la gamme depuis `__seo_keywords`
   * (gate anti-contamination : le mot-clé doit contenir les mots-cœur de la
   * gamme — cf. `pickGammeKeywordModifier`). Caché 24h. Null si rien de sûr.
   */
  private async loadGammeKeywordModifier(
    pgId: number,
    gammeName: string,
  ): Promise<string | null> {
    if (!pgId || Number.isNaN(pgId) || !gammeName) return null;
    const cacheKey = `seo:gamme_kw_modifier:${pgId}`;
    const cached = await this.cacheService.get<string>(cacheKey);
    if (cached !== undefined && cached !== null) return cached === '' ? null : cached;

    let modifier: string | null = null;
    try {
      const { data, error } = await this.supabase
        .from('__seo_keywords')
        .select('keyword, volume')
        .eq('pg_id', pgId);
      if (!error && Array.isArray(data)) {
        modifier = pickGammeKeywordModifier(
          gammeName,
          (data as Array<{ keyword: string | null; volume: number | null }>).map(
            (r) => ({ keyword: r.keyword ?? '', volume: r.volume ?? 0 }),
          ),
        );
      }
    } catch (e) {
      this.logger.warn(`loadGammeKeywordModifier(${pgId}) failed: ${String(e)}`);
    }
    // Cache la chaîne vide pour « null » (évite re-query). TTL 24h.
    await this.cacheService
      .set(cacheKey, modifier ?? '', 86400)
      .catch(() => undefined);
    return modifier;
  }

  /** Décode les entités HTML legacy les plus fréquentes dans les fragments switch. */
  private decodeHtmlEntities(s: string): string {
    if (!s) return s;
    return s
      .replace(/&rsquo;/g, '’')
      .replace(/&lsquo;/g, '‘')
      .replace(/&rdquo;/g, '”')
      .replace(/&ldquo;/g, '“')
      .replace(/&nbsp;/g, ' ')
      .replace(/&eacute;/g, 'é')
      .replace(/&egrave;/g, 'è')
      .replace(/&agrave;/g, 'à')
      .replace(/&ccedil;/g, 'ç')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  // ────────────────────────────────────────────────────────────────────
  // PR-3 (plan seo-v9) — branchement chaîne SEO commune en shadow/on
  // ────────────────────────────────────────────────────────────────────

  /**
   * Construit un `SeoChainInput` à partir du contexte rm-builder + appelle
   * `SeoChainOrchestratorService.run()`. Surface = R1_GAMME_VEHICLE_ROUTER
   * (le legacy supposait toujours un contexte gamme×véhicule).
   *
   * @returns le payload `seo` formaté comme la sortie `SeoTemplateService`,
   * ou `null` si la chaîne renvoie un title vide (fallback legacy).
   */
  /**
   * Fire-and-forget shadow observation R1 gamme×véhicule (retrofit ADR-055).
   *
   * NE PAS `await` cette méthode — `observe()` est sync par contrat (validé
   * par `.ast-grep/rules/seo-shadow-no-await.yml`). La comparaison réelle
   * court via `setImmediate` dans le module observatory.
   */
  private fireShadowObservation(
    ctx: SeoContext,
    legacy: {
      h1: string;
      title: string;
      description: string;
      content: string;
      preview: string;
    },
  ): void {
    this.shadowObservatory.observe({
      surface: 'R1_GAMME_VEHICLE_ROUTER',
      legacy: {
        title: legacy.title,
        description: legacy.description,
        h1: legacy.h1,
        content: legacy.content,
        keywords: null,
        canonical: null,
        robots: null,
      },
      requestUrl: `https://www.automecanik.com/pieces/${ctx.gamme_alias}.${ctx.marque_alias}.${ctx.modele_alias}.${ctx.type_alias}.html`,
      ids: {
        pgId: ctx.pg_id,
        typeId: ctx.type_id,
        gammeAlias: ctx.gamme_alias,
        marqueAlias: ctx.marque_alias,
        modeleAlias: ctx.modele_alias,
        typeAlias: ctx.type_alias,
      },
      vars: {
        gamme: ctx.gamme_name,
        gammeMeta: ctx.gamme_name,
        marque: ctx.marque_name,
        marqueMeta: ctx.marque_name,
        marqueMetaTitle: ctx.marque_name,
        modele: ctx.modele_name,
        modeleMeta: ctx.modele_name,
        type: ctx.type_name,
        typeMeta: ctx.type_name,
        nbCh: Number.parseInt(ctx.power_ps ?? '0', 10) || 0,
        minPrice: ctx.min_price ?? 0,
        articlesCount: ctx.count ?? 0,
        gammeLevel: 1,
        isTopGamme: 0,
      },
      entityId: `${ctx.pg_id}:${ctx.type_id}`,
    });
  }
}
