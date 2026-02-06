import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * Service pour les données techniques des produits :
 * références OEM, critères techniques, compatibilités véhicule.
 *
 * Extrait de ProductsService pour séparation des responsabilités.
 */
@Injectable()
export class ProductsTechnicalService extends SupabaseBaseService {
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
}
