import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../database/services/supabase-base.service';

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

@Injectable()
export class PiecesDbService extends SupabaseBaseService {
  protected readonly logger = new Logger(PiecesDbService.name);

  constructor() {
    super();
  }

  /**
   * Récupère les vraies pièces de la base de données
   * Implémente la même logique que votre code PHP
   */
  async getPiecesForVehicleAndGamme(
    typeId: number,
    pgId: number,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    pieces: DatabasePiece[];
    stats: DatabaseStats;
    filters: DatabaseFilters;
  }> {
    this.logger.log(
      `🔧 [PIECES-DB-SERVICE] Récupération pour type_id: ${typeId}, pg_id: ${pgId}`,
    );

    try {
      // 1. Requête principale pour récupérer les pièces
      // Copie de votre logique PHP avec les bonnes tables
      const { data: piecesData, error: piecesError } = await this.supabase
        .from('pieces_relation_type')
        .select(
          `
          piece_id,
          rtp_pg_id,
          pieces!inner(
            piece_id,
            piece_name,
            piece_ref,
            piece_ref_clean,
            piece_has_img,
            pieces_marques!inner(
              pm_name,
              pm_alias,
              pm_quality,
              pm_nb_stars
            )
          ),
          pieces_price!inner(
            price_id,
            price_pv_ttc,
            price_cs_ttc
          )
        `,
        )
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId)
        .gt('pieces_price.price_pv_ttc', 0) // Seulement les prix > 0
        .order('pieces_price.price_pv_ttc', { ascending: true })
        .range(offset, offset + limit - 1);

      if (piecesError) {
        this.logger.error(
          '❌ [PIECES-DB-SERVICE] Erreur requête pièces:',
          piecesError,
        );
        throw new Error(`Erreur récupération pièces: ${piecesError.message}`);
      }

      // 2. Transformation des données (comme votre PHP)
      const pieces: DatabasePiece[] = (piecesData || []).map((item) => {
        const piece = item.pieces;
        const marque = piece.pieces_marques;
        const price = item.pieces_price;

        return {
          piece_id: piece.piece_id,
          piece_name: piece.piece_name || `Pièce ${piece.piece_id}`,
          piece_ref: piece.piece_ref || `REF-${piece.piece_id}`,
          piece_ref_clean: piece.piece_ref_clean,
          pm_name: marque.pm_name || 'MARQUE INCONNUE',
          pm_alias: marque.pm_alias || 'marque-inconnue',
          pm_quality: marque.pm_quality,
          pm_nb_stars: marque.pm_nb_stars,
          price_pv_ttc: price.price_pv_ttc,
          price_cs_ttc: price.price_cs_ttc,
          price_formatted: `${price.price_pv_ttc.toFixed(2)}€`,
          piece_has_img: piece.piece_has_img,
          technical_criteria: [], // TODO: Ajouter si nécessaire
        };
      });

      // 3. Statistiques
      const stats = await this.getStatsForVehicleAndGamme(typeId, pgId);

      // 4. Filtres disponibles
      const filters = await this.getFiltersForVehicleAndGamme(typeId, pgId);

      this.logger.log(
        `✅ [PIECES-DB-SERVICE] ${pieces.length} pièces récupérées`,
      );

      return {
        pieces,
        stats,
        filters,
      };
    } catch (error) {
      this.logger.error('❌ [PIECES-DB-SERVICE] Erreur:', error);
      throw error;
    }
  }

  /**
   * Calcule les statistiques pour une combinaison véhicule/gamme
   */
  async getStatsForVehicleAndGamme(
    typeId: number,
    pgId: number,
  ): Promise<DatabaseStats> {
    const supabase = this.supabaseService.getServiceClient();

    try {
      // Statistiques de prix (comme votre PHP)
      const { data: priceStats, error: priceError } = await supabase
        .from('pieces_relation_type')
        .select(
          `
          pieces_price!inner(
            price_pv_ttc
          )
        `,
        )
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId)
        .gt('pieces_price.price_pv_ttc', 0);

      if (priceError) {
        this.logger.error(
          '❌ [PIECES-DB-SERVICE] Erreur stats prix:',
          priceError,
        );
        throw new Error(`Erreur statistiques prix: ${priceError.message}`);
      }

      const prices = (priceStats || []).map(
        (item) => item.pieces_price.price_pv_ttc,
      );
      const totalCount = prices.length;
      const minPrice = totalCount > 0 ? Math.min(...prices) : 0;
      const maxPrice = totalCount > 0 ? Math.max(...prices) : 0;
      const avgPrice =
        totalCount > 0 ? prices.reduce((a, b) => a + b, 0) / totalCount : 0;

      // Nombre d'équipementiers distincts
      const { data: equipData, error: equipError } = await supabase
        .from('pieces_relation_type')
        .select(
          `
          pieces!inner(
            pieces_marques!inner(pm_name)
          )
        `,
        )
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId);

      const uniqueEquipementiers = equipData
        ? [
            ...new Set(
              equipData.map((item) => item.pieces.pieces_marques.pm_name),
            ),
          ]
        : [];

      return {
        total_count: totalCount,
        min_price: Math.round(minPrice * 100) / 100,
        max_price: Math.round(maxPrice * 100) / 100,
        avg_price: Math.round(avgPrice * 100) / 100,
        equipementiers_count: uniqueEquipementiers.length,
      };
    } catch (error) {
      this.logger.error('❌ [PIECES-DB-SERVICE] Erreur stats:', error);
      return {
        total_count: 0,
        min_price: 0,
        max_price: 0,
        avg_price: 0,
        equipementiers_count: 0,
      };
    }
  }

  /**
   * Récupère les filtres disponibles pour une combinaison véhicule/gamme
   */
  async getFiltersForVehicleAndGamme(
    typeId: number,
    pgId: number,
  ): Promise<DatabaseFilters> {
    const supabase = this.supabaseService.getServiceClient();

    try {
      // Équipementiers avec comptage
      const { data: equipData, error: equipError } = await supabase
        .from('pieces_relation_type')
        .select(
          `
          pieces!inner(
            pieces_marques!inner(
              pm_name,
              pm_alias
            )
          )
        `,
        )
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId);

      const equipementiers = equipData
        ? Object.entries(
            equipData.reduce(
              (acc, item) => {
                const marque = item.pieces.pieces_marques;
                const key = marque.pm_name;
                acc[key] = acc[key] || {
                  pm_name: marque.pm_name,
                  pm_alias: marque.pm_alias,
                  count: 0,
                };
                acc[key].count++;
                return acc;
              },
              {} as Record<string, any>,
            ),
          ).map(([_, value]) => value)
        : [];

      // Qualités disponibles
      const { data: qualityData, error: qualityError } = await supabase
        .from('pieces_relation_type')
        .select(
          `
          pieces!inner(
            pieces_marques!inner(pm_quality)
          )
        `,
        )
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId)
        .not('pieces.pieces_marques.pm_quality', 'is', null);

      const qualities = qualityData
        ? Object.entries(
            qualityData.reduce(
              (acc, item) => {
                const quality = item.pieces.pieces_marques.pm_quality;
                acc[quality] = acc[quality] || {
                  quality_name: quality,
                  count: 0,
                };
                acc[quality].count++;
                return acc;
              },
              {} as Record<string, any>,
            ),
          ).map(([_, value]) => value)
        : [];

      return {
        equipementiers,
        qualities,
      };
    } catch (error) {
      this.logger.error('❌ [PIECES-DB-SERVICE] Erreur filtres:', error);
      return {
        equipementiers: [],
        qualities: [],
      };
    }
  }
}
