import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import {
  RmProduct,
  RmListing,
  ProductsResponse,
  ListingPageData,
  GetProductsParams,
  GetListingParams,
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

  constructor(private readonly cacheService: CacheService) {
    super();
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

    // 1. Try cache first (v1.6.2 - duration_ms fix)
    try {
      const cached = await this.cacheService.get<ProductsResponse>(cacheKey);
      if (cached) {
        this.logger.debug(
          `Cache HIT for ${cacheKey} (${cached.count} products)`,
        );
        // Return cached data with duration_ms: 0 to indicate instant response
        return { ...cached, cacheHit: true, duration_ms: 0 };
      }
    } catch {
      // Cache error - continue to RPC
    }

    this.logger.debug(
      `Cache MISS - Fetching products for gamme=${gamme_id} vehicle=${vehicle_id} limit=${limit}`,
    );

    try {
      const { data, error } = await this.supabase.rpc(
        'get_listing_products_for_build',
        {
          p_gamme_id: gamme_id,
          p_vehicle_id: vehicle_id,
          p_limit: limit,
        },
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
      const { data, error } = await this.supabase.rpc('rm_get_listing_page', {
        p_gamme_id: gamme_id,
        p_vehicle_id: vehicle_id,
      });

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
      const { data, error } = await this.supabase.rpc('rm_health');

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
        this.logger.debug(
          `Cache HIT for ${cacheKey} (${cached.count} products)`,
        );
        return { ...cached, cacheHit: true, duration_ms: 0 };
      }
    } catch {
      // Cache error - continue to RPC
    }

    this.logger.debug(
      `Cache MISS - Getting page complete for gamme=${gamme_id} vehicle=${vehicle_id} limit=${limit}`,
    );

    try {
      const { data, error } = await this.supabase.rpc('rm_get_page_complete', {
        p_gamme_id: gamme_id,
        p_vehicle_id: vehicle_id,
        p_limit: limit,
      });

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
}
