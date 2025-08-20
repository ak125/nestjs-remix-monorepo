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

interface UpdateProductDto extends Partial<CreateProductDto> {}

interface SearchProductDto {
  search?: string;
  rangeId?: number;
  brandId?: number;
  limit?: number;
  page?: number;
}

/**
 * Service pour la gestion des produits automobiles
 * Utilise les vraies tables de la base de données :
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
        .from('pieces')
        .select(`
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
        `)
        .limit(filters?.limit || 50);

      if (filters?.search) {
        query = query.or(
          `piece_name.ilike.%${filters.search}%,piece_ref.ilike.%${filters.search}%,piece_ref_brut.ilike.%${filters.search}%`
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

      let query = this.client.from('pieces').select(
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
   * Récupérer une pièce par ID avec toutes ses relations
   */
  async findOne(id: string) {
    try {
      // D'abord récupérer les données de base de la pièce
      const { data: pieceData, error: pieceError } = await this.client
        .from('pieces')
        .select('*')
        .eq('piece_id', id)
        .single();

      if (pieceError) {
        this.logger.error(`Erreur findOne pièce pour ${id}:`, pieceError);
        throw pieceError;
      }

      if (!pieceData) {
        throw new Error(`Pièce ${id} non trouvée`);
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
          .from('auto_marque')
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
        .from('pieces_price')
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
        .from('pieces')
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
        .from('pieces')
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
        .from('products')
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
      const { data, error } = await this.client
        .from('products')
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
        .from('products')
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
        .select(`
          product:products(
            *,
            range:product_ranges(*),
            prices:product_prices(*),
            images:product_images(*)
          )
        `)
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
        .from('pieces_gamme')
        .select('*')
        .limit(3);

      // Test auto_marque
      const { data: marques, error: marqueError } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_name')
        .limit(5);

      // Test pieces
      const { data: pieces, error: piecesError } = await this.client
        .from('pieces')
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
      return { error: error.message };
    }
  }

  /**
   * Obtenir les statistiques réelles des produits
   */
  async getStats() {
    try {
      // Compter les pièces totales
      const { count: totalPieces, error: piecesError } = await this.client
        .from('pieces')
        .select('*', { count: 'exact', head: true });

      // Compter les pièces actives
      const { count: activePieces, error: activeError } = await this.client
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('piece_activ', '1');

      // Compter les gammes
      const { count: totalGammes, error: gammesError } = await this.client
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true });

      // Compter les marques actives (correction table)
      const { count: totalMarques, error: marquesError } = await this.client
        .from('pieces_marque')
        .select('*', { count: 'exact', head: true })
        .eq('marque_activ', '1');

      // Compter les pièces avec stock faible (seulement celles qui ont un stock défini)
      const { count: lowStockCount, error: lowStockError } = await this.client
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .not('piece_stock', 'is', null)
        .lte('piece_stock', 10)
        .eq('piece_activ', '1');

      if (
        piecesError ||
        activeError ||
        gammesError ||
        marquesError ||
        lowStockError
      ) {
        this.logger.error('Erreur getStats:', {
          piecesError,
          activeError,
          gammesError,
          marquesError,
          lowStockError,
        });
      }

      const stats = {
        totalProducts: totalPieces || 0,
        activeProducts: activePieces || 0,
        totalCategories: totalGammes || 0,
        totalBrands: totalMarques || 0,
        lowStockItems: lowStockCount || 0,
      };

      this.logger.log('Statistiques produits:', stats);
      return stats;
    } catch (error) {
      this.logger.error('Erreur dans getStats:', error);
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
   * Récupérer toutes les gammes de pièces (vraie méthode)
   */
  async getGammes() {
    try {
      const { data, error } = await this.client
        .from('pieces_gamme')
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
   * @deprecated Utiliser getGammes() à la place
   * Récupérer toutes les gammes de produits (utilise la vraie structure)
   */
  async getProductRanges() {
    try {
      const { data, error } = await this.client
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_alias, pg_pic, pg_display, pg_top')
        .eq('pg_display', '1')
        .order('pg_name', { ascending: true })
        .limit(50);

      if (error) {
        this.logger.error('Erreur getProductRanges:', error);
        throw error;
      }

      return (
        data?.map((range) => ({
          id: range.pg_id,
          name: range.pg_name,
          alias: range.pg_alias,
          image: range.pg_pic,
          is_active: range.pg_display === '1',
          is_top: range.pg_top === '1',
        })) || []
      );
    } catch (error) {
      this.logger.error('Erreur dans getProductRanges:', error);
      throw error;
    }
  }

  /**
   * Test simple des marques
   */
  async getBrandsTest() {
    try {
      const { data, error } = await this.client
        .from('auto_marque')
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
   * Récupérer toutes les marques automobiles (simplifié)
   */
  async getBrands() {
    try {
      const { data, error } = await this.client
        .from('auto_marque')
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
        .from('auto_models')
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
        .from('auto_types')
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
        .from('products')
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
}
