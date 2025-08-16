import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * Service pour gérer les données automobiles avec les tables existantes
 * Utilise: auto_marque, auto_modele, auto_type, pieces, pieces_price
 */
@Injectable()
export class AutoDataService extends SupabaseBaseService {
  private readonly logger = new Logger(AutoDataService.name);

  /**
   * Récupérer toutes les marques automobiles
   */
  async getBrands() {
    try {
      const { data: brands, error } = await this.supabase
        .from('auto_marque')
        .select('*')
        .eq('marque_activ', '1') // Seulement les marques actives
        .order('marque_name');

      if (error) throw error;

      return {
        success: true,
        data: brands.map(brand => ({
          id: brand.marque_id,
          code: brand.marque_code,
          name: brand.marque_name,
          logo: brand.marque_logo,
          isActive: brand.marque_activ === '1',
          slug: brand.marque_slug
        }))
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des marques:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async getModelsByBrand(brandId: string) {
    try {
      const { data: models, error } = await this.supabase
        .from('auto_modele')
        .select('*')
        .eq('modele_marque_id', brandId)
        .order('modele_name');

      if (error) throw error;

      return {
        success: true,
        data: models.map(model => ({
          id: model.modele_id,
          brandId: model.modele_marque_id,
          name: model.modele_name,
          yearStart: model.modele_year_begin,
          yearEnd: model.modele_year_end,
          slug: model.modele_slug
        }))
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des modèles:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Récupérer les types/versions d'un modèle
   */
  async getTypesByModel(modelId: string) {
    try {
      const { data: types, error } = await this.supabase
        .from('auto_type')
        .select('*')
        .eq('type_modele_id', modelId)
        .order('type_name');

      if (error) throw error;

      return {
        success: true,
        data: types.map(type => ({
          id: type.type_id,
          modelId: type.type_modele_id,
          name: type.type_name,
          motorCode: type.type_motor_code,
          fuelType: type.type_motor_fuel,
          power: type.type_motor_power,
          yearStart: type.type_year_begin,
          yearEnd: type.type_year_end
        }))
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des types:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Rechercher des pièces par compatibilité véhicule
   */
  async searchPartsByVehicle({
    brandId,
    modelId, 
    typeId,
    gamme,
    limit = 50,
    offset = 0
  }: {
    brandId?: string;
    modelId?: string;
    typeId?: string;
    gamme?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = this.supabase
        .from('pieces')
        .select(`
          piece_id,
          piece_title,
          piece_ref,
          piece_marque,
          piece_gamme,
          piece_description,
          piece_price_public,
          piece_stock,
          piece_img_principal
        `)
        .eq('piece_statut', '1') // Seulement les pièces actives
        .range(offset, offset + limit - 1);

      // Filtrer par gamme si spécifiée
      if (gamme) {
        query = query.ilike('piece_gamme', `%${gamme}%`);
      }

      // Filtrer par marque de pièce si spécifiée
      if (brandId) {
        query = query.eq('piece_marque_id', brandId);
      }

      const { data: parts, error } = await query.order('piece_title');

      if (error) throw error;

      // Pour les pièces trouvées, on peut aussi récupérer leur compatibilité
      // via la table pieces_relation_type si nécessaire

      return {
        success: true,
        data: parts.map(part => ({
          id: part.piece_id,
          title: part.piece_title,
          reference: part.piece_ref,
          brand: part.piece_marque,
          gamme: part.piece_gamme,
          description: part.piece_description,
          price: parseFloat(part.piece_price_public || '0'),
          stock: parseInt(part.piece_stock || '0'),
          image: part.piece_img_principal
        })),
        pagination: {
          limit,
          offset,
          total: parts.length
        }
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche de pièces:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Récupérer les détails d'une pièce avec ses prix
   */
  async getPartDetails(partId: string) {
    try {
      // Récupérer la pièce
      const { data: part, error: partError } = await this.supabase
        .from('pieces')
        .select('*')
        .eq('piece_id', partId)
        .single();

      if (partError) throw partError;

      // Récupérer les prix de cette pièce
      const { data: prices, error: pricesError } = await this.supabase
        .from('pieces_price')
        .select('*')
        .eq('price_piece_id', partId);

      if (pricesError) {
        this.logger.warn('Erreur lors de la récupération des prix:', pricesError);
      }

      return {
        success: true,
        data: {
          ...part,
          prices: prices || []
        }
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des détails:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Recherche rapide de pièces par référence ou titre
   */
  async quickSearchParts(searchTerm: string, limit = 20) {
    try {
      const { data: parts, error } = await this.supabase
        .from('pieces')
        .select(`
          piece_id,
          piece_title,
          piece_ref,
          piece_marque,
          piece_price_public,
          piece_img_principal
        `)
        .or(`piece_title.ilike.%${searchTerm}%,piece_ref.ilike.%${searchTerm}%`)
        .eq('piece_statut', '1')
        .limit(limit)
        .order('piece_title');

      if (error) throw error;

      return {
        success: true,
        data: parts.map(part => ({
          id: part.piece_id,
          title: part.piece_title,
          reference: part.piece_ref,
          brand: part.piece_marque,
          price: parseFloat(part.piece_price_public || '0'),
          image: part.piece_img_principal
        }))
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche rapide:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
}
