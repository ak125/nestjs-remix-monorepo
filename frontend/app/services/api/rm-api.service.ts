/**
 * RM API Service - Read Model pour listings produits optimisés
 * Performance: ~200ms vs ~1.6s (batch-loader)
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
 * Replaces batch-loader for product listing pages
 * Performance: ~350ms vs ~950ms (batch-loader)
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
