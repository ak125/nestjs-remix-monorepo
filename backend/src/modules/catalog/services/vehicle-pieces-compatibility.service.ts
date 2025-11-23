import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { buildRackImageUrl, buildImageMetadata, type PieceImageData } from '../utils/image-urls.utils';

/**
 * 🚗 SERVICE DE COMPATIBILITÉ PIÈCES/VÉHICULES
 *
 * Anciennement PiecesPhpLogicService - Renommé pour plus de clarté
 * Gère la compatibilité entre pièces automobiles et véhicules spécifiques
 */
@Injectable()
export class VehiclePiecesCompatibilityService extends SupabaseBaseService {
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
        .eq('rtp_pg_id', pgId)
        .limit(500);

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

      // 2️⃣ RÉCUPÉRATION DES PIÈCES (Filtrage display=1 d'abord pour optimiser)
      const initialPieceIds = [...new Set(relationsData.map((r) => r.rtp_piece_id))];
      
      this.logger.log(
        `🚀 [STEP 1] Récupération pièces pour ${initialPieceIds.length} relations`,
      );

      const { data: piecesData, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select(
          `
        piece_id, piece_name, piece_ref, piece_ref_clean, piece_des,
        piece_has_img, piece_has_oem, piece_qty_sale, piece_qty_pack,
        piece_name_side, piece_name_comp, piece_fil_id, piece_fil_name,
        piece_display, piece_pm_id
      `,
        )
        .in('piece_id', initialPieceIds)
        .eq('piece_display', 1);

      if (piecesError) {
        this.logger.error('❌ Erreur pièces:', piecesError);
        return {
          pieces: [],
          count: 0,
          minPrice: null,
          error: piecesError.message,
          success: false,
        };
      }

      if (!piecesData?.length) {
        return {
          pieces: [],
          count: 0,
          minPrice: null,
          message: 'Aucune pièce active trouvée',
          success: true,
        };
      }

      // 3️⃣ RÉCUPÉRATION DU RESTE (Optimisé sur pièces visibles uniquement)
      const validPieceIds = piecesData.map(p => p.piece_id);
      const validPieceIdsStr = validPieceIds.map(id => id.toString());
      
      // Recalcul des PM IDs (Marques) pour seulement les pièces visibles
      const relevantRelations = relationsData.filter(r => validPieceIds.includes(r.rtp_piece_id));
      const pmIdsSet = new Set<number>();
      
      relevantRelations.forEach(r => {
          if (r.rtp_pm_id) pmIdsSet.add(r.rtp_pm_id);
      });
      piecesData.forEach(p => {
          if (p.piece_pm_id) pmIdsSet.add(p.piece_pm_id);
      });
      const uniquePmIds = [...pmIdsSet];

      this.logger.log(
        `🚀 [STEP 2] Récupération détails pour ${validPieceIds.length} pièces actives (vs ${initialPieceIds.length} total)`,
      );

      const [marquesResult, pricesResult, filtresResult, imagesResult, criteriasResult, criteriasLinksResult] =
        await Promise.all([
          // Marques d'équipementiers
          uniquePmIds.length > 0
            ? this.client
                .from('pieces_marque')
                .select(
                  'pm_id, pm_name, pm_alias, pm_logo, pm_quality, pm_oes, pm_nb_stars, pm_display',
                )
                .in('pm_id', uniquePmIds)
            : { data: [], error: null },

          // Prix (avec tri pour garantir le meilleur prix)
          this.client
            .from('pieces_price')
            .select(
              'pri_piece_id, pri_vente_ttc, pri_consigne_ttc, pri_type, pri_dispo',
            )
            .in('pri_piece_id', validPieceIds)
            .eq('pri_dispo', 1)
            .order('pri_type', { ascending: false }),

          // Filtres de côté
          this.client
            .from('pieces_side_filtre')
            .select('psf_id, psf_side, psf_sort')
            .in(
              'psf_id',
              relevantRelations.map((r) => r.rtp_psf_id).filter(Boolean),
            ),

          // Images (depuis pieces_media_img)
          this.client
            .from(TABLES.pieces_media_img)
            .select('pmi_piece_id, pmi_folder, pmi_name, pmi_display, pmi_sort')
            .in('pmi_piece_id', validPieceIdsStr)
            .eq('pmi_display', '1')
            .order('pmi_piece_id', { ascending: true })
            .order('pmi_sort', { ascending: true })
            .limit(validPieceIds.length * 2), 

          // Critères techniques (logique PHP simplifiée)
          this.client
            .from(TABLES.pieces_criteria)
            .select('*')
            .in('pc_piece_id', validPieceIds),

          // Liens des critères techniques
          this.client
            .from('pieces_criteria_link')
            .select('*')
            .eq('pcl_display', 1)
            .order('pcl_level')
            .order('pcl_sort'),
        ]);

      // 3️⃣ CONSTRUCTION DES MAPS POUR PERFORMANCE O(1) (optimisation)
      // const piecesData = piecesResult.data || []; // Déjà récupéré
      const marquesData = marquesResult.data || [];
      const pricesData = pricesResult.data || [];
      const filtresData = filtresResult.data || [];
      const imagesData = imagesResult.data || [];
      const criteriasData = criteriasResult.data || [];
      const criteriasLinksData = criteriasLinksResult.data || [];

      // 🔍 DEBUG: Vérification des données récupérées
      // Logs de debug pour diagnostiquer les prix
      this.logger.log(
        `🔍 [DEBUG] Données récupérées: ${piecesData.length} pièces, ${marquesData.length} marques, ${pricesData.length} prix, ${filtresData.length} filtres, ${imagesData.length} images, ${criteriasData.length} critères`,
      );
      if (pricesData.length > 0) {
        this.logger.log(
          `🔍 [DEBUG] Premier prix: ${JSON.stringify(pricesData[0])}`,
        );
      }

      // Maps pour jointure rapide en mémoire
      // 🔥 CRITIQUE: Convertir pm_id en string car Supabase retourne des strings
      const marquesMap = new Map(
        marquesData.map((m) => [m.pm_id.toString(), m]),
      );
      const filtresMap = new Map(filtresData.map((f) => [f.psf_id, f]));
      
      // 🚀 OPTIMISATION: Ne garder que la première image par pièce (déjà trié par pmi_sort)
      // Évite de stocker 286 images pour 8 pièces en Map
      const imagesMap = new Map();
      imagesData.forEach((img) => {
        const pieceId = img.pmi_piece_id.toString();
        if (!imagesMap.has(pieceId)) {
          imagesMap.set(pieceId, img);
        }
      });
      
      const relationsMap = new Map(
        relationsData.map((r) => [r.rtp_piece_id, r]),
      );

      // Critères : groupement par pièce avec liens
      const criteriasLinksMap = new Map(
        criteriasLinksData.map((cl: any) => [cl.pcl_cri_id, cl]),
      );

      const criteriasMap = new Map();
      criteriasData.forEach((c: any) => {
        if (!criteriasMap.has(c.pc_piece_id)) {
          criteriasMap.set(c.pc_piece_id, []);
        }
        // Joindre avec les informations du lien
        const criteriaLink = criteriasLinksMap.get(c.pc_cri_id);
        criteriasMap.get(c.pc_piece_id).push({
          ...c,
          link_info: criteriaLink,
        });
      });

      // Debug: vérifier le contenu du marquesMap
      this.logger.log(
        `🔍 [DEBUG-MARQUES] ${marquesMap.size} marques dans le Map, clés: ${Array.from(marquesMap.keys()).slice(0, 5).join(', ')}`,
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

        // 🔥 Conversion en string pour correspondre aux clés de marquesMap
        const marqueKey = (
          relation?.rtp_pm_id || piece.piece_pm_id
        )?.toString();

        // Debug pour la première pièce
        if (piece.piece_id === piecesData[0]?.piece_id) {
          this.logger.log(
            `🔍 [DEBUG-MARQUE] Pièce ${piece.piece_id}: relation.rtp_pm_id=${relation?.rtp_pm_id}, piece.piece_pm_id=${piece.piece_pm_id}, marqueKey=${marqueKey}`,
          );
          this.logger.log(
            `🔍 [DEBUG-MARQUE] marquesMap.has("${marqueKey}")=${marquesMap.has(marqueKey)}`,
          );
        }

        const marqueEquip = marquesMap.get(marqueKey);
        const price = pricesMap.get(piece.piece_id.toString()); // 🔧 Conversion en string
        const filtre = filtresMap.get(relation?.rtp_psf_id);
        const criterias = criteriasMap.get(piece.piece_id) || [];

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

        // Détermination de la qualité selon pm_oes (compatible avec API filters)
        let qualite = 'A'; // Aftermarket par défaut
        if (marqueEquip?.pm_oes === 'OES' || marqueEquip?.pm_oes === 'O') {
          qualite = marqueEquip.pm_oes; // 'OES' ou 'O'
        }
        // Note: "Echange Standard" n'a pas d'équivalent direct dans pm_oes
        // On garde 'A' pour les pièces avec consigne

        // Nom complet de la pièce - ÉVITER LES RÉPÉTITIONS
        const nomParts: string[] = [piece.piece_name];

        // Ajouter le côté SEULEMENT s'il n'est pas déjà dans piece_name
        const sideToAdd = piece.piece_name_side || filtre?.psf_side;
        if (
          sideToAdd &&
          !piece.piece_name?.toLowerCase().includes(sideToAdd.toLowerCase())
        ) {
          nomParts.push(sideToAdd);
        }

        // Ajouter le complément SEULEMENT s'il existe et n'est pas déjà présent
        if (
          piece.piece_name_comp &&
          !piece.piece_name
            ?.toLowerCase()
            .includes(piece.piece_name_comp.toLowerCase())
        ) {
          nomParts.push(piece.piece_name_comp);
        }

        const nomComplet = nomParts.filter(Boolean).join(' ').trim();

        // IMAGE (logique PHP ligne 980-1000)
        const imageObj = imagesMap.get(piece.piece_id.toString());
        let imageUrl = 'upload/articles/no.png'; // Default PHP
        let imageAlt = '';
        let imageTitle = '';

        if (piece.piece_has_img === 1 && imageObj) {
          imageUrl = `rack/${imageObj.pmi_folder}/${imageObj.pmi_name}.webp`;
          imageAlt = `${nomComplet} ${marqueEquip?.pm_name || ''} ${piece.piece_ref || ''}`;
          imageTitle = `${nomComplet} ${piece.piece_ref || ''}`;
        } else {
           // Fallback to utility if needed, but prefer direct logic
           imageUrl = this.buildImageUrl(piece.piece_id, piece.piece_has_img, imagesMap);
        }

        // CRITÈRES TECHNIQUES (logique PHP ligne 1050-1070, LIMIT 3)
        const criteriasTechniques = criterias
          .filter((c: any) => c.link_info) // Seulement avec liens valides
          .slice(0, 3)
          .map((c: any) => ({
            criteria: c.link_info?.pcl_cri_criteria || '',
            value: c.pc_cri_value || '',
            unit: c.link_info?.pcl_cri_unit || '',
            level: c.link_info?.pcl_level || 1,
          }));

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
          image: imageUrl,
          image_alt: imageAlt,
          image_title: imageTitle,
          criterias_techniques: criteriasTechniques,
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
        blocs: Object.values(groupedByFilter), // Alias pour compatibilité
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

  /**
   * Construire l'URL de l'image depuis Supabase rack-images
   * Ne pas vérifier piece_has_img car ce champ n'est pas fiable
   */
  private buildImageUrl(
    pieceId: number,
    hasImg: number,
    imagesMap: Map<string, any>,
  ): string {
    // Chercher l'image directement dans la Map (ignore piece_has_img)
    const image = imagesMap.get(pieceId.toString()) as PieceImageData | undefined;
    return buildRackImageUrl(image);
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
