import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  RmProduct,
  RmListing,
  ProductsResponse,
  ListingPageData,
  GetProductsParams,
  GetListingParams,
} from '../rm.types';

/**
 * 🏗️ RM Builder Service
 *
 * Service for building and retrieving Read Model listings.
 * Uses PostgreSQL RPC functions for efficient data access.
 *
 * Available RPCs:
 * - get_listing_products_for_build: Fetches raw products with scoring
 * - rm_get_listing_page: Retrieves cached listing page data
 */
@Injectable()
export class RmBuilderService extends SupabaseBaseService {
  protected override readonly logger = new Logger(RmBuilderService.name);

  /**
   * 📦 Get products for a gamme+vehicle pair
   *
   * Calls get_listing_products_for_build RPC which:
   * - Joins pieces, pieces_price, pieces_marque
   * - Calculates quality (OE/EQUIV/ECO) and stock status
   * - Computes ranking score
   * - Returns sorted by score DESC, price ASC
   *
   * @param params - gamme_id, vehicle_id, limit
   * @returns ProductsResponse with scored products
   */
  async getProducts(params: GetProductsParams): Promise<ProductsResponse> {
    const startTime = performance.now();
    const { gamme_id, vehicle_id, limit = 500 } = params;

    this.logger.debug(
      `Fetching products for gamme=${gamme_id} vehicle=${vehicle_id} limit=${limit}`,
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
        };
      }

      const rawProducts = (data || []) as RmProduct[];

      // 🚫 TEMPORAIRE: Masquer stock_status pour le moment
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const products = rawProducts.map(({ stock_status, ...rest }) => rest);

      this.logger.debug(
        `Found ${products.length} products in ${duration_ms}ms`,
      );

      return {
        success: true,
        gamme_id,
        vehicle_id,
        count: products.length,
        products: products as unknown as RmProduct[],
        duration_ms,
      };
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
  }> {
    const { gamme_id, vehicle_id, limit = 200 } = params;

    this.logger.debug(
      `Getting page complete for gamme=${gamme_id} vehicle=${vehicle_id} limit=${limit}`,
    );

    try {
      const { data, error } = await this.supabase.rpc('rm_get_page_complete', {
        p_gamme_id: gamme_id,
        p_vehicle_id: vehicle_id,
        p_limit: limit,
      });

      if (error) {
        this.logger.error(`RPC error: ${error.message}`);
        return {
          success: false,
          error: {
            code: 'RPC_ERROR',
            message: error.message,
          },
        };
      }

      // RPC returns JSONB directly
      const result = data as {
        success: boolean;
        products?: RmProduct[];
        count?: number;
        vehicleInfo?: Record<string, unknown>;
        gamme?: Record<string, unknown>;
        filters?: Record<string, unknown>;
        duration_ms?: number;
        error?: { code: string; message: string };
      };

      if (result.success) {
        this.logger.debug(
          `Page complete: ${result.count} products in ${result.duration_ms}ms`,
        );
      }

      return result;
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
      };
    }
  }
}
