import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

@Injectable()
export class PiecesPhpLogicService extends SupabaseBaseService {
  /**
   * 🎯 LOGIQUE PHP EXACTE INTÉGRÉE - Version finale fonctionnelle
   * Extrait du fichier PHP analysé et optimisé avec l'approche V4 hybride
   */
  async getPiecesExactPHP(typeId: number, pgId: number) {
    const startTime = Date.now();
    this.logger.log(`🚀 [PHP-LOGIC] type_id=${typeId}, pg_id=${pgId}`);

    try {
      // 1️⃣ RÉCUPÉRATION DES RELATIONS (logique PHP: SELECT DISTINCT FROM pieces_relation_type)
      const { data: relationsData, error: relationsError } = await this.client
        .from('pieces_relation_type')
        .select('rtp_piece_id, rtp_psf_id, rtp_pm_id')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId);

      if (relationsError) {
        this.logger.error('❌ Erreur relations:', relationsError);
        return {
          pieces: [],
          count: 0,
          minPrice: null,
          error: relationsError.message,
          success: false,
        };
      }

      if (!relationsData?.length) {
        this.logger.log(
          `⚠️ Aucune relation trouvée pour type_id=${typeId}, pg_id=${pgId}`,
        );
        return {
          pieces: [],
          count: 0,
          minPrice: null,
          message: 'Aucune pièce disponible pour ce véhicule et cette gamme',
          success: true,
        };
      }

      // 2️⃣ RÉCUPÉRATION PARALLÈLE DES DONNÉES (optimisation V4 hybride)
      const pieceIds = [...new Set(relationsData.map((r) => r.rtp_piece_id))];
      const pmIds = [
        ...new Set(relationsData.map((r) => r.rtp_pm_id).filter(Boolean)),
      ];

      this.logger.log(
        `🚀 [PARALLEL] ${relationsData.length} relations → ${pieceIds.length} pièces, ${pmIds.length} marques`,
      );

      const [piecesResult, marquesResult, pricesResult, filtresResult] =
        await Promise.all([
          // Pièces (logique PHP: SELECT * FROM pieces WHERE piece_id IN (...))
          this.client
            .from('pieces')
            .select(
              `
            piece_id, piece_name, piece_ref, piece_ref_clean, piece_des,
            piece_has_img, piece_has_oem, piece_qty_sale, piece_qty_pack,
            piece_name_side, piece_name_comp, piece_fil_id, piece_fil_name,
            piece_display, piece_pm_id
          `,
            )
            .in('piece_id', pieceIds)
            .eq('piece_display', 1),

          // Marques d'équipementiers (logique PHP: SELECT * FROM pieces_marque WHERE pm_id IN (...))
          pmIds.length > 0
            ? this.client
                .from('pieces_marque')
                .select(
                  'pm_id, pm_name, pm_alias, pm_logo, pm_quality, pm_oes, pm_nb_stars, pm_display',
                )
                .in('pm_id', pmIds)
                .eq('pm_display', 1)
            : { data: [], error: null },

          // Prix (logique PHP: ORDER BY PRI_TYPE DESC pour prendre le meilleur prix)
          this.client
            .from('pieces_price')
            .select(
              'pri_piece_id, pri_vente_ttc, pri_consigne_ttc, pri_type, pri_dispo',
            )
            .in('pri_piece_id', pieceIds)
            .eq('pri_dispo', 1) // Rétabli selon PHP
            .order('pri_type', { ascending: false }), // PRI_TYPE DESC comme dans PHP

          // Filtres de côté (logique PHP pour les sides)
          this.client
            .from('pieces_side_filtre')
            .select('psf_id, psf_side, psf_sort')
            .in(
              'psf_id',
              relationsData.map((r) => r.rtp_psf_id).filter(Boolean),
            ),
        ]);

      if (piecesResult.error) {
        this.logger.error('❌ Erreur pièces:', piecesResult.error);
        return {
          pieces: [],
          count: 0,
          minPrice: null,
          error: piecesResult.error.message,
          success: false,
        };
      }

      // 3️⃣ CONSTRUCTION DES MAPS POUR PERFORMANCE O(1) (optimisation)
      const piecesData = piecesResult.data || [];
      const marquesData = marquesResult.data || [];
      const pricesData = pricesResult.data || [];
      const filtresData = filtresResult.data || [];

      // 🔍 DEBUG: Vérification des données récupérées
      // Logs de debug pour diagnostiquer les prix
      this.logger.log(
        `🔍 [DEBUG] Données récupérées: ${piecesData.length} pièces, ${marquesData.length} marques, ${pricesData.length} prix, ${filtresData.length} filtres`,
      );
      if (pricesData.length > 0) {
        this.logger.log(
          `🔍 [DEBUG] Premier prix: ${JSON.stringify(pricesData[0])}`,
        );
      }

      // Maps pour jointure rapide en mémoire
      const marquesMap = new Map(marquesData.map((m) => [m.pm_id, m]));
      const filtresMap = new Map(filtresData.map((f) => [f.psf_id, f]));
      const relationsMap = new Map(
        relationsData.map((r) => [r.rtp_piece_id, r]),
      );

      // Prix : garde le meilleur prix par pièce (logique PHP)
      const pricesMap = new Map();
      pricesData.forEach((p) => {
        if (
          !pricesMap.has(p.pri_piece_id) ||
          p.pri_type > pricesMap.get(p.pri_piece_id).pri_type
        ) {
          pricesMap.set(p.pri_piece_id, p);
        }
      });

      // 4️⃣ TRANSFORMATION DES DONNÉES SELON LOGIQUE PHP EXACTE
      const pieces = piecesData.map((piece) => {
        const relation = relationsMap.get(piece.piece_id);
        const marqueEquip = marquesMap.get(
          relation?.rtp_pm_id || piece.piece_pm_id,
        );
        const price = pricesMap.get(piece.piece_id);
        const filtre = filtresMap.get(relation?.rtp_psf_id);

        // Calcul du prix total (logique PHP EXACTE avec debug)
        const prixUnitaire = parseFloat(price?.pri_vente_ttc || '0');
        const quantiteVente = parseFloat(piece.piece_qty_sale || '1');
        const prixTotal = prixUnitaire * quantiteVente;
        const prixConsigne =
          parseFloat(price?.pri_consigne_ttc || '0') * quantiteVente;

        // Debug des prix pour la première pièce
        if (piece.piece_id === piecesData[0]?.piece_id) {
          this.logger.log(
            `🔍 [DEBUG-PRIX] Pièce ${piece.piece_id}: prix_unitaire=${prixUnitaire}, qty=${quantiteVente}, total=${prixTotal}, consigne=${prixConsigne}`,
          );
          this.logger.log(
            `🔍 [DEBUG-PRIX] Prix brut: ${JSON.stringify(price)}`,
          );
        }

        // Détermination de la qualité (logique PHP exacte)
        let qualite = 'AFTERMARKET';
        if (marqueEquip?.pm_oes === '1' || marqueEquip?.pm_oes === 'O') {
          qualite = 'OES';
        }
        if (prixConsigne > 0) {
          qualite = 'Echange Standard';
        }

        // Nom complet de la pièce (logique PHP: concat de tous les noms)
        const nomComplet = [
          piece.piece_name,
          piece.piece_name_side || filtre?.psf_side,
          piece.piece_name_comp,
        ]
          .filter(Boolean)
          .join(' ');

        return {
          id: piece.piece_id,
          nom: nomComplet || 'Pièce sans nom',
          reference: piece.piece_ref || '',
          reference_clean: piece.piece_ref_clean || '',
          description: piece.piece_des || '',
          marque: marqueEquip?.pm_name || 'Marque inconnue',
          marque_id: marqueEquip?.pm_id || null,
          marque_logo: marqueEquip?.pm_logo || null,
          prix_ttc: prixTotal,
          prix_unitaire: prixUnitaire,
          prix_consigne: prixConsigne,
          prix_total: prixTotal + prixConsigne,
          quantite_vente: quantiteVente,
          qualite,
          nb_stars: marqueEquip?.pm_nb_stars || 0,
          has_image: piece.piece_has_img === 1,
          has_oem: piece.piece_has_oem === 1,
          filtre_gamme: piece.piece_fil_name || '',
          filtre_side: filtre?.psf_side || '',
          image:
            piece.piece_has_img === 1
              ? `/images/pieces/${piece.piece_id}.webp`
              : '/images/pieces/default.png',
          url: `/piece/${piece.piece_id}/${this.slugify(nomComplet || 'piece')}.html`,
        };
      });

      // 5️⃣ CALCUL DU PRIX MINIMUM GLOBAL (logique PHP)
      const validPrices = pieces
        .map((p) => p.prix_ttc)
        .filter((price) => price > 0);
      const globalMinPrice =
        validPrices.length > 0 ? Math.min(...validPrices) : null;

      // 6️⃣ GROUPEMENT PAR FILTRE (comme dans le PHP original)
      const groupedByFilter = pieces.reduce((acc: any, piece: any) => {
        const key = `${piece.filtre_gamme}_${piece.filtre_side}`;
        if (!acc[key]) {
          acc[key] = {
            filtre_gamme: piece.filtre_gamme,
            filtre_side: piece.filtre_side,
            pieces: [],
          };
        }
        acc[key].pieces.push(piece);
        return acc;
      }, {});

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ [PHP-LOGIC] ${pieces.length} pièces trouvées, prix min: ${globalMinPrice}€ en ${duration}ms`,
      );

      return {
        pieces,
        grouped_pieces: Object.values(groupedByFilter),
        count: pieces.length,
        minPrice: globalMinPrice,
        relations_found: relationsData.length,
        duration: `${duration}ms`,
        success: true,
        optimization: 'PHP_LOGIC_INTEGRATED_V4_HYBRID',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ [PHP-LOGIC] Erreur: ${error.message}`);
      return {
        pieces: [],
        count: 0,
        minPrice: null,
        error: error.message,
        success: false,
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
