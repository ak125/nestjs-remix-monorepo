/**
 * RM API Service - Read Model pour listings produits optimisés
 * Performance: ~200ms (single RPC with Redis cache)
 */

export interface RmProduct {
  piece_id: number;
  piece_reference: string;
  piece_name: string;
  pm_id: number;
  pm_name: string;
  price_ttc: number;
  quality: "OE" | "EQUIV" | "ECO";
  piece_position: string | null;
  score: number;
  has_image: boolean;
  pmi_folder: string | null; // Bucket folder (e.g. "101")
  pmi_name: string | null; // Image filename (e.g. "34407_1.JPG")
}

export interface RmProductsResponse {
  success: boolean;
  gamme_id: number;
  vehicle_id: number;
  count: number;
  products: RmProduct[];
  duration_ms: number;
}

export async function fetchRmProducts(
  gammeId: number,
  vehicleId: number,
  limit = 100,
): Promise<RmProductsResponse> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/rm/products?gamme_id=${gammeId}&vehicle_id=${vehicleId}&limit=${Math.min(limit, 500)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`RM API failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// RM Page Complete - Retourne TOUTES les données (~350ms)
// ============================================================================

export interface RmVehicleInfo {
  type_id: number;
  type_name: string;
  type_alias: string;
  type_power_kw: string;
  type_power_ps: string;
  type_liter: string;
  type_year_from: string;
  type_year_to: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
}

export interface RmGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_ppa_id: string;
  pg_parent: string;
}

export interface RmFilters {
  brands: Array<{ pm_id: number; pm_name: string }>;
  qualities: string[];
  price_range: { min: number; max: number };
}

export interface RmPageResponse {
  success: boolean;
  products: RmProduct[];
  count: number;
  vehicleInfo: RmVehicleInfo;
  gamme: RmGamme;
  filters: RmFilters;
  duration_ms: number;
  error?: { code: string; message: string };
}

/**
 * Fetch complete page data from RM API
 * Performance: ~350ms (single RPC with Redis cache)
 */
export async function fetchRmPage(
  gammeId: number,
  vehicleId: number,
  limit = 200,
): Promise<RmPageResponse> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/rm/page?gamme_id=${gammeId}&vehicle_id=${vehicleId}&limit=${Math.min(limit, 500)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`RM Page API failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// V2: RM Page Complete avec ALL features (SEO, OEM, cross-selling, groupes)
// ============================================================================

export interface RmProductV2 extends RmProduct {
  image: string;
  filtre_gamme: string;
  is_accessory: boolean;
}

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
    quality: "OE" | "EQUIV" | "ECO";
    stock_status: string;
    score: number;
  }>;
  oemRefs: string[];
  oemRefsCount: number;
}

export interface RmVehicleInfoV2 {
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

export interface RmGammeV2 {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_pic: string | null;
  pg_ppa_id: number | null;
  pg_parent: number | null;
}

export interface RmSeoData {
  h1: string;
  title: string;
  description: string;
  content: string;
  preview: string;
}

export interface RmCrossSelling {
  PG_ID: number;
  PG_NAME: string;
  PG_ALIAS: string;
  PG_IMAGE: string | null;
}

export interface RmFilterOption {
  value?: string;
  pm_id?: number;
  pm_name?: string;
  count: number;
}

export interface RmFiltersV2 {
  brands: RmFilterOption[];
  qualities: RmFilterOption[];
  sides: RmFilterOption[];
  price_range: { min: number | null; max: number | null };
}

export interface RmDataQuality {
  quality: number;
  pieces_with_brand_percent: number;
  pieces_with_image_percent: number;
  pieces_with_price_percent: number;
}

export interface RmValidation {
  valid: boolean;
  relationsCount: number;
  dataQuality: RmDataQuality;
}

export interface RmPageV2Response {
  success: boolean;
  products: RmProductV2[];
  count: number;
  minPrice: number | null;
  grouped_pieces: RmGroupedPiece[];
  vehicleInfo: RmVehicleInfoV2;
  gamme: RmGammeV2;
  seo: RmSeoData;
  oemRefs: string[];
  crossSelling: RmCrossSelling[];
  filters: RmFiltersV2;
  validation: RmValidation;
  duration_ms: number;
  cacheHit?: boolean;
  error?: { code: string; message: string };
}

/**
 * 🚀 V2: Fetch complete page data with ALL features from RM API
 *
 * Returns:
 * - products: RM-scored products (OE/EQUIV/ECO, stock status)
 * - grouped_pieces: Products grouped by gamme+side with OEM refs per group
 * - vehicleInfo: Complete vehicle info with motor/mine/cnit codes
 * - seo: Fully processed SEO (h1, title, description, content)
 * - oemRefs: Normalized OEM references
 * - crossSelling: Related gammes
 * - filters: Brands/qualities/sides with counts
 * - validation: Data quality metrics
 *
 * Performance: ~400ms (single RPC with Redis cache)
 */
export async function fetchRmPageV2(
  gammeId: number,
  vehicleId: number,
  limit = 200,
): Promise<RmPageV2Response> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/rm/page-v2?gamme_id=${gammeId}&vehicle_id=${vehicleId}&limit=${Math.min(limit, 500)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`RM Page V2 API failed: ${response.status}`);
  }

  return response.json();
}
