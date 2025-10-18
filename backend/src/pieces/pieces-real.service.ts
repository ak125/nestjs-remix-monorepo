import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../database/services/supabase-base.service';

export interface RealPiece {
  piece_id: number;
  piece_ref: string;
  piece_ref_clean?: string;
  piece_name: string;
  piece_des?: string;
  piece_pg_id: number;
  piece_has_img: boolean;
  piece_qty_sale: number;
  // Gamme info
  pg_name: string;
  pg_alias: string;
}

@Injectable()
export class PiecesRealService extends SupabaseBaseService {
  protected readonly logger = new Logger(PiecesRealService.name);

  /**
   * Récupère les vraies pièces pour un type de véhicule et une gamme
   * Utilise directement vos tables pieces et pieces_gamme
   */
  async getRealPiecesForVehicleAndGamme(
    typeId: number,
    pgId: number,
    limit: number = 20,
  ): Promise<{
    pieces: RealPiece[];
    total_count: number;
  }> {
    this.logger.log(
      `🔧 [PIECES-REAL] Récupération pour type_id: ${typeId}, pg_id: ${pgId}`,
    );

    try {
      // 1. D'abord, vérifions si la gamme existe
      const { data: gammeData, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias')
        .eq('pg_id', pgId)
        .single();

      if (gammeError || !gammeData) {
        this.logger.warn(`⚠️ [PIECES-REAL] Gamme ${pgId} non trouvée`);
        return { pieces: [], total_count: 0 };
      }

      this.logger.log(`✅ [PIECES-REAL] Gamme trouvée: ${gammeData.pg_name}`);

      // 2. Récupérons les pièces de cette gamme
      // Note: Pour le moment, on récupère toutes les pièces de la gamme
      // Plus tard, on ajoutera le filtrage par véhicule via pieces_relation_type
      const {
        data: piecesData,
        error: piecesError,
        count,
      } = await this.supabase
        .from('pieces')
        .select(
          `
          piece_id,
          piece_ref,
          piece_ref_clean,
          piece_name,
          piece_des,
          piece_pg_id,
          piece_has_img,
          piece_qty_sale
        `,
          { count: 'exact' },
        )
        .eq('piece_pg_id', pgId)
        .eq('piece_display', true)
        .order('piece_name')
        .limit(limit);

      if (piecesError) {
        this.logger.error(
          '❌ [PIECES-REAL] Erreur requête pièces:',
          piecesError,
        );
        return { pieces: [], total_count: 0 };
      }

      // 3. Ajoutons les informations de la gamme à chaque pièce
      const pieces: RealPiece[] = (piecesData || []).map((piece) => ({
        ...piece,
        pg_name: gammeData.pg_name,
        pg_alias: gammeData.pg_alias,
      }));

      this.logger.log(
        `✅ [PIECES-REAL] ${pieces.length} vraies pièces trouvées`,
      );

      return {
        pieces,
        total_count: count || 0,
      };
    } catch (error) {
      this.logger.error('❌ [PIECES-REAL] Erreur:', error);
      return { pieces: [], total_count: 0 };
    }
  }

  /**
   * Récupère les statistiques d'une gamme
   */
  async getGammeStats(pgId: number): Promise<{
    total_pieces: number;
    gamme_name: string;
    gamme_alias: string;
  }> {
    try {
      // Comptage des pièces dans cette gamme
      const { count } = await this.supabase
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('piece_pg_id', pgId)
        .eq('piece_display', true);

      // Info gamme
      const { data: gammeData } = await this.supabase
        .from('pieces_gamme')
        .select('pg_name, pg_alias')
        .eq('pg_id', pgId)
        .single();

      return {
        total_pieces: count || 0,
        gamme_name: gammeData?.pg_name || 'Gamme inconnue',
        gamme_alias: gammeData?.pg_alias || 'gamme-inconnue',
      };
    } catch (error) {
      this.logger.error('❌ [PIECES-REAL] Erreur stats:', error);
      return {
        total_pieces: 0,
        gamme_name: 'Erreur',
        gamme_alias: 'erreur',
      };
    }
  }
}
