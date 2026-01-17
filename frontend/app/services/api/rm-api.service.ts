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
  price_ttc: number; // Prix en euros (pas en centimes)
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

/**
 * Fetch products from RM API
 * @param gammeId - ID de la gamme (ex: 402 pour plaquettes de frein)
 * @param vehicleId - ID du véhicule/type (ex: 9045)
 * @param limit - Nombre max de produits (default: 100, max: 500)
 */
export async function fetchRmProducts(
  gammeId: number,
  vehicleId: number,
  limit = 100,
  timeoutMs = 3000,
): Promise<RmProductsResponse> {
  // URL absolue pour SSR (localhost ne fonctionne pas en SSR)
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/rm/products?gamme_id=${gammeId}&vehicle_id=${vehicleId}&limit=${Math.min(limit, 500)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`RM API failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
