/**
 * 🔧 API Catalogue Unifié
 * 
 * Service pour récupérer les pièces via l'API NestJS backend 
 * en utilisant les types partagés du monorepo
 * 
 * @package @monorepo/frontend
 */

import { type UnifiedCatalogResponse } from "@monorepo/shared-types";

class UnifiedCatalogApi {
  private baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
  
  /**
   * Récupère les pièces unifiées via l'API backend
   */
  async getPiecesUnified(
    typeId: number,
    pgId: number
  ): Promise<UnifiedCatalogResponse> {
    try {
      console.log(`🎯 [UNIFIED-CATALOG-API] Récupération pour type_id: ${typeId}, pg_id: ${pgId}`);
      
      const url = `${this.baseUrl}/api/catalog/pieces/php-logic/${typeId}/${pgId}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const apiResponse = await response.json();
      
      // L'API backend wrappe les données dans un champ 'data'
      const data = apiResponse.data as UnifiedCatalogResponse;
      
      console.log(`✅ [UNIFIED-CATALOG-API] ${data.pieces?.length || 0} pièces récupérées en ${apiResponse.statistics?.response_time || 'N/A'}`);
      
      // On retourne les données wrappées avec success du niveau supérieur
      return {
        ...data,
        success: apiResponse.success || data.success,
      };
      
    } catch (error) {
      console.error('❌ [UNIFIED-CATALOG-API] Erreur:', error);
      
      // Retour d'erreur structuré selon le type partagé
      return {
        pieces: [],
        blocs: [],
        pieces_grouped_by_filter: [],
        count: 0,
        blocs_count: 0,
        minPrice: null,
        maxPrice: null,
        averagePrice: null,
        relations_found: 0,
        duration: '0ms',
        success: false,
        message: 'Erreur de récupération des pièces',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        optimization: 'UNIFIED_ENHANCED_V2',
        features: [],
        metadata: {
          requestId: Math.random().toString(36).substr(2, 9),
          typeId,
          pgId,
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          config: {},
          error: {
            message: error instanceof Error ? error.message : 'Erreur inconnue',
          },
        },
      };
    }
  }
}

// Export de l'instance API
export const unifiedCatalogApi = new UnifiedCatalogApi();