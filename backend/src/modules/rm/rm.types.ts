/**
 * 📦 RM (Read Model) Types
 *
 * Types locaux pour le module RM.
 * ⚠️ NE PAS IMPORTER de @monorepo/shared-types (incident 2026-01-11)
 */

// ============================================================================
// Enums (mirroring PostgreSQL enums)
// ============================================================================

export type RmQuality = 'OE' | 'EQUIV' | 'ECO';
export type RmStockStatus =
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'PREORDER';
export type RmBuildStatus =
  | 'READY'
  | 'PARTIAL'
  | 'FAILED'
  | 'EMPTY'
  | 'PENDING';

// ============================================================================
// Product Types
// ============================================================================

/**
 * Product returned by get_listing_products_for_build RPC
 */
export interface RmProduct {
  piece_id: number;
  piece_reference: string;
  piece_name: string;
  pm_id: number;
  pm_name: string;
  price_ttc: number;
  quality: RmQuality;
  stock_status: RmStockStatus;
  piece_position: string | null;
  score: number;
  has_image: boolean;
}

// ============================================================================
// Listing Types (matching existing rm_listing table schema)
// ============================================================================

/**
 * Listing metadata from rm_listing table
 */
export interface RmListing {
  rml_gamme_id: number;
  rml_vehicle_id: number;
  rml_family_id: number | null;
  rml_h1: string | null;
  rml_title: string | null;
  rml_meta_description: string | null;
  rml_product_count: number;
  rml_min_price: number | null;
  rml_max_price: number | null;
  rml_build_status: RmBuildStatus;
  rml_serving_enabled: boolean;
  rml_seo_indexable: boolean;
  rml_seo_reasons: string[] | null;
  rml_data_version: string;
  rml_content_hash: string | null;
  rml_products_hash: string | null;
  rml_facets_hash: string | null;
  rml_version: number;
  rml_created_at: string;
  rml_updated_at: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Result from building a listing
 */
export interface BuildResult {
  success: boolean;
  gamme_id: number;
  vehicle_id: number;
  product_count: number;
  duration_ms: number;
  error?: string;
}

/**
 * Products response for API
 */
export interface ProductsResponse {
  success: boolean;
  gamme_id: number;
  vehicle_id: number;
  count: number;
  products: RmProduct[];
  duration_ms: number;
}

/**
 * Listing page data from rm_get_listing_page RPC
 */
export interface ListingPageData {
  valid: boolean;
  success: boolean;
  listing?: RmListing;
  products?: RmProduct[];
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface GetProductsParams {
  gamme_id: number;
  vehicle_id: number;
  limit?: number;
}

export interface GetListingParams {
  gamme_id: number;
  vehicle_id: number;
  rebuild_if_missing?: boolean;
}
