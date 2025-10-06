/**
 * 🔧 API Catalogue Unifié
 * 
 * Service pour récupérer les pièces via l'API NestJS backend 
 * en utilisant les types partagés du monorepo
 * 
 * @package @monorepo/frontend
 */

// Configuration API Base URL
const API_BASE = typeof window !== 'undefined' 
  ? '/api' // Côté client: utilisation relative
  : process.env.API_BASE_URL || 'http://localhost:3000'; // Côté serveur

// Types pour les résultats cross-selling
export interface CrossSellingV5Result {
  success: boolean;
  crossSelling?: {
    recommendations: Array<{
      id: number;
      name: string;
      brand: string;
      price: number;
      priceFormatted: string;
      reference: string;
      quality: string;
      description?: string;
    }>;
    relatedProducts: Array<{
      id: number;
      name: string;
      brand: string;
      price: number;
      category: string;
    }>;
  };
  metadata: {
    source: string;
    responseTime: number;
    alias: string;
  };
}

// Types pour le SEO V5
export interface AdvancedSeoV5Result {
  success: boolean;
  seo?: {
    title: string;
    h1: string;
    description: string;
    longDescription: string;
    technicalSpecs: string[];
    faqItems: Array<{
      id: string;
      question: string;
      answer: string;
    }>;
  };
  metadata: {
    source: string;
    responseTime: number;
    gamme: string;
    marque: string;
    modele: string;
    type: string;
  };
}

/**
 * 🎯 CROSS-SELLING V5 PAR ALIAS
 * @param alias Alias de la gamme de pièces
 * @returns Recommandations de cross-selling
 */
export async function getCrossSellingV5ByAlias(alias: string): Promise<CrossSellingV5Result> {
  try {
    const response = await fetch(`${API_BASE}/cross-selling/v5/by-alias/${encodeURIComponent(alias)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      crossSelling: {
        recommendations: data.recommendations || [],
        relatedProducts: data.relatedProducts || [],
      },
      metadata: {
        source: 'v5-ultimate-cross-selling',
        responseTime: data.responseTime || 0,
        alias,
      },
    };
  } catch (error) {
    console.error('Erreur cross-selling V5 Ultimate:', error);
    return {
      success: false,
      metadata: {
        source: 'v5-ultimate-cross-selling-error',
        responseTime: 0,
        alias,
      },
    };
  }
}

/**
 * 📝 SEO AVANCÉ V5
 * @param params Paramètres pour le SEO (gamme, marque, modele, type)
 * @returns Contenu SEO optimisé
 */
export async function getAdvancedSeoV5(params: {
  gamme: string;
  marque: string;
  modele: string;
  type: string;
}): Promise<AdvancedSeoV5Result> {
  try {
    const queryParams = new URLSearchParams({
      gamme: params.gamme,
      marque: params.marque,
      modele: params.modele,
      type: params.type,
    });

    const response = await fetch(`${API_BASE}/advanced-seo-v5/generate-complex-seo?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      seo: {
        title: data.seo?.title || `${params.gamme} pour ${params.marque} ${params.modele} ${params.type}`,
        h1: data.seo?.h1 || `${params.gamme} pour ${params.marque} ${params.modele} ${params.type}`,
        description: data.seo?.description || `Pièces ${params.gamme} compatibles avec ${params.marque} ${params.modele} ${params.type}`,
        longDescription: data.seo?.longDescription || '',
        technicalSpecs: data.seo?.technicalSpecs || [],
        faqItems: data.seo?.faqItems || [],
      },
      metadata: {
        source: 'v5-ultimate-seo',
        responseTime: data.responseTime || 0,
        gamme: params.gamme,
        marque: params.marque,
        modele: params.modele,
        type: params.type,
      },
    };
  } catch (error) {
    console.error('Erreur SEO V5 Ultimate:', error);
    return {
      success: false,
      metadata: {
        source: 'v5-ultimate-seo-error',
        responseTime: 0,
        gamme: params.gamme,
        marque: params.marque,
        modele: params.modele,
        type: params.type,
      },
    };
  }
}

export interface V5UltimateSearchResult {
  success: boolean;
  search_query: string;
  found_count: number;
  results: Array<{
    piece_id: string;
    reference: string;
    supplier: string;  // Fournisseur (ACR, DCA, etc.)
    brand: string;     // Vraie marque (BOSCH, DAYCO, etc.)
    designation: string;
    stock_status: string;
    raw_price_ht: string;
    raw_price_ttc: string;
    enhanced_pricing: any;
  }>;
  _metadata: {
    response_time: number;
    search_type: string;
    methodology: string;
  };
}

export interface V5UltimatePricing {
  success: boolean;
  pricing?: {
    base_prices: Array<{
      type: string;
      price_ht: number;
      price_ttc: number;
      quantity: number;
      total_ht: number;
      total_ttc: number;
    }>;
    recommendations?: {
      best_deal: string;
      savings: number;
      alternative_suppliers: string[];
    };
  };
  _metadata: {
    response_time: number;
    methodology: string;
    cache_hit?: boolean;
  };
}

export interface V5UltimateHealth {
  status: 'healthy' | 'degraded' | 'error';
  services: {
    technical_data_v5: any;
    enhancement_v5: any;
    pricing_v5: any;
  };
  methodology: string;
  summary: {
    total_services: number;
    all_healthy: boolean;
    improvements: any;
  };
}

/**
 * 🔍 RECHERCHE PAR RÉFÉRENCE - Utilise l'endpoint de production
 * ✅ Migré en Phase 5.1: /api/test-v5/search → /api/products/search
 * @param reference Référence de pièce à rechercher
 * @returns Résultats avec distinction supplier/brand
 */
export async function searchPieceByReference(reference: string): Promise<V5UltimateSearchResult> {
  try {
    const response = await fetch(`${API_BASE}/api/products/search/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur recherche par référence:', error);
    return {
      success: false,
      search_query: reference,
      found_count: 0,
      results: [],
      _metadata: {
        response_time: 0,
        search_type: 'error',
        methodology: 'vérifier existant avant et utiliser le meilleur et améliorer - ERROR',
      },
    };
  }
}

/**
 * 💰 PRICING AVANCÉ - Service V5 Ultimate Final  
 * @param pieceId ID de la pièce
 * @returns Pricing avancé avec cache et recommandations
 */
export async function getAdvancedPricing(pieceId: string): Promise<V5UltimatePricing> {
  try {
    const response = await fetch(`${API_BASE}/api/test-v5/pricing-final-advanced/${pieceId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      pricing: {
        base_prices: data.advanced ? [{
          type: 'standard',
          price_ht: data.advanced.price_ht,
          price_ttc: data.advanced.unit_price_ttc,
          quantity: data.advanced.quantity_sale,
          total_ht: data.advanced.price_ht * data.advanced.total_units,
          total_ttc: data.priceTTC,
        }] : [],
        recommendations: {
          best_deal: 'Prix actuel',
          savings: 0,
          alternative_suppliers: [],
        },
      },
      _metadata: data._metadata || {
        response_time: 0,
        methodology: 'vérifier existant avant et utiliser le meilleur et améliorer - V5 ULTIMATE',
      },
    };
  } catch (error) {
    console.error('Erreur pricing V5 Ultimate:', error);
    return {
      success: false,
      _metadata: {
        response_time: 0,
        methodology: 'vérifier existant avant et utiliser le meilleur et améliorer - ERROR',
      },
    };
  }
}

/**
 * 🏥 SANTÉ DES SERVICES V5 ULTIMATE
 * @returns État de santé complet des services V5
 */
export async function getV5UltimateHealth(): Promise<V5UltimateHealth> {
  try {
    const response = await fetch(`${API_BASE}/api/test-v5/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur health check V5 Ultimate:', error);
    return {
      status: 'error',
      services: {
        technical_data_v5: null,
        enhancement_v5: null,
        pricing_v5: null,
      },
      methodology: 'vérifier existant avant et utiliser le meilleur et améliorer - ERROR',
      summary: {
        total_services: 0,
        all_healthy: false,
        improvements: {},
      },
    };
  }
}

/**
 * 📊 STATISTIQUES DES SERVICES V5 ULTIMATE
 * @returns Métriques de performance et utilisation
 */
export async function getV5UltimateStats() {
  try {
    const response = await fetch(`${API_BASE}/api/test-v5/pricing-final-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur stats V5 Ultimate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      methodology: 'vérifier existant avant et utiliser le meilleur et améliorer - STATS ERROR',
    };
  }
}

/**
 * 🧹 NETTOYAGE CACHE V5 ULTIMATE
 * @returns Résultat du nettoyage
 */
export async function clearV5UltimateCache() {
  try {
    const response = await fetch(`${API_BASE}/api/test-v5/pricing-final-clear-cache`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur nettoyage cache V5 Ultimate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      methodology: 'vérifier existant avant et utiliser le meilleur et améliorer - CACHE CLEAR ERROR',
    };
  }
}

/**
 * 🎯 SERVICE INTÉGRÉ AU CATALOG PRINCIPAL
 * Utilise le PricingServiceV5UltimateFinal intégré dans PiecesCleanController
 */
export async function getEnhancedCatalogData(typeId: number, pgId: number) {
  try {
    const response = await fetch(`${API_BASE}/api/catalog/pieces/debug/${typeId}/${pgId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur catalog V5 Ultimate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      debug: {
        v5_ultimate_active: false,
        pricing_service: 'Error',
      },
    };
  }
}