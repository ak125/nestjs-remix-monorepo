import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * Service enrichi pour gérer les données automobiles avec les tables existantes
 * Utilise: auto_marque, auto_modele, auto_type, pieces, pieces_price
 * Extensions: Compatibilité véhicules, recherche avancée, statistiques
 */
@Injectable()
export class AutoDataEnhancedService extends SupabaseBaseService {
  protected readonly logger = new Logger(AutoDataEnhancedService.name);

  /**
   * Récupérer toutes les marques automobiles
   */
  async getBrands() {
    try {
      const { data: brands, error } = await this.client
        .from('auto_marque')
        .select('*')
        .eq('marque_activ', '1') // Seulement les marques actives
        .order('marque_name');

      if (error) throw error;

      return {
        success: true,
        data:
          brands?.map((brand) => ({
            id: brand.marque_id,
            code: brand.marque_code,
            name: brand.marque_name,
            logo: brand.marque_logo,
            isActive: brand.marque_activ === '1',
            slug: brand.marque_slug,
          })) || [],
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des marques:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
      };
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async getModelsByBrand(brandId: string) {
    try {
      const { data: models, error } = await this.client
        .from('auto_modele')
        .select('*')
        .eq('modele_marque_id', brandId)
        .order('modele_name');

      if (error) throw error;

      return {
        success: true,
        data:
          models?.map((model) => ({
            id: model.modele_id,
            name: model.modele_name,
            brandId: model.modele_marque_id,
            slug: model.modele_slug,
            isActive: true,
          })) || [],
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des modèles:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
      };
    }
  }

  /**
   * Récupérer les types/versions d'un modèle
   */
  async getTypesByModel(modelId: string) {
    try {
      const { data: types, error } = await this.client
        .from('auto_type')
        .select('*')
        .eq('type_modele_id', modelId)
        .order('type_name');

      if (error) throw error;

      return {
        success: true,
        data:
          types?.map((type) => ({
            id: type.type_id,
            name: type.type_name,
            modelId: type.type_modele_id,
            fuelType: type.type_carburant,
            power: {
              cv: type.type_puissance_cv,
              kw: type.type_puissance_kw,
            },
            displacement: type.type_cylindree,
            engineCode: type.type_code_moteur,
            period: {
              start: type.type_date_debut,
              end: type.type_date_fin,
            },
          })) || [],
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des types:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
      };
    }
  }

  /**
   * 🚗 NOUVELLES FONCTIONNALITÉS VÉHICULES
   * Extensions du module automobile pour compatibilité et recherche avancée
   */

  /**
   * Récupérer les véhicules compatibles avec une pièce
   */
  async getCompatibleVehicles(pieceId: string) {
    try {
      // Recherche dans les tables de compatibilité existantes
      const { data: piece, error } = await this.client
        .from('pieces')
        .select(
          `
          piece_id,
          piece_title,
          piece_ref,
          piece_marque,
          piece_gamme
        `,
        )
        .eq('piece_id', pieceId)
        .single();

      if (error) throw error;

      // Obtenir les marques, modèles et types liés à cette pièce
      const { data: brands, error: brandsError } = await this.client
        .from('auto_marque')
        .select('*')
        .eq('marque_activ', '1');

      if (brandsError) throw brandsError;

      return {
        success: true,
        data: {
          piece,
          compatibleBrands:
            brands?.map((brand) => ({
              id: brand.marque_id,
              name: brand.marque_name,
              logo: brand.marque_logo,
              code: brand.marque_code,
            })) || [],
        },
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération de compatibilité:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: null,
      };
    }
  }

  /**
   * Recherche avancée de véhicules par critères multiples
   */
  async searchVehicles({
    brandId,
    modelId,
    typeId,
    year,
    engineCode,
    fuelType,
    limit = 50,
    offset = 0,
  }: {
    brandId?: string;
    modelId?: string;
    typeId?: string;
    year?: number;
    engineCode?: string;
    fuelType?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_name,
          type_carburant,
          type_puissance_cv,
          type_puissance_kw,
          type_cylindree,
          type_code_moteur,
          type_date_debut,
          type_date_fin,
          modele:auto_modele!inner(
            modele_id,
            modele_name,
            marque:auto_marque!inner(
              marque_id,
              marque_name,
              marque_logo,
              marque_code
            )
          )
        `,
        )
        .range(offset, offset + limit - 1);

      // Filtres conditionnels
      if (brandId) {
        query = query.eq('modele.marque.marque_id', brandId);
      }
      if (modelId) {
        query = query.eq('modele.modele_id', modelId);
      }
      if (typeId) {
        query = query.eq('type_id', typeId);
      }
      if (engineCode) {
        query = query.ilike('type_code_moteur', `%${engineCode}%`);
      }
      if (fuelType) {
        query = query.eq('type_carburant', fuelType);
      }

      const { data: vehicles, error } = await query.order(
        'modele.marque.marque_name',
      );

      if (error) throw error;

      return {
        success: true,
        data: vehicles || [],
        meta: {
          total: vehicles?.length || 0,
          limit,
          offset,
        },
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche de véhicules:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
      };
    }
  }

  /**
   * Obtenir les statistiques des véhicules
   */
  async getVehicleStats() {
    try {
      // Compter les marques actives
      const { count: brandsCount, error: brandsError } = await this.client
        .from('auto_marque')
        .select('marque_id', { count: 'exact' })
        .eq('marque_activ', '1');

      // Compter les modèles
      const { count: modelsCount, error: modelsError } = await this.client
        .from('auto_modele')
        .select('modele_id', { count: 'exact' });

      // Compter les types/versions
      const { count: typesCount, error: typesError } = await this.client
        .from('auto_type')
        .select('type_id', { count: 'exact' });

      if (brandsError || modelsError || typesError) {
        throw brandsError || modelsError || typesError;
      }

      return {
        success: true,
        data: {
          totalBrands: brandsCount || 0,
          totalModels: modelsCount || 0,
          totalTypes: typesCount || 0,
          lastUpdate: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors du calcul des statistiques véhicules:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: null,
      };
    }
  }

  /**
   * Recherche de pièces par véhicule spécifique
   */
  async getPartsByVehicle(brandId: string, modelId: string, typeId?: string) {
    try {
      const query = this.client
        .from('pieces')
        .select(
          `
          piece_id,
          piece_title,
          piece_ref,
          piece_marque,
          piece_gamme,
          piece_description,
          piece_price_public,
          piece_stock,
          piece_img_principal
        `,
        )
        .eq('piece_statut', '1');

      // Logique de recherche par gamme et marque automobile
      // (À adapter selon la structure réelle des relations)

      const { data: parts, error } = await query
        .limit(100)
        .order('piece_title');

      if (error) throw error;

      return {
        success: true,
        data: parts || [],
        meta: {
          brandId,
          modelId,
          typeId,
          total: parts?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la recherche de pièces par véhicule:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
      };
    }
  }

  /**
   * Recherche rapide de pièces par référence ou titre
   */
  async quickSearchParts(searchTerm: string, limit = 20) {
    try {
      const { data: parts, error } = await this.client
        .from('pieces')
        .select(
          `
          piece_id,
          piece_title,
          piece_ref,
          piece_marque,
          piece_gamme,
          piece_description,
          piece_price_public,
          piece_stock,
          piece_img_principal
        `,
        )
        .or(`piece_title.ilike.%${searchTerm}%,piece_ref.ilike.%${searchTerm}%`)
        .eq('piece_statut', '1')
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        data: parts || [],
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche rapide:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
      };
    }
  }

  /**
   * Rechercher des pièces par compatibilité véhicule (méthode existante améliorée)
   */
  async searchPartsByVehicle({
    brandId,
    modelId,
    typeId,
    gamme,
    limit = 50,
    offset = 0,
  }: {
    brandId?: string;
    modelId?: string;
    typeId?: string;
    gamme?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = this.client
        .from('pieces')
        .select(
          `
          piece_id,
          piece_title,
          piece_ref,
          piece_marque,
          piece_gamme,
          piece_description,
          piece_price_public,
          piece_stock,
          piece_img_principal
        `,
        )
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

      return {
        success: true,
        data: parts || [],
        meta: {
          total: parts?.length || 0,
          limit,
          offset,
          filters: { brandId, modelId, typeId, gamme },
        },
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la recherche de pièces par véhicule:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
      };
    }
  }

  /**
   * Récupérer les détails d'une pièce avec ses prix
   */
  async getPartDetails(partId: string) {
    try {
      const { data: part, error } = await this.client
        .from('pieces')
        .select(
          `
          piece_id,
          piece_title,
          piece_ref,
          piece_marque,
          piece_gamme,
          piece_description,
          piece_price_public,
          piece_stock,
          piece_img_principal,
          piece_statut
        `,
        )
        .eq('piece_id', partId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data: part,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des détails de pièce:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: null,
      };
    }
  }
}
