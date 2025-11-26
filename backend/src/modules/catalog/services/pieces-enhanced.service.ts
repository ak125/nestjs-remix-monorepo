import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { buildRackImageUrl, type PieceImageData } from '../utils/image-urls.utils';

@Injectable()
export class PiecesEnhancedService extends SupabaseBaseService {
  async getPiecesEnhancedCatalog(typeId: number, pgId: number) {
    const startTime = Date.now();

    try {
      this.logger.log(
        `🚀 [ENHANCED] Catalogue amélioré type_id=${typeId}, pg_id=${pgId}`,
      );

      // 1️⃣ RÉCUPÉRATION DES RELATIONS SIMPLIFIÉE
      const relationsResult = await this.client
        .from(TABLES.pieces_relation_type)
        .select('rtp_piece_id, rtp_pm_id, rtp_psf_id, rtp_type_id, rtp_pg_id')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId);

      if (relationsResult.error || !relationsResult.data?.length) {
        this.logger.warn(
          `⚠️ [ENHANCED] Aucune relation trouvée pour type_id=${typeId}, pg_id=${pgId}`,
        );
        return {
          success: true,
          catalog: {
            total_products: 0,
            products: [],
            filters: {},
            statistics: {
              brands_count: 0,
              price_range: null,
              quality_distribution: {},
            },
          },
          message: 'Aucune pièce disponible',
        };
      }

      const relations = relationsResult.data;
      const pieceIds = relations.map((r) => r.rtp_piece_id);
      const pmIds = [
        ...new Set(relations.map((r) => r.rtp_pm_id).filter(Boolean)),
      ];

      this.logger.log(
        `🔍 [ENHANCED] ${relations.length} relations → ${pieceIds.length} pièces`,
      );

      // 1.5 RÉCUPÉRATION PIÈCES SÉPARÉE
      const piecesResult = await this.client
        .from(TABLES.pieces)
        .select('*')
        .in('piece_id', pieceIds)
        .eq('piece_display', 1)
        .order('piece_name')
        .limit(50);

      // 2️⃣ RÉCUPÉRATION PARALLÈLE OPTIMISÉE
      const [marquesResult, pricesResult, imagesResult, filtresResult] =
        await Promise.all([
          // MARQUES avec logos
          this.client
            .from(TABLES.pieces_marque)
            .select('pm_id, pm_name, pm_logo, pm_alias, pm_nb_stars, pm_oes')
            .in('pm_id', pmIds),

          // PRIX avec meilleur type
          this.client
            .from(TABLES.pieces_price)
            .select(
              'pri_piece_id, pri_vente_ttc, pri_consigne_ttc, pri_type, pri_dispo',
            )
            .in('pri_piece_id', pieceIds)
            .eq('pri_dispo', 1)
            .order('pri_type', { ascending: false }),

          // IMAGES principales
          this.client
            .from(TABLES.pieces_media_img)
            .select('pmi_piece_id, pmi_folder, pmi_name')
            .in('pmi_piece_id', pieceIds)
            .eq('pmi_display', 1)
            .limit(100),

          // FILTRES latéraux
          this.client
            .from(TABLES.pieces_side_filtre)
            .select('psf_id, psf_side')
            .in('psf_id', relations.map((r) => r.rtp_psf_id).filter(Boolean)),
        ]);

      // 3️⃣ CONSTRUCTION DES MAPS PERFORMANTES
      const marquesMap = new Map(
        marquesResult.data?.map((m) => [m.pm_id, m]) || [],
      );
      const imagesMap = new Map(
        imagesResult.data?.map((i) => [i.pmi_piece_id, i]) || [],
      );
      const filtresMap = new Map(
        filtresResult.data?.map((f) => [f.psf_id, f]) || [],
      );

      // Prix : garde le meilleur prix par pièce
      const pricesMap = new Map();
      pricesResult.data?.forEach((p) => {
        if (
          !pricesMap.has(p.pri_piece_id) ||
          p.pri_type > pricesMap.get(p.pri_piece_id).pri_type
        ) {
          pricesMap.set(p.pri_piece_id, p);
        }
      });

      // 4️⃣ TRANSFORMATION EN CATALOGUE STRUCTURÉ
      const piecesData = piecesResult.data || [];
      const products = piecesData.map((piece: any) => {
        // Trouver la relation correspondante
        const relation = relations.find(
          (r) => r.rtp_piece_id === piece.piece_id,
        );
        const marque = marquesMap.get(relation?.rtp_pm_id || piece.piece_pm_id);
        const price = pricesMap.get(piece.piece_id);
        const image = imagesMap.get(piece.piece_id);
        const filtre = filtresMap.get(relation?.rtp_psf_id);

        // CALCUL PRIX AVANCÉ (comme HTML exemple)
        const prixUnitaire = parseFloat(price?.pri_vente_ttc || '0');
        const prixConsigne = parseFloat(price?.pri_consigne_ttc || '0');
        const quantiteVente = parseFloat(piece.piece_qty_sale || '1');
        const prixTotal = prixUnitaire * quantiteVente;
        const prixTotalAvecConsigne = prixTotal + prixConsigne * quantiteVente;

        // DÉTERMINATION QUALITÉ (logique HTML)
        let qualite = 'AFTERMARKET';
        if (marque?.pm_oes === '1' || marque?.pm_oes === 'O') {
          qualite = 'OES';
        }
        if (prixConsigne > 0) {
          qualite = 'Echange Standard';
        }

        // CALCUL ÉTOILES PERFORMANCE
        const nbStars = parseInt(marque?.pm_nb_stars || '0');
        const starsDisplay =
          nbStars > 0 ? '★'.repeat(Math.min(nbStars, 6)) : '★★★';

        // NOM COMPLET OPTIMISÉ
        const sideText = filtre?.psf_side || piece.piece_name_side || '';
        const nomComplet = [piece.piece_name, sideText, piece.piece_name_comp]
          .filter(Boolean)
          .join(' ')
          .trim();

        // IMAGE URL CORRECTE (helper centralisé)
        const imageUrl = buildRackImageUrl(image as PieceImageData);

        return {
          // IDENTIFIANTS
          id: piece.piece_id,
          ref_id: `ref${piece.piece_id}`,
          reference: piece.piece_ref || '',
          reference_clean: piece.piece_ref_clean || piece.piece_ref || '',

          // NOMS ET DESCRIPTIONS
          nom: nomComplet || 'Pièce sans nom',
          nom_complet: nomComplet,
          piece_name: piece.piece_name || '',
          piece_name_side: sideText,
          piece_name_comp: piece.piece_name_comp || '',
          description: piece.piece_des || '',
          title_alt: `${nomComplet} ${marque?.pm_name || ''} ${piece.piece_ref || ''}`,

          // MARQUE ET ÉQUIPEMENTIER
          marque: {
            id: marque?.pm_id || null,
            name: marque?.pm_name || 'Marque inconnue',
            logo: marque?.pm_logo
              ? `/upload/equipementiers-automobiles/${marque.pm_logo}.webp`
              : null,
            alias: marque?.pm_alias || null,
            oes: marque?.pm_oes || 'A',
          },

          // PRIX DÉTAILLÉS (structure HTML)
          prix: {
            unitaire: prixUnitaire,
            total: prixTotal,
            consigne: prixConsigne * quantiteVente,
            total_avec_consigne: prixTotalAvecConsigne,
            quantite_vente: quantiteVente,
            devise: '€',
            // Format d'affichage comme HTML
            display:
              prixTotal > 0
                ? {
                    principal: `${prixTotal.toFixed(2).replace('.', ',')} €`,
                    consigne:
                      prixConsigne > 0
                        ? `Consigne ${(prixConsigne * quantiteVente).toFixed(2).replace('.', ',')} €`
                        : null,
                    total:
                      prixConsigne > 0
                        ? `(Total ${prixTotalAvecConsigne.toFixed(2).replace('.', ',')} € TTC)`
                        : 'Prix TTC',
                  }
                : null,
          },

          // QUALITÉ ET PERFORMANCE
          qualite: {
            type: qualite.toLowerCase().replace(/\s+/g, '-'),
            label: qualite,
            stars: nbStars,
            stars_display: starsDisplay,
            css_class:
              qualite.toLowerCase().replace(/\s+/g, '-') +
              ` st${nbStars || 3}ars`,
          },

          // IMAGE
          image: {
            url: imageUrl,
            alt: `${nomComplet} ${marque?.pm_name || ''} ${piece.piece_ref || ''}`,
            title: `${nomComplet} ${piece.piece_ref || ''}`,
            width: 360,
            height: 360,
          },

          // CARACTÉRISTIQUES
          has_image: piece.piece_has_img === 1,
          has_oem: piece.piece_has_oem === 1,

          // FILTRES (pour JS de filtrage)
          filter_categories: [
            piece.piece_fil_name?.toLowerCase() || 'piece',
            qualite.toLowerCase().replace(/\s+/g, '-'),
            `st${nbStars || 3}ars`,
            marque?.pm_name?.toLowerCase() || 'unknown',
          ].join(' '),

          // URLs
          urls: {
            fiche: `/fiche/${piece.piece_id}/${typeId}`,
            detail: `/piece/${piece.piece_id}/${this.slugify(nomComplet || 'piece')}.html`,
          },
        };
      });

      // 5️⃣ STATISTIQUES ET FILTRES AVANCÉS
      const statistics = this.calculateCatalogStatistics(products);
      const filters = this.generateSmartFilters(products);

      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ [ENHANCED] ${products.length} produits générés avec filtres avancés en ${duration}ms`,
      );

      return {
        success: true,
        catalog: {
          total_products: products.length,
          products: products,
          filters: filters,
          statistics: statistics,
          meta: {
            gamme: piecesData[0]?.piece_fil_name || 'Pièces détachées',
            vehicle_info: {
              type_id: typeId,
              pg_id: pgId,
            },
          },
        },
        performance: {
          duration: `${duration}ms`,
          relations_found: relations.length,
          brands_count: marquesMap.size,
          images_count: imagesMap.size,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ [ENHANCED] Erreur: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        catalog: {
          total_products: 0,
          products: [],
          filters: {},
          statistics: {},
        },
      };
    }
  }

  private calculateCatalogStatistics(products: any[]) {
    const prices = products
      .map((p) => p.prix.total)
      .filter((price) => price > 0);

    const qualityDistribution: any = {};
    const brandsDistribution: any = {};

    products.forEach((product) => {
      // Distribution qualité
      const quality = product.qualite.type;
      qualityDistribution[quality] = (qualityDistribution[quality] || 0) + 1;

      // Distribution marques
      const brand = product.marque.name;
      brandsDistribution[brand] = (brandsDistribution[brand] || 0) + 1;
    });

    return {
      total_count: products.length,
      brands_count: Object.keys(brandsDistribution).length,
      price_range:
        prices.length > 0
          ? {
              min: Math.min(...prices),
              max: Math.max(...prices),
              average: prices.reduce((a, b) => a + b, 0) / prices.length,
            }
          : null,
      quality_distribution: qualityDistribution,
      brands_distribution: brandsDistribution,
    };
  }

  private generateSmartFilters(products: any[]) {
    const filters = {
      qualite: new Set(),
      performance: new Set(),
      equipementiers: new Set(),
    };

    products.forEach((product) => {
      // Filtres qualité
      filters.qualite.add({
        id: product.qualite.type,
        label: product.qualite.label,
        value: product.qualite.type,
      });

      // Filtres performance (étoiles)
      filters.performance.add({
        id: `st${product.qualite.stars}ars`,
        label: product.qualite.stars_display,
        value: `st${product.qualite.stars}ars`,
        stars: product.qualite.stars,
      });

      // Filtres équipementiers
      filters.equipementiers.add({
        id: product.marque.name.toLowerCase(),
        label: product.marque.name,
        value: product.marque.name.toLowerCase(),
        logo: product.marque.logo,
      });
    });

    return {
      qualite: Array.from(filters.qualite),
      performance: Array.from(filters.performance).sort(
        (a: any, b: any) => b.stars - a.stars,
      ),
      equipementiers: Array.from(filters.equipementiers).sort(
        (a: any, b: any) => a.label.localeCompare(b.label),
      ),
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }
}
