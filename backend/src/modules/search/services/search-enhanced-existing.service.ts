import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

/**
 * 🔍 SERVICE DE RECHERCHE ENHANCED - Tables Existantes
 *
 * Utilise UNIQUEMENT les tables existantes de Supabase :
 * ✅ pieces (4M+ enregistrements)
 * ✅ pieces_gamme (9K+ gammes)
 * ✅ pieces_marque (981 marques)
 * ✅ pieces_price (442K+ prix)
 * ✅ pieces_media_img (4.6M+ images)
 * ✅ auto_marque/modele/type (véhicules)
 *
 * Améliore la recherche PHP en ajoutant :
 * - Recherche intelligente par nom/référence
 * - Normalisation des termes
 * - Recherche contextuelle par véhicule
 * - Suggestions automatiques
 */
@Injectable()
export class SearchEnhancedExistingService extends SupabaseBaseService {
  protected readonly logger = new Logger(SearchEnhancedExistingService.name);

  /**
   * 🎯 RECHERCHE PRINCIPALE - Compatible avec logique PHP
   * Utilise pieces_ref_search comme le système PHP original
   */
  async searchPieces(params: {
    query: string;
    vehicleContext?: {
      marqueId?: number;
      modeleId?: number;
      typeId?: number;
    };
    filters?: {
      gammeId?: number;
      marqueId?: number;
      gammeIds?: number[]; // Support multi-valeurs
      marqueIds?: number[]; // Support multi-valeurs
      qualite?: string;
      stars?: number;
    };
    pagination?: {
      page?: number;
      limit?: number;
    };
  }) {
    const startTime = Date.now();
    const { query, vehicleContext, filters, pagination } = params;
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 100; // PHP retourne beaucoup de résultats
    const offset = (page - 1) * limit;

    try {
      this.logger.log(
        `🔍 Recherche Enhanced: "${query}" avec ${JSON.stringify(vehicleContext)}`,
      );

      // 1️⃣ NETTOYAGE ET NORMALISATION de la requête (comme PHP)
      const cleanQuery = this.cleanSearchQuery(query);

      this.logger.log(`📝 Query nettoyée: "${cleanQuery}"`);

      // 2️⃣ STRATÉGIE HYBRIDE: Chercher dans indexation ET directement dans pieces
      // Essayer plusieurs variantes: "kh22", "kh 22", "kh-22"
      const queryVariants = [
        cleanQuery, // "kh22"
        cleanQuery.replace(/([a-z])(\d)/gi, '$1 $2'), // "kh 22"
        cleanQuery.replace(/([a-z])(\d)/gi, '$1-$2'), // "kh-22"
      ];

      const [refSearchResult, refOemResult] = await Promise.all([
        // Recherche par référence équipementier (indexation)
        this.client
          .from(TABLES.pieces_ref_search)
          .select('prs_piece_id, prs_kind, prs_ref')
          .or(queryVariants.map((v) => `prs_search.eq.${v}`).join(',')),
        // Recherche par référence OEM constructeur (indexation)
        this.client
          .from(TABLES.pieces_ref_oem)
          .select('pro_piece_id, pro_oem')
          .or(queryVariants.map((v) => `pro_oem_serach.eq.${v}`).join(',')),
        // Recherche DIRECTE dans pieces (fallback automatique)
        this.client
          .from(TABLES.pieces)
          .select('piece_id, piece_ref, piece_pg_id, piece_pm_id')
          .or(queryVariants.map((v) => `piece_ref.ilike.%${v}%`).join(','))
          .limit(100),
      ]);

      // Combiner les résultats des deux tables + capturer prs_kind pour tri
      const allPieceIds = new Set<number>();
      const pieceRelevanceMap = new Map<number, number>(); // piece_id -> prs_kind (score)

      if (refSearchResult.data) {
        refSearchResult.data.forEach((r) => {
          const id = parseInt(r.prs_piece_id);
          if (!isNaN(id)) {
            allPieceIds.add(id);
            // prs_kind: 0=match exact, 1=match partiel, etc. (plus bas = plus pertinent)
            const currentScore = pieceRelevanceMap.get(id);
            const newScore = parseInt(r.prs_kind) || 99;
            // Garder le meilleur score (le plus bas)
            if (!currentScore || newScore < currentScore) {
              pieceRelevanceMap.set(id, newScore);
            }
          }
        });
        this.logger.log(
          `✅ ${refSearchResult.data.length} résultats dans pieces_ref_search`,
        );
      }

      if (refOemResult.data) {
        refOemResult.data.forEach((r) => {
          const id = parseInt(r.pro_piece_id);
          if (!isNaN(id)) {
            allPieceIds.add(id);
            // Les OEM ont un score de 50 (moins prioritaires que les refs exactes)
            if (!pieceRelevanceMap.has(id)) {
              pieceRelevanceMap.set(id, 50);
            }
          }
        });
        this.logger.log(
          `✅ ${refOemResult.data.length} résultats dans pieces_ref_oem`,
        );
      }

      if (allPieceIds.size === 0) {
        this.logger.log(
          `⚠️ Aucun résultat dans les tables d'indexation pour "${cleanQuery}"`,
        );
        this.logger.log(
          `🔄 Fallback: Recherche directe dans pieces.piece_ref...`,
        );

        // 🔄 FALLBACK: Recherche directe dans la table pieces si indexation vide
        // Simplifiée: sans jointures pour éviter les erreurs de schéma
        const fallbackQuery = this.client
          .from(TABLES.pieces)
          .select('piece_id, piece_ref, piece_pg_id, piece_pm_id, piece_code')
          .or(queryVariants.map((v) => `piece_ref.ilike.%${v}%`).join(','))
          .limit(100);

        const { data: fallbackPieces, error: fallbackError } =
          await fallbackQuery;

        if (fallbackError) {
          this.logger.error(`❌ Erreur fallback: ${fallbackError.message}`);
          return {
            success: true,
            data: {
              items: [],
              total: 0,
              page,
              limit,
              executionTime: Date.now() - startTime,
              features: ['search-fallback-error'],
              facets: [],
            },
          };
        }

        if (!fallbackPieces || fallbackPieces.length === 0) {
          this.logger.log(`❌ Aucun résultat même en fallback`);
          return {
            success: true,
            data: {
              items: [],
              total: 0,
              page,
              limit,
              executionTime: Date.now() - startTime,
              features: ['search-ref-tables', 'search-fallback', 'no-results'],
              facets: [],
            },
          };
        }

        this.logger.log(
          `✅ Fallback: ${fallbackPieces.length} résultats trouvés dans pieces`,
        );

        // Charger les marques et gammes pour enrichir les résultats
        const marqueIds = [
          ...new Set(
            fallbackPieces
              .map((p: any) => p.piece_pm_id)
              .filter((id: any) => id),
          ),
        ];
        const gammeIds = [
          ...new Set(
            fallbackPieces
              .map((p: any) => p.piece_pg_id)
              .filter((id: any) => id),
          ),
        ];

        const [marquesResult, gammesResult] = await Promise.all([
          marqueIds.length > 0
            ? this.client
                .from(TABLES.pieces_marque)
                .select('pm_id, pm_name')
                .in('pm_id', marqueIds)
            : Promise.resolve({ data: [] }),
          gammeIds.length > 0
            ? this.client
                .from(TABLES.pieces_gamme)
                .select('pg_id, pg_name')
                .in('pg_id', gammeIds)
            : Promise.resolve({ data: [] }),
        ]);

        const marqueMap = new Map(
          (marquesResult.data || []).map((m: any) => [m.pm_id, m.pm_name]),
        );
        const gammeMap = new Map(
          (gammesResult.data || []).map((g: any) => [g.pg_id, g.pg_name]),
        );

        // Formater les résultats du fallback
        const formattedItems = fallbackPieces.map((piece: any) => {
          return {
            id: piece.piece_id?.toString() || '',
            reference: piece.piece_ref || piece.piece_code || '',
            brand: marqueMap.get(piece.piece_pm_id) || '',
            brandId: piece.piece_pm_id,
            category: gammeMap.get(piece.piece_pg_id) || '',
            categoryId: piece.piece_pg_id,
            _score: 99, // Score fallback (moins pertinent)
          };
        });

        const facets = this.generateFacetsFromResults(formattedItems);

        return {
          success: true,
          data: {
            items: formattedItems.slice(offset, offset + limit),
            total: formattedItems.length,
            page,
            limit,
            pages: Math.ceil(formattedItems.length / limit),
            executionTime: Date.now() - startTime,
            features: ['search-fallback', 'direct-piece-ref'],
            facets,
          },
        };
      }

      // 3️⃣ EXTRACTION des piece_ids trouvés (COMBINÉS)
      const foundPieceIds = Array.from(allPieceIds);

      this.logger.log(
        `✅ ${foundPieceIds.length} pièces uniques trouvées (ref + oem)`,
      );

      // 4️⃣ RÉCUPÉRATION des pièces complètes
      let piecesQuery = this.client
        .from(TABLES.pieces)
        .select(
          `
          piece_id,
          piece_ref,
          piece_name,
          piece_name_comp,
          piece_name_side,
          piece_has_img,
          piece_has_oem,
          piece_qty_sale,
          piece_display,
          piece_pg_id,
          piece_pm_id
        `,
        )
        .in('piece_id', foundPieceIds)
        .eq('piece_display', 1);

      // 5️⃣ FILTRES CONTEXTUELS - Support mono et multi-valeurs
      // Filtres par gamme (catégorie)
      const gammeFilter =
        filters?.gammeIds || (filters?.gammeId ? [filters.gammeId] : null);
      if (gammeFilter && gammeFilter.length > 0) {
        if (gammeFilter.length === 1) {
          piecesQuery = piecesQuery.eq('piece_pg_id', gammeFilter[0]);
        } else {
          piecesQuery = piecesQuery.in('piece_pg_id', gammeFilter);
        }
      }

      // Filtres par marque
      const marqueFilter =
        filters?.marqueIds || (filters?.marqueId ? [filters.marqueId] : null);
      if (marqueFilter && marqueFilter.length > 0) {
        if (marqueFilter.length === 1) {
          piecesQuery = piecesQuery.eq('piece_pm_id', marqueFilter[0]);
        } else {
          piecesQuery = piecesQuery.in('piece_pm_id', marqueFilter);
        }
      }

      // 6️⃣ PAS DE LIMITATION ICI - on va trier par pertinence après
      // On récupère toutes les pièces trouvées pour les trier ensuite
      piecesQuery = piecesQuery;

      const { data: pieces, error: piecesError } = await piecesQuery;

      if (piecesError) {
        throw new DatabaseException({
          code: ErrorCodes.SEARCH.QUERY_FAILED,
          message: `Erreur requête pièces: ${piecesError.message}`,
          details: piecesError.message,
          cause: piecesError instanceof Error ? piecesError : undefined,
        });
      }

      if (!pieces?.length) {
        return {
          success: true,
          data: {
            items: [],
            total: 0,
            page,
            limit,
            executionTime: Date.now() - startTime,
            features: ['search-existing-tables'],
          },
        };
      }

      // 6️⃣ ENRICHISSEMENT des données (prix, images, marques, gammes)
      const pieceIds = pieces.map((p) => p.piece_id);
      const marqueIds = [
        ...new Set(pieces.map((p) => p.piece_pm_id).filter(Boolean)),
      ];
      const gammeIds = [
        ...new Set(pieces.map((p) => p.piece_pg_id).filter(Boolean)),
      ];

      const [pricesResult, imagesResult, marquesResult, gammesResult] =
        await Promise.all([
          // Prix des pièces
          this.client
            .from(TABLES.pieces_price)
            .select('*')
            .in('pri_piece_id', pieceIds)
            .eq('pri_dispo', '1')
            .order('pri_type', { ascending: false }),

          // Images des pièces
          this.client
            .from(TABLES.pieces_media_img)
            .select('pmi_piece_id, pmi_folder, pmi_name')
            .in('pmi_piece_id', pieceIds)
            .eq('pmi_display', 1)
            .limit(pieceIds.length),

          // Marques/équipementiers
          this.client
            .from(TABLES.pieces_marque)
            .select('*')
            .in('pm_id', marqueIds)
            .eq('pm_display', 1),

          // Gammes (jointure manuelle)
          this.client
            .from(TABLES.pieces_gamme)
            .select('pg_id, pg_name, pg_alias')
            .in('pg_id', gammeIds)
            .eq('pg_display', 1),
        ]);

      // 7️⃣ ASSEMBLAGE des résultats (logique PHP)
      const prices = pricesResult.data || [];
      const images = imagesResult.data || [];
      const marques = marquesResult.data || [];
      const gammes = gammesResult.data || [];

      // Index pour performance
      const pricesByPiece = new Map();
      prices.forEach((price) => {
        if (!pricesByPiece.has(price.pri_piece_id)) {
          pricesByPiece.set(price.pri_piece_id, []);
        }
        pricesByPiece.get(price.pri_piece_id).push(price);
      });

      const imagesByPiece = new Map();
      images.forEach((img) => {
        imagesByPiece.set(
          img.pmi_piece_id,
          `rack/${img.pmi_folder}/${img.pmi_name}`,
        );
      });

      const marquesById = new Map<number, any>();
      marques.forEach((marque) => {
        const id = parseInt(marque.pm_id, 10);
        if (!isNaN(id)) {
          marquesById.set(id, marque);
        }
      });

      const gammesById = new Map<number, any>();
      gammes.forEach((gamme) => {
        const id = parseInt(gamme.pg_id, 10);
        if (!isNaN(id)) {
          gammesById.set(id, gamme);
        }
      });

      // 8️⃣ FORMATAGE final des résultats
      const formattedPieces = pieces.map((piece) => {
        const piecePrices = pricesByPiece.get(piece.piece_id) || [];
        const mainPrice = piecePrices[0]; // Premier prix (plus prioritaire)
        const marque = marquesById.get(piece.piece_pm_id);
        const gamme = gammesById.get(piece.piece_pg_id);
        const imageUrl =
          imagesByPiece.get(piece.piece_id) || 'upload/articles/no.png';

        // Calcul du prix total (logique PHP)
        const prixVenteTTC = mainPrice
          ? parseFloat(mainPrice.pri_vente_ttc) * piece.piece_qty_sale
          : 0;
        const prixConsigneTTC = mainPrice
          ? parseFloat(mainPrice.pri_consigne_ttc) * piece.piece_qty_sale
          : 0;

        // Détermination de la qualité (logique PHP)
        let qualite = 'OES';
        if (marque?.pm_oes === 'A') qualite = 'AFTERMARKET';
        if (prixConsigneTTC > 0) qualite = 'Echange Standard';

        return {
          id: piece.piece_id, // Frontend s'attend à 'id'
          piece_id: piece.piece_id,
          title:
            `${piece.piece_name} ${piece.piece_name_side || ''} ${piece.piece_name_comp || ''}`.trim(), // Frontend s'attend à 'title'
          name: `${piece.piece_name} ${piece.piece_name_side || ''} ${piece.piece_name_comp || ''}`.trim(),
          description:
            `${piece.piece_name} ${piece.piece_name_side || ''} ${piece.piece_name_comp || ''}`.trim(), // Frontend s'attend à 'description'
          reference: piece.piece_ref,
          brand: marque ? marque.pm_name : '',
          brandId: piece.piece_pm_id, // ID de la marque pour filtrage
          category: gamme ? gamme.pg_name : '',
          categoryId: piece.piece_pg_id, // ID de la gamme pour filtrage
          qualite,
          stars: 0,
          price: prixVenteTTC, // Prix simple pour compatibilité
          prices: {
            // Prix détaillés
            vente_ttc: prixVenteTTC,
            consigne_ttc: prixConsigneTTC,
            total_ttc: prixVenteTTC + prixConsigneTTC,
            formatted: this.formatPrice(prixVenteTTC),
          },
          image: imageUrl,
          hasImage: !!imagesByPiece.get(piece.piece_id),
          hasOEM: !!piece.piece_has_oem,
          inStock: true, // Frontend s'attend à 'inStock'
          quantity: piece.piece_qty_sale || 1,
          searchTerms: [cleanQuery],
          _score: pieceRelevanceMap.get(piece.piece_id) || 99, // Score de pertinence réel
          _relevance: pieceRelevanceMap.get(piece.piece_id) || 99,
        };
      });

      // 9️⃣ TRI par pertinence (score le plus BAS = plus pertinent)
      // prs_kind: 0=exact match, 1=match proche, etc.
      formattedPieces.sort((a, b) => {
        const scoreDiff = a._score - b._score;
        if (scoreDiff !== 0) return scoreDiff;
        // Si même score, trier par nom
        return a.name.localeCompare(b.name);
      });

      // 🔟 PAGINATION après tri
      const totalResults = formattedPieces.length;
      const paginatedPieces = formattedPieces.slice(offset, offset + limit);

      this.logger.log(
        `📊 Tri: ${totalResults} résultats, page ${page}/${Math.ceil(totalResults / limit)}, showing ${paginatedPieces.length}`,
      );

      // 🔟 GÉNÉRATION DYNAMIQUE des facets à partir des résultats
      const facets = this.generateFacetsFromResults(formattedPieces);

      const executionTime = Date.now() - startTime;

      this.logger.log(
        `✅ Recherche complétée: ${formattedPieces.length} résultats en ${executionTime}ms`,
      );

      return {
        success: true,
        data: {
          items: paginatedPieces,
          total: totalResults,
          page,
          limit,
          pages: Math.ceil(totalResults / limit),
          executionTime,
          features: [
            'search-existing-tables',
            'price-calculation',
            'image-resolution',
            'relevance-scoring',
            'dynamic-facets',
            'pagination',
          ],
          facets,
          debug: {
            cleanQuery,
            searchTerms: [cleanQuery],
            tablesUsed: [
              'pieces_ref_search',
              'pieces_ref_oem',
              'pieces',
              'pieces_gamme',
              'pieces_price',
              'pieces_media_img',
              'pieces_marque',
            ],
          },
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche Enhanced:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 🔄 RECHERCHE FALLBACK - Si pieces_ref_search échoue
   * Retourne un résultat vide pour éviter une erreur complète
   */
  private async fallbackDirectSearch(
    cleanQuery: string,
    filters?: any,
    pagination?: any,
  ) {
    this.logger.warn(`⚠️ Utilisation du fallback pour "${cleanQuery}"`);
    return {
      success: true,
      data: {
        items: [],
        total: 0,
        page: pagination?.page || 1,
        limit: pagination?.limit || 100,
        executionTime: 0,
        features: ['fallback-search', 'no-results'],
        facets: [],
      },
    };
  }

  /**
   * 🧹 NETTOYAGE de la requête de recherche
   */
  private cleanSearchQuery(query: string): string {
    if (!query) return '';

    return query
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\s\-\.]/g, '') // Garder accents, points et tirets
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 🎯 GÉNÉRATION des termes de recherche
   */
  private generateSearchTerms(cleanQuery: string): string[] {
    if (!cleanQuery) return [];

    // Détection plus précise des références - doit avoir beaucoup de chiffres et peu de mots
    const hasDigits = /[0-9]/.test(cleanQuery);
    const hasSpecialChars = /[.-]/.test(cleanQuery);
    const wordCount = cleanQuery.split(' ').length;
    const digitRatio =
      (cleanQuery.match(/[0-9]/g) || []).length / cleanQuery.length;

    // C'est une référence si : beaucoup de chiffres, caractères spéciaux, et peu de mots
    const isReferencePattern =
      hasDigits && hasSpecialChars && wordCount <= 2 && digitRatio > 0.3;

    if (isReferencePattern) {
      // Pour les références, garder la query entière ET les fragments
      const terms = [cleanQuery]; // Référence complète
      const fragments = cleanQuery
        .split(/[\s.-]+/)
        .filter((term) => term.length >= 2);
      terms.push(...fragments);
      return [...new Set(terms)];
    }

    // Pour le texte normal, diviser en mots
    const terms = cleanQuery.split(' ').filter((term) => term.length >= 2);

    // Ajouter des variantes pour les recherches courantes
    const expandedTerms = [...terms];

    // Expansions courantes
    terms.forEach((term) => {
      if (term === 'filtre') expandedTerms.push('filter');
      if (term === 'huile') expandedTerms.push('oil');
      if (term === 'frein') expandedTerms.push('brake');
      if (term === 'amortisseur') expandedTerms.push('shock');
    });

    return [...new Set(expandedTerms)];
  }

  /**
   * 📊 CALCUL du score de pertinence
   */
  private calculateRelevanceScore(piece: any, searchTerms: string[]): number {
    let score = 0;
    const pieceName = piece.piece_name?.toLowerCase() || '';
    const pieceRef = piece.piece_ref?.toLowerCase() || '';

    searchTerms.forEach((term) => {
      // Score pour correspondance exacte dans le nom
      if (pieceName.includes(term)) score += 10;

      // Score pour correspondance dans la référence
      if (pieceRef.includes(term)) score += 15;

      // Score pour correspondance au début
      if (pieceName.startsWith(term)) score += 5;
    });

    return score;
  }

  /**
   * 💰 FORMATAGE du prix
   */
  private formatPrice(price: number): string {
    const euros = Math.floor(price);
    const centimes = Math.round((price - euros) * 100);
    return `${euros}.${centimes.toString().padStart(2, '0')} €`;
  }

  /**
   * 🎯 SUGGESTIONS automatiques (autocomplete)
   */
  async getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
    try {
      const cleanQuery = this.cleanSearchQuery(query);
      if (cleanQuery.length < 2) return [];

      // Recherche dans les noms de pièces les plus courants
      const { data: suggestions, error } = await this.client
        .from(TABLES.pieces)
        .select('piece_name')
        .ilike('piece_name', `%${cleanQuery}%`)
        .eq('piece_display', 1)
        .limit(limit * 2);

      if (error || !suggestions) return [];

      // Extraire les termes uniques
      const uniqueSuggestions = new Set<string>();

      suggestions.forEach((item) => {
        const name = item.piece_name?.toLowerCase() || '';
        const words = name.split(' ');

        words.forEach((word) => {
          if (word.includes(cleanQuery) && word.length >= cleanQuery.length) {
            uniqueSuggestions.add(word);
          }
        });
      });

      return Array.from(uniqueSuggestions)
        .slice(0, limit)
        .sort((a, b) => a.length - b.length); // Plus courts en premier
    } catch (error) {
      this.logger.error('❌ Erreur suggestions:', error);
      return [];
    }
  }

  /**
   * 🚗 RECHERCHE CONTEXTUELLE par véhicule
   * Améliore la recherche en utilisant les données véhicule
   */
  async searchPiecesByVehicle(params: {
    query: string;
    marqueId: number;
    modeleId?: number;
    typeId?: number;
    gammeId?: number;
    limit?: number;
  }) {
    const { query, marqueId, modeleId, typeId, gammeId, limit = 20 } = params;

    try {
      this.logger.log(
        `🚗 Recherche par véhicule: ${query} pour marque ${marqueId}`,
      );

      // 1️⃣ Récupérer les infos du véhicule pour contexte
      const vehicleContext = await this.getVehicleContext(
        marqueId,
        modeleId,
        typeId,
      );

      // 2️⃣ Recherche principale avec contexte véhicule
      const searchResult = await this.searchPieces({
        query,
        vehicleContext: { marqueId, modeleId, typeId },
        filters: { gammeId },
        pagination: { limit },
      });

      // 3️⃣ Enrichir avec infos véhicule (désactivé pour l'instant)
      if (searchResult.success && vehicleContext) {
        // Note: vehicleContext pourrait être ajouté plus tard si nécessaire
        searchResult.data.features.push('vehicle-context');
      }

      return searchResult;
    } catch (error) {
      this.logger.error('❌ Erreur recherche par véhicule:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Erreur recherche véhicule',
      };
    }
  }

  /**
   * 🚗 RÉCUPÉRATION du contexte véhicule
   */
  private async getVehicleContext(
    marqueId: number,
    modeleId?: number,
    typeId?: number,
  ) {
    try {
      const queries = [
        this.client
          .from(TABLES.auto_marque)
          .select('marque_id, marque_name')
          .eq('marque_id', marqueId)
          .single(),
      ];

      if (modeleId) {
        queries.push(
          this.client
            .from(TABLES.auto_modele)
            .select('modele_id, modele_name')
            .eq('modele_id', modeleId)
            .single(),
        );
      }

      if (typeId) {
        queries.push(
          this.client
            .from(TABLES.auto_type)
            .select('type_id, type_name, type_fuel')
            .eq('type_id', typeId)
            .single(),
        );
      }

      const results = await Promise.all(queries);
      const [marqueResult, modeleResult, typeResult] = results;

      return {
        marque: marqueResult.data,
        modele: modeleResult?.data,
        type: typeResult?.data,
      };
    } catch (error) {
      this.logger.warn('⚠️ Erreur récupération contexte véhicule:', error);
      return null;
    }
  }

  /**
   * 🏷️ GÉNÉRATION DYNAMIQUE des facets à partir des résultats
   * Regroupe les résultats par marque, gamme et prix pour créer les filtres
   */
  private generateFacetsFromResults(items: any[]): any[] {
    const facets = [];

    // 1️⃣ Facet MARQUE (Equipementier) - Utiliser IDs pour le filtrage
    const marqueMap = new Map<number, { label: string; count: number }>();
    items.forEach((item) => {
      if (item.brandId && item.brand && item.brand.trim()) {
        const brandId = item.brandId;
        const existing = marqueMap.get(brandId);
        if (existing) {
          existing.count++;
        } else {
          marqueMap.set(brandId, { label: item.brand.trim(), count: 1 });
        }
      }
    });

    if (marqueMap.size > 0) {
      const marqueValues = Array.from(marqueMap.entries())
        .map(([id, data]) => ({
          value: id.toString(), // ID numérique converti en string
          label: data.label,
          count: data.count,
        }))
        .sort((a, b) => b.count - a.count); // Trier par popularité

      facets.push({
        field: 'marque',
        label: 'Marque',
        values: marqueValues,
      });
    }

    // 2️⃣ Facet GAMME (Catégorie) - Utiliser IDs pour le filtrage
    const gammeMap = new Map<number, { label: string; count: number }>();
    items.forEach((item) => {
      if (item.categoryId && item.category && item.category.trim()) {
        const categoryId = item.categoryId;
        const existing = gammeMap.get(categoryId);
        if (existing) {
          existing.count++;
        } else {
          gammeMap.set(categoryId, { label: item.category.trim(), count: 1 });
        }
      }
    });

    if (gammeMap.size > 0) {
      const gammeValues = Array.from(gammeMap.entries())
        .map(([id, data]) => ({
          value: id.toString(), // ID numérique converti en string
          label: data.label,
          count: data.count,
        }))
        .sort((a, b) => b.count - a.count); // Trier par popularité

      facets.push({
        field: 'gamme',
        label: 'Gamme',
        values: gammeValues,
      });
    }

    // 3️⃣ Facet PRIX (Tranches)
    const prices = items
      .map((item) => item.price || 0)
      .filter((price) => price > 0);

    if (prices.length > 0) {
      // Créer des tranches de prix
      const ranges = [
        { min: 0, max: 50, label: 'Moins de 50€' },
        { min: 50, max: 100, label: '50€ - 100€' },
        { min: 100, max: 200, label: '100€ - 200€' },
        { min: 200, max: 500, label: '200€ - 500€' },
        { min: 500, max: 999999, label: 'Plus de 500€' },
      ];

      const priceValues = ranges
        .map((range) => {
          const count = prices.filter(
            (p) => p >= range.min && p < range.max,
          ).length;
          return {
            value: `${range.min}-${range.max}`,
            label: range.label,
            count,
          };
        })
        .filter((r) => r.count > 0);

      if (priceValues.length > 0) {
        facets.push({
          field: 'price_range',
          label: 'Prix',
          values: priceValues,
        });
      }
    }

    return facets;
  }
}
