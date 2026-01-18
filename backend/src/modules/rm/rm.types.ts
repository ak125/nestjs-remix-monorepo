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

// ============================================================================
// V2 Types - Complete Page Data
// ============================================================================

/**
 * Extended product with additional fields from v2 RPC
 */
export interface RmProductV2 extends RmProduct {
  image: string;
  filtre_gamme: string;
  is_accessory: boolean;
}

/**
 * Grouped pieces with OEM refs per group
 */
export interface RmGroupedPiece {
  filtre_gamme: string;
  filtre_side: string | null;
  title_h2: string;
  pieces: Array<{
    id: number;
    nom: string;
    reference: string;
    marque: string;
    marque_id: number;
    prix_unitaire: number;
    prix_ttc: number;
    image: string;
    dispo: boolean;
    quality: RmQuality;
    stock_status: RmStockStatus;
    score: number;
  }>;
  oemRefs: string[];
  oemRefsCount: number;
}

/**
 * Complete vehicle info from v2 RPC
 */
export interface RmVehicleInfo {
  typeId: number;
  typeName: string;
  typeAlias: string;
  typePowerPs: string | null;
  typePowerKw: string | null;
  typeYearFrom: string | null;
  typeYearTo: string | null;
  typeBody: string | null;
  typeFuel: string | null;
  typeEngine: string | null;
  typeLiter: string | null;
  modeleId: number;
  modeleName: string;
  modeleAlias: string;
  modelePic: string | null;
  marqueId: number;
  marqueName: string;
  marqueAlias: string;
  marqueLogo: string | null;
  motorCodesFormatted: string | null;
  mineCodesFormatted: string | null;
  cnitCodesFormatted: string | null;
}

/**
 * Gamme info
 */
export interface RmGammeInfo {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_pic: string | null;
  pg_ppa_id: number | null;
  pg_parent: number | null;
}

/**
 * SEO data (processed switches)
 */
export interface RmSeoData {
  h1: string;
  title: string;
  description: string;
  content: string;
  preview: string;
}

/**
 * Cross-selling gamme
 */
export interface RmCrossSelling {
  PG_ID: number;
  PG_NAME: string;
  PG_ALIAS: string;
  PG_IMAGE: string | null;
}

/**
 * Filter with count
 */
export interface RmFilterOption {
  value?: string;
  pm_id?: number;
  pm_name?: string;
  count: number;
}

/**
 * Filters with counts
 */
export interface RmFilters {
  brands: RmFilterOption[];
  qualities: RmFilterOption[];
  sides: RmFilterOption[];
  price_range: {
    min: number | null;
    max: number | null;
  };
}

/**
 * Data quality metrics
 */
export interface RmDataQuality {
  quality: number;
  pieces_with_brand_percent: number;
  pieces_with_image_percent: number;
  pieces_with_price_percent: number;
}

/**
 * Validation info
 */
export interface RmValidation {
  valid: boolean;
  relationsCount: number;
  dataQuality: RmDataQuality;
}

/**
 * Complete page response from rm_get_page_complete_v2 RPC
 */
export interface RmPageCompleteV2Response {
  success: boolean;
  products: RmProductV2[];
  count: number;
  minPrice: number | null;
  grouped_pieces: RmGroupedPiece[];
  vehicleInfo: RmVehicleInfo;
  gamme: RmGammeInfo;
  seo: RmSeoData;
  oemRefs: string[];
  crossSelling: RmCrossSelling[];
  filters: RmFilters;
  validation: RmValidation;
  duration_ms: number;
  cacheHit?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Query parameters for v2 page
 */
export interface GetPageV2Params {
  gamme_id: number;
  vehicle_id: number;
  limit?: number;
}
