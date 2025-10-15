import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

@Injectable()
export class PiecesV4WorkingService extends SupabaseBaseService {
  /**
   * 🎯 VERSION V4 HYBRIDE QUI MARCHE - Logique PHP exacte
   */
  async getPiecesV4Working(typeId: number, pgId: number) {
    const startTime = Date.now();
    this.logger.log(`🚀 [V4-WORKING] type_id=${typeId}, pg_id=${pgId}`);

    try {
      // 1️⃣ RELATIONS (exactly like test that works)
      const { data: relationsData, error: relationsError } = await this.client
        .from('pieces_relation_type')
        .select('rtp_piece_id, rtp_psf_id, rtp_pm_id')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId);

      if (relationsError) {
        return { success: false, error: relationsError.message, count: 0 };
      }

      if (!relationsData?.length) {
        return { success: true, count: 0, message: 'Aucune pièce trouvée' };
      }

      // 2️⃣ PIÈCES PARALLÈLES
      const pieceIds = [...new Set(relationsData.map((r) => r.rtp_piece_id))];
      const pmIds = [
        ...new Set(relationsData.map((r) => r.rtp_pm_id).filter(Boolean)),
      ];

      const [piecesResult, marquesResult, pricesResult] = await Promise.all([
        this.client
          .from('pieces')
          .select(
            'piece_id, piece_name, piece_ref, piece_des, piece_has_img, piece_qty_sale, piece_pm_id',
          )
          .in('piece_id', pieceIds)
          .eq('piece_display', 1),

        pmIds.length > 0
          ? this.client
              .from('pieces_marque')
              .select('pm_id, pm_name, pm_oes, pm_nb_stars')
              .in('pm_id', pmIds)
              .eq('pm_display', 1)
          : { data: [], error: null },

        this.client
          .from('pieces_price')
          .select('pri_piece_id, pri_vente_ttc, pri_consigne_ttc')
          .in('pri_piece_id', pieceIds)
          .eq('pri_dispo', 1),
      ]);

      if (piecesResult.error) {
        return { success: false, error: piecesResult.error.message, count: 0 };
      }

      // 3️⃣ MAPS pour performance
      const piecesData = piecesResult.data || [];
      const marquesData = marquesResult.data || [];
      const pricesData = pricesResult.data || [];

      const marquesMap = new Map(marquesData.map((m) => [m.pm_id, m]));
      const pricesMap = new Map(pricesData.map((p) => [p.pri_piece_id, p]));
      const relationsMap = new Map(
        relationsData.map((r) => [r.rtp_piece_id, r]),
      );

      // 4️⃣ TRANSFORMATION (logique PHP)
      const pieces = piecesData.map((piece) => {
        const relation = relationsMap.get(piece.piece_id);
        const marqueEquip = marquesMap.get(
          relation?.rtp_pm_id || piece.piece_pm_id,
        );
        const price = pricesMap.get(piece.piece_id);

        const prixUnitaire = parseFloat(price?.pri_vente_ttc || '0');
        const quantiteVente = parseFloat(piece.piece_qty_sale || '1');
        const prixTotal = prixUnitaire * quantiteVente;
        const prixConsigne =
          parseFloat(price?.pri_consigne_ttc || '0') * quantiteVente;

        let qualite = 'AFTERMARKET';
        if (marqueEquip?.pm_oes === '1' || marqueEquip?.pm_oes === 'O')
          qualite = 'OES';
        if (prixConsigne > 0) qualite = 'Echange Standard';

        return {
          id: piece.piece_id,
          nom: piece.piece_name || 'Pièce sans nom',
          reference: piece.piece_ref || '',
          description: piece.piece_des || '',
          marque: marqueEquip?.pm_name || 'Marque inconnue',
          prix_ttc: prixTotal,
          prix_consigne: prixConsigne,
          prix_total: prixTotal + prixConsigne,
          quantite_vente: quantiteVente,
          qualite,
          nb_stars: marqueEquip?.pm_nb_stars || 0,
          has_image: piece.piece_has_img === 1,
          image:
            piece.piece_has_img === 1
              ? `/images/pieces/${piece.piece_id}.webp`
              : '/images/pieces/default.png',
          url: `/piece/${piece.piece_id}/${this.slugify(piece.piece_name || 'piece')}.html`,
        };
      });

      // 5️⃣ PRIX MINIMUM
      const validPrices = pieces
        .map((p) => p.prix_ttc)
        .filter((price) => price > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ [V4-WORKING] ${pieces.length} pièces en ${duration}ms`,
      );

      return {
        success: true,
        pieces,
        count: pieces.length,
        minPrice,
        relations_found: relationsData.length,
        duration: `${duration}ms`,
        optimization: 'V4_HYBRID_CLEAN_SUCCESS',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ [V4-WORKING] Erreur: ${error.message}`);
      return {
        success: false,
        error: error.message,
        count: 0,
        duration: `${duration}ms`,
      };
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
