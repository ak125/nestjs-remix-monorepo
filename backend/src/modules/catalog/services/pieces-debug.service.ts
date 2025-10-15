import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

@Injectable()
export class PiecesDebugService extends SupabaseBaseService {
  async debugPieceData(typeId: number, pgId: number) {
    try {
      // 1. Vérifier les relations
      const relationsResult = await this.client
        .from('pieces_relation_type')
        .select('*')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId)
        .limit(5);

      console.log('🔍 Relations trouvées:', relationsResult.data?.length);

      if (relationsResult.data?.length > 0) {
        const firstRelation = relationsResult.data[0];
        console.log('📋 Première relation:', firstRelation);

        const pieceId = firstRelation.rtp_piece_id;

        // 2. Vérifier les prix pour cette pièce
        const pricesResult = await this.client
          .from('pieces_prices')
          .select('*')
          .eq('pri_piece_id', pieceId);

        console.log(
          '💰 Prix trouvés pour pièce',
          pieceId,
          ':',
          pricesResult.data,
        );

        // 3. Vérifier les critères pour cette pièce
        const criteriasResult = await this.client
          .from('pieces_criteria')
          .select('*')
          .eq('pc_piece_id', pieceId);

        console.log(
          '📊 Critères trouvés pour pièce',
          pieceId,
          ':',
          criteriasResult.data,
        );

        // 4. Vérifier les images pour cette pièce
        const imagesResult = await this.client
          .from('pieces_media_img')
          .select('*')
          .eq('pmi_piece_id', pieceId);

        console.log(
          '🖼️ Images trouvées pour pièce',
          pieceId,
          ':',
          imagesResult.data,
        );
      }

      return { success: true, relations: relationsResult.data?.length || 0 };
    } catch (error) {
      console.error('❌ Erreur debug:', error);
      return { success: false, error: error.message };
    }
  }
}
