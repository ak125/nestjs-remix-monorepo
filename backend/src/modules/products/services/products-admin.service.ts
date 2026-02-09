import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import {
  DomainNotFoundException,
  ErrorCodes,
} from '../../../common/exceptions';

/**
 * Service pour l'interface commerciale et admin des produits :
 * listing commercial, filtres dynamiques, toggle activation, produits par gamme.
 *
 * Extrait de ProductsService pour séparation des responsabilités.
 */
@Injectable()
export class ProductsAdminService extends SupabaseBaseService {
  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Récupérer les produits d'une gamme spécifique avec fonctionnalités avancées
   */
  async findProductsByGamme(options: {
    gammeId: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      const {
        gammeId,
        search = '',
        page = 1,
        limit = 24,
        sortBy = 'piece_name',
        sortOrder = 'asc',
      } = options;

      // Récupérer les infos de la gamme
      const { data: gammeInfo, error: gammeError } = (await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias, pg_pic, pg_display')
        .eq('pg_id', gammeId)
        .single()) as {
        data: {
          pg_id: string;
          pg_name: string;
          pg_alias: string;
          pg_pic: string;
          pg_display: string;
        } | null;
        error: { message: string; code?: string } | null;
      };

      if (gammeError || !gammeInfo) {
        throw new DomainNotFoundException({
          code: ErrorCodes.PRODUCT.NOT_FOUND,
          message: `Gamme ${gammeId} non trouvée`,
        });
      }

      // Construire la requête pour les produits
      let query = this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact' })
        .eq('piece_ga_id', gammeId)
        .eq('piece_display', true);

      // Recherche si fournie
      if (search) {
        query = query.or(
          `piece_name.ilike.%${search}%,piece_ref.ilike.%${search}%,piece_des.ilike.%${search}%`,
        );
      }

      // Tri
      const sortDirection = sortOrder === 'desc' ? false : true;
      query = query.order(sortBy, { ascending: sortDirection });

      // Pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: products, error: productsError, count } = await query;

      if (productsError) {
        this.logger.error('Erreur findProductsByGamme:', productsError);
        throw productsError;
      }

      // Enrichir les produits avec les informations des marques
      let enrichedProducts: Record<string, unknown>[] = [];
      if (products && products.length > 0) {
        const brandIds = [
          ...new Set(products.map((p) => p.piece_pm_id).filter((id) => id)),
        ];

        // Utiliser Map() pour lookup O(1) au lieu de find() O(n)
        const brandsMap = new Map<number, Record<string, unknown>>();
        if (brandIds.length > 0) {
          const { data: brands, error: brandsError } = await this.client
            .from(TABLES.auto_marque)
            .select(
              'marque_id, marque_name, marque_logo, marque_activ, marque_country',
            )
            .in('marque_id', brandIds);

          if (!brandsError && brands) {
            brands.forEach((b) => brandsMap.set(b.marque_id, b));
          }
        }

        // Mapper les produits enrichis avec lookup O(1)
        enrichedProducts = products.map((product) => {
          const brand = brandsMap.get(product.piece_pm_id);

          return {
            piece_id: product.piece_id,
            piece_name: product.piece_name,
            piece_alias: product.piece_ref,
            piece_sku: product.piece_ref,
            piece_description: product.piece_des,
            piece_activ: product.piece_display,
            piece_top: false,
            has_image: product.piece_has_img,
            has_oem: product.piece_has_oem,
            year: product.piece_year,
            weight: product.piece_weight_kgm,
            quantity_sale: product.piece_qty_sale,
            quantity_pack: product.piece_qty_pack,
            sort_order: product.piece_sort,
            reference_clean: product.piece_ref_clean,
            category_name: product.piece_fil_name,
            brand_id: product.piece_pm_id,
            gamme_id: product.piece_ga_id,
            filiere_id: product.piece_fil_id,
            brand: brand
              ? {
                  id: brand.marque_id,
                  name: brand.marque_name,
                  logo: brand.marque_logo,
                  is_active: brand.marque_activ,
                  country: brand.marque_country,
                }
              : {
                  id: product.piece_pm_id,
                  name: 'Marque inconnue',
                  logo: null,
                  is_active: false,
                  country: null,
                },
            pricing: null,
            oem_references: [],
            quality_rating: null,
          };
        });
      }

      return {
        gamme: {
          id: gammeInfo.pg_id,
          name: gammeInfo.pg_name,
          alias: gammeInfo.pg_alias,
          image: gammeInfo.pg_pic,
          is_active: gammeInfo.pg_display === '1',
        },
        products: enrichedProducts,
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
        filters: {
          search,
          sortBy,
          sortOrder,
        },
      };
    } catch (error) {
      this.logger.error('Erreur dans findProductsByGamme:', error);
      throw error;
    }
  }

  /**
   * 🏪 INTERFACE COMMERCIALE - Récupérer produits avec TOUS les détails
   * Pour page /products/admin (commercial level 3+)
   */
  async getProductsForCommercial(
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      isActive?: boolean;
      lowStock?: boolean;
      gammeId?: number;
      categoryId?: number;
      brandId?: number;
    } = {},
  ) {
    try {
      const {
        search = '',
        page = 1,
        limit = 50,
        sortBy = 'piece_name',
        sortOrder = 'asc',
        isActive,
        lowStock,
        gammeId,
        categoryId,
        brandId,
      } = options;

      this.logger.log('🏪 getProductsForCommercial - Options:', options);

      // Étape 1 : Récupérer les pièces
      let query = this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact' });

      // Filtres
      if (search) {
        query = query.or(
          `piece_name.ilike.%${search}%,piece_ref.ilike.%${search}%`,
        );
      }

      if (isActive !== undefined) {
        query = query.eq('piece_display', isActive);
      }

      if (lowStock) {
        query = query.lte('piece_qty_sale', 10);
      }

      // Filtres avancés
      if (gammeId) {
        query = query.eq('piece_pg_id', gammeId);
        this.logger.log(`🔍 Filtre gammeId appliqué: ${gammeId}`);
      }

      if (categoryId) {
        query = query.eq('piece_ga_id', categoryId);
        this.logger.log(`🔍 Filtre categoryId appliqué: ${categoryId}`);
      }

      if (brandId) {
        query = query.eq('piece_pm_id', brandId);
        this.logger.log(`🔍 Filtre brandId appliqué: ${brandId}`);
      }

      // Tri
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Pagination
      const startIndex = (page - 1) * limit;
      query = query.range(startIndex, startIndex + limit - 1);

      const { data: piecesData, error: piecesError, count } = await query;

      if (piecesError) {
        this.logger.error('❌ Erreur récupération pieces:', piecesError);
        throw piecesError;
      }

      if (!piecesData || piecesData.length === 0) {
        return {
          products: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          stats: { totalProducts: 0, activeProducts: 0, lowStockItems: 0 },
        };
      }

      // Étape 2 : Récupérer marques
      const marqueIds = [
        ...new Set(piecesData.map((p) => p.piece_pm_id).filter(Boolean)),
      ];
      const { data: marquesData } = await this.client
        .from(TABLES.pieces_marque)
        .select('pm_id, pm_name, pm_logo')
        .in('pm_id', marqueIds);

      // Étape 2b : Récupérer gammes
      const gammeIds = [
        ...new Set(piecesData.map((p) => p.piece_pg_id).filter(Boolean)),
      ];
      const { data: gammesData } = await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name')
        .in('pg_id', gammeIds);

      // Étape 3 : Récupérer prix
      const pieceIds = piecesData.map((p) => p.piece_id);
      const { data: pricesData } = await this.client
        .from(TABLES.pieces_price)
        .select('*')
        .in('pri_piece_id', pieceIds);

      // Créer des maps pour lookup rapide
      const marquesMap = new Map(
        marquesData?.map((m) => [parseInt(m.pm_id, 10), m]) || [],
      );
      const gammesMap = new Map(
        gammesData?.map((g) => [parseInt(g.pg_id, 10), g]) || [],
      );
      const pricesMap = new Map();
      pricesData?.forEach((price) => {
        const pieceId = parseInt(price.pri_piece_id, 10);
        if (!pricesMap.has(pieceId)) {
          pricesMap.set(pieceId, []);
        }
        pricesMap.get(pieceId).push(price);
      });

      // Transformation des données
      const products = piecesData.map((item) => {
        const marque = marquesMap.get(item.piece_pm_id);
        const gamme = gammesMap.get(item.piece_pg_id);

        const prices = pricesMap.get(item.piece_id) || [];
        const priceData =
          prices.find((p) => p.pri_dispo === '1') || prices[0] || {};

        const prixPublicTTC = parseFloat(priceData.pri_vente_ttc || '0');
        const prixProHT = parseFloat(priceData.pri_vente_ht || '0');
        const consigneTTC = parseFloat(priceData.pri_consigne_ttc || '0');
        const marge = parseFloat(priceData.pri_marge || '0');

        const margeCalculee =
          marge > 0
            ? marge
            : prixProHT > 0
              ? ((prixPublicTTC - prixProHT) / prixPublicTTC) * 100
              : 0;

        const stock = parseInt(item.piece_qty_sale?.toString() || '0', 10);

        return {
          id: item.piece_id,
          name: item.piece_name,
          reference: item.piece_ref,
          description: item.piece_des,
          brand: {
            id: marque?.pm_id || item.piece_pm_id,
            name: marque?.pm_name || 'Sans marque',
            logo: marque?.pm_logo,
          },
          gamme: gamme?.pg_name || null,
          pricing: {
            publicTTC: prixPublicTTC,
            proHT: prixProHT,
            consigneTTC: consigneTTC,
            margin: margeCalculee,
            currency: 'EUR',
          },
          stock: {
            available: stock,
            status:
              stock === 0
                ? 'out_of_stock'
                : stock <= 10
                  ? 'low_stock'
                  : 'in_stock',
            minAlert: 10,
          },
          status: {
            isActive: item.piece_display === true,
            hasImage: item.piece_has_img === true,
            year: item.piece_year,
          },
          categoryId: item.piece_pg_id,
          available: priceData.pri_dispo === '1',
        };
      });

      return {
        products,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        stats: {
          totalProducts: count || 0,
          activeProducts: products.filter((p) => p.status.isActive).length,
          lowStockItems: products.filter((p) => p.stock.status === 'low_stock')
            .length,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur dans getProductsForCommercial:', error);
      throw error;
    }
  }

  /**
   * 🔄 TOGGLE ACTIVATION - Activer/désactiver un produit
   */
  async toggleProductStatus(pieceId: string, isActive: boolean) {
    try {
      this.logger.log(
        `🔄 Toggle produit ${pieceId} -> ${isActive ? 'ACTIF' : 'INACTIF'}`,
      );

      const { data, error } = await this.client
        .from(TABLES.pieces)
        .update({ piece_display: isActive })
        .eq('piece_id', parseInt(pieceId, 10))
        .select();

      if (error) {
        this.logger.error('❌ Erreur toggleProductStatus:', error);
        throw error;
      }

      return {
        success: true,
        pieceId,
        isActive,
        updated: data?.[0],
      };
    } catch (error) {
      this.logger.error('❌ Erreur dans toggleProductStatus:', error);
      throw error;
    }
  }

  /**
   * 📋 LISTES FILTRES - Récupérer gammes de pièces pour filtres
   * Utilise une fonction RPC PostgreSQL optimisée
   */
  async getGammesForFilters() {
    try {
      this.logger.log('🔍 Récupération gammes avec pièces (RPC)');

      // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
      const { data: gammesData, error: gammesError } = await this.callRpc<
        { pg_id: string; pg_name: string }[]
      >('get_gammes_with_pieces', {}, { source: 'api', role: 'service_role' });

      if (gammesError) {
        this.logger.error('Erreur getGammesForFilters (RPC):', gammesError);
        throw gammesError;
      }

      const gammes =
        gammesData?.map((g) => ({
          id: g.pg_id.toString(),
          name: g.pg_name,
        })) || [];

      this.logger.log(`✅ Trouvé ${gammes.length} gammes avec pièces`);

      return gammes;
    } catch (error) {
      this.logger.error('❌ Erreur dans getGammesForFilters:', error);
      return [];
    }
  }

  /**
   * 📋 LISTES FILTRES - Récupérer marques de pièces pour filtres
   * Utilise une fonction RPC PostgreSQL optimisée
   */
  async getPieceBrandsForFilters() {
    try {
      this.logger.log('🔍 Récupération marques avec pièces (RPC)');

      // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
      const { data: brandsData, error: brandsError } = await this.callRpc<
        { pm_id: string; pm_name: string }[]
      >('get_brands_with_pieces', {}, { source: 'api', role: 'service_role' });

      if (brandsError) {
        this.logger.error(
          'Erreur getPieceBrandsForFilters (RPC):',
          brandsError,
        );
        throw brandsError;
      }

      const brands =
        brandsData?.map((b) => ({
          id: b.pm_id.toString(),
          name: b.pm_name,
        })) || [];

      this.logger.log(`✅ Trouvé ${brands.length} marques avec pièces`);

      return brands;
    } catch (error) {
      this.logger.error('❌ Erreur dans getPieceBrandsForFilters:', error);
      return [];
    }
  }

  /**
   * 📋 FILTRES DYNAMIQUES - Récupérer marques d'une gamme spécifique
   */
  async getBrandsForGamme(gammeId: number) {
    try {
      this.logger.log(`🔍 Récupération marques pour gamme ${gammeId}`);

      const { data: piecesData, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('piece_pm_id')
        .eq('piece_pg_id', gammeId)
        .eq('piece_display', true)
        .limit(50000);

      if (piecesError) {
        this.logger.error('Erreur getBrandsForGamme (pieces):', piecesError);
        throw piecesError;
      }

      const brandIds = [
        ...new Set(piecesData?.map((p) => p.piece_pm_id).filter(Boolean)),
      ];

      if (brandIds.length === 0) {
        return [];
      }

      const { data: brandsData, error: brandsError } = await this.client
        .from(TABLES.pieces_marque)
        .select('pm_id, pm_name')
        .in('pm_id', brandIds)
        .order('pm_name', { ascending: true });

      if (brandsError) {
        this.logger.error('Erreur getBrandsForGamme (brands):', brandsError);
        throw brandsError;
      }

      const brands =
        brandsData?.map((b) => ({
          id: b.pm_id.toString(),
          name: b.pm_name,
        })) || [];

      this.logger.log(
        `✅ Trouvé ${brands.length} marques vendables pour gamme ${gammeId}`,
      );

      return brands;
    } catch (error) {
      this.logger.error('❌ Erreur dans getBrandsForGamme:', error);
      return [];
    }
  }

  /**
   * 📋 FILTRES DYNAMIQUES - Récupérer gammes d'une marque spécifique
   */
  async getGammesForBrand(brandId: number) {
    try {
      this.logger.log(`🔍 Récupération gammes pour marque ${brandId}`);

      const { data: piecesData, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('piece_pg_id')
        .eq('piece_pm_id', brandId)
        .eq('piece_display', true)
        .limit(50000);

      if (piecesError) {
        this.logger.error('Erreur getGammesForBrand (pieces):', piecesError);
        throw piecesError;
      }

      const gammeIds = [
        ...new Set(piecesData?.map((p) => p.piece_pg_id).filter(Boolean)),
      ];

      if (gammeIds.length === 0) {
        return [];
      }

      const { data: gammesData, error: gammesError } = await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name')
        .in('pg_id', gammeIds)
        .order('pg_name', { ascending: true });

      if (gammesError) {
        this.logger.error('Erreur getGammesForBrand (gammes):', gammesError);
        throw gammesError;
      }

      const gammes =
        gammesData?.map((g) => ({
          id: g.pg_id.toString(),
          name: g.pg_name,
        })) || [];

      this.logger.log(
        `✅ Trouvé ${gammes.length} gammes vendables pour marque ${brandId}`,
      );

      return gammes;
    } catch (error) {
      this.logger.error('❌ Erreur dans getGammesForBrand:', error);
      return [];
    }
  }
}
