import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { RpcGateService } from '../../security/rpc-gate/rpc-gate.service';

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
 * Service principal pour la gestion des produits automobiles (CRUD + Search)
 *
 * Autres responsabilités extraites vers :
 * - ProductsCatalogService (gammes, marques, modèles, stats, debug)
 * - ProductsAdminService (commercial, filtres dynamiques, toggle)
 * - ProductsTechnicalService (OEM, critères, compatibilités)
 */
@Injectable()
export class ProductsService extends SupabaseBaseService {
  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Récupérer toutes les pièces avec filtres et pagination
   */
  async findAll(filters?: SearchProductDto) {
    try {
      let query = this.client
        .from(TABLES.pieces)
        .select('*')
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

      // Récupérer gamme, marque et prix EN PARALLÈLE (optimisation 4x)
      const [gammeResult, marqueResult, priceResult] = await Promise.all([
        // Gamme
        pieceData.gamme_id
          ? this.client
              .from('auto_gamme')
              .select('gamme_id, gamme_name, gamme_description')
              .eq('gamme_id', pieceData.gamme_id)
              .single()
          : Promise.resolve({ data: null, error: null }),

        // Marque
        pieceData.marque_id
          ? this.client
              .from(TABLES.auto_marque)
              .select('marque_id, marque_name, marque_logo, marque_activ')
              .eq('marque_id', pieceData.marque_id)
              .single()
          : Promise.resolve({ data: null, error: null }),

        // Prix
        this.client
          .from(TABLES.pieces_price)
          .select('price_ht, price_ttc, price_vat, price_date')
          .eq('piece_id', id)
          .single(),
      ]);

      // Extraire les données
      const gammeData = gammeResult.data
        ? {
            gamme_id: gammeResult.data.gamme_id,
            gamme_name: gammeResult.data.gamme_name,
            gamme_description: gammeResult.data.gamme_description,
          }
        : null;

      const marqueData = marqueResult.data
        ? {
            marque_id: marqueResult.data.marque_id,
            marque_name: marqueResult.data.marque_name,
            marque_logo: marqueResult.data.marque_logo,
            marque_activ: marqueResult.data.marque_activ,
          }
        : null;

      const priceData = priceResult.data
        ? {
            price_ht: priceResult.data.price_ht,
            price_ttc: priceResult.data.price_ttc,
            price_vat: priceResult.data.price_vat,
            price_date: priceResult.data.price_date,
          }
        : null;

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
   * 🔍 Recherche rapide de produits pour ProductSearch component
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
          pieces_marque!left(pm_id, pm_name)
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
          marque_name: piece.pieces_marque?.pm_name,
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
}
