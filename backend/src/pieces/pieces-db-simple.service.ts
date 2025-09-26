import { Injectable, Logger } from '@nestjs/common';

export interface SimplePiece {
  piece_id: number;
  piece_name: string;
  piece_ref: string;
  pm_name: string;
  price_formatted: string;
  price_pv_ttc: number;
}

export interface SimpleStats {
  total_count: number;
  min_price: number;
  max_price: number;
  avg_price: number;
}

@Injectable()
export class PiecesDbSimpleService {
  private readonly logger = new Logger(PiecesDbSimpleService.name);

  /**
   * Version temporaire qui retourne des données simulées mais réalistes
   * Basée sur les vrais paramètres type_id et pg_id
   */
  async getPiecesForVehicleAndGamme(
    typeId: number,
    pgId: number,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    pieces: SimplePiece[];
    stats: SimpleStats;
    filters: any;
  }> {
    this.logger.log(`🔧 [PIECES-DB-SIMPLE] Génération pour type_id: ${typeId}, pg_id: ${pgId}`);
    
    // Génère des pièces réalistes basées sur les IDs réels
    const pieces: SimplePiece[] = [];
    const marques = ['BOSCH', 'VALEO', 'MANN-FILTER', 'FEBI BILSTEIN', 'SACHS', 'GATES'];
    const basePrices = [17.58, 24.90, 16.45, 18.20, 32.15, 28.99]; // Prix réalistes
    
    const pieceCount = Math.min(limit, 12); // Maximum 12 pièces comme dans vos logs
    
    for (let i = 0; i < pieceCount; i++) {
      const marque = marques[i % marques.length];
      const basePrice = basePrices[i % basePrices.length];
      const finalPrice = basePrice + (Math.random() * 10 - 5); // Variation ±5€
      
      pieces.push({
        piece_id: pgId * 1000 + typeId + i,
        piece_name: `Pièce ${pgId} pour véhicule ${typeId}`,
        piece_ref: `REF-${pgId}-${typeId}-${String(i+1).padStart(3, '0')}`,
        pm_name: marque,
        price_formatted: `${Math.max(finalPrice, 10).toFixed(2)}€`,
        price_pv_ttc: Math.max(finalPrice, 10),
      });
    }
    
    const prices = pieces.map(p => p.price_pv_ttc);
    const stats: SimpleStats = {
      total_count: pieces.length,
      min_price: Math.min(...prices),
      max_price: Math.max(...prices),
      avg_price: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
    
    const filters = {
      equipementiers: marques.map(marque => ({
        pm_name: marque,
        pm_alias: marque.toLowerCase().replace(' ', '-'),
        count: pieces.filter(p => p.pm_name === marque).length,
      })),
      qualities: [
        { quality_name: 'OES', count: Math.ceil(pieces.length * 0.4) },
        { quality_name: 'AFTERMARKET', count: Math.floor(pieces.length * 0.6) },
      ],
    };
    
    this.logger.log(`✅ [PIECES-DB-SIMPLE] ${pieces.length} pièces générées, prix min: ${stats.min_price.toFixed(2)}€`);
    
    return { pieces, stats, filters };
  }

  /**
   * Statistiques simplifiées
   */
  async getStatsForVehicleAndGamme(typeId: number, pgId: number): Promise<SimpleStats> {
    // Utilise la méthode principale et retourne seulement les stats
    const result = await this.getPiecesForVehicleAndGamme(typeId, pgId, 20, 0);
    return result.stats;
  }
}