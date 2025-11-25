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
        .from(TABLES.pieces_relation_type)
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

      const [marquesResult, pricesResult, filtresResult, imagesResult, criteriasResult, criteriasLinksResult, relationCriteriasResult] =
        await Promise.all([
          // Marques d'équipementiers
          uniquePmIds.length > 0
            ? this.client
                .from(TABLES.pieces_marque)
                .select(
                  'pm_id, pm_name, pm_alias, pm_logo, pm_quality, pm_oes, pm_nb_stars, pm_display',
                )
                .in('pm_id', uniquePmIds)
            : { data: [], error: null },

          // Prix (avec tri pour garantir le meilleur prix)
          this.client
            .from(TABLES.pieces_price)
            .select(
              'pri_piece_id, pri_vente_ttc, pri_consigne_ttc, pri_type, pri_dispo',
            )
            .in('pri_piece_id', validPieceIds)
            .eq('pri_dispo', 1)
            .order('pri_type', { ascending: false }),

          // Filtres de côté - SANS exclusion 9999 (fallback intelligent actif)
          this.client
            .from(TABLES.pieces_side_filtre)
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
            .in('pc_piece_id', validPieceIdsStr),  // ✅ Utiliser string[] car pc_piece_id est TEXT en base

          // Liens des critères techniques
          this.client
            .from(TABLES.pieces_criteria_link)
            .select('*')
            .eq('pcl_display', 1)
            .order('pcl_level')
            .order('pcl_sort'),

          // 🎯 NOUVEAU: Critères de relation pièce-véhicule (position spécifique)
          this.client
            .from(TABLES.pieces_relation_criteria)
            .select('rcp_piece_id, rcp_cri_id, rcp_cri_value')
            .eq('rcp_type_id', typeId)
            .eq('rcp_pg_id', pgId)
            .in('rcp_piece_id', validPieceIdsStr),
        ]);

      // 3️⃣ CONSTRUCTION DES MAPS POUR PERFORMANCE O(1) (optimisation)
      // const piecesData = piecesResult.data || []; // Déjà récupéré
      const marquesData = marquesResult.data || [];
      const pricesData = pricesResult.data || [];
      const filtresData = filtresResult.data || [];
      const imagesData = imagesResult.data || [];
      const criteriasData = criteriasResult.data || [];
      const criteriasLinksData = criteriasLinksResult.data || [];
      const relationCriteriasData = relationCriteriasResult.data || [];

      // 🔍 DEBUG: Vérification des données récupérées
      // Logs de debug pour diagnostiquer les prix
      this.logger.log(
        `🔍 [DEBUG] Données récupérées: ${piecesData.length} pièces, ${marquesData.length} marques, ${pricesData.length} prix, ${filtresData.length} filtres, ${imagesData.length} images, ${criteriasData.length} critères, ${relationCriteriasData.length} critères de relation`,
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

      // 🎯 Map des positions par pièce depuis pieces_relation_criteria
      // Cherche spécifiquement le critère 100 ("Côté d'assemblage") pour ce véhicule
      const relationPositionsMap = new Map();
      
      // Grouper d'abord les critères par pièce
      const criteriaByPiece = new Map<string, string[]>();
      relationCriteriasData.forEach((rc: any) => {
        if (rc.rcp_cri_id === 100 && rc.rcp_cri_value) {
          const pieceId = rc.rcp_piece_id.toString();
          if (!criteriaByPiece.has(pieceId)) {
            criteriaByPiece.set(pieceId, []);
          }
          criteriaByPiece.get(pieceId)!.push(rc.rcp_cri_value.toLowerCase());
        }
      });
      
      // Analyser les positions pour chaque pièce avec PRIORITÉ
      criteriaByPiece.forEach((values, pieceId) => {
        let hasGauche = false;
        let hasDroite = false;
        let hasAvant = false;
        let hasArriere = false;
        let hasSuperieur = false;
        let hasInferieur = false;
        
        // Scanner toutes les valeurs pour cette pièce
        values.forEach(value => {
          // Détection AVANT/ARRIÈRE
          if (value.includes('essieu avant') || (value.includes('avant') && !value.includes('arrière') && !value.includes('arriere'))) {
            hasAvant = true;
          }
          if (value.includes('essieu arrière') || value.includes('essieu arriere') || value.includes('arrière') || value.includes('arriere')) {
            hasArriere = true;
          }
          
          // Détection GAUCHE/DROITE
          if (value.includes('gauche') || value.includes('conducteur')) {
            hasGauche = true;
          }
          if (value.includes('droit') || value.includes('passager')) {
            hasDroite = true;
          }
          
          // Détection SUPÉRIEUR/INFÉRIEUR
          if (value.includes('supérieur') || value.includes('superieur') || value.includes('haut')) {
            hasSuperieur = true;
          }
          if (value.includes('inférieur') || value.includes('inferieur') || value.includes('bas')) {
            hasInferieur = true;
          }
        });
        
        // PRIORITÉ de détection : Gauche/Droite > Avant/Arrière > Supérieur/Inférieur
        let detectedPosition = '';
        
        // Si gauche ET droite → pièce universelle, pas de position
        if (hasGauche && !hasDroite) {
          detectedPosition = 'gauche';
        } else if (hasDroite && !hasGauche) {
          detectedPosition = 'droite';
        } else if (hasAvant) {
          detectedPosition = 'avant';
        } else if (hasArriere) {
          detectedPosition = 'arrière';
        } else if (hasSuperieur) {
          detectedPosition = 'supérieur';
        } else if (hasInferieur) {
          detectedPosition = 'inférieur';
        }
        
        // Stocker la position détectée
        if (detectedPosition) {
          relationPositionsMap.set(pieceId, detectedPosition);
        }
      });

      this.logger.log(
        `🎯 [POSITIONS-RELATION] ${relationPositionsMap.size} pièces avec position détectée depuis pieces_relation_criteria`,
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

      // 🔍 DEBUG: Vérifier le chargement des critères
      this.logger.log(
        `🔍 [DEBUG-CRITERES] ${criteriasData.length} critères chargés, ${criteriasMap.size} pièces avec critères`,
      );
      if (criteriasMap.size > 0) {
        const firstKey = Array.from(criteriasMap.keys())[0];
        this.logger.log(`🔍 [DEBUG-CRITERES] Exemple: piece_id=${firstKey}, critères=${criteriasMap.get(firstKey)?.length}`);
      }

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
        const criterias = criteriasMap.get(piece.piece_id.toString()) || [];  // ✅ Conversion en string car pc_piece_id est TEXT

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
        // ✅ Priorité PSF_SIDE (table pieces_side_filtre) puis PIECE_NAME_SIDE - logique COALESCE(PSF_SIDE, PIECE_NAME_SIDE) du PHP legacy
        const sideToAdd = filtre?.psf_side || piece.piece_name_side;
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
        
        // 🖼️ GALERIE D'IMAGES - Toutes les images disponibles pour cette pièce
        const allPieceImages = imagesData
          .filter(img => img.pmi_piece_id.toString() === piece.piece_id.toString() && img.pmi_display === true)
          .sort((a, b) => a.pmi_sort - b.pmi_sort)
          .map(img => ({
            id: img.pmi_piece_id.toString() + '_' + img.pmi_sort,
            url: `rack/${img.pmi_folder}/${img.pmi_name}.webp`,
            sort: img.pmi_sort,
            alt: `${nomComplet} ${marqueEquip?.pm_name || ''} - Photo ${img.pmi_sort}`
          }));

        // CRITÈRES TECHNIQUES - TOUS les critères disponibles (pas de limite)
        // ⚠️ EXCLURE le critère 100 (Côté d'assemblage) car déjà utilisé pour le groupement H2
        const criteriasTechniques = criterias
          .filter((c: any) => {
            const criId = parseInt(c.pc_cri_id);
            return c.link_info && criId !== 100;
          })
          .map((c: any) => ({
            criteria: c.link_info?.pcl_cri_criteria || '',
            value: c.pc_cri_value || '',
            unit: c.link_info?.pcl_cri_unit || '',
            level: c.link_info?.pcl_level || 1,
            group: c.link_info?.pcl_cri_group || 'Autres',
          }))
          .sort((a, b) => a.level - b.level); // Trier par niveau d'importance

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
          psf_sort: filtre?.psf_sort ? parseInt(filtre.psf_sort) : 999,
          image: imageUrl,
          image_alt: imageAlt,
          image_title: imageTitle,
          images: allPieceImages, // 🖼️ Galerie complète
          criterias_techniques: criteriasTechniques,
          url: `/piece/${piece.piece_id}/${this.slugify(nomComplet || 'piece')}.html`,
        };
      });

      // 5️⃣ TRI DES PIÈCES (position puis prix)
      // Tri par psf_sort (1=avant, 2=arrière, 3+=accessoires) puis par prix croissant
      // Pour les plaquettes : on met les "Plaquettes de frein" avant les "Accessoires"
      pieces.sort((a, b) => {
        // Tri spécial pour les accessoires : toujours à la fin
        const aIsAccessoire = a.filtre_gamme?.toLowerCase().includes('accessoire');
        const bIsAccessoire = b.filtre_gamme?.toLowerCase().includes('accessoire');
        
        if (aIsAccessoire && !bIsAccessoire) return 1;  // a après b
        if (!aIsAccessoire && bIsAccessoire) return -1; // a avant b
        
        // Si même type (tous deux accessoires ou tous deux pièces principales)
        // 🎯 Détection multi-niveaux: relation > critères > piece_name
        const getPositionPriority = (piece: any): number => {
          // 🔥 PRIORITÉ 1: Position depuis pieces_relation_criteria (spécifique véhicule)
          const relationPosition = relationPositionsMap.get(piece.id.toString());
          if (relationPosition === 'avant') return 1;
          if (relationPosition === 'arrière') return 2;
          if (relationPosition === 'gauche') return 3;
          if (relationPosition === 'droite') return 4;
          if (relationPosition === 'supérieur') return 5;
          if (relationPosition === 'inférieur') return 6;
          if (relationPosition === 'latéral') return 7;
          
          // PRIORITÉ 2: Chercher dans les critères de la pièce
          if (piece.criterias_techniques && piece.criterias_techniques.length > 0) {
            for (const crit of piece.criterias_techniques) {
              const searchText = `${crit.criteria || ''} ${crit.value || ''}`.toLowerCase();
              
              // Ordre: avant(1) < arrière(2) < gauche(3) < droite(4) < supérieur(5) < inférieur(6)
              if (searchText.includes('essieu avant') || (searchText.includes('avant') && !searchText.includes('arrière') && !searchText.includes('arriere'))) {
                return 1;
              }
              if (searchText.includes('essieu arrière') || searchText.includes('essieu arriere') || searchText.includes('arrière') || searchText.includes('arriere')) {
                return 2;
              }
              if (searchText.includes('gauche') || searchText.includes('conducteur')) {
                return 3;
              }
              if (searchText.includes('droit') || searchText.includes('passager')) {
                return 4;
              }
              if (searchText.includes('supérieur') || searchText.includes('superieur') || searchText.includes('haut')) {
                return 5;
              }
              if (searchText.includes('inférieur') || searchText.includes('inferieur') || searchText.includes('bas')) {
                return 6;
              }
            }
          }
          
          // PRIORITÉ 3: Fallback sur piece_name
          if (piece.nom) {
            const nomLower = piece.nom.toLowerCase();
            if (nomLower.includes('avant') && !nomLower.includes('arrière') && !nomLower.includes('arriere')) return 1;
            if (nomLower.includes('arrière') || nomLower.includes('arriere')) return 2;
            if (nomLower.includes('gauche') || nomLower.includes('conducteur')) return 3;
            if (nomLower.includes('droit') || nomLower.includes('passager')) return 4;
            if (nomLower.includes('supérieur') || nomLower.includes('superieur') || nomLower.includes('haut')) return 5;
            if (nomLower.includes('inférieur') || nomLower.includes('inferieur') || nomLower.includes('bas')) return 6;
          }
          
          return 5; // Pas de position spécifique
        };
        
        const aPosition = getPositionPriority(a);
        const bPosition = getPositionPriority(b);
        
        // Tri par position détectée
        if (aPosition !== bPosition) {
          return aPosition - bPosition;
        }
        
        // Si même position, tri par psf_sort
        if (a.psf_sort !== b.psf_sort) {
          return a.psf_sort - b.psf_sort;
        }
        
        // Finalement, tri par prix
        return a.prix_ttc - b.prix_ttc;
      });

      // 6️⃣ CALCUL DU PRIX MINIMUM GLOBAL (logique PHP)
      const validPrices = pieces
        .map((p) => p.prix_ttc)
        .filter((price) => price > 0);
      const globalMinPrice =
        validPrices.length > 0 ? Math.min(...validPrices) : null;

      // 7️⃣ GROUPEMENT PAR FILTRE (logique PHP originale)
      const groupedByFilter = pieces.reduce((acc: any, piece: any) => {
        // 🎯 DÉTECTION DE POSITION AVEC PRIORITÉ INTELLIGENTE
        // Stratégie : Gauche/Droite dans pieces_criteria (Priority 2) > pieces_relation_criteria (Priority 1) > piece_name (Priority 3)
        // Car pieces_criteria contient souvent "Essieu avant gauche/droit" (plus précis)
        // Alors que pieces_relation_criteria peut avoir juste "supérieur" (moins précis)
        
        let detectedPosition = '';
        
        // ÉTAPE 1: Scanner pieces_criteria (Priority 2) pour Gauche/Droite
        const criterias = criteriasMap.get(piece.id.toString()) || [];
        let foundGauche = false;
        let foundDroite = false;
        let foundAvant = false;
        let foundArriere = false;
        let foundSuperieur = false;
        let foundInferieur = false;
        
        if (criterias.length > 0) {
          // Scanner TOUS les critères (y compris critère 100 "Côté d'assemblage")
          for (const crit of criterias) {
            const valueText = (crit.pc_cri_value || '').toLowerCase();
            
            // Détecter toutes les positions présentes
            if (valueText.includes('gauche') || valueText.includes('conducteur')) {
              foundGauche = true;
            }
            if (valueText.includes('droit') || valueText.includes('passager')) {
              foundDroite = true;
            }
            if (valueText.includes('essieu avant') || (valueText.includes('avant') && !valueText.includes('arrière') && !valueText.includes('arriere'))) {
              foundAvant = true;
            }
            if (valueText.includes('essieu arrière') || valueText.includes('essieu arriere') || valueText.includes('arrière') || valueText.includes('arriere')) {
              foundArriere = true;
            }
            if (valueText.includes('supérieur') || valueText.includes('superieur') || valueText.includes('haut')) {
              foundSuperieur = true;
            }
            if (valueText.includes('inférieur') || valueText.includes('inferieur') || valueText.includes('bas')) {
              foundInferieur = true;
            }
          }
          
          // Choisir par priorité : Gauche/Droite > Avant/Arrière > Supérieur/Inférieur
          if (foundGauche) {
            detectedPosition = 'Gauche';
          } else if (foundDroite) {
            detectedPosition = 'Droite';
          } else if (foundAvant) {
            detectedPosition = 'Avant';
          } else if (foundArriere) {
            detectedPosition = 'Arrière';
          } else if (foundSuperieur) {
            detectedPosition = 'Supérieur';
          } else if (foundInferieur) {
            detectedPosition = 'Inférieur';
          }
        }
        
        // ÉTAPE 2: Si pieces_criteria n'a pas trouvé, utiliser pieces_relation_criteria (Priority 1)
        if (!detectedPosition) {
          const relationPosition = relationPositionsMap.get(piece.id.toString());
          if (relationPosition) {
            // Capitaliser
            detectedPosition = relationPosition
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        }
        
        // PRIORITÉ 3: Fallback sur piece_name si aucune source n'a la position
        if (!detectedPosition && piece.nom) {
          const nomLower = piece.nom.toLowerCase();
          // Avant/Arrière
          if (nomLower.includes('avant') && !nomLower.includes('arrière') && !nomLower.includes('arriere')) {
            detectedPosition = 'Avant';
          } else if (nomLower.includes('arrière') || nomLower.includes('arriere')) {
            detectedPosition = 'Arrière';
          }
          // Gauche/Droite
          else if (nomLower.includes('gauche') || nomLower.includes('conducteur')) {
            detectedPosition = 'Gauche';
          } else if (nomLower.includes('droit') || nomLower.includes('passager')) {
            detectedPosition = 'Droite';
          }
          // Supérieur/Inférieur
          else if (nomLower.includes('supérieur') || nomLower.includes('superieur') || nomLower.includes('haut')) {
            detectedPosition = 'Supérieur';
          } else if (nomLower.includes('inférieur') || nomLower.includes('inferieur') || nomLower.includes('bas')) {
            detectedPosition = 'Inférieur';
          }
        }
        
        // ⚠️ UTILISER UNIQUEMENT detectedPosition pour le groupement
        const finalPosition = detectedPosition || '';
        
        // Clé de groupement : filtre_gamme + position
        const key = `${piece.filtre_gamme}_${finalPosition}`;
        
        if (!acc[key]) {
          // Construire le titre H2 complet pour les sections
          // Logique PHP : PIECE_FIL_NAME + PSF_SIDE
          const titleParts = [
            piece.filtre_gamme,
            finalPosition,
          ].filter(Boolean);
          
          // Capitaliser chaque partie (premier caractère en majuscule)
          const title_h2 = titleParts.length > 0
            ? titleParts
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ')
            : piece.filtre_gamme || 'Pièces';

          acc[key] = {
            filtre_gamme: piece.filtre_gamme,
            filtre_side: finalPosition || piece.filtre_side,
            title_h2: title_h2,
            pieces: [],
          };
        }
        acc[key].pieces.push(piece);
        return acc;
      }, {});

      // 🔄 FUSION DES GROUPES SIMILAIRES
      // Règles de fusion :
      // 1. Gauche (prioritaire) : toute position contenant "gauche" → fusionner sous "Gauche"
      // 2. Droite (prioritaire) : toute position contenant "droite" → fusionner sous "Droite"
      // 3. Même type de pièce (ex: "intérieure") avec positions différentes → fusionner
      const groupsArray = Object.values(groupedByFilter) as any[];
      
      const mergedGroups: { [key: string]: any } = {};

      for (const group of groupsArray) {
        const position = ((group as any).filtre_side || '').toLowerCase();
        const baseName = (group as any).filtre_gamme.toLowerCase();
        
        // Déterminer la clé de fusion
        let mergeKey: string;
        let mergedPosition = '';
        
        // PRIORITÉ 1: Type de pièce spécifique (intérieure, extérieure, etc.)
        // → Fusionner par type même si position Gauche/Droite présente
        if (baseName.includes('intérieure') || baseName.includes('extérieure')) {
          mergeKey = baseName; // Clé = nom de base sans position
          mergedPosition = ''; // Pas de position dans le titre
        }
        // PRIORITÉ 2: Gauche (pour les pièces NON-intérieure/extérieure)
        else if (position.includes('gauche')) {
          mergeKey = `${baseName}|gauche`;
          mergedPosition = 'Gauche';
        }
        // PRIORITÉ 3: Droite (pour les pièces NON-intérieure/extérieure)
        else if (position.includes('droite') || position.includes('droit')) {
          mergeKey = `${baseName}|droite`;
          mergedPosition = 'Droite';
        }
        // PRIORITÉ 4: Toutes les autres positions → clé unique incluant la position
        else {
          mergeKey = `${baseName}|${position}`;
          mergedPosition = position;
        }

        // Fusionner ou créer le groupe
        if (!mergedGroups[mergeKey]) {
          // Créer le nouveau groupe avec titre approprié
          const titleParts = [(group as any).filtre_gamme, mergedPosition].filter(Boolean);
          const newTitle = titleParts
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

          mergedGroups[mergeKey] = {
            filtre_gamme: (group as any).filtre_gamme,
            filtre_side: mergedPosition,
            title_h2: newTitle,
            pieces: [...(group as any).pieces],
          };
        } else {
          // Ajouter les pièces au groupe existant (fusion)
          mergedGroups[mergeKey].pieces.push(...(group as any).pieces);
        }
      }

      const finalGroups = Object.values(mergedGroups);

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ [PHP-LOGIC] ${pieces.length} pièces trouvées, ${groupsArray.length} groupes → ${finalGroups.length} groupes après fusion, prix min: ${globalMinPrice}€ en ${duration}ms`,
      );

      return {
        pieces,
        grouped_pieces: finalGroups,
        blocs: finalGroups, // Alias pour compatibilité
        count: pieces.length,
        minPrice: globalMinPrice,
        relations_found: relationsData.length,
        duration: `${duration}ms`,
        success: true,
        optimization: 'PHP_LOGIC_INTEGRATED_V4_HYBRID_MERGED',
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
