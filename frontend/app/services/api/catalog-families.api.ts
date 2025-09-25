// 🏗️ Service API pour récupérer les vraies familles de catalogue
// Utilise les endpoints backend avec tables minuscules pour Supabase

// ✅ CORRECTION : URL absolue pour éviter l'erreur "Invalid URL"
const API_BASE_URL = typeof window === 'undefined' 
  ? 'http://localhost:3000/api'  // Côté serveur (SSR)
  : '/api';  // Côté client (navigateur)

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_image?: string;
}

export interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_description?: string;
  mf_pic?: string;
  gammes: CatalogGamme[];
}

export interface PopularPart {
  cgc_pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  addon_content: string;
}

export interface HierarchyResponse {
  hierarchy: {
    [familyId: string]: {
      family: {
        mf_id: string;
        mf_name: string;
        mf_description?: string;
        mf_pic?: string;
      };
      gammes: Array<{
        pg_id: string;
        pg_alias: string;
        pg_name: string;
        pg_image?: string;
      }>;
    };
  };
  success: boolean;
  stats: {
    totalFamilies: number;
    totalGammes: number;
  };
}

/**
 * 🎯 Service API pour les familles de catalogue
 * Centralise tous les appels vers le backend
 */
export class CatalogFamiliesApi {
  private baseUrl = API_BASE_URL;

  /**
   * 🚗 V2: Récupère les familles de catalogue filtrées par véhicule
   */
  async getCatalogFamiliesForVehicle(typeId: number): Promise<CatalogFamily[]> {
    try {
      console.log(`🚗 [API V2] Récupération catalogue filtré pour type_id: ${typeId}`);
      
      const response = await fetch(`${this.baseUrl}/catalog/families/vehicle/${typeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      if (!data.success) {
        console.warn(`⚠️ Catalogue V2 filtré: ${data.message}`);
        return []; // Retour vide si pas de pièces compatibles
      }

      console.log(`✅ [API V2] ${data.totalFamilies} familles filtrées récupérées`);
      return data.families || [];

    } catch (error) {
      console.error('❌ [API V2] Erreur récupération catalogue filtré:', error);
      throw error;
    }
  }

  /**
   * 🚗 V3 HYBRIDE: Récupère le catalogue filtré par véhicule avec approche hybride optimisée
   * Utilise index composite + validation FK pour performance + intégrité
   */
  async getCatalogFamiliesForVehicleV3(typeId: number): Promise<{
    catalog: CatalogFamily[];
    popularParts: PopularPart[];
    queryType: string;
    seoValid: boolean;
  }> {
    try {
      console.log(`🚗 [API V3 HYBRIDE] Récupération catalogue avec approche hybride pour type_id: ${typeId}`);
      
      const response = await fetch(`${this.baseUrl}/catalog/families/vehicle-v3/${typeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new ApiError(`Erreur HTTP V3 HYBRIDE: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      if (!data.success || !data.catalog) {
        throw new ApiError(`Réponse V3 HYBRIDE invalide: ${data.message || 'Catalogue manquant'}`, 500);
      }
      
      // Transformer les familles du backend vers le format frontend
      const transformedCatalog: CatalogFamily[] = data.catalog.families?.map((family: any) => ({
        mf_id: family.mf_id,
        mf_name: family.mf_name,
        mf_description: family.mf_description || `Système ${family.mf_name.toLowerCase()}`,
        mf_pic: family.mf_pic || `${family.mf_name.toLowerCase().replace(/\s+/g, '_')}.webp`,
        gammes: family.gammes?.map((gamme: any) => ({
          pg_id: gamme.pg_id,
          pg_alias: gamme.pg_alias,
          pg_name: gamme.pg_name,
          pg_image: gamme.pg_img
        })) || []
      })) || [];
      
      // Transformer les pièces populaires (si disponibles)
      const transformedPopularParts: PopularPart[] = data.popularParts?.map((part: any) => ({
        cgc_pg_id: part.cgc_pg_id || part.pg_id,
        pg_alias: part.pg_alias,
        pg_name: part.pg_name,
        pg_name_meta: part.pg_name_meta || part.pg_name.toLowerCase(),
        pg_img: part.pg_img || 'no.png',
        addon_content: `Trouvez ${part.pg_name} pas cher, d'origine à prix bas.`
      })) || [];
      
      const queryType = data.catalog.queryType || 'UNKNOWN';
      const seoValid = data.catalog.seoValid || false;
      
      console.log(`✅ [API V3 HYBRIDE] ${transformedCatalog.length} familles (${queryType}), ${transformedPopularParts.length} pièces populaires, SEO: ${seoValid}`);
      
      return {
        catalog: transformedCatalog,
        popularParts: transformedPopularParts,
        queryType,
        seoValid
      };
      
    } catch (error) {
      console.error('❌ [API V3 HYBRIDE] Erreur récupération catalogue:', error);
      
      // En cas d'erreur, fallback vers V2
      console.log('🔄 [API V3 HYBRIDE] Fallback vers V2...');
      try {
        const fallbackData = await this.getCatalogFamiliesForVehicle(typeId);
        return {
          catalog: fallbackData,
          popularParts: [],
          queryType: 'V2_FALLBACK',
          seoValid: false
        };
      } catch (fallbackError) {
        console.error('❌ [API V3 HYBRIDE] Erreur fallback V2:', fallbackError);
        throw error; // Throw original V3 error
      }
    }
  }

  /**
   * 🚀 V4 HYBRIDE ULTIME: Cache intelligent + requêtes parallèles + TTL adaptatif
   * Performance ultime avec cache mémoire et pré-calcul background
   */
  async getCatalogFamiliesForVehicleV4(typeId: number): Promise<{
    catalog: CatalogFamily[];
    popularParts: PopularPart[];
    queryType: string;
    seoValid: boolean;
    performance: {
      responseTime: string;
      source: 'CACHE' | 'DATABASE' | 'PRECOMPUTED';
      cacheHitRatio: number;
      completenessScore: number;
    };
  }> {
    try {
      console.log(`🚀 [API V4 ULTIMATE] Récupération catalogue hybride ultime pour type_id: ${typeId}`);
      
      const response = await fetch(`${this.baseUrl}/catalog/families/vehicle-v4/${typeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new ApiError(`Erreur HTTP V4 ULTIMATE: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      if (!data.success || !data.catalog) {
        throw new ApiError(`Réponse V4 ULTIMATE invalide: ${data.error || 'Catalogue manquant'}`, 500);
      }
      
      // Transformer les familles du backend vers le format frontend
      const transformedCatalog: CatalogFamily[] = data.catalog.families?.map((family: any) => ({
        mf_id: family.mf_id,
        mf_name: family.mf_name,
        mf_description: family.mf_description || `Système ${family.mf_name.toLowerCase()}`,
        mf_pic: family.mf_pic || `${family.mf_name.toLowerCase().replace(/\s+/g, '_')}.webp`,
        gammes: family.gammes?.map((gamme: any) => ({
          pg_id: gamme.pg_id,
          pg_alias: gamme.pg_alias,
          pg_name: gamme.pg_name,
          pg_image: gamme.pg_img
        })) || []
      })) || [];
      
      // Générer les pièces populaires depuis le catalogue (pas d'endpoint spécifique)
      const transformedPopularParts: PopularPart[] = this.generatePopularParts(
        transformedCatalog, 
        `Type ${typeId}`,
        typeId
      );
      
      const queryType = data.catalog.queryType || 'V4_HYBRID_ULTIMATE';
      const seoValid = true; // V4 est toujours SEO valide
      
      console.log(`✅ [API V4 ULTIMATE] ${transformedCatalog.length} familles (${queryType}), ${transformedPopularParts.length} pièces populaires, Cache: ${data.performance?.source}, ${data.performance?.responseTime}`);
      
      return {
        catalog: transformedCatalog,
        popularParts: transformedPopularParts,
        queryType,
        seoValid,
        performance: data.performance || {
          responseTime: '0ms',
          source: 'DATABASE',
          cacheHitRatio: 0,
          completenessScore: 100
        }
      };
      
    } catch (error) {
      console.error('❌ [API V4 ULTIMATE] Erreur récupération catalogue:', error);
      
      // En cas d'erreur, fallback vers V3
      console.log('🔄 [API V4 ULTIMATE] Fallback vers V3...');
      try {
        const fallbackData = await this.getCatalogFamiliesForVehicleV3(typeId);
        return {
          ...fallbackData,
          performance: {
            responseTime: '0ms',
            source: 'DATABASE',
            cacheHitRatio: 0,
            completenessScore: 90
          }
        };
      } catch (fallbackError) {
        console.error('❌ [API V4 ULTIMATE] Erreur fallback V3:', fallbackError);
        throw error; // Throw original V4 error
      }
    }
  }

  /**
   * 📊 Récupère les métriques avancées V4
   */
  async getV4Metrics(): Promise<{
    service: string;
    performance: {
      totalRequests: number;
      cacheHitRatio: string;
      avgResponseTime: number;
      totalCachedVehicles: number;
    };
    topVehicles: Array<{
      typeId: number;
      requestCount: number;
      lastAccessed: Date;
      avgResponseTime: number;
    }>;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/catalog/families/metrics-v4`);
      
      if (!response.ok) {
        throw new ApiError(`Erreur métriques V4: ${response.status}`, response.status);
      }
      
      const data = await response.json();
      return data.metrics;
      
    } catch (error) {
      console.error('❌ [API V4] Erreur récupération métriques:', error);
      throw error;
    }
  }
  async getCatalogFamilies(): Promise<CatalogFamily[]> {
    try {
      const response = await fetch(`${this.baseUrl}/catalog/hierarchy/full`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status);
      }

      const data: HierarchyResponse = await response.json();
      
      // Convertir la structure hiérarchie en array de familles
      const families: CatalogFamily[] = Object.values(data.hierarchy).map(item => ({
        mf_id: parseInt(item.family.mf_id),
        mf_name: item.family.mf_name,
        mf_description: item.family.mf_description,
        mf_pic: item.family.mf_pic,
        gammes: item.gammes.map(gamme => ({
          pg_id: parseInt(gamme.pg_id),
          pg_alias: gamme.pg_alias,
          pg_name: gamme.pg_name,
          pg_image: gamme.pg_image
        }))
      }));

      console.log(`✅ ${families.length} familles de catalogue récupérées depuis la hiérarchie`);
      return families;

    } catch (error) {
      console.error('❌ Erreur récupération familles catalogue:', error);
      throw error;
    }
  }

  /**
   * 🎯 Génère les pièces populaires basées sur les vraies données
   */
  generatePopularParts(families: CatalogFamily[], vehicleName: string, typeId: number): PopularPart[] {
    const popularParts: PopularPart[] = [];
    
    // Sélectionner les pièces les plus communes (basé sur les vrais alias de la DB)
    const commonPartNames = ['filtre-a', 'plaquette', 'disque', 'courroie', 'bougie', 'rotule'];
    
    console.log(`🔍 Recherche de pièces populaires dans ${families.length} familles...`);
    
    families.forEach(family => {
      family.gammes.forEach(gamme => {
        // Chercher les pièces communes (recherche plus flexible)
        const isCommon = commonPartNames.some(common => 
          gamme.pg_alias.toLowerCase().includes(common.toLowerCase()) ||
          gamme.pg_name.toLowerCase().includes(common.toLowerCase())
        );
        
        if (isCommon && popularParts.length < 6) { // Récupérer plus pour avoir du choix
          console.log(`✅ Pièce populaire trouvée: ${gamme.pg_name} (${gamme.pg_alias})`);
          popularParts.push({
            cgc_pg_id: gamme.pg_id,
            pg_alias: gamme.pg_alias,
            pg_name: gamme.pg_name,
            pg_name_meta: gamme.pg_name.toLowerCase(),
            pg_img: gamme.pg_image || `${gamme.pg_alias}.webp`,
            addon_content: this.generateSeoContent(gamme.pg_name, vehicleName, typeId + popularParts.length)
          });
        }
      });
    });

    console.log(`🎯 ${popularParts.length} pièces populaires générées depuis ${families.length} familles`);
    
    // Limiter à 3 pièces populaires mais assurer qu'on en a au moins quelques unes
    return popularParts.slice(0, 3);
  }

  /**
   * 🔄 Génère le contenu SEO pour une pièce
   */
  private generateSeoContent(pgName: string, vehicleName: string, typeId: number): string {
    const switches = ["Achetez", "Trouvez", "Commandez", "Choisissez"];
    const qualities = ["d'origine", "de qualité", "certifiées", "garanties"];
    const switchIndex = typeId % switches.length;
    const qualityIndex = (typeId + 1) % qualities.length;
    
    return `${switches[switchIndex]} ${pgName.toLowerCase()} ${vehicleName}, ${qualities[qualityIndex]} à prix bas.`;
  }
}

// Instance singleton pour l'export
export const catalogFamiliesApi = new CatalogFamiliesApi();