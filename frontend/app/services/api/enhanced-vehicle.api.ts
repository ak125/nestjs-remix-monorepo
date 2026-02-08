/**
 * Enhanced Vehicle API Service (v2)
 * - Unifié: utilisable côté Remix (client/loader) et côté Nest si besoin
 * - Typage via @repo/database-types
 * - Backend retourne { data, page, limit, total } (sans "success") → mapping standardisé
 */

import {
  type VehicleBrand,
  type VehicleModel,
  type VehicleType,
  type PaginationOptions,
} from "@repo/database-types";

type VehicleResponse<T> = {
  data?: T;
  page?: number;
  limit?: number;
  total?: number;
  message?: string;
  // Pas de "success" attendu côté backend
};

// --- Helpers ---

const DEFAULT_HEADERS: HeadersInit = { "Content-Type": "application/json" };
const DEFAULT_TIMEOUT_MS = 15000;

function resolveBaseUrl(): string {
  // Côté browser, même origine
  if (typeof window !== "undefined") return window.location.origin;
  // Côté serveur (loaders Remix, scripts), utilisez une env si différent
  return process.env.API_BASE_URL || "http://localhost:3000";
}

async function httpJSON<T>(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      ...init,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

function toSearchParams(
  opts?: Record<string, string | number | boolean | undefined>,
) {
  const sp = new URLSearchParams();
  if (!opts) return sp;
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === null) continue;
    sp.append(k, String(v));
  }
  return sp;
}

// --- Mapping utilitaires (backend → types unifiés) ---

function mapBrand(raw: any): VehicleBrand {
  return {
    marque_id: Number(raw.marque_id),
    marque_name: String(raw.marque_name),
    marque_alias: String(
      raw.marque_alias ?? raw.marque_name?.toLowerCase().replace(/\s+/g, "-"),
    ),
    marque_display: Number(raw.marque_display ?? 1),
    marque_relfollow: Number(raw.marque_relfollow ?? 1),
    marque_sitemap: Number(raw.marque_sitemap ?? 1),
    is_featured: raw.is_featured ?? raw.marque_top === 1,
    marque_logo: raw.marque_logo,
    marque_country: raw.marque_country,
    products_count: raw.products_count,
  } as VehicleBrand;
}

function mapModel(raw: any): VehicleModel {
  return {
    modele_id: Number(raw.modele_id),
    modele_marque_id: Number(raw.modele_marque_id ?? raw.brand_id),
    modele_name: String(raw.modele_name),
    modele_alias: String(
      raw.modele_alias ?? raw.modele_name?.toLowerCase().replace(/\s+/g, "-"),
    ),
    modele_ful_name: raw.modele_ful_name,
    modele_display: Number(raw.modele_display ?? 1),
    year_from: raw.modele_year_from ? Number(raw.modele_year_from) : undefined,
    year_to: raw.modele_year_to ? Number(raw.modele_year_to) : undefined,
  } as VehicleModel;
}

function mapType(raw: any): VehicleType {
  return {
    type_id: Number(raw.type_id),
    type_name: String(raw.type_name),
    modele_id: Number(raw.type_modele_id ?? raw.modele_id),
    type_alias: String(
      raw.type_alias ?? raw.type_name?.toLowerCase().replace(/\s+/g, "-"),
    ),
    type_fuel: raw.type_fuel,
    type_power_ps: raw.type_power_ps ? Number(raw.type_power_ps) : undefined,
    type_liter: raw.type_liter ? Number(raw.type_liter) : undefined,
    type_engine: raw.type_engine,
    year_from: raw.type_year_from ? Number(raw.type_year_from) : undefined,
    year_to: raw.type_year_to ? Number(raw.type_year_to) : undefined,
  } as VehicleType;
}

// --- Service ---

class EnhancedVehicleApiService {
  private readonly baseUrl: string;
  private readonly apiPrefix = "/api/vehicles";

  constructor() {
    this.baseUrl = resolveBaseUrl();
  }

  // -------- Brands --------

  async getBrands(
    options?: PaginationOptions & {
      search?: string;
      onlyFavorites?: boolean;
      onlyActive?: boolean;
    },
  ): Promise<VehicleBrand[]> {
    const params = toSearchParams({
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
      onlyFavorites: options?.onlyFavorites,
      onlyActive: options?.onlyActive,
    });
    const url = `${this.baseUrl}${this.apiPrefix}/brands${params.toString() ? `?${params}` : ""}`;
    const res = await httpJSON<VehicleResponse<any[]>>(url);
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(mapBrand);
  }

  async getFeaturedBrands(): Promise<VehicleBrand[]> {
    const url = `${this.baseUrl}${this.apiPrefix}/brands/featured`;
    const res = await httpJSON<VehicleResponse<any[]>>(url);
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(mapBrand);
  }

  // -------- Models --------

  async getModels(
    brandId: number,
    options?: { year?: number } & PaginationOptions & { search?: string },
  ): Promise<VehicleModel[]> {
    const params = toSearchParams({
      year: options?.year,
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
    });
    const url = `${this.baseUrl}${this.apiPrefix}/brands/${brandId}/models${params.toString() ? `?${params}` : ""}`;
    const res = await httpJSON<VehicleResponse<any[]>>(url);
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(mapModel);
  }

  async searchModels(brandId: number, query: string): Promise<VehicleModel[]> {
    const params = toSearchParams({ brandId, q: query });
    const url = `${this.baseUrl}${this.apiPrefix}/models/search?${params}`;
    const res = await httpJSON<VehicleResponse<any[]>>(url);
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(mapModel);
  }

  // -------- Types --------

  async getTypes(
    modelId: number,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      fuel?: string;
      year?: number;
    },
  ): Promise<VehicleType[]> {
    const params = toSearchParams(options);
    const url = `${this.baseUrl}${this.apiPrefix}/models/${modelId}/types${params.toString() ? `?${params}` : ""}`;
    const res = await httpJSON<VehicleResponse<any[]>>(url);
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(mapType);
  }

  // -------- Search / VIN --------

  async searchVehicles(
    query: string,
    options?: { type?: "brand" | "model" | "type" | "all"; limit?: number },
  ): Promise<{
    brands: VehicleBrand[];
    models: VehicleModel[];
    types: VehicleType[];
  }> {
    const params = toSearchParams({
      query,
      type: options?.type,
      limit: options?.limit,
    });
    const url = `${this.baseUrl}${this.apiPrefix}/search?${params}`;
    const res = await httpJSON<{
      success?: boolean;
      data?: { brands?: any[]; models?: any[]; types?: any[] };
    }>(url);
    const data = res.data ?? {};
    return {
      brands: (data.brands ?? []).map(mapBrand),
      models: (data.models ?? []).map(mapModel),
      types: (data.types ?? []).map(mapType),
    };
  }

  async searchByVin(vin: string): Promise<VehicleType | null> {
    const url = `${this.baseUrl}${this.apiPrefix}/vin/${encodeURIComponent(vin)}`;
    const res = await httpJSON<VehicleResponse<any | null>>(url);
    return res.data ? mapType(res.data) : null;
  }

  // -------- Years / Stats --------

  async getYearsByBrand(brandId: number): Promise<number[]> {
    const url = `${this.baseUrl}${this.apiPrefix}/brands/${brandId}/years`;
    const res =
      await httpJSON<VehicleResponse<{ year: number }[] | number[]>>(url);
    const payload = res.data ?? [];
    if (Array.isArray(payload) && typeof payload[0] === "number")
      return payload as number[];
    return (payload as { year: number }[]).map((r) => Number(r.year));
  }

  async getStats(): Promise<{
    totalBrands: number;
    totalModels: number;
    totalTypes: number;
    featuredBrands: number;
  }> {
    const url = `${this.baseUrl}${this.apiPrefix}/stats`;
    const res = await httpJSON<
      VehicleResponse<{
        totalBrands: number;
        totalModels: number;
        totalTypes: number;
        featuredBrands: number;
      }>
    >(url);
    return (
      res.data ?? {
        totalBrands: 0,
        totalModels: 0,
        totalTypes: 0,
        featuredBrands: 0,
      }
    );
  }

  // -------- Utils --------

  generateVehicleUrl(vehicle: {
    brand: VehicleBrand;
    model: VehicleModel;
    type: VehicleType;
  }): string {
    const brandSlug =
      vehicle.brand.marque_alias ||
      vehicle.brand.marque_name.toLowerCase().replace(/\s+/g, "-");
    const modelSlug = vehicle.model.modele_name
      .toLowerCase()
      .replace(/\s+/g, "-");
    const typeSlug = vehicle.type.type_name.toLowerCase().replace(/\s+/g, "-");
    return `/vehicules/${brandSlug}/${modelSlug}/${typeSlug}`;
  }

  isValidBrand(obj: unknown): obj is VehicleBrand {
    return (
      !!obj &&
      typeof obj === "object" &&
      "marque_id" in obj &&
      "marque_name" in obj &&
      "marque_display" in obj
    );
  }
  isValidModel(obj: unknown): obj is VehicleModel {
    return (
      !!obj &&
      typeof obj === "object" &&
      "modele_id" in obj &&
      "modele_name" in obj &&
      "modele_marque_id" in obj
    );
  }
  isValidType(obj: unknown): obj is VehicleType {
    return (
      !!obj &&
      typeof obj === "object" &&
      "type_id" in obj &&
      "type_name" in obj &&
      "modele_id" in obj
    );
  }
}

export const enhancedVehicleApi = new EnhancedVehicleApiService();
// Re-export vehicle types from database-types
export type {
  VehicleBrand,
  VehicleModel,
  VehicleType,
} from "@repo/database-types";
