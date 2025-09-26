// 🔧 API service pour récupérer les vraies pièces avec logique PHP complète
// Utilise le nouveau PiecesCleanController avec la méthode php-logic

export interface PHPExactPiece {
  id: number;
  nom: string;
  reference: string;
  marque: string;
  prix_min: number;
  prix_max: number;
  image: string;
  url: string;
}

export interface PHPExactResponse {
  pieces: PHPExactPiece[];
  count: number;
  minPrice: number | null;
  duration: string;
  success: boolean;
  error?: string;
}

export interface PHPExactApiResponse {
  success: boolean;
  data: PHPExactResponse;
  statistics: {
    response_time: string;
    total_pieces: number;
    min_price: number | null;
  };
  timestamp: string;
  version: string;
}

class PiecesPhpExactApi {
  private baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
  
  /**
   * Récupère les vraies pièces avec la logique PHP exacte
   */
  async getPiecesExactPHP(
    typeId: number,
    pgId: number
  ): Promise<PHPExactResponse> {
    try {
      console.log(`🎯 [PHP-EXACT-API] Récupération pour type_id: ${typeId}, pg_id: ${pgId}`);
      
      const url = `${this.baseUrl}/api/catalog/pieces/php-logic/${typeId}/${pgId}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const apiResponse = await response.json() as PHPExactApiResponse;
      
      console.log(`✅ [PHP-EXACT-API] ${apiResponse.data.count} pièces récupérées en ${apiResponse.statistics.response_time}`);
      
      return apiResponse.data;
      
    } catch (error) {
      console.error('❌ [PHP-EXACT-API] Erreur:', error);
      
      // Retour d'erreur structuré
      return {
        pieces: [],
        count: 0,
        minPrice: null,
        duration: '0ms',
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Test avec les paramètres Clio III plaquettes
   */
  async testClioPlaquettes(): Promise<PHPExactResponse> {
    try {
      console.log(`🧪 [PHP-EXACT-API] Test Clio III plaquettes`);
      
      const url = `${this.baseUrl}/api/catalog/pieces/v4-working/55593/402`; // Utilise un endpoint de test valide
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as PHPExactResponse;
      
      console.log(`✅ [PHP-EXACT-API] Test réussi: ${data.count} pièces Clio III`);
      
      return data;
      
    } catch (error) {
      console.error('❌ [PHP-EXACT-API] Erreur test:', error);
      
      return {
        pieces: [],
        count: 0,
        minPrice: null,
        duration: '0ms',
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}

// Export de l'instance API
export const piecesPhpExactApi = new PiecesPhpExactApi();