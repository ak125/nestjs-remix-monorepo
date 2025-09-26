// ⚡ API service pour récupérer les vraies pièces de la base de données
// Utilise le nouveau PiecesDbController pour afficher des données réelles

export interface DatabasePiece {
  piece_id: number;
  piece_name: string;
  piece_ref: string;
  piece_ref_clean?: string;
  pm_name: string;
  pm_alias: string;
  pm_quality?: string;
  pm_nb_stars?: number;
  price_pv_ttc: number;
  price_cs_ttc?: number;
  price_formatted: string;
  piece_has_img?: boolean;
  technical_criteria?: any[];
}

export interface DatabaseStats {
  total_count: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  equipementiers_count: number;
}

export interface DatabaseFilters {
  equipementiers: Array<{
    pm_name: string;
    pm_alias: string;
    count: number;
  }>;
  qualities: Array<{
    quality_name: string;
    count: number;
  }>;
}

export interface DatabaseResponse {
  pieces: DatabasePiece[];
  stats: DatabaseStats;
  filters: DatabaseFilters;
  performance: {
    response_time_ms: number;
    source: 'DATABASE' | 'ERROR';
    cache_status: 'MISS' | 'HIT' | 'ERROR';
    error?: string;
  };
}

class PiecesDbApi {
  private baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
  
  /**
   * Récupère les vraies pièces de la base de données pour un véhicule et une gamme
   */
  async getPiecesForVehicleAndGamme(
    typeId: number,
    pgId: number,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<DatabaseResponse> {
    try {
      console.log(`🔧 [PIECES-DB-API] Récupération pour type_id: ${typeId}, pg_id: ${pgId}`);
      
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());
      
      const url = `${this.baseUrl}/api/pieces-db/vehicle/${typeId}/gamme/${pgId}${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as DatabaseResponse;
      
      console.log(`✅ [PIECES-DB-API] ${data.pieces.length} pièces récupérées (source: ${data.performance.source})`);
      
      return data;
      
    } catch (error) {
      console.error('❌ [PIECES-DB-API] Erreur:', error);
      
      // Retour d'erreur structuré
      return {
        pieces: [],
        stats: {
          total_count: 0,
          min_price: 0,
          max_price: 0,
          avg_price: 0,
          equipementiers_count: 0,
        },
        filters: {
          equipementiers: [],
          qualities: [],
        },
        performance: {
          response_time_ms: 0,
          source: 'ERROR',
          cache_status: 'ERROR',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
      };
    }
  }

  /**
   * Récupère seulement les statistiques pour un véhicule et une gamme
   */
  async getStatsForVehicleAndGamme(
    typeId: number,
    pgId: number
  ): Promise<DatabaseStats> {
    try {
      console.log(`📊 [PIECES-DB-API-STATS] Stats pour type_id: ${typeId}, pg_id: ${pgId}`);
      
      const url = `${this.baseUrl}/api/pieces-db/stats/vehicle/${typeId}/gamme/${pgId}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const stats = await response.json() as DatabaseStats;
      
      console.log(
        `✅ [PIECES-DB-API-STATS] ${stats.total_count} pièces, prix: ${stats.min_price}€-${stats.max_price}€`
      );
      
      return stats;
      
    } catch (error) {
      console.error('❌ [PIECES-DB-API-STATS] Erreur:', error);
      
      return {
        total_count: 0,
        min_price: 0,
        max_price: 0,
        avg_price: 0,
        equipementiers_count: 0,
      };
    }
  }
}

// Export de l'instance API
export const piecesDbApi = new PiecesDbApi();