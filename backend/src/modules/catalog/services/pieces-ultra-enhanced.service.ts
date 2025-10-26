import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

@Injectable()
export class PiecesUltraEnhancedService extends SupabaseBaseService {
  protected readonly logger = new Logger(PiecesUltraEnhancedService.name);

  constructor() {
    super();
  }

  /**
   * 🚀 SERVICE ULTRA-ENHANCED - Structure similaire à l'HTML de production
   * Optimisé pour performance et données manquantes
   */
  async getPiecesUltraEnhanced(typeId: number, pgId: number) {
    const startTime = Date.now();

    try {
      this.logger.log(
        `🎯 [ULTRA-ENHANCED] Recherche type_id=${typeId}, pg_id=${pgId}`,
      );

      // 1️⃣ RÉCUPÉRATION DES RELATIONS (optimisée)
      const relationsResult = await this.client
        .from('pieces_relation_type')
        .select('rtp_piece_id, rtp_pm_id, rtp_psf_id, rtp_type_id, rtp_pg_id')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId)
        .limit(100); // Limite raisonnable

      if (relationsResult.error || !relationsResult.data?.length) {
        return {
          pieces: [],
          blocks: [],
          filters: {},
          count: 0,
          minPrice: null,
          success: true,
          message: 'Aucune pièce disponible',
        };
      }

      const relationsData = relationsResult.data;
      const pieceIds = [...new Set(relationsData.map((r) => r.rtp_piece_id))];
      const pmIds = [
        ...new Set(relationsData.map((r) => r.rtp_pm_id).filter(Boolean)),
      ];
      const psfIds = [
        ...new Set(relationsData.map((r) => r.rtp_psf_id).filter(Boolean)),
      ];

      this.logger.log(
        `🚀 [ULTRA-ENHANCED] ${relationsData.length} relations → ${pieceIds.length} pièces`,
      );

      // 2️⃣ REQUÊTES PARALLÈLES OPTIMISÉES
      const [
        piecesResult,
        marquesResult,
        pricesResult,
        filtresResult,
        imagesResult,
      ] = await Promise.all([
        // PIÈCES avec sélection optimisée
        this.client
          .from('pieces')
          .select(
            'piece_id, piece_ref, piece_ref_clean, piece_name, piece_name_side, piece_name_comp, piece_des, piece_pm_id, piece_has_img, piece_has_oem, piece_qty_sale, piece_fil_id, piece_fil_name, piece_display',
          )
          .in('piece_id', pieceIds)
          .eq('piece_display', 1),

        // MARQUES
        this.client
          .from('pieces_marque')
          .select('pm_id, pm_name, pm_logo, pm_alias, pm_oes, pm_nb_stars')
          .in('pm_id', pmIds),

        // PRIX (avec gestion d'erreur)
        this.client
          .from('pieces_price')
          .select(
            'pri_piece_id, pri_vente_ttc, pri_consigne_ttc, pri_dispo, pri_type',
          )
          .in(
            'pri_piece_id',
            pieceIds.map((id) => id.toString()),
          )
          .eq('pri_dispo', '1')
          .order('pri_type', { ascending: false }),

        // FILTRES
        this.client
          .from('pieces_side_filtre')
          .select('psf_id, psf_side')
          .in('psf_id', psfIds),

        // IMAGES
        this.client
          .from('pieces_media_img')
          .select('pmi_piece_id, pmi_folder, pmi_name, pmi_display')
          .in('pmi_piece_id', pieceIds)
          .eq('pmi_display', 1),
      ]);

      // Vérification d'erreurs
      if (piecesResult.error) {
        this.logger.error('❌ Erreur pièces:', piecesResult.error);
        throw new Error(piecesResult.error.message);
      }

      const piecesData = piecesResult.data || [];
      const marquesData = marquesResult.data || [];
      const pricesData = pricesResult.data || [];
      const filtresData = filtresResult.data || [];
      const imagesData = imagesResult.data || [];

      this.logger.log(
        `🔍 [ULTRA-DEBUG] Données: ${piecesData.length} pièces, ${marquesData.length} marques, ${pricesData.length} prix, ${imagesData.length} images`,
      );

      // 3️⃣ CONSTRUCTION DES MAPS OPTIMISÉES
      const relationsMap = new Map(
        relationsData.map((r) => [r.rtp_piece_id, r]),
      );
      const marquesMap = new Map(marquesData.map((m) => [m.pm_id, m]));
      const filtresMap = new Map(filtresData.map((f) => [f.psf_id, f]));
      const imagesMap = new Map(imagesData.map((i) => [i.pmi_piece_id, i]));

      // Prix avec gestion spéciale
      const pricesMap = new Map();
      pricesData.forEach((p) => {
        const pieceId = parseInt(p.pri_piece_id);
        if (
          !pricesMap.has(pieceId) ||
          parseInt(p.pri_type) > parseInt(pricesMap.get(pieceId).pri_type)
        ) {
          pricesMap.set(pieceId, p);
        }
      });

      // 4️⃣ TRANSFORMATION AVEC DONNÉES ENRICHIES
      const pieces = piecesData.map((piece) => {
        const relation = relationsMap.get(piece.piece_id);
        const marqueEquip = marquesMap.get(
          relation?.rtp_pm_id || piece.piece_pm_id,
        );
        const price = pricesMap.get(piece.piece_id);
        const filtre = filtresMap.get(relation?.rtp_psf_id);
        const image = imagesMap.get(piece.piece_id);

        // CALCUL PRIX avec simulation si manquant
        let prixUnitaire = parseFloat(price?.pri_vente_ttc || '0');
        let prixConsigne = parseFloat(price?.pri_consigne_ttc || '0');

        // SIMULATION DE PRIX RÉALISTES si manquant (pour développement)
        if (prixUnitaire === 0 && process.env.NODE_ENV === 'development') {
          prixUnitaire = Math.random() * 500 + 50; // Prix entre 50€ et 550€
          prixConsigne = Math.random() > 0.7 ? Math.random() * 100 + 20 : 0; // 30% chance de consigne
        }

        const quantiteVente = parseFloat(piece.piece_qty_sale || '1');
        const prixTotal = prixUnitaire * quantiteVente;
        const prixTotalAvecConsigne = prixTotal + prixConsigne * quantiteVente;

        // QUALITÉ (logique PHP améliorée)
        let qualite = 'AFTERMARKET';
        let qualiteScore = 3;
        if (marqueEquip?.pm_oes === '1' || marqueEquip?.pm_oes === 'O') {
          qualite = 'OES';
          qualiteScore = 6;
        }
        if (prixConsigne > 0) {
          qualite = 'Echange Standard';
          qualiteScore = marqueEquip?.pm_nb_stars || 4;
        }

        // NOM COMPLET optimisé
        const sideFromFilter = filtre?.psf_side || piece.piece_name_side || '';
        const nomComplet =
          [piece.piece_name, sideFromFilter, piece.piece_name_comp]
            .filter(Boolean)
            .join(' ')
            .trim() || 'Pièce sans nom';

        // IMAGE avec URL complète
        let imageUrl = '/upload/articles/no.png';
        let imageAlt = '';
        let imageTitle = '';

        if (piece.piece_has_img === 1 && image) {
          imageUrl = `https://www.automecanik.com/rack/${image.pmi_folder}/${image.pmi_name}.webp`;
          imageAlt = `${nomComplet} ${marqueEquip?.pm_name || ''} ${piece.piece_ref || ''}`;
          imageTitle = `${nomComplet} ${piece.piece_ref || ''}`;
        }

        return {
          // IDENTIFIANTS
          id: piece.piece_id,
          ref_id: `ref${piece.piece_id}`,
          reference: piece.piece_ref || '',
          reference_clean: piece.piece_ref_clean || '',

          // NOMS
          nom: nomComplet,
          nom_complet: nomComplet,
          piece_name: piece.piece_name || '',
          piece_name_side: sideFromFilter,
          piece_name_comp: piece.piece_name_comp || '',
          description: piece.piece_des || '',

          // MARQUE
          marque: marqueEquip?.pm_name || 'Marque inconnue',
          marque_id: marqueEquip?.pm_id || null,
          marque_logo: marqueEquip?.pm_logo
            ? `/upload/equipementiers-automobiles/${marqueEquip.pm_logo}`
            : null,
          marque_alias: marqueEquip?.pm_alias || null,

          // PRIX (structure HTML complète)
          prix_unitaire: Math.round(prixUnitaire * 100) / 100,
          prix_ttc: Math.round(prixTotal * 100) / 100,
          prix_consigne: Math.round(prixConsigne * 100) / 100,
          prix_total: Math.round(prixTotalAvecConsigne * 100) / 100,
          quantite_vente: quantiteVente,

          // QUALITÉ ET PERFORMANCES
          qualite,
          qualite_code: qualite.toLowerCase().replace(/\s+/g, '-'),
          nb_stars: qualiteScore,
          pm_oes: marqueEquip?.pm_oes || 'A',
          stars_display:
            '★'.repeat(qualiteScore) + '☆'.repeat(6 - qualiteScore),

          // IMAGES
          image: imageUrl,
          image_alt: imageAlt,
          image_title: imageTitle,

          // FILTRES ET CATÉGORIES
          filtre_gamme: piece.piece_fil_name || '',
          filtre_side: filtre?.psf_side || '',
          filtre_id: piece.piece_fil_id || null,
          psf_id: relation?.rtp_psf_id || null,

          // CATÉGORIES POUR FILTRAGE (comme dans HTML)
          data_category: `${piece.piece_fil_name || 'piece'} ${qualite.toLowerCase().replace(/\s+/g, '-')} st${qualiteScore}ars ${(marqueEquip?.pm_name || 'unknown').toLowerCase()}`,

          // CARACTÉRISTIQUES
          has_image: piece.piece_has_img === 1,
          has_oem: piece.piece_has_oem === 1,
          has_price: prixUnitaire > 0,
          has_consigne: prixConsigne > 0,

          // URL
          url: `/piece/${piece.piece_id}/${this.slugify(nomComplet)}.html`,
        };
      });

      // 5️⃣ GROUPEMENT PAR BLOCS (comme dans HTML)
      const blocksMap = new Map();
      pieces.forEach((piece) => {
        const key = `${piece.filtre_gamme}_${piece.filtre_side}`;
        if (!blocksMap.has(key)) {
          blocksMap.set(key, {
            filtre_gamme: piece.filtre_gamme,
            filtre_side: piece.filtre_side,
            key: key,
            pieces: [],
            count: 0,
            minPrice: null,
          });
        }
        const block = blocksMap.get(key);
        block.pieces.push(piece);
        block.count++;
        if (piece.prix_unitaire > 0) {
          block.minPrice =
            block.minPrice === null
              ? piece.prix_unitaire
              : Math.min(block.minPrice, piece.prix_unitaire);
        }
      });

      const blocks = Array.from(blocksMap.values());

      // 6️⃣ CALCUL PRIX MINIMUM GLOBAL
      const validPrices = pieces
        .map((p) => p.prix_unitaire)
        .filter((price) => price > 0);
      const globalMinPrice =
        validPrices.length > 0 ? Math.min(...validPrices) : null;

      // 7️⃣ GÉNÉRATION DES FILTRES (comme dans HTML)
      const filters = {
        qualite: [
          ...new Set(
            pieces.map((p) => ({ value: p.qualite_code, label: p.qualite })),
          ),
        ],
        performance: [
          ...new Set(
            pieces.map((p) => ({
              value: `st${p.nb_stars}ars`,
              label: p.stars_display,
            })),
          ),
        ],
        equipementiers: [
          ...new Set(
            pieces
              .filter((p) => p.marque !== 'Marque inconnue')
              .map((p) => ({
                value: p.marque.toLowerCase().replace(/\s+/g, ''),
                label: p.marque,
              })),
          ),
        ],
      };

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ [ULTRA-ENHANCED] ${pieces.length} pièces, ${blocks.length} blocs, prix min: ${globalMinPrice}€ en ${duration}ms`,
      );

      return {
        pieces,
        blocks,
        filters,
        count: pieces.length,
        blocks_count: blocks.length,
        minPrice: globalMinPrice,
        duration: `${duration}ms`,
        success: true,
        features: [
          'structure_html_identique',
          'filtrage_avance',
          'prix_simules_dev',
          'blocs_optimises',
          'images_completes',
          'performance_optimisee',
        ],
        relations_found: relationsData.length,
        optimization: {
          parallel_queries: true,
          maps_performance: true,
          price_simulation: process.env.NODE_ENV === 'development',
          limit_applied: pieceIds.length,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ [ULTRA-ENHANCED] Erreur: ${error.message}`,
        error.stack,
      );

      return {
        pieces: [],
        blocks: [],
        filters: {},
        count: 0,
        minPrice: null,
        duration: `${duration}ms`,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🔧 Utilitaire pour créer des slugs d'URL
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-z0-9\s-]/g, '') // Garde seulement lettres, chiffres, espaces, tirets
      .replace(/\s+/g, '-') // Remplace espaces par tirets
      .replace(/-+/g, '-') // Supprime tirets multiples
      .replace(/^-|-$/g, ''); // Supprime tirets en début/fin
  }
}
