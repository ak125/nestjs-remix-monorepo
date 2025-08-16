import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

@Injectable()
export class CatalogService extends SupabaseBaseService {
  protected readonly logger = new Logger(CatalogService.name);

  /**
   * Récupérer toutes les marques automobiles actives
   */
  async getAutoBrands(limit: number = 50) {
    try {
      const { data, error } = await this.supabase
        .from('auto_marque')
        .select(`
          marque_id,
          marque_name,
          marque_alias,
          marque_logo,
          marque_display,
          marque_top
        `)
        .eq('marque_display', 1)
        .order('marque_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data?.map(brand => ({
          id: brand.marque_id,
          name: brand.marque_name,
          alias: brand.marque_alias,
          logo: brand.marque_logo,
          isTop: brand.marque_top === 1,
          isActive: brand.marque_display === 1
        })) || [],
        count: data?.length || 0
      };

    } catch (error) {
      this.logger.error('Erreur lors de la récupération des marques:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async getModelsByBrand(marqueId: number, limit: number = 100) {
    try {
      const { data, error } = await this.supabase
        .from('auto_modele')
        .select(`
          modele_id,
          modele_name,
          modele_alias,
          modele_year_from,
          modele_year_to,
          modele_body,
          modele_pic,
          modele_display
        `)
        .eq('modele_marque_id', marqueId)
        .eq('modele_display', 1)
        .order('modele_sort', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data?.map(model => ({
          id: model.modele_id,
          name: model.modele_name,
          alias: model.modele_alias,
          yearFrom: model.modele_year_from,
          yearTo: model.modele_year_to,
          body: model.modele_body,
          picture: model.modele_pic,
          isActive: model.modele_display === 1
        })) || [],
        count: data?.length || 0
      };

    } catch (error) {
      this.logger.error('Erreur lors de la récupération des modèles:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Rechercher des pièces par référence ou nom
   */
  async searchPieces(query: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await this.supabase
        .from('pieces')
        .select(`
          piece_id,
          piece_ref,
          piece_name,
          piece_des,
          piece_name_comp,
          piece_weight_kgm,
          piece_has_img,
          piece_display
        `)
        .or(`piece_ref.ilike.%${query}%,piece_name.ilike.%${query}%,piece_des.ilike.%${query}%`)
        .eq('piece_display', true)
        .order('piece_sort', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data?.map(piece => ({
          id: piece.piece_id,
          reference: piece.piece_ref,
          name: piece.piece_name,
          description: piece.piece_des,
          completeName: piece.piece_name_comp,
          weight: piece.piece_weight_kgm,
          hasImage: piece.piece_has_img,
          isActive: piece.piece_display
        })) || [],
        count: data?.length || 0
      };

    } catch (error) {
      this.logger.error('Erreur lors de la recherche de pièces:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Récupérer les détails d'une pièce
   */
  async getPieceById(pieceId: number) {
    try {
      const { data, error } = await this.supabase
        .from('pieces')
        .select(`
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
          piece_qty_pack
        `)
        .eq('piece_id', pieceId)
        .eq('piece_display', true)
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data ? {
          id: data.piece_id,
          reference: data.piece_ref,
          referenceClean: data.piece_ref_clean,
          name: data.piece_name,
          description: data.piece_des,
          completeName: data.piece_name_comp,
          side: data.piece_name_side,
          weight: data.piece_weight_kgm,
          hasOem: data.piece_has_oem,
          hasImage: data.piece_has_img,
          year: data.piece_year,
          quantitySale: data.piece_qty_sale,
          quantityPack: data.piece_qty_pack
        } : null
      };

    } catch (error) {
      this.logger.error('Erreur lors de la récupération de la pièce:', error);
      return {
        success: false,
        error: error.message,
        data: null
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
        .from('auto_marque')
        .select('*', { count: 'exact', head: true })
        .eq('marque_display', 1);

      // Statistiques des modèles
      const { count: modelsCount, error: modelsError } = await this.supabase
        .from('auto_modele')
        .select('*', { count: 'exact', head: true })
        .eq('modele_display', 1);

      // Statistiques des pièces
      const { count: piecesCount, error: piecesError } = await this.supabase
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('piece_display', true);

      if (brandsError || modelsError || piecesError) {
        throw new Error('Erreur lors du calcul des statistiques');
      }

      return {
        success: true,
        stats: {
          brands: brandsCount || 0,
          models: modelsCount || 0,
          pieces: piecesCount || 0,
          lastUpdate: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Erreur lors du calcul des statistiques:', error);
      return {
        success: false,
        error: error.message,
        stats: null
      };
    }
  }
}
