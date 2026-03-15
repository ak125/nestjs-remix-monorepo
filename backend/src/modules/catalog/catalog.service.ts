import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '../../common/exceptions';
import { TABLES } from '@repo/database-types';
import { RpcGateService } from '../../security/rpc-gate/rpc-gate.service';
import { getErrorMessage } from '../../common/utils/error.utils';
// 📁 backend/src/modules/catalog/catalog.service.ts
// 🏗️ Service principal pour le catalogue - Orchestrateur des données

// import { GammeService } from './services/gamme.service'; // TEMPORAIREMENT DÉSACTIVÉ - dépendance VehicleCacheService
import { CatalogHierarchyService } from './services/catalog-hierarchy.service';

// ========================================
// 📊 INTERFACES ÉTENDUES
// ========================================

export interface CatalogItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  image_url?: string;
  piece_count?: number;
  is_featured?: boolean;
}

export interface HomeCatalogData {
  mainCategories: CatalogItem[];
  featuredCategories: CatalogItem[];
  quickAccess: CatalogItem[];
  stats: {
    total_categories: number;
    total_pieces: number;
    featured_count: number;
  };
}

@Injectable()
export class CatalogService
  extends SupabaseBaseService
  implements OnModuleInit
{
  protected readonly logger = new Logger(CatalogService.name);

  // 🗄️ Cache intelligent pour performance
  private catalogCache: Map<string, unknown> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 heure

  constructor(
    private readonly catalogHierarchyService: CatalogHierarchyService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 🚀 Initialisation du module - Préchargement intelligent
   */
  async onModuleInit() {
    this.logger.log('🚀 Initialisation CatalogService avec préchargement...');

    try {
      // Préchargement parallèle des données critiques
      await Promise.allSettled([
        this.preloadMainCategories(),
        this.preloadAutoBrands(),
        this.preloadGlobalStats(),
      ]);

      this.logger.log('✅ Préchargement du catalogue terminé avec succès');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement catalogue:', error);
    }
  }

  /**
   * 👨‍👩‍👧‍👦 Récupérer les familles de gammes (utilise catalog_family)
   */
  async getGamesFamilies() {
    this.logger.log('👨‍👩‍👧‍👦 Récupération familles de gammes via CatalogService');
    return this.catalogHierarchyService.getFamiliesResponse();
  }

  /**
   * 👨‍👩‍👧‍👦 Récupérer toutes les familles formatées comme des gammes (pour homepage)
   */
  async getAllFamiliesAsGammes() {
    this.logger.log(
      '👨‍👩‍👧‍👦 Récupération de toutes les familles comme gammes via CatalogService',
    );
    return this.catalogHierarchyService.getFamiliesResponse();
  }

  /**
   * 🏠 Récupère les gammes principales pour la page d'accueil
   * Version fusionnée optimisée avec cache intelligent
   */
  async getHomeCatalog(): Promise<HomeCatalogData> {
    const cacheKey = 'home_catalog_v2';

    // Vérifier le cache d'abord
    if (this.catalogCache.has(cacheKey)) {
      this.logger.log('🎯 Cache hit - Données homepage catalogue');
      return this.catalogCache.get(cacheKey) as HomeCatalogData;
    }

    try {
      this.logger.log(
        '🏠 Génération catalogue homepage avec données réelles...',
      );

      // Exécution parallèle optimisée
      const [categoriesResult, statsResult, quickAccessResult] =
        await Promise.allSettled([
          this.getMainCategories(),
          this.getCatalogStats(),
          this.getQuickAccessItems(),
        ]);

      // Extraction sécurisée des résultats
      const mainCategories =
        categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
      const stats =
        statsResult.status === 'fulfilled'
          ? statsResult.value
          : {
              total_categories: 0,
              total_pieces: 0,
              featured_count: 0,
            };
      const quickAccess =
        quickAccessResult.status === 'fulfilled' ? quickAccessResult.value : [];

      // Filtrage des catégories featured
      const featuredCategories = mainCategories.filter(
        (cat) => cat.is_featured,
      );

      const result: HomeCatalogData = {
        mainCategories,
        featuredCategories,
        quickAccess,
        stats: {
          total_categories: mainCategories.length,
          total_pieces:
            (stats as unknown as Record<string, Record<string, number>>).stats
              ?.pieces || 0,
          featured_count: featuredCategories.length,
        },
      };

      // Mise en cache avec TTL
      this.catalogCache.set(cacheKey, result);
      setTimeout(() => {
        this.catalogCache.delete(cacheKey);
        this.logger.log('♻️ Cache homepage catalogue expiré');
      }, this.CACHE_TTL);

      this.logger.log(
        `✅ Catalogue homepage: ${mainCategories.length} catégories, ${featuredCategories.length} featured`,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur génération catalogue homepage:', error);
      throw error;
    }
  }

  /**
   * 📋 Récupère les catégories principales (gammes)
   */
  private async getMainCategories(): Promise<CatalogItem[]> {
    try {
      // Charger les IDs du catalogue actif (~221 gammes)
      const { data: catalogGammes } = await this.supabase
        .from(TABLES.catalog_gamme)
        .select('mc_pg_id');
      const catalogIds = (catalogGammes || []).map((cg) => cg.mc_pg_id);

      // Requete ciblee sur les gammes actives (evite le plafond Supabase 1000 rows)
      const { data, error } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select(
          `
          pg_id,
          pg_name,
          pg_alias,
          pg_pic,
          pg_top,
          pg_display,
          pg_level
        `,
        )
        .in('pg_id', catalogIds)
        .order('pg_level', { ascending: true });

      if (error) {
        throw error;
      }

      // Transformation vers interface CatalogItem
      const catalogItems: CatalogItem[] = (data || []).map((item) => ({
        id: item.pg_id,
        code: item.pg_alias || `gamme-${item.pg_id}`,
        name: item.pg_name,
        description: '', // pg_description n'existe pas dans pieces_gamme
        image_url: item.pg_pic || '',
        is_featured: item.pg_top === 1 || item.pg_top === '1',
        piece_count: 0, // Sera enrichi par RPC si disponible
      }));

      // Enrichissement avec compteur de produits
      return await this.enrichWithProductCounts(catalogItems);
    } catch (error) {
      this.logger.error(
        '❌ Erreur récupération catégories principales:',
        error,
      );
      return [];
    }
  }

  /**
   * 🔥 Récupère les éléments d'accès rapide (populaires)
   */
  private async getQuickAccessItems(): Promise<CatalogItem[]> {
    return this.getFallbackQuickAccess();
  }

  /**
   * 🔄 Fallback pour accès rapide
   */
  private async getFallbackQuickAccess(): Promise<CatalogItem[]> {
    const { data } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias, pg_pic')
      .eq('pg_top', '1')
      .eq('pg_display', '1')
      .limit(8);

    return (data || []).map((item) => ({
      id: item.pg_id,
      code: item.pg_alias,
      name: item.pg_name,
      image_url: item.pg_pic || '',
      is_featured: true,
      piece_count: 0,
    }));
  }

  /**
   * 📊 Enrichit les catégories avec le nombre de produits
   */
  private async enrichWithProductCounts(
    categories: CatalogItem[],
  ): Promise<CatalogItem[]> {
    return categories;
  }

  /**
   * 🔍 Recherche dans le catalogue (version améliorée)
   */
  async searchCatalog(
    query: string,
    filters?: {
      minPrice?: number;
      maxPrice?: number;
      categoryId?: number;
      brandId?: number;
      limit?: number;
    },
  ): Promise<unknown[]> {
    try {
      this.logger.log(`🔍 Recherche catalogue: "${query}" avec filtres`);

      let queryBuilder = this.supabase.from(TABLES.pieces_gamme).select(`
          pg_id,
          pg_name,
          pg_alias,
          pg_pic,
          products_pieces!inner(
            piece_id,
            piece_name,
            piece_ref,
            piece_price,
            piece_brand,
            piece_image
          )
        `);

      // Recherche textuelle
      if (query) {
        queryBuilder = queryBuilder.or(
          `pg_name.ilike.%${query}%,pg_alias.ilike.%${query}%`,
        );
      }

      // Appliquer les filtres
      if (filters?.minPrice) {
        queryBuilder = queryBuilder.gte(
          'products_pieces.piece_price',
          filters.minPrice,
        );
      }
      if (filters?.maxPrice) {
        queryBuilder = queryBuilder.lte(
          'products_pieces.piece_price',
          filters.maxPrice,
        );
      }
      if (filters?.categoryId) {
        queryBuilder = queryBuilder.eq('pg_id', filters.categoryId);
      }

      const { data, error } = await queryBuilder.limit(filters?.limit || 50);

      if (error) {
        throw error;
      }

      this.logger.log(`✅ Recherche: ${(data || []).length} résultats trouvés`);
      return data || [];
    } catch (error) {
      this.logger.error('❌ Erreur recherche catalogue:', error);
      return [];
    }
  }

  /**
   * ♻️ Méthodes de préchargement pour OnModuleInit
   */
  private async preloadMainCategories(): Promise<void> {
    try {
      await this.getHomeCatalog();
      this.logger.log('✅ Catégories principales préchargées');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement catégories:', error);
    }
  }

  private async preloadAutoBrands(): Promise<void> {
    try {
      await this.getAutoBrands(50);
      this.logger.log('✅ Marques automobiles préchargées');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement marques:', error);
    }
  }

  private async preloadGlobalStats(): Promise<void> {
    try {
      await this.getCatalogStats();
      this.logger.log('✅ Statistiques globales préchargées');
    } catch (error) {
      this.logger.error('❌ Erreur préchargement stats:', error);
    }
  }

  /**
   * 🗑️ Invalidation du cache
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.catalogCache.keys()) {
        if (key.includes(pattern)) {
          this.catalogCache.delete(key);
        }
      }
      this.logger.log(`♻️ Cache invalidé pour pattern: ${pattern}`);
    } else {
      this.catalogCache.clear();
      this.logger.log('♻️ Cache complet invalidé');
    }
  }
  async getAutoBrands(limit: number = 50) {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.auto_marque)
        .select(
          `
          marque_id,
          marque_name,
          marque_alias,
          marque_logo,
          marque_display,
          marque_top
        `,
        )
        .eq('marque_display', 1)
        .order('marque_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data:
          data?.map((brand) => ({
            id: brand.marque_id,
            name: brand.marque_name,
            alias: brand.marque_alias,
            logo: brand.marque_logo,
            isTop: brand.marque_top === 1,
            isActive: brand.marque_display === 1,
          })) || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des marques:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        data: [],
        count: 0,
      };
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async getModelsByBrand(marqueId: number, limit: number = 100) {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.auto_modele)
        .select(
          `
          modele_id,
          modele_name,
          modele_alias,
          modele_year_from,
          modele_year_to,
          modele_body,
          modele_pic,
          modele_display
        `,
        )
        .eq('modele_marque_id', marqueId)
        .eq('modele_display', 1)
        .order('modele_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data:
          data?.map((model) => ({
            id: model.modele_id,
            name: model.modele_name,
            alias: model.modele_alias,
            yearFrom: model.modele_year_from,
            yearTo: model.modele_year_to,
            body: model.modele_body,
            picture: model.modele_pic,
            isActive: model.modele_display === 1,
          })) || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des modèles:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        data: [],
        count: 0,
      };
    }
  }

  /**
   * Rechercher des pièces par référence ou nom
   */
  async searchPieces(query: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.pieces)
        .select(
          `
          piece_id,
          piece_ref,
          piece_name,
          piece_des,
          piece_name_comp,
          piece_weight_kgm,
          piece_has_img,
          piece_display
        `,
        )
        .or(
          `piece_ref.ilike.%${query}%,piece_name.ilike.%${query}%,piece_des.ilike.%${query}%`,
        )
        .eq('piece_display', true)
        .order('piece_sort', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data:
          data?.map((piece) => ({
            id: piece.piece_id,
            reference: piece.piece_ref,
            name: piece.piece_name,
            description: piece.piece_des,
            completeName: piece.piece_name_comp,
            weight: piece.piece_weight_kgm,
            hasImage: piece.piece_has_img,
            isActive: piece.piece_display,
          })) || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche de pièces:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        data: [],
        count: 0,
      };
    }
  }

  /**
   * Récupérer les détails d'une pièce avec prix, marque et images
   */
  async getPieceById(pieceId: number) {
    try {
      // Récupérer la pièce avec toutes les informations nécessaires
      const { data: pieceData, error: pieceError } = await this.supabase
        .from(TABLES.pieces)
        .select(
          `
          piece_id,
          piece_ref,
          piece_ref_clean,
          piece_name,
          piece_des,
          piece_name_comp,
          piece_name_side,
          piece_weight_kgm,
          piece_has_oem,
          piece_has_img,
          piece_year,
          piece_qty_sale,
          piece_qty_pack,
          piece_pm_id,
          piece_pg_id
        `,
        )
        .eq('piece_id', pieceId)
        .eq('piece_display', true)
        .single();

      if (pieceError || !pieceData) {
        throw pieceError || new Error('Pièce non trouvée');
      }

      // Récupérer le prix
      const { data: prixData, error: prixError } = await this.supabase
        .from(TABLES.pieces_price)
        .select('pri_vente_ttc_n, pri_consigne_ttc_n, pri_dispo')
        .eq('pri_piece_id_i', pieceId)
        .eq('pri_type', 0)
        .single();

      this.logger.log(`📊 Prix récupéré pour piece ${pieceId}:`, prixData);
      if (prixError) this.logger.warn(`⚠️ Erreur prix:`, prixError);

      // Récupérer la marque
      const { data: marqueData, error: marqueError } = await this.supabase
        .from(TABLES.pieces_marque)
        .select('pm_name, pm_logo, pm_quality, pm_nb_stars')
        .eq('pm_id', pieceData.piece_pm_id)
        .single();

      this.logger.log(
        `🏷️ Marque récupérée pour pm_id ${pieceData.piece_pm_id}:`,
        marqueData,
      );
      if (marqueError) this.logger.warn(`⚠️ Erreur marque:`, marqueError);

      // Récupérer les images
      const { data: imagesData } = await this.supabase
        .from(TABLES.pieces_media_img)
        .select('pmi_folder, pmi_name')
        .eq('pmi_piece_id_i', pieceId)
        .order('pmi_sort', { ascending: true });

      // Récupérer les critères techniques
      const { data: criteresData } = await this.supabase
        .from(TABLES.pieces_criteria)
        .select('pc_cri_id, pc_cri_value')
        .eq('pc_piece_id_i', pieceId)
        .eq('pc_display', 1)
        .order('pc_sort', { ascending: true });

      // Récupérer les liens des critères (jointure manuelle)
      // 🎯 Filtre PHP: pcl_level='1' pour critères prioritaires, avec fallback si aucun résultat
      let criteresTechniques: {
        id: unknown;
        name: unknown;
        value: unknown;
        unit: string;
        level: string;
        priority: boolean;
      }[] = [];
      if (criteresData && criteresData.length > 0) {
        const criIds = [...new Set(criteresData.map((c) => c.pc_cri_id))];

        // Étape 1: Essayer avec pcl_level='1' (critères prioritaires)
        let { data: linksData } = await this.supabase
          .from(TABLES.pieces_criteria_link)
          .select('pcl_cri_id, pcl_cri_criteria, pcl_cri_unit, pcl_level')
          .in('pcl_cri_id', criIds)
          .eq('pcl_display', 1)
          .eq('pcl_level', '1')
          .order('pcl_level', { ascending: true });

        let usedFallback = false;

        // Étape 2: Fallback si aucun critère level=1 trouvé
        if (!linksData || linksData.length === 0) {
          usedFallback = true;
          const fallbackResult = await this.supabase
            .from(TABLES.pieces_criteria_link)
            .select('pcl_cri_id, pcl_cri_criteria, pcl_cri_unit, pcl_level')
            .in('pcl_cri_id', criIds)
            .eq('pcl_display', 1)
            .order('pcl_level', { ascending: true });
          linksData = fallbackResult.data;
          this.logger.warn(
            `⚠️ [CRITÈRES FALLBACK] piece_id=${pieceId}: aucun critère level=1, utilisation de tous les niveaux`,
          );
        }

        // Logging pour monitoring
        this.logger.log(
          `📊 [CRITÈRES] piece_id=${pieceId}: ${criIds.length} critères → ${linksData?.length || 0} level=1 ${usedFallback ? '(FALLBACK all levels)' : ''}`,
        );

        // Créer une map des liens (prendre le premier par cri_id)
        const linksMap = new Map();
        linksData?.forEach((link) => {
          if (!linksMap.has(link.pcl_cri_id)) {
            linksMap.set(link.pcl_cri_id, link);
          }
        });

        // Formater les critères avec leurs liens
        criteresTechniques = criteresData
          .map((crit) => {
            const link = linksMap.get(crit.pc_cri_id);
            return link
              ? {
                  id: crit.pc_cri_id,
                  name: link.pcl_cri_criteria,
                  value: crit.pc_cri_value,
                  unit: link.pcl_cri_unit || '',
                  level: link.pcl_level || '5',
                  priority: link.pcl_level === '1',
                }
              : null;
          })
          .filter(Boolean);
      }

      // Récupérer les références OEM constructeurs (Type 3) depuis pieces_ref_search
      const { data: refOemData } = await this.supabase
        .from(TABLES.pieces_ref_search)
        .select('prs_ref, prs_prb_id')
        .eq('prs_piece_id_i', pieceId)
        .eq('prs_kind', '3') // Type 3 = références OEM constructeurs (RENAULT, BMW, AUDI...)
        .limit(50);

      // Grouper les références OEM constructeurs par marque
      const referencesOem: Record<string, string[]> = {};

      if (refOemData && refOemData.length > 0) {
        const brandIds = [...new Set(refOemData.map((r) => r.prs_prb_id))];
        const { data: brandsData } = await this.supabase
          .from(TABLES.pieces_ref_brand)
          .select('prb_id, prb_name')
          .in('prb_id', brandIds);

        const brandMap = new Map(
          brandsData?.map((b) => [b.prb_id.toString(), b.prb_name]) || [],
        );

        refOemData.forEach((ref) => {
          const brandName = brandMap.get(ref.prs_prb_id.toString());
          if (brandName) {
            if (!referencesOem[brandName]) {
              referencesOem[brandName] = [];
            }
            if (!referencesOem[brandName].includes(ref.prs_ref)) {
              referencesOem[brandName].push(ref.prs_ref);
            }
          }
        });
      }

      return {
        success: true,
        data: {
          id: pieceData.piece_id,
          nom: pieceData.piece_name,
          reference: pieceData.piece_ref,
          marque: marqueData?.pm_name || '',
          marque_logo: marqueData?.pm_logo || null,
          qualite: marqueData?.pm_quality || null,
          nb_stars: marqueData?.pm_nb_stars || 0,
          prix_ttc: Number(prixData?.pri_vente_ttc_n) || 0,
          consigne_ttc: Number(prixData?.pri_consigne_ttc_n) || 0,
          dispo: prixData?.pri_dispo === '1' || prixData?.pri_dispo === 1,
          description: pieceData.piece_des,
          image: imagesData?.[0]
            ? `${imagesData[0].pmi_folder}/${imagesData[0].pmi_name}`
            : '',
          images:
            imagesData?.map((img) => `${img.pmi_folder}/${img.pmi_name}`) || [],
          weight: pieceData.piece_weight_kgm,
          hasOem: pieceData.piece_has_oem,
          criteresTechniques,
          referencesOem,
        },
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de la pièce:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        data: null,
      };
    }
  }

  /**
   * Obtenir les statistiques du catalogue
   */
  async getCatalogStats() {
    try {
      // Statistiques des marques
      const { count: brandsCount, error: brandsError } = await this.supabase
        .from(TABLES.auto_marque)
        .select('*', { count: 'exact', head: true })
        .eq('marque_display', 1);

      // Statistiques des modèles
      const { count: modelsCount, error: modelsError } = await this.supabase
        .from(TABLES.auto_modele)
        .select('*', { count: 'exact', head: true })
        .eq('modele_display', 1);

      // Statistiques des pièces
      const { count: piecesCount, error: piecesError } = await this.supabase
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true);

      if (brandsError || modelsError || piecesError) {
        throw new DatabaseException({
          code: ErrorCodes.CATALOG.STATS_FAILED,
          message: 'Erreur lors du calcul des statistiques',
        });
      }

      return {
        success: true,
        stats: {
          brands: brandsCount || 0,
          models: modelsCount || 0,
          pieces: piecesCount || 0,
          lastUpdate: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Erreur lors du calcul des statistiques:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        stats: null,
      };
    }
  }

  /**
   * 🏠 Obtient toutes les données nécessaires pour la page d'accueil
   * Agrège marques, statistiques et gammes en un seul appel optimisé
   */
  async getHomepageData() {
    try {
      this.logger.log("🏠 Génération données complètes page d'accueil");

      // Exécution parallèle pour performance optimale
      const [brandsResult, statsResult] = await Promise.allSettled([
        this.getAutoBrands(20), // Top 20 marques pour homepage
        this.getCatalogStats(),
      ]);

      // Extraction sécurisée des résultats
      const brands: { success: boolean; data: unknown[]; count: number } =
        brandsResult.status === 'fulfilled'
          ? brandsResult.value
          : {
              success: false,
              data: [],
              count: 0,
            };

      const stats =
        statsResult.status === 'fulfilled'
          ? statsResult.value
          : {
              success: false,
              stats: {
                brands: 0,
                models: 0,
                pieces: 0,
                lastUpdate: new Date().toISOString(),
              },
            };

      // Construction de la réponse optimisée
      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          // 🚗 Marques automobiles populaires
          brands: {
            success: brands.success,
            data: brands.data || [],
            count: brands.count || 0,
            featured: (brands.data || [])
              .filter(
                (brand: unknown) =>
                  (brand as Record<string, unknown>).marque_top === 1,
              )
              .slice(0, 8), // Top 8 marques featured
          },

          // 📊 Statistiques globales
          stats: {
            success: stats.success,
            ...stats.stats,
            // Statistiques enrichies pour homepage
            formatted: {
              brands: this.formatNumber(stats.stats?.brands || 0),
              models: this.formatNumber(stats.stats?.models || 0),
              pieces: this.formatNumber(stats.stats?.pieces || 0),
              satisfaction: '4.8/5', // Valeur statique pour l'exemple
            },
          },

          // 🎯 Métadonnées pour le cache et l'affichage
          cache_info: {
            generated_at: new Date().toISOString(),
            ttl_seconds: 1800, // 30 minutes
            version: '2.0.0',
          },
        },
        message: 'Données homepage générées avec succès',
      };

      this.logger.log(
        `✅ Homepage data: ${brands.count} marques, ${stats.stats?.pieces || 0} pièces`,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur génération données homepage:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        data: null,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔢 Formate les nombres pour l'affichage (ex: 50000 -> "50K+")
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${Math.floor(num / 1000000)}M+`;
    } else if (num >= 1000) {
      return `${Math.floor(num / 1000)}K+`;
    }
    return num.toString();
  }

  /**
   * 🎯 Obtient les marques optimisées pour le sélecteur de véhicule
   */
  async getBrandsForVehicleSelector(limit: number = 50) {
    try {
      this.logger.log(
        `🎯 Récupération marques pour sélecteur (limite: ${limit})`,
      );

      const { data, error } = await this.supabase
        .from(TABLES.auto_marque)
        .select(
          `
          marque_id,
          marque_name,
          marque_alias,
          marque_logo,
          marque_top,
          marque_display
        `,
        )
        .eq('marque_display', 1)
        .order('marque_top', { ascending: false }) // Featured d'abord
        .order('marque_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Structurer pour VehicleSelector
      const structuredBrands = (data || []).map((brand) => ({
        id: brand.marque_id,
        name: brand.marque_name,
        slug: brand.marque_alias,
        logo: brand.marque_logo,
        isFeatured: brand.marque_top === 1,
        isActive: brand.marque_display === 1,
      }));

      this.logger.log(
        `✅ ${structuredBrands.length} marques structurées pour sélecteur`,
      );

      return {
        success: true,
        data: structuredBrands,
        count: structuredBrands.length,
        featured_count: structuredBrands.filter((b) => b.isFeatured).length,
      };
    } catch (error) {
      this.logger.error('❌ Erreur marques sélecteur:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        data: [],
        count: 0,
      };
    }
  }

  /**
   * 🔍 MÉTHODE TEMPORAIRE - Test d'une table Supabase
   * Utilisée pour explorer les tables gammes disponibles
   */
  async testTable(tableName: string) {
    this.logger.log(`🔍 Test de la table: ${tableName}`);

    try {
      // Récupérer quelques échantillons
      const { data: samples, error: samplesError } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(2);

      if (samplesError) {
        throw new DatabaseException({
          code: ErrorCodes.CATALOG.RPC_FAILED,
          message: `Erreur échantillons ${tableName}: ${samplesError.message}`,
          details: samplesError.message,
          cause: samplesError instanceof Error ? samplesError : undefined,
        });
      }

      // Compter le total
      const { count, error: countError } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.warn(`⚠️ Erreur comptage ${tableName}:`, countError);
      }

      const columns =
        samples && samples.length > 0 ? Object.keys(samples[0]) : [];

      this.logger.log(
        `✅ Table ${tableName}: ${count || 0} enregistrements, ${columns.length} colonnes`,
      );

      return {
        count: count || 0,
        columns,
        sample: samples?.[0] || null,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur test table ${tableName}:`, error);
      throw error;
    }
  }
}
