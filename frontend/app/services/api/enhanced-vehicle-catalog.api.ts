// 📁 frontend/app/services/api/enhanced-vehicle-catalog.api.ts
// 🚗 Enhanced Vehicle Catalog API Client - Utilise le service backend modernisé

import { z } from "zod";

// ========================================
// 🔍 VALIDATION ET TYPES
// ========================================

const VehicleCatalogResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    vehicle: z.object({
      id: z.number(),
      name: z.string(),
      slug: z.string().optional(),
      power_hp: z.number().optional(),
      power_kw: z.number().optional(),
      fuel: z.string().optional(),
      yearFrom: z.number().optional(),
      yearTo: z.number().optional(),
      model: z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string().optional(),
        brand: z.object({
          id: z.number(),
          name: z.string(),
          code: z.string(),
          slug: z.string().optional(),
        }),
      }),
    }),
    categories: z.array(z.object({
      id: z.number(),
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      subcategories: z.array(z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string(),
        partsCount: z.number().optional(),
      })),
    })),
    breadcrumbs: z.array(z.object({
      label: z.string(),
      path: z.string(),
      position: z.number(),
    })),
    metadata: z.object({
      title: z.string(),
      description: z.string(),
      keywords: z.array(z.string()),
      ogTitle: z.string(),
      ogDescription: z.string(),
      ogImage: z.string().optional(),
      canonicalUrl: z.string(),
      schemaMarkup: z.record(z.any()),
    }),
    analytics: z.object({
      vehicleViews: z.number(),
      popularCategories: z.array(z.string()),
      recommendedParts: z.number(),
      conversionRate: z.number().optional(),
      cacheStatus: z.object({
        vehicle: z.boolean(),
        categories: z.boolean(),
        metadata: z.boolean(),
      }),
    }),
  }),
  responseTime: z.string().optional(),
  timestamp: z.string(),
});

const PopularPartsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string().optional(),
    price: z.number().optional(),
    brand: z.string().optional(),
    imageUrl: z.string().optional(),
    category: z.object({
      id: z.number(),
      name: z.string(),
    }).optional(),
  })),
  total: z.number(),
  timestamp: z.string(),
});

const VehicleSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.number(),
    name: z.string(),
    model: z.object({
      id: z.number(),
      name: z.string(),
      brand: z.object({
        id: z.number(),
        name: z.string(),
        code: z.string(),
      }),
    }),
  }),
  mineType: z.string(),
  timestamp: z.string(),
});

// ========================================
// 🌐 CONFIGURATION API
// ========================================

const API_BASE_URL = typeof window !== "undefined" 
  ? window.ENV?.API_URL || "http://localhost:3000"
  : process.env.API_URL || "http://localhost:3000";

const API_TIMEOUT = 10000; // 10 secondes

// ========================================
// 🛠️ UTILITAIRES API
// ========================================

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public url: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeout = API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ApiError(
        `HTTP Error: ${response.status}`,
        response.status,
        response.statusText,
        url
      );
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timeout", 408, "Request Timeout", url);
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0,
      "Network Error",
      url
    );
  }
}

// ========================================
// 🚗 ENHANCED VEHICLE CATALOG API CLIENT
// ========================================

export interface VehicleCatalogOptions {
  includeAnalytics?: boolean;
  cacheBypass?: boolean;
  timeout?: number;
}

export interface PopularPartsOptions {
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
}

export class EnhancedVehicleCatalogApi {
  private baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * 🚗 Récupérer le catalogue complet d'un véhicule
   */
  async getVehicleCatalog(
    brandSlug: string,
    modelSlug: string,
    typeSlug: string,
    options: VehicleCatalogOptions = {}
  ) {
    try {
      const url = `${this.baseUrl}/api/catalog/vehicles/${encodeURIComponent(brandSlug)}/${encodeURIComponent(modelSlug)}/${encodeURIComponent(typeSlug)}`;
      
      const searchParams = new URLSearchParams();
      if (options.includeAnalytics === false) {
        searchParams.set("includeAnalytics", "false");
      }
      if (options.cacheBypass) {
        searchParams.set("cache", "bypass");
      }

      const finalUrl = searchParams.toString() 
        ? `${url}?${searchParams.toString()}`
        : url;

      console.log(`📞 API Call: GET ${finalUrl}`);
      
      const response = await fetchWithTimeout(finalUrl, {}, options.timeout);
      const data = await response.json();

      // Validation de la réponse
      const validatedData = VehicleCatalogResponseSchema.parse(data);
      
      if (!validatedData.success) {
        throw new ApiError(
          "API returned success=false",
          500,
          "API Error",
          finalUrl
        );
      }

      console.log(`✅ Catalogue récupéré: ${validatedData.data.vehicle.model.brand.name} ${validatedData.data.vehicle.model.name} ${validatedData.data.vehicle.name}`);
      
      return validatedData.data;
    } catch (error) {
      console.error("❌ Erreur getVehicleCatalog:", error);
      
      if (error instanceof z.ZodError) {
        throw new ApiError(
          "Invalid API response format",
          500,
          "Validation Error",
          ""
        );
      }
      
      throw error;
    }
  }

  /**
   * 🔥 Récupérer les pièces populaires pour un véhicule
   */
  async getPopularParts(
    brandSlug: string,
    modelSlug: string,
    typeSlug: string,
    options: PopularPartsOptions = {}
  ) {
    try {
      // D'abord, récupérer le véhicule pour obtenir son ID
      const catalogData = await this.getVehicleCatalog(brandSlug, modelSlug, typeSlug);
      const vehicleTypeId = catalogData.vehicle.id;

      const url = `${this.baseUrl}/api/catalog/vehicles/${vehicleTypeId}/popular-parts`;
      
      const searchParams = new URLSearchParams();
      if (options.limit) {
        searchParams.set("limit", options.limit.toString());
      }
      if (options.category) {
        searchParams.set("category", options.category);
      }
      if (options.brand) {
        searchParams.set("brand", options.brand);
      }

      const finalUrl = searchParams.toString() 
        ? `${url}?${searchParams.toString()}`
        : url;

      console.log(`📞 API Call: GET ${finalUrl}`);
      
      const response = await fetchWithTimeout(finalUrl);
      const data = await response.json();

      // Validation de la réponse
      const validatedData = PopularPartsResponseSchema.parse(data);
      
      if (!validatedData.success) {
        throw new ApiError(
          "API returned success=false",
          500,
          "API Error",
          finalUrl
        );
      }

      console.log(`✅ ${validatedData.data.length} pièces populaires récupérées`);
      
      return validatedData.data;
    } catch (error) {
      console.error("❌ Erreur getPopularParts:", error);
      
      if (error instanceof z.ZodError) {
        throw new ApiError(
          "Invalid API response format",
          500,
          "Validation Error",
          ""
        );
      }
      
      throw error;
    }
  }

  /**
   * 🔍 Rechercher un véhicule par type mine
   */
  async searchByMineType(mineType: string) {
    try {
      const url = `${this.baseUrl}/api/catalog/vehicles/search/mine/${encodeURIComponent(mineType)}`;
      
      console.log(`📞 API Call: GET ${url}`);
      
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      // Validation de la réponse
      const validatedData = VehicleSearchResponseSchema.parse(data);
      
      if (!validatedData.success) {
        throw new ApiError(
          "API returned success=false",
          500,
          "API Error",
          url
        );
      }

      console.log(`✅ Véhicule trouvé par mine: ${validatedData.data.model.brand.name} ${validatedData.data.model.name} ${validatedData.data.name}`);
      
      return validatedData.data;
    } catch (error) {
      console.error("❌ Erreur searchByMineType:", error);
      
      if (error instanceof z.ZodError) {
        throw new ApiError(
          "Invalid API response format",
          500,
          "Validation Error",
          ""
        );
      }
      
      throw error;
    }
  }

  /**
   * 📊 Récupérer les statistiques du service
   */
  async getServiceStats() {
    try {
      const url = `${this.baseUrl}/api/catalog/vehicles/stats`;
      
      console.log(`📞 API Call: GET ${url}`);
      
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      console.log("✅ Statistiques récupérées:", data);
      
      return data;
    } catch (error) {
      console.error("❌ Erreur getServiceStats:", error);
      throw error;
    }
  }

  /**
   * ❤️ Health check du service
   */
  async healthCheck() {
    try {
      const url = `${this.baseUrl}/api/catalog/vehicles/health`;
      
      const response = await fetchWithTimeout(url, {}, 5000); // 5s timeout
      const data = await response.json();

      return data.status === "healthy";
    } catch (error) {
      console.error("❌ Erreur health check:", error);
      return false;
    }
  }

  /**
   * 🧹 Nettoyer le cache (admin uniquement)
   */
  async clearCache() {
    try {
      const url = `${this.baseUrl}/api/catalog/vehicles/cache/clear`;
      
      console.log(`📞 API Call: POST ${url}`);
      
      const response = await fetchWithTimeout(url, {
        method: "POST",
      });
      const data = await response.json();

      console.log("✅ Cache nettoyé:", data);
      
      return data;
    } catch (error) {
      console.error("❌ Erreur clearCache:", error);
      throw error;
    }
  }
}

// ========================================
// 🚀 INSTANCE SINGLETON EXPORTÉE
// ========================================

export const enhancedVehicleCatalogApi = new EnhancedVehicleCatalogApi();

// ========================================
// 🧪 UTILITAIRES DE TEST
// ========================================

export const testApi = {
  /**
   * Test complet de l'API avec un véhicule d'exemple
   */
  async runFullTest() {
    console.log("🧪 Test complet API Enhanced Vehicle Catalog");
    
    try {
      // 1. Health check
      console.log("1️⃣ Health check...");
      const isHealthy = await enhancedVehicleCatalogApi.healthCheck();
      console.log(`   Status: ${isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`);

      // 2. Statistiques
      console.log("2️⃣ Statistiques...");
      const stats = await enhancedVehicleCatalogApi.getServiceStats();
      console.log(`   Requests: ${stats.data?.catalogRequests || 0}`);
      console.log(`   Cache hit rate: ${stats.data?.cacheHitRate || 0}%`);

      // 3. Catalogue véhicule (exemple)
      console.log("3️⃣ Catalogue véhicule...");
      const catalog = await enhancedVehicleCatalogApi.getVehicleCatalog("peugeot", "308", "1-6-hdi");
      console.log(`   Véhicule: ${catalog.vehicle.model.brand.name} ${catalog.vehicle.model.name} ${catalog.vehicle.name}`);
      console.log(`   Catégories: ${catalog.categories.length}`);
      console.log(`   Pièces recommandées: ${catalog.analytics.recommendedParts}`);

      // 4. Pièces populaires
      console.log("4️⃣ Pièces populaires...");
      const popularParts = await enhancedVehicleCatalogApi.getPopularParts("peugeot", "308", "1-6-hdi", { limit: 5 });
      console.log(`   Pièces populaires: ${popularParts.length}`);

      console.log("✅ Test complet terminé avec succès!");
      return true;
      
    } catch (error) {
      console.error("❌ Test échoué:", error);
      return false;
    }
  },

  /**
   * Test de performance de l'API
   */
  async performanceTest() {
    console.log("⏱️ Test de performance API");
    
    const tests = [
      { name: "Catalogue (cache miss)", test: () => enhancedVehicleCatalogApi.getVehicleCatalog("peugeot", "308", "1-6-hdi", { cacheBypass: true }) },
      { name: "Catalogue (cache hit)", test: () => enhancedVehicleCatalogApi.getVehicleCatalog("peugeot", "308", "1-6-hdi") },
      { name: "Pièces populaires", test: () => enhancedVehicleCatalogApi.getPopularParts("peugeot", "308", "1-6-hdi", { limit: 10 }) },
      { name: "Statistiques", test: () => enhancedVehicleCatalogApi.getServiceStats() },
    ];

    const results: Array<{name: string, duration: number, success: boolean, error?: string}> = [];

    for (const testConfig of tests) {
      const start = performance.now();
      try {
        await testConfig.test();
        const duration = Math.round(performance.now() - start);
        results.push({ name: testConfig.name, duration, success: true });
        console.log(`✅ ${testConfig.name}: ${duration}ms`);
      } catch (error) {
        const duration = Math.round(performance.now() - start);
        const err = error as Error;
        results.push({ name: testConfig.name, duration, success: false, error: err.message });
        console.log(`❌ ${testConfig.name}: ${duration}ms (ERROR: ${err.message})`);
      }
    }

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successRate = (results.filter(r => r.success).length / results.length) * 100;

    console.log(`📊 Performance moyenne: ${avgDuration.toFixed(1)}ms`);
    console.log(`📊 Taux de succès: ${successRate.toFixed(1)}%`);

    return results;
  }
};

// Export des types pour utilisation externe
// Types exportés via les interfaces définies ci-dessus
export { ApiError };