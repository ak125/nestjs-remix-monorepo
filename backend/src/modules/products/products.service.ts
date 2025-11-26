import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

// DTOs comme interfaces simples (pas de dépendances externes)
interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  price?: number;
  stock_quantity?: number;
  range_id?: number;
  brand_id?: number;
  is_active?: boolean;
}

interface UpdateProductDto extends Partial<CreateProductDto> {
  id?: string; // Ajout d'un champ id pour différencier de CreateProductDto
}

interface SearchProductDto {
  search?: string;
  rangeId?: number;
  brandId?: number;
  limit?: number;
  page?: number;
}

/**
 * Service pour la gestion des produits automobiles
 * Utilise les vraies table        // Mapper les produits enrichis
        enrichedProducts = products.map((product) => {
          const brand = brandsData.find((b) => b.marque_id === product.piece_pm_id);
          
          return {la base de données :
 * - pieces (table principale des pièces)
 * - pieces_gamme (gammes de pièces)
 * - pieces_marque (marques de pièces)
 * - auto_marque, auto_modele, auto_type (données automobiles)
 */
@Injectable()
export class ProductsService extends SupabaseBaseService {
  // Pas de constructeur - utilise celui du parent sans ConfigService
  // Cela évite les dépendances circulaires

  /**
   * Récupérer toutes les pièces avec filtres et pagination
   */
  async findAll(filters?: SearchProductDto) {
    try {
      let query = this.client
        .from(TABLES.pieces)
        .select(
          `
          *,
          pieces_gamme:pieces_gamme!inner(
            gamme_id,
            gamme_name,
            gamme_description
          ),
          pieces_marque:pieces_marque!inner(
            marque_id,
            marque_name,
            marque_logo
          )
        `,
        )
        .limit(filters?.limit || 50);

      if (filters?.search) {
        query = query.or(
          `piece_name.ilike.%${filters.search}%,piece_ref.ilike.%${filters.search}%,piece_ref_brut.ilike.%${filters.search}%`,
        );
      }

      if (filters?.rangeId) {
        query = query.eq('piece_gamme_id', filters.rangeId);
      }

      if (filters?.brandId) {
        query = query.eq('piece_marque_id', filters.brandId);
      }

      const offset = (filters?.page || 0) * (filters?.limit || 50);
      const { data, error } = await query
        .order('piece_name', { ascending: true })
        .range(offset, offset + (filters?.limit || 50) - 1);

      if (error) {
        this.logger.error('Erreur findAll:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: filters?.page || 0,
        limit: filters?.limit || 50,
      };
    } catch (error) {
      this.logger.error('Erreur dans findAll:', error);
      throw error;
    }
  }

  /**
   * Récupérer les pièces réelles avec pagination
   */
  async findAllPieces(
    options: {
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    try {
      const { search = '', page = 1, limit = 24 } = options;

      let query = this.client.from(TABLES.pieces).select(
        `
          piece_id,
          piece_name,
          piece_ref,
          piece_des,
          piece_display,
          piece_has_img,
          piece_has_oem,
          piece_year
        `,
        { count: 'exact' },
      );

      // Recherche si fournie
      if (search) {
        query = query.or(
          `piece_name.ilike.%${search}%,piece_ref.ilike.%${search}%,piece_des.ilike.%${search}%`,
        );
      }

      // Filtrer seulement les pièces affichables
      query = query.eq('piece_display', true);

      // Pagination
      const startIndex = (page - 1) * limit;
      query = query.range(startIndex, startIndex + limit - 1);

      // Tri par nom
      query = query.order('piece_name', { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Erreur findAllPieces:', error);
        throw error;
      }

      // Mapper les données vers le format attendu par le frontend
      const mappedProducts = (data || []).map((piece) => ({
        piece_id: piece.piece_id,
        piece_name: piece.piece_name || 'Nom non défini',
        piece_alias: piece.piece_ref || piece.piece_des || '',
        piece_sku: piece.piece_ref,
        piece_activ: piece.piece_display || false,
        piece_top: false, // On peut définir une logique plus tard
        piece_description: piece.piece_des,
      }));

      return {
        products: mappedProducts,
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0,
      };
    } catch (error) {
      this.logger.error('Erreur dans findAllPieces:', error);
      throw error;
    }
  }

  /**
   * Générer des données simulées pour un produit non trouvé en DB
   */
  private getMockProduct(id: string) {
    return {
      id: id,
      piece_id: id,
      name: `Produit simulé ${id}`,
      piece_name: `Produit simulé ${id}`,
      sku: id.toUpperCase(),
      piece_ref: id.toUpperCase(),
      description: `Description du produit ${id} - Données de démonstration`,
      price: 29.99 + (parseInt(id.replace(/\D/g, ''), 10) || 0) * 0.01,
      price_ht: 29.99 + (parseInt(id.replace(/\D/g, ''), 10) || 0) * 0.01,
      price_ttc: 35.99 + (parseInt(id.replace(/\D/g, ''), 10) || 0) * 0.01,
      stock_quantity: Math.floor(Math.random() * 100),
      piece_stock: Math.floor(Math.random() * 100),
      is_active: true,
      piece_activ: 1,
      brand: {
        id: 1,
        name: 'Marque Simulée',
        logo: '/images/mock-brand.jpg',
      },
      category: {
        id: 1,
        name: 'Catégorie Simulée',
      },
      images: [`/images/mock-product-${id}.jpg`],
      rating: 4.0 + Math.random(),
      reviewCount: Math.floor(Math.random() * 50),
      deliveryTime: '24-48h',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Récupérer une pièce par ID avec toutes ses relations
   */
  async findOne(id: string) {
    try {
      // Vérifier si l'ID est numérique pour les vraies pièces de la DB
      const isNumericId = /^\d+$/.test(id);

      if (!isNumericId) {
        // Pour les IDs non-numériques, retourner des données simulées
        return this.getMockProduct(id);
      }

      // D'abord récupérer les données de base de la pièce
      const { data: pieceData, error: pieceError } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .eq('piece_id', parseInt(id, 10))
        .single();

      if (pieceError) {
        this.logger.error(`Erreur findOne pièce pour ${id}:`, pieceError);
        // Si pas trouvé en DB, retourner données simulées
        if (pieceError.code === 'PGRST116') {
          return this.getMockProduct(id);
        }
        throw pieceError;
      }

      if (!pieceData) {
        // Si pas de données, retourner données simulées
        return this.getMockProduct(id);
      }

      // Récupérer les données de gamme si disponibles
      let gammeData = null;
      if (pieceData.gamme_id) {
        const { data: gamme, error: gammeError } = await this.client
          .from('auto_gamme')
          .select('*')
          .eq('gamme_id', pieceData.gamme_id)
          .single();

        if (!gammeError && gamme) {
          gammeData = {
            gamme_id: gamme.gamme_id,
            gamme_name: gamme.gamme_name,
            gamme_description: gamme.gamme_description,
          };
        }
      }

      // Récupérer les données de marque si disponibles
      let marqueData = null;
      if (pieceData.marque_id) {
        const { data: marque, error: marqueError } = await this.client
          .from(TABLES.auto_marque)
          .select('*')
          .eq('marque_id', pieceData.marque_id)
          .single();

        if (!marqueError && marque) {
          marqueData = {
            marque_id: marque.marque_id,
            marque_name: marque.marque_name,
            marque_logo: marque.marque_logo,
            marque_activ: marque.marque_activ,
          };
        }
      }

      // Récupérer les prix si disponibles
      let priceData = null;
      const { data: price, error: priceError } = await this.client
        .from(TABLES.pieces_price)
        .select('*')
        .eq('piece_id', id)
        .single();

      if (!priceError && price) {
        priceData = {
          price_ht: price.price_ht,
          price_ttc: price.price_ttc,
          price_vat: price.price_vat,
          price_date: price.price_date,
        };
      }

      // Combiner toutes les données
      const result = {
        ...pieceData,
        pieces_gamme: gammeData,
        pieces_marque: marqueData,
        pieces_price: priceData,
      };

      this.logger.log(`Produit ${id} récupéré avec succès`);
      return result;
    } catch (error) {
      this.logger.error(`Erreur dans findOne pour ${id}:`, error);
      throw error;
    }
  }

  /**
   * Rechercher une pièce par référence
   */
  async findBySku(sku: string) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .or(`piece_ref.eq.${sku},piece_ref_brut.eq.${sku}`)
        .single();

      if (error) {
        this.logger.error(`Erreur findBySku pour ${sku}:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error(`Erreur dans findBySku pour ${sku}:`, error);
      throw error;
    }
  }

  /**
   * Créer une nouvelle pièce
   */
  async create(createProductDto: CreateProductDto) {
    try {
      const pieceData = {
        piece_name: createProductDto.name,
        piece_ref: createProductDto.sku,
        piece_description: createProductDto.description,
        piece_gamme_id: createProductDto.range_id,
        piece_marque_id: createProductDto.brand_id,
        piece_stock: createProductDto.stock_quantity || 0,
        piece_activ: createProductDto.is_active ? '1' : '0',
      };

      const { data, error } = await this.client
        .from(TABLES.pieces)
        .insert(pieceData)
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur create:', error);
        throw error;
      }

      this.logger.log(`Pièce créée: ${data.piece_id}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur dans create:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un produit
   */
  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces)
        .update({
          ...updateProductDto,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Erreur update pour ${id}:`, error);
        throw error;
      }

      this.logger.log(`Produit mis à jour: ${id}`);
      return data;
    } catch (error) {
      this.logger.error(`Erreur dans update pour ${id}:`, error);
      throw error;
    }
  }

  /**
   * Supprimer un produit (soft delete)
   */
  async remove(id: string) {
    try {
      const { error } = await this.client
        .from(TABLES.pieces)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Erreur remove pour ${id}:`, error);
        throw error;
      }

      this.logger.log(`Produit supprimé (soft): ${id}`);
      return { message: 'Produit supprimé avec succès' };
    } catch (error) {
      this.logger.error(`Erreur dans remove pour ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour le stock d'un produit
   */
  async updateStock(id: string, quantity: number) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces)
        .update({
          stock_quantity: quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Erreur updateStock pour ${id}:`, error);
        throw error;
      }

      this.logger.log(`Stock mis à jour pour ${id}: ${quantity}`);
      return data;
    } catch (error) {
      this.logger.error(`Erreur dans updateStock pour ${id}:`, error);
      throw error;
    }
  }

  /**
   * Rechercher des produits compatibles avec un véhicule
   */
  async searchByVehicle(brandId: number, modelId: number, typeId?: number) {
    try {
      let query = this.client
        .from('product_vehicle_compatibility')
        .select(
          `
          product:products(
            *,
            range:product_ranges(*),
            prices:product_prices(*),
            images:product_images(*)
          )
        `,
        )
        .eq('brand_id', brandId)
        .eq('model_id', modelId);

      if (typeId) {
        query = query.eq('type_id', typeId);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Erreur searchByVehicle:', error);
        throw error;
      }

      return data?.map((item: any) => item.product) || [];
    } catch (error) {
      this.logger.error('Erreur dans searchByVehicle:', error);
      throw error;
    }
  }

  /**
   * Debug : vérifier le contenu des tables
   */
  async debugTables() {
    try {
      // Test pieces_gamme
      const { data: gammes, error: gammeError } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*')
        .limit(3);

      // Test auto_marque
      const { data: marques, error: marqueError } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name')
        .limit(5);

      // Test pieces
      const { data: pieces, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('piece_id, piece_name')
        .limit(5);

      return {
        gammes: {
          count: gammes?.length || 0,
          data: gammes,
          error: gammeError?.message,
        },
        marques: {
          count: marques?.length || 0,
          data: marques,
          error: marqueError?.message,
        },
        pieces: {
          count: pieces?.length || 0,
          data: pieces,
          error: piecesError?.message,
        },
      };
    } catch (error) {
      this.logger.error('Erreur debug:', error);
      return { error: (error as Error).message };
    }
  }

  /**
   * Obtenir les statistiques réelles des produits
   */
  async getStats() {
    try {
      // 🎯 Compter uniquement les pièces AFFICHABLES (piece_display = true)
      // Structure réelle vérifiée: piece_display = boolean
      const { count: totalPieces, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true);

      // Compter les pièces actives disponibles (avec stock > 0)
      // piece_qty_sale est de type SMALLINT (int2), comparaison numérique possible
      const { count: activePieces, error: activeError } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true)
        .not('piece_qty_sale', 'is', null)
        .gt('piece_qty_sale', 0);

      // Compter les gammes actives uniquement (pg_display = '1')
      const { count: totalGammes, error: gammesError } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', '1');

      // Compter les marques de pièces actives (pm_display = '1')
      // Note: pieces_marque contient les marques de pièces (toutes colonnes TEXT)
      const { count: totalMarques, error: marquesError } = await this.client
        .from(TABLES.pieces_marque)
        .select('*', { count: 'exact', head: true })
        .eq('pm_display', '1');

      // Compter les pièces avec stock faible (piece_qty_sale = 1)
      // piece_qty_sale est SMALLINT, comparaison numérique directe
      const { count: lowStockCount, error: lowStockError } = await this.client
        .from(TABLES.pieces)
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true)
        .eq('piece_qty_sale', 1);

      if (
        piecesError ||
        activeError ||
        gammesError ||
        marquesError ||
        lowStockError
      ) {
        this.logger.error(
          '⚠️ Erreur getStats (certaines requêtes ont échoué):',
          {
            piecesError: piecesError?.message,
            activeError: activeError?.message,
            gammesError: gammesError?.message,
            marquesError: marquesError?.message,
            lowStockError: lowStockError?.message,
          },
        );
      }

      const stats = {
        totalProducts: totalPieces || 0,
        activeProducts: activePieces || 0,
        totalCategories: totalGammes || 0,
        totalBrands: totalMarques || 0,
        lowStockItems: lowStockCount || 0,
      };

      this.logger.log(
        '📊 Statistiques produits (affichables uniquement):',
        stats,
      );
      return stats;
    } catch (error) {
      this.logger.error('❌ Erreur dans getStats:', error);
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalCategories: 0,
        totalBrands: 0,
        lowStockItems: 0,
      };
    }
  }

  /**
   * DEBUG: Examiner la vraie structure des données Supabase
   */
  async debugRealData() {
    try {
      // Récupérer quelques vraies pièces pour voir la structure - SANS spécifier les colonnes
      const { data: samplePieces, error: piecesError } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .limit(2);

      // Récupérer quelques vraies marques - SANS spécifier les colonnes
      const { data: sampleMarques, error: marquesError } = await this.client
        .from(TABLES.pieces_marque)
        .select('*')
        .limit(2);

      // Récupérer les tables disponibles (si possible)
      const { data: tables, error: tablesError } = await this.client
        .rpc('get_table_names')
        .limit(10);

      return {
        debug: true,
        message: 'Vraie structure des tables Supabase',
        samplePieces: samplePieces || [],
        sampleMarques: sampleMarques || [],
        tables: tables || [],
        errors: {
          piecesError: piecesError?.message || null,
          marquesError: marquesError?.message || null,
          tablesError: tablesError?.message || null,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur debug:', error);
      return {
        debug: true,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * DEBUG: Analyser la distribution des stocks
   */
  async debugStockDistribution() {
    try {
      // Échantillon de stocks pour comprendre la distribution
      const { data: stockSample, error: stockError } = await this.client
        .from(TABLES.pieces)
        .select('piece_id, piece_name, piece_qty_sale, piece_display')
        .eq('piece_display', true)
        .not('piece_qty_sale', 'is', null)
        .order('piece_qty_sale', { ascending: false })
        .limit(10);

      // Compter par ranges de stock
      const ranges = [
        { label: 'Stock 0', min: 0, max: 0 },
        { label: 'Stock 1-5', min: 1, max: 5 },
        { label: 'Stock 6-10', min: 6, max: 10 },
        { label: 'Stock 11-50', min: 11, max: 50 },
        { label: 'Stock 51+', min: 51, max: 999999 },
      ];

      const rangeCounts: any = {};
      for (const range of ranges) {
        const { count } = await this.client
          .from(TABLES.pieces)
          .select('*', { count: 'exact', head: true })
          .eq('piece_display', true)
          .gte('piece_qty_sale', range.min)
          .lte('piece_qty_sale', range.max);

        rangeCounts[range.label] = count || 0;
      }

      return {
        debug: 'Stock Distribution Analysis',
        stockSample: stockSample || [],
        rangeCounts,
        errors: { stockError },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        debug: 'Stock Distribution Error',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Récupérer toutes les gammes de pièces (vraie méthode)
   */
  async getGammes() {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias, pg_pic, pg_display, pg_top')
        .eq('pg_display', '1')
        .order('pg_name', { ascending: true })
        .limit(50);

      if (error) {
        this.logger.error('Erreur getGammes:', error);
        throw error;
      }

      return (
        data?.map((gamme) => ({
          id: gamme.pg_id,
          name: gamme.pg_name,
          alias: gamme.pg_alias,
          image: gamme.pg_pic,
          is_active: gamme.pg_display === '1',
          is_top: gamme.pg_top === '1',
        })) || []
      );
    } catch (error) {
      this.logger.error('Erreur dans getGammes:', error);
      throw error;
    }
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
          pg_id: any;
          pg_name: any;
          pg_alias: any;
          pg_pic: any;
          pg_display: any;
        } | null;
        error: any;
      };

      if (gammeError || !gammeInfo) {
        throw new Error(`Gamme ${gammeId} non trouvée`);
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
      let enrichedProducts: any[] = [];
      if (products && products.length > 0) {
        // Récupérer tous les IDs de marques uniques
        const brandIds = [
          ...new Set(products.map((p) => p.piece_pm_id).filter((id) => id)),
        ];

        // Récupérer les informations des marques en une seule requête
        let brandsData: any[] = [];
        if (brandIds.length > 0) {
          const { data: brands, error: brandsError } = await this.client
            .from(TABLES.auto_marque)
            .select(
              'marque_id, marque_name, marque_logo, marque_activ, marque_country',
            )
            .in('marque_id', brandIds);

          if (!brandsError && brands) {
            brandsData = brands;
          }
        }

        // Mapper les produits enrichis
        enrichedProducts = products.map((product) => {
          const brand = brandsData.find((b) => b.pm_id === product.piece_pm_id);

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
            // Informations enrichies disponibles directement
            weight: product.piece_weight_kgm,
            quantity_sale: product.piece_qty_sale,
            quantity_pack: product.piece_qty_pack,
            sort_order: product.piece_sort,
            reference_clean: product.piece_ref_clean,
            category_name: product.piece_fil_name,
            brand_id: product.piece_pm_id,
            gamme_id: product.piece_ga_id,
            filiere_id: product.piece_fil_id,
            // Marque enrichie
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
            // Prix et autres infos (à enrichir plus tard)
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
   * Test simple des marques
   */
  async getBrandsTest() {
    try {
      const { data, error } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name')
        .limit(10);

      if (error) {
        return { error: error.message };
      }

      return { count: data?.length || 0, data };
    } catch (error) {
      return { error: 'Exception: ' + error };
    }
  }

  /**
   * 🔍 PHASE 9: Recherche rapide de produits pour ProductSearch component
   * Recherche dans: nom, référence, marque
   */
  async searchProducts(query: string, limit: number = 10) {
    try {
      const searchTerm = `%${query}%`;

      const { data, error } = await this.client
        .from(TABLES.pieces)
        .select(
          `
          piece_id,
          piece_name,
          piece_ref,
          piece_stock,
          pieces_price!left(pri_vente_ttc, pri_consigne_ttc),
          pieces_marque!left(marque_id, marque_name)
        `,
        )
        .or(`piece_name.ilike.${searchTerm},piece_ref.ilike.${searchTerm}`)
        .limit(limit);

      if (error) {
        this.logger.error('❌ Erreur searchProducts:', error);
        return [];
      }

      // Mapper les résultats au format attendu par ProductSearch
      return (
        data?.map((piece: any) => ({
          piece_id: piece.piece_id,
          name: piece.piece_name || 'Produit sans nom',
          reference: piece.piece_ref,
          marque_name: piece.pieces_marque?.marque_name,
          price_ttc: piece.pieces_price?.pri_vente_ttc
            ? parseFloat(piece.pieces_price.pri_vente_ttc)
            : undefined,
          consigne_ttc: piece.pieces_price?.pri_consigne_ttc
            ? parseFloat(piece.pieces_price.pri_consigne_ttc)
            : undefined,
          stock: piece.piece_stock,
          image_url: undefined, // TODO: Ajouter images plus tard
        })) || []
      );
    } catch (error) {
      this.logger.error('❌ Exception searchProducts:', error);
      return [];
    }
  }

  /**
   * Récupérer toutes les marques automobiles (simplifié)
   */
  async getBrands() {
    try {
      const { data, error } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name, marque_logo, marque_activ')
        .eq('marque_activ', '1')
        .order('marque_name', { ascending: true })
        .limit(50);

      if (error) {
        this.logger.error('Erreur getBrands:', error);
        throw error;
      }

      return (
        data?.map((brand) => ({
          id: brand.marque_id,
          name: brand.marque_name,
          logo: brand.marque_logo,
          is_active: brand.marque_activ === '1',
        })) || []
      );
    } catch (error) {
      this.logger.error('Erreur dans getBrands:', error);
      throw error;
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async getModels(brandId: number) {
    try {
      const { data, error } = await this.client
        .from(TABLES.auto_modele)
        .select('*')
        .eq('brand_id', brandId)
        .order('name', { ascending: true });

      if (error) {
        this.logger.error(`Erreur getModels pour brand ${brandId}:`, error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Erreur dans getModels pour brand ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer les types d'un modèle
   */
  async getTypes(modelId: number) {
    try {
      const { data, error } = await this.client
        .from(TABLES.auto_type)
        .select('*')
        .eq('model_id', modelId)
        .order('name', { ascending: true });

      if (error) {
        this.logger.error(`Erreur getTypes pour model ${modelId}:`, error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Erreur dans getTypes pour model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Récupérer les produits populaires
   */
  async getPopularProducts(limit = 10) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces)
        .select(
          `
          *,
          range:product_ranges(*),
          brand:auto_brands(*),
          images:product_images(*)
        `,
        )
        .eq('is_active', true)
        .order('view_count', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Erreur getPopularProducts:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur dans getPopularProducts:', error);
      throw error;
    }
  }

  // ========== MÉTHODES AVANCÉES POUR PARITÉ PHP ==========

  /**
   * Rechercher des produits par références OEM
   * Correspond à la table PIECES_REF_OEM
   */
  async findByOEMReference(filters: {
    oem_number?: string;
    manufacturer?: string;
    quality_level?: 'Original' | 'First' | 'Aftermarket';
    page?: number;
    limit?: number;
  }) {
    try {
      const { page = 1, limit = 20, ...oemFilters } = filters;

      let query = this.client.from(TABLES.pieces_ref_oem).select(
        `
          piece_id,
          oem_number,
          manufacturer,
          quality_level,
          notes,
          pieces:pieces!pieces_ref_oem_piece_id_fkey (
            piece_id,
            piece_name,
            piece_ref,
            piece_des,
            piece_display,
            piece_has_img
          )
        `,
        { count: 'exact' },
      );

      // Appliquer les filtres
      if (oemFilters.oem_number) {
        query = query.ilike('oem_number', `%${oemFilters.oem_number}%`);
      }
      if (oemFilters.manufacturer) {
        query = query.ilike('manufacturer', `%${oemFilters.manufacturer}%`);
      }
      if (oemFilters.quality_level) {
        query = query.eq('quality_level', oemFilters.quality_level);
      }

      // Pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Erreur findByOEMReference:', error);
        throw error;
      }

      return {
        products:
          data?.map((item) => ({
            ...item.pieces,
            oem_reference: {
              oem_number: item.oem_number,
              manufacturer: item.manufacturer,
              quality_level: item.quality_level,
              notes: item.notes,
            },
          })) || [],
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      this.logger.error('Erreur dans findByOEMReference:', error);
      throw error;
    }
  }

  /**
   * Rechercher des produits par critères techniques
   * Utilise la table pieces_criteria
   */
  async findByCriteria(filters: {
    criteria_type?: string;
    criteria_value?: number;
    criteria_unit?: string;
    tolerance?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      const { page = 1, limit = 20, ...criteriaFilters } = filters;

      let query = this.client.from(TABLES.pieces_criteria).select(
        `
          pc_piece_id,
          pc_cri_id,
          pc_cri_value,
          pc_display,
          pieces:pieces!pieces_criteria_pc_piece_id_fkey (
            piece_id,
            piece_name,
            piece_ref,
            piece_des,
            piece_display,
            piece_has_img
          )
        `,
        { count: 'exact' },
      );

      // Appliquer les filtres
      if (criteriaFilters.criteria_type) {
        query = query.eq('pc_cri_id', criteriaFilters.criteria_type);
      }
      if (criteriaFilters.criteria_value !== undefined) {
        // Note: La table pieces_criteria stocke les IDs, pas les valeurs
        // Cette logique doit être adaptée selon la structure réelle
        query = query.eq('pc_cri_value', criteriaFilters.criteria_value);
      }

      // Pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Erreur findByCriteria:', error);
        throw error;
      }

      return {
        products:
          data?.map((item) => ({
            ...item.pieces,
            criteria: {
              cri_id: item.pc_cri_id,
              cri_value: item.pc_cri_value,
              display: item.pc_display,
            },
          })) || [],
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      this.logger.error('Erreur dans findByCriteria:', error);
      throw error;
    }
  }

  /**
   * Ajouter une référence OEM à un produit
   */
  async addOEMReference(
    pieceId: string,
    oemRef: {
      oem_number: string;
      manufacturer: string;
      quality_level: 'Original' | 'First' | 'Aftermarket';
      notes?: string;
    },
  ) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces_ref_oem)
        .insert({
          piece_id: parseInt(pieceId, 10),
          ...oemRef,
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur addOEMReference:', error);
        throw error;
      }

      this.logger.log(`Référence OEM ajoutée pour pièce ${pieceId}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur dans addOEMReference:', error);
      throw error;
    }
  }

  /**
   * Ajouter un critère technique à un produit
   */
  async addProductCriteria(
    pieceId: string,
    criteria: {
      cri_id: number;
      cri_value: string;
      display?: string;
    },
  ) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces_criteria)
        .insert({
          pc_piece_id: parseInt(pieceId, 10),
          pc_cri_id: criteria.cri_id,
          pc_cri_value: criteria.cri_value,
          pc_display: criteria.display || '1',
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur addProductCriteria:', error);
        throw error;
      }

      this.logger.log(`Critère technique ajouté pour pièce ${pieceId}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur dans addProductCriteria:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les compatibilités véhicule d'un produit
   */
  async getProductVehicleCompatibilities(pieceId: string) {
    try {
      const { data, error } = await this.client
        .from('vehicules_pieces')
        .select(
          `
          *,
          auto_marque:auto_marque!vehicules_pieces_brand_id_fkey(marque_name),
          auto_modele:auto_modele!vehicules_pieces_model_id_fkey(modele_name)
        `,
        )
        .eq('piece_id', parseInt(pieceId, 10));

      if (error) {
        this.logger.error('Erreur getProductVehicleCompatibilities:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur dans getProductVehicleCompatibilities:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les références OEM d'un produit
   */
  async getProductOEMReferences(pieceId: string) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces_ref_oem)
        .select('*')
        .eq('piece_id', parseInt(pieceId, 10));

      if (error) {
        this.logger.error('Erreur getProductOEMReferences:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur dans getProductOEMReferences:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les critères techniques d'un produit
   */
  async getProductCriteria(pieceId: string) {
    try {
      const { data, error } = await this.client
        .from(TABLES.pieces_criteria)
        .select('*')
        .eq('pc_piece_id', parseInt(pieceId, 10));

      if (error) {
        this.logger.error('Erreur getProductCriteria:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur dans getProductCriteria:', error);
      throw error;
    }
  }

  /**
   * 🏪 INTERFACE COMMERCIALE - Récupérer produits avec TOUS les détails
   * Pour page /products/admin (commercial level 3+)
   *
   * Retourne: produits avec prix (TTC/HT), stock, marque, activation
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
      let query = this.client.from(TABLES.pieces).select('*', { count: 'exact' });

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
        // piece_pg_id est le champ correct pour filtrer par gamme (pg_id)
        query = query.eq('piece_pg_id', gammeId);
        this.logger.log(`🔍 Filtre gammeId appliqué: ${gammeId}`);
      }

      if (categoryId) {
        query = query.eq('piece_ga_id', categoryId);
        this.logger.log(`🔍 Filtre categoryId appliqué: ${categoryId}`);
      }

      if (brandId) {
        // piece_pm_id est le champ correct pour filtrer par marque (pm_id)
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
      // IMPORTANT: pm_id peut être string ou number, on normalise en number
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
        // Marque
        const marque = marquesMap.get(item.piece_pm_id);

        // Gamme
        const gamme = gammesMap.get(item.piece_pg_id);

        // Prix - prendre le premier disponible
        const prices = pricesMap.get(item.piece_id) || [];
        const priceData =
          prices.find((p) => p.pri_dispo === '1') || prices[0] || {};

        const prixPublicTTC = parseFloat(priceData.pri_vente_ttc || '0');
        const prixProHT = parseFloat(priceData.pri_vente_ht || '0');
        const consigneTTC = parseFloat(priceData.pri_consigne_ttc || '0');
        const marge = parseFloat(priceData.pri_marge || '0');

        // Calcul marge si manquante
        const margeCalculee =
          marge > 0
            ? marge
            : prixProHT > 0
              ? ((prixPublicTTC - prixProHT) / prixPublicTTC) * 100
              : 0;

        // Stock
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
          // Infos additionnelles
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

      // Utiliser la fonction PostgreSQL optimisée
      const { data: gammesData, error: gammesError } = await this.client.rpc(
        'get_gammes_with_pieces',
      );

      if (gammesError) {
        this.logger.error('Erreur getGammesForFilters (RPC):', gammesError);
        throw gammesError;
      }

      const gammes =
        gammesData?.map((g: any) => ({
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

      // Utiliser la fonction PostgreSQL optimisée
      const { data: brandsData, error: brandsError } = await this.client.rpc(
        'get_brands_with_pieces',
      );

      if (brandsError) {
        this.logger.error(
          'Erreur getPieceBrandsForFilters (RPC):',
          brandsError,
        );
        throw brandsError;
      }

      const brands =
        brandsData?.map((b: any) => ({
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
   * Retourne toutes les marques qui ont des produits actifs dans cette gamme
   */
  async getBrandsForGamme(gammeId: number) {
    try {
      this.logger.log(`🔍 Récupération marques pour gamme ${gammeId}`);

      // Récupérer les marques des pièces actives de cette gamme avec LIMIT élevé
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

      // Extraire les IDs uniques
      const brandIds = [
        ...new Set(piecesData?.map((p) => p.piece_pm_id).filter(Boolean)),
      ];

      if (brandIds.length === 0) {
        return [];
      }

      // Récupérer les infos des marques
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
   * Retourne toutes les gammes qui ont des produits actifs de cette marque
   */
  async getGammesForBrand(brandId: number) {
    try {
      this.logger.log(`🔍 Récupération gammes pour marque ${brandId}`);

      // Récupérer les gammes des pièces actives de cette marque avec LIMIT élevé
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

      // Extraire les IDs uniques
      const gammeIds = [
        ...new Set(piecesData?.map((p) => p.piece_pg_id).filter(Boolean)),
      ];

      if (gammeIds.length === 0) {
        return [];
      }

      // Récupérer les infos des gammes
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
