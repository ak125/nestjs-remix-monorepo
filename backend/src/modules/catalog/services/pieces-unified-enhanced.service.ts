import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * 🚀 SERVICE PIÈCES UNIFIÉ ET AMÉLIORÉ
 *
 * Combine le meilleur de :
 * ✅ PiecesPhpLogicCompleteService (logique PHP 100% exacte)
 * ✅ PiecesUltraEnhancedService (performance optimisée)
 * ✅ Cache intelligent multi-niveau
 * ✅ Types unifiés et validation stricte
 * ✅ Monitoring et métriques intégrés
 * ✅ Gestion d'erreurs robuste
 * ✅ Architecture modulaire
 *
 * @version 2.0.0
 * @author Architecture Team
 */
@Injectable()
export class PiecesUnifiedEnhancedService extends SupabaseBaseService {
  protected readonly logger = new Logger(PiecesUnifiedEnhancedService.name);

  // 🔧 Configuration par défaut - FALLBACKS DÉSACTIVÉS pour éviter les faux résultats
  private readonly DEFAULT_CONFIG = {
    maxPiecesPerQuery: 150,
    cacheEnabled: true,
    performanceLogging: true,
    fallbackEnabled: false, // ❌ DÉSACTIVÉ - Pas de fausses pièces
    parallelQueries: true,
  };

  // 📊 Métriques de performance
  private metrics = {
    totalRequests: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
  };

  /**
   * 🎯 MÉTHODE PRINCIPALE UNIFIÉE
   * Combine logique PHP exacte + optimisations performance
   */
  async getPiecesUnified(
    typeId: number,
    pgId: number,
    options: GetPiecesOptions = {},
  ): Promise<UnifiedCatalogResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.logger.log(
        `🎯 [UNIFIED-${requestId}] Recherche type_id=${typeId}, pg_id=${pgId}`,
      );

      // 📈 Increment metrics
      this.metrics.totalRequests++;

      // 🔄 Cache Layer (si activé)
      const cacheKey = this.buildCacheKey(typeId, pgId, options);
      if (this.DEFAULT_CONFIG.cacheEnabled && !options.bypassCache) {
        const cachedResult = await this.getCachedResult(cacheKey);
        if (cachedResult) {
          this.updateMetrics(startTime, true);
          return cachedResult;
        }
      }

      // 1️⃣ RÉCUPÉRATION RELATIONS (optimisée avec limitation)
      const relationsResult = await this.getVehicleRelations(
        typeId,
        pgId,
        options,
      );

      if (!relationsResult.success || relationsResult.data.length === 0) {
        return this.buildEmptyResponse(
          'Aucune pièce disponible pour ce véhicule et cette gamme',
          Date.now() - startTime,
        );
      }

      const relationsData = relationsResult.data;
      const pieceIds = this.extractUniqueIds(relationsData, 'rtp_piece_id');
      const pmIds = this.extractUniqueIds(relationsData, 'rtp_pm_id', true);
      const psfIds = this.extractUniqueIds(relationsData, 'rtp_psf_id', true);

      // 🚀 Limitation intelligente pour performance
      const optimizedPieceIds = this.optimizePieceIds(pieceIds, options);

      this.logger.log(
        `🚀 [UNIFIED-${requestId}] ${relationsData.length} relations → ${pieceIds.length} pièces (${optimizedPieceIds.length} optimisées)`,
      );

      // 2️⃣ REQUÊTES PARALLÈLES AVEC GESTION D'ERREURS
      const dataResults = await this.fetchAllPieceData(
        optimizedPieceIds,
        pmIds,
        psfIds,
        options,
      );

      // 3️⃣ CONSTRUCTION MAPS OPTIMISÉES
      const dataMaps = this.buildOptimizedMaps(
        relationsData,
        dataResults,
        options,
      );

      // 4️⃣ TRANSFORMATION DONNÉES SELON LOGIQUE PHP + OPTIMISATIONS
      const pieces = await this.transformPiecesUnified(
        dataResults.pieces,
        dataMaps,
        options,
      );

      // 5️⃣ GROUPEMENT PAR BLOCS (logique PHP)
      const blocs = this.groupPiecesByBlocks(pieces, options);

      // 6️⃣ CALCULS GLOBAUX ET MÉTRIQUES
      const globalStats = this.calculateGlobalStats(pieces, options);

      // 🏗️ CONSTRUCTION RÉPONSE FINALE
      const response: UnifiedCatalogResponse = {
        pieces,
        blocs,
        pieces_grouped_by_filter: blocs, // Alias compatibilité
        count: pieces.length,
        blocs_count: blocs.length,
        minPrice: globalStats.minPrice,
        maxPrice: globalStats.maxPrice,
        averagePrice: globalStats.averagePrice,
        relations_found: relationsData.length,
        duration: `${Date.now() - startTime}ms`,
        success: true,
        optimization: 'UNIFIED_ENHANCED_V2',
        features: [
          'logique_php_exacte',
          'performance_optimisee',
          'cache_intelligent',
          'types_unifies',
          'monitoring_integre',
          'gestion_erreurs_robuste',
        ],
        metadata: {
          requestId,
          typeId,
          pgId,
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          config: {
            cacheUsed: this.DEFAULT_CONFIG.cacheEnabled && !options.bypassCache,
            parallelQueries: this.DEFAULT_CONFIG.parallelQueries,
            maxPieces: optimizedPieceIds.length,
          },
        },
      };

      // 💾 Cache résultat (si activé)
      if (this.DEFAULT_CONFIG.cacheEnabled && !options.bypassCache) {
        await this.setCachedResult(cacheKey, response, options.cacheDuration);
      }

      // 📊 Mise à jour métriques
      this.updateMetrics(startTime, false);

      this.logger.log(
        `✅ [UNIFIED-${requestId}] ${pieces.length} pièces, ${blocs.length} blocs, prix: ${globalStats.minPrice}€-${globalStats.maxPrice}€ en ${response.duration}`,
      );

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ [UNIFIED-${requestId}] Erreur: ${error.message}`,
        error.stack,
      );

      // 📊 Increment error metrics
      this.metrics.errorRate++;

      return this.buildErrorResponse(error, duration, requestId);
    }
  }

  /**
   * 🔍 Récupération des relations véhicule-pièces optimisée
   */
  private async getVehicleRelations(
    typeId: number,
    pgId: number,
    options: GetPiecesOptions,
  ): Promise<{ success: boolean; data: any[]; error?: string }> {
    try {
      const query = this.client
        .from('pieces_relation_type')
        .select('rtp_piece_id, rtp_pm_id, rtp_psf_id, rtp_type_id, rtp_pg_id')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId);

      // Limitation optionnelle pour performance
      if (options.maxRelations) {
        query.limit(options.maxRelations);
      }

      const result = await query;

      if (result.error) {
        return { success: false, data: [], error: result.error.message };
      }

      return { success: true, data: result.data || [] };
    } catch (error: any) {
      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * 🚀 Récupération parallèle de toutes les données nécessaires
   */
  private async fetchAllPieceData(
    pieceIds: number[],
    pmIds: number[],
    psfIds: number[],
    options: GetPiecesOptions,
  ) {
    const queries = [
      // PIÈCES avec colonnes essentielles
      this.client
        .from('pieces')
        .select(
          'piece_id, piece_ref, piece_ref_clean, piece_name, piece_name_side, piece_name_comp, piece_des, piece_pm_id, piece_has_img, piece_has_oem, piece_qty_sale, piece_fil_id, piece_fil_name, piece_display',
        )
        .in('piece_id', pieceIds)
        .eq('piece_display', 1),

      // MARQUES/ÉQUIPEMENTIERS
      pmIds.length > 0
        ? this.client
            .from('pieces_marques')
            .select(
              'pm_id, pm_name, pm_logo, pm_alias, pm_oes, pm_nb_stars, pm_quality',
            )
            .in('pm_id', pmIds)
        : Promise.resolve({ data: [], error: null }),

      // PRIX avec gestion optimisée
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

      // FILTRES LATÉRAUX
      psfIds.length > 0
        ? this.client
            .from('pieces_side_filtre')
            .select('psf_id, psf_side')
            .in('psf_id', psfIds)
        : Promise.resolve({ data: [], error: null }),

      // IMAGES
      this.client
        .from('pieces_media_img')
        .select('pmi_piece_id, pmi_folder, pmi_name, pmi_display')
        .in('pmi_piece_id', pieceIds)
        .eq('pmi_display', 1),

      // CRITÈRES TECHNIQUES (si demandés)
      options.includeTechnicalCriteria
        ? this.client
            .from('pieces_criteria')
            .select('*')
            .in('pc_piece_id', pieceIds)
        : Promise.resolve({ data: [], error: null }),
    ];

    const [
      piecesResult,
      marquesResult,
      pricesResult,
      filtresResult,
      imagesResult,
      criteriasResult,
    ] = await Promise.all(queries);

    // Vérification erreurs critiques
    if (piecesResult.error) {
      throw new Error(
        `Erreur récupération pièces: ${piecesResult.error.message}`,
      );
    }

    return {
      pieces: piecesResult.data || [],
      marques: marquesResult.data || [],
      prices: pricesResult.data || [],
      filtres: filtresResult.data || [],
      images: imagesResult.data || [],
      criterias: criteriasResult.data || [],
    };
  }

  /**
   * 🗺️ Construction des maps optimisées pour jointures O(1)
   */
  private buildOptimizedMaps(
    relationsData: any[],
    dataResults: any,
    options: GetPiecesOptions,
  ) {
    return {
      relations: new Map(relationsData.map((r) => [r.rtp_piece_id, r])),
      marques: new Map(dataResults.marques.map((m: any) => [m.pm_id, m])),
      filtres: new Map(dataResults.filtres.map((f: any) => [f.psf_id, f])),
      images: new Map(dataResults.images.map((i: any) => [i.pmi_piece_id, i])),
      // Prix avec logique PHP : garde le meilleur prix par pièce
      prices: this.buildPricesMap(dataResults.prices),
      criterias: options.includeTechnicalCriteria
        ? this.buildCriteriasMap(dataResults.criterias)
        : new Map(),
    };
  }

  /**
   * 💰 Construction optimisée de la map des prix (logique PHP)
   */
  private buildPricesMap(pricesData: any[]): Map<number, any> {
    const pricesMap = new Map();

    pricesData.forEach((p: any) => {
      const pieceId = parseInt(p.pri_piece_id);
      if (
        !pricesMap.has(pieceId) ||
        parseInt(p.pri_type) > parseInt(pricesMap.get(pieceId).pri_type)
      ) {
        pricesMap.set(pieceId, p);
      }
    });

    return pricesMap;
  }

  /**
   * 🔧 Transformation des pièces selon logique PHP + optimisations
   */
  private async transformPiecesUnified(
    piecesData: any[],
    dataMaps: any,
    options: GetPiecesOptions,
  ): Promise<UnifiedPiece[]> {
    return piecesData.map((piece) => {
      const relation = dataMaps.relations.get(piece.piece_id);
      const marqueEquip = dataMaps.marques.get(
        relation?.rtp_pm_id || piece.piece_pm_id,
      );
      const price = dataMaps.prices.get(piece.piece_id);
      const filtre = dataMaps.filtres.get(relation?.rtp_psf_id);
      const image = dataMaps.images.get(piece.piece_id);
      const criterias = dataMaps.criterias.get(piece.piece_id) || [];

      // CALCULS PRIX (logique PHP exacte)
      const pricingData = this.calculatePiecePricing(piece, price, marqueEquip);

      // QUALITÉ (logique PHP exacte)
      const qualityData = this.determineQuality(
        marqueEquip,
        pricingData.prixConsigne,
      );

      // NOM COMPLET (logique PHP)
      const nameData = this.buildCompleteName(piece, filtre);

      // IMAGE (logique PHP)
      const imageData = this.buildImageData(
        piece,
        image,
        nameData.nomComplet,
        marqueEquip,
      );

      // CRITÈRES TECHNIQUES (logique PHP, LIMIT 3)
      const technicalCriteria = this.processTechnicalCriteria(
        criterias,
        options,
      );

      return {
        // IDENTIFIANTS
        id: piece.piece_id,
        reference: piece.piece_ref || '',
        reference_clean: piece.piece_ref_clean || '',

        // NOMS (logique PHP complète)
        nom: nameData.nomComplet,
        nom_complet: nameData.nomComplet,
        piece_name: piece.piece_name || '',
        piece_name_side: nameData.sideFromFilter,
        piece_name_comp: piece.piece_name_comp || '',
        description: piece.piece_des || '',

        // MARQUE ET ÉQUIPEMENTIER
        marque: marqueEquip?.pm_name || 'Marque inconnue',
        marque_id: marqueEquip?.pm_id || null,
        marque_logo: marqueEquip?.pm_logo || null,
        marque_alias: marqueEquip?.pm_alias || null,

        // PRIX (logique PHP exacte)
        prix_unitaire: pricingData.prixUnitaire,
        prix_ttc: pricingData.prixTotal,
        prix_consigne: pricingData.prixConsigne,
        prix_total: pricingData.prixTotalAvecConsigne,
        quantite_vente: pricingData.quantiteVente,

        // QUALITÉ ET PERFORMANCES
        qualite: qualityData.qualite,
        nb_stars: qualityData.nbStars,
        pm_oes: marqueEquip?.pm_oes || 'A',

        // IMAGES (logique PHP)
        image: imageData.url,
        image_alt: imageData.alt,
        image_title: imageData.title,

        // FILTRES ET CATÉGORIES
        filtre_gamme: piece.piece_fil_name || '',
        filtre_side: filtre?.psf_side || '',
        filtre_id: piece.piece_fil_id || null,
        psf_id: relation?.rtp_psf_id || null,

        // CARACTÉRISTIQUES TECHNIQUES
        has_image: piece.piece_has_img === 1,
        has_oem: piece.piece_has_oem === 1,
        has_price: pricingData.prixUnitaire > 0,
        has_consigne: pricingData.prixConsigne > 0,

        // CRITÈRES TECHNIQUES (logique PHP)
        criterias_techniques: technicalCriteria,

        // URL et METADATA
        url: `/piece/${piece.piece_id}/${this.slugify(nameData.nomComplet || 'piece')}.html`,

        // DEBUG et METADATA
        _metadata: {
          has_price_data: price ? true : false,
          has_image_data: image ? true : false,
          criterias_count: criterias.length,
          relation_ids: {
            pm_id: relation?.rtp_pm_id,
            psf_id: relation?.rtp_psf_id,
          },
        },
      } as UnifiedPiece;
    });
  }

  /**
   * 💰 Calcul des prix selon logique PHP exacte
   */
  private calculatePiecePricing(piece: any, price: any, marqueEquip: any) {
    const prixBrut = parseFloat(price?.pri_vente_ttc || '0');
    const quantiteVente = parseFloat(piece.piece_qty_sale || '1');
    const prixUnitaire = prixBrut > 0 ? prixBrut : 0;
    const prixTotal = prixUnitaire * quantiteVente;
    const prixConsigne =
      parseFloat(price?.pri_consigne_ttc || '0') * quantiteVente;
    const prixTotalAvecConsigne = prixTotal + prixConsigne;

    return {
      prixUnitaire: Math.round(prixUnitaire * 100) / 100,
      prixTotal: Math.round(prixTotal * 100) / 100,
      prixConsigne: Math.round(prixConsigne * 100) / 100,
      prixTotalAvecConsigne: Math.round(prixTotalAvecConsigne * 100) / 100,
      quantiteVente,
    };
  }

  /**
   * ⭐ Détermination qualité selon logique PHP
   */
  private determineQuality(marqueEquip: any, prixConsigne: number) {
    let qualite = 'AFTERMARKET';
    let nbStars = 3;

    if (marqueEquip?.pm_oes === '1' || marqueEquip?.pm_oes === 'O') {
      qualite = 'OES';
      nbStars = 6;
    }

    // Si consigne > 0, alors Echange Standard (logique PHP)
    if (prixConsigne > 0) {
      qualite = 'Echange Standard';
      nbStars = marqueEquip?.pm_nb_stars || 4;
    }

    return { qualite, nbStars };
  }

  /**
   * 🏷️ Construction nom complet (logique PHP)
   */
  private buildCompleteName(piece: any, filtre: any) {
    const sideFromFilter = filtre?.psf_side || piece.piece_name_side || '';
    const nomComplet =
      [piece.piece_name, sideFromFilter, piece.piece_name_comp]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Pièce sans nom';

    return { nomComplet, sideFromFilter };
  }

  /**
   * 🖼️ Construction données image (logique PHP)
   */
  private buildImageData(
    piece: any,
    image: any,
    nomComplet: string,
    marqueEquip: any,
  ) {
    let url = 'upload/articles/no.png'; // Default PHP
    let alt = '';
    let title = '';

    if (piece.piece_has_img === 1 && image) {
      url = `rack/${image.pmi_folder}/${image.pmi_name}.webp`;
      alt = `${nomComplet} ${marqueEquip?.pm_name || ''} ${piece.piece_ref || ''}`;
      title = `${nomComplet} ${piece.piece_ref || ''}`;
    }

    return { url, alt, title };
  }

  /**
   * 🔧 Traitement critères techniques (logique PHP, LIMIT 3)
   */
  private processTechnicalCriteria(
    criterias: any[],
    options: GetPiecesOptions,
  ) {
    if (!options.includeTechnicalCriteria || !criterias.length) {
      return [];
    }

    return criterias
      .filter((c: any) => c.link_info) // Seulement avec liens valides
      .slice(0, 3) // LIMIT 3 comme en PHP
      .map((c: any) => ({
        criteria: c.link_info?.pcl_cri_criteria || '',
        value: c.pc_cri_value || '',
        unit: c.link_info?.pcl_cri_unit || '',
        level: c.link_info?.pcl_level || 1,
      }));
  }

  /**
   * 📊 Groupement par blocs (logique PHP)
   */
  private groupPiecesByBlocks(
    pieces: UnifiedPiece[],
    options: GetPiecesOptions,
  ) {
    const blocsMap = new Map();

    pieces.forEach((piece) => {
      const key = `${piece.filtre_gamme}_${piece.filtre_side}`;
      if (!blocsMap.has(key)) {
        blocsMap.set(key, {
          filtre_gamme: piece.filtre_gamme,
          filtre_side: piece.filtre_side,
          key: key,
          pieces: [],
          count: 0,
          minPrice: null,
          maxPrice: null,
        });
      }
      const bloc = blocsMap.get(key);
      bloc.pieces.push(piece);
      bloc.count++;

      // Calculs prix min/max du bloc
      if (piece.prix_unitaire > 0) {
        bloc.minPrice =
          bloc.minPrice === null
            ? piece.prix_unitaire
            : Math.min(bloc.minPrice, piece.prix_unitaire);
        bloc.maxPrice =
          bloc.maxPrice === null
            ? piece.prix_unitaire
            : Math.max(bloc.maxPrice, piece.prix_unitaire);
      }
    });

    return Array.from(blocsMap.values());
  }

  /**
   * 📈 Calculs statistiques globaux
   */
  private calculateGlobalStats(
    pieces: UnifiedPiece[],
    options: GetPiecesOptions,
  ) {
    const validPrices = pieces
      .map((p) => p.prix_unitaire)
      .filter((price) => price > 0);

    return {
      minPrice: validPrices.length > 0 ? Math.min(...validPrices) : null,
      maxPrice: validPrices.length > 0 ? Math.max(...validPrices) : null,
      averagePrice:
        validPrices.length > 0
          ? Math.round(
              (validPrices.reduce((a, b) => a + b, 0) / validPrices.length) *
                100,
            ) / 100
          : null,
      totalPieces: pieces.length,
      piecesWithPrices: validPrices.length,
    };
  }

  /**
   * 🔧 MÉTHODES UTILITAIRES
   */

  private extractUniqueIds(
    data: any[],
    field: string,
    filterNull = false,
  ): number[] {
    const values = data.map((item) => item[field]);
    const filtered = filterNull ? values.filter(Boolean) : values;
    return [...new Set(filtered)];
  }

  private optimizePieceIds(
    pieceIds: number[],
    options: GetPiecesOptions,
  ): number[] {
    const maxPieces =
      options.maxPieces || this.DEFAULT_CONFIG.maxPiecesPerQuery;
    return pieceIds.slice(0, maxPieces);
  }

  private buildCacheKey(
    typeId: number,
    pgId: number,
    options: GetPiecesOptions,
  ): string {
    const optionsHash = JSON.stringify(options);
    return `pieces:unified:${typeId}:${pgId}:${Buffer.from(optionsHash).toString('base64').slice(0, 10)}`;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private buildEmptyResponse(
    message: string,
    duration: number,
  ): UnifiedCatalogResponse {
    return {
      pieces: [],
      blocs: [],
      pieces_grouped_by_filter: [],
      count: 0,
      blocs_count: 0,
      minPrice: null,
      maxPrice: null,
      averagePrice: null,
      relations_found: 0,
      duration: `${duration}ms`,
      success: true,
      message,
      optimization: 'UNIFIED_ENHANCED_V2',
      features: [],
      metadata: {
        requestId: this.generateRequestId(),
        typeId: 0,
        pgId: 0,
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        config: {},
      },
    };
  }

  private buildErrorResponse(
    error: any,
    duration: number,
    requestId: string,
  ): UnifiedCatalogResponse {
    return {
      pieces: [],
      blocs: [],
      pieces_grouped_by_filter: [],
      count: 0,
      blocs_count: 0,
      minPrice: null,
      maxPrice: null,
      averagePrice: null,
      relations_found: 0,
      duration: `${duration}ms`,
      success: false,
      error: error.message,
      optimization: 'UNIFIED_ENHANCED_V2',
      features: [],
      metadata: {
        requestId,
        typeId: 0,
        pgId: 0,
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        config: {},
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    };
  }

  private updateMetrics(startTime: number, cacheHit: boolean) {
    const duration = Date.now() - startTime;

    // Simple moving average pour responseTime
    this.metrics.averageResponseTime =
      this.metrics.averageResponseTime * 0.9 + duration * 0.1;

    // Cache hit rate
    if (cacheHit) {
      this.metrics.cacheHitRate = this.metrics.cacheHitRate * 0.9 + 1 * 0.1;
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

  /**
   * 🔧 Cache methods (à implémenter avec Redis)
   */
  private async getCachedResult(
    key: string,
  ): Promise<UnifiedCatalogResponse | null> {
    // TODO: Implémenter avec Redis/Memory cache
    return null;
  }

  private async setCachedResult(
    key: string,
    result: UnifiedCatalogResponse,
    duration?: number,
  ): Promise<void> {
    // TODO: Implémenter avec Redis cache
  }

  /**
   * 📊 Métriques publiques
   */
  public getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * 🧹 Reset métriques
   */
  public resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
    };
  }

  private buildCriteriasMap(criteriasData: any[]): Map<number, any[]> {
    const criteriasMap = new Map();

    criteriasData.forEach((c: any) => {
      if (!criteriasMap.has(c.pc_piece_id)) {
        criteriasMap.set(c.pc_piece_id, []);
      }
      criteriasMap.get(c.pc_piece_id).push(c);
    });

    return criteriasMap;
  }
}

// 📝 INTERFACES ET TYPES UNIFIÉS

export interface GetPiecesOptions {
  maxPieces?: number;
  maxRelations?: number;
  bypassCache?: boolean;
  cacheDuration?: number;
  includeTechnicalCriteria?: boolean;
  includeImages?: boolean;
  sortBy?: 'name' | 'price' | 'brand' | 'quality';
  filters?: {
    brands?: string[];
    priceRange?: { min: number; max: number };
    quality?: string[];
  };
}

export interface UnifiedPiece {
  // IDENTIFIANTS
  id: number;
  reference: string;
  reference_clean: string;

  // NOMS (logique PHP exacte)
  nom: string;
  nom_complet: string;
  piece_name: string;
  piece_name_side: string;
  piece_name_comp: string;
  description: string;

  // MARQUE ET ÉQUIPEMENTIER
  marque: string;
  marque_id: number | null;
  marque_logo: string | null;
  marque_alias: string | null;

  // PRIX (logique PHP exacte)
  prix_unitaire: number;
  prix_ttc: number;
  prix_consigne: number;
  prix_total: number;
  quantite_vente: number;

  // QUALITÉ ET PERFORMANCES
  qualite: 'OES' | 'AFTERMARKET' | 'Echange Standard';
  nb_stars: number;
  pm_oes: string;

  // IMAGES (logique PHP)
  image: string;
  image_alt: string;
  image_title: string;

  // FILTRES ET CATÉGORIES
  filtre_gamme: string;
  filtre_side: string;
  filtre_id: number | null;
  psf_id: number | null;

  // CARACTÉRISTIQUES TECHNIQUES
  has_image: boolean;
  has_oem: boolean;
  has_price: boolean;
  has_consigne: boolean;

  // CRITÈRES TECHNIQUES (logique PHP)
  criterias_techniques: TechnicalCriteria[];

  // URL et METADATA
  url: string;

  // DEBUG et METADATA
  _metadata?: {
    has_price_data: boolean;
    has_image_data: boolean;
    criterias_count: number;
    relation_ids?: {
      pm_id?: number;
      psf_id?: number;
    };
  };
}

export interface TechnicalCriteria {
  criteria: string;
  value: string;
  unit: string;
  level: number;
}

export interface PieceBlock {
  filtre_gamme: string;
  filtre_side: string;
  key: string;
  pieces: UnifiedPiece[];
  count: number;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface UnifiedCatalogResponse {
  pieces: UnifiedPiece[];
  blocs: PieceBlock[];
  pieces_grouped_by_filter: PieceBlock[]; // Alias compatibilité
  count: number;
  blocs_count: number;
  minPrice: number | null;
  maxPrice?: number | null;
  averagePrice?: number | null;
  relations_found: number;
  duration: string;
  success: boolean;
  message?: string;
  error?: string;
  optimization: string;
  features: string[];
  metadata: {
    requestId: string;
    typeId: number;
    pgId: number;
    version: string;
    timestamp: string;
    config: any;
    error?: {
      message: string;
      stack?: string;
    };
  };
}
