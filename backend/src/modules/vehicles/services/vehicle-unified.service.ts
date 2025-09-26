/**
 * 🚗 SERVICE VÉHICULES UNIFIÉ - Migration types partagés
 * 
 * Service NestJS utilisant les types unifiés @monorepo/shared-types
 * Démonstration de l'intégration backend avec types partagés
 */

import { Injectable } from '@nestjs/common';
import type {
  VehicleBrand,
  VehicleModel,
  VehicleType,
  ApiResponse,
  PaginationOptions,
  createSuccessResponse,
  createErrorResponse,
} from '@monorepo/shared-types';

// Import des fonctions utilitaires
import { 
  createSuccessResponse as createSuccess,
  createErrorResponse as createError,
  validateVehicleBrand,
} from '@monorepo/shared-types';

import { SupabaseService } from '../../../database/supabase/supabase.service';

// Type temporaire étendu pour les options de recherche  
interface SearchablePaginationOptions extends PaginationOptions {
  search?: string;
}

@Injectable()
export class VehicleUnifiedService {
  
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Récupère toutes les marques avec types unifiés
   */
  async getBrands(
    options: SearchablePaginationOptions = { page: 1, limit: 50 },
  ): Promise<ApiResponse<VehicleBrand[]>> {
    try {
      const supabase = this.supabaseService.getClient();
      
      let query = supabase
        .from('auto_marque')
        .select('*')
        .eq('marque_display', 1);

      if (options.search) {
        query = query.ilike('marque_name', `%${options.search}%`);
      }

      const { data, error, count } = await query
        .range(
          (options.page - 1) * options.limit,
          options.page * options.limit - 1
        )
        .order('marque_name');

      if (error) {
        return createError('DATABASE_ERROR', `Erreur récupération marques: ${error.message}`);
      }

      // Validation avec Zod des données récupérées
      const validatedBrands = data?.map(brand => {
        try {
          return validateVehicleBrand(brand);
        } catch (validationError) {
          console.warn('⚠️ Marque invalide ignorée:', brand, validationError);
          return null;
        }
      }).filter((brand): brand is VehicleBrand => brand !== null) || [];

      return createSuccess(
        validatedBrands,
        `${validatedBrands.length} marques récupérées avec succès`,
        {
          total: count || 0,
          page: options.page,
          limit: options.limit,
        }
      );

    } catch (error) {
      return createError('UNEXPECTED_ERROR', `Erreur inattendue: ${error.message}`);
    }
  }

  /**
   * Récupère les modèles d'une marque avec types unifiés
   */
  async getModelsByBrand(brandId: number, options: PaginationOptions = { page: 1, limit: 50 }): Promise<ApiResponse<VehicleModel[]>> {
    try {
      const supabase = this.supabaseService.getClient();
      
      let query = supabase
        .from('auto_modele')
        .select('*')
        .eq('modele_marque_id', brandId)
        .eq('modele_display', 1);

      if (options.search) {
        query = query.ilike('modele_name', `%${options.search}%`);
      }

      const { data, error, count } = await query
        .range(
          (options.page - 1) * options.limit,
          options.page * options.limit - 1
        )
        .order('modele_name');

      if (error) {
        return createError('DATABASE_ERROR', `Erreur récupération modèles: ${error.message}`);
      }

      // Cast vers VehicleModel (pas de validation Zod pour les modèles dans ce exemple)
      const models = (data || []) as VehicleModel[];

      return createSuccess(
        models,
        `${models.length} modèles récupérés pour la marque ${brandId}`,
        {
          total: count || 0,
          page: options.page,
          limit: options.limit,
        }
      );

    } catch (error) {
      return createError('UNEXPECTED_ERROR', `Erreur inattendue: ${error.message}`);
    }
  }

  /**
   * Récupère les types d'un modèle avec types unifiés
   */
  async getTypesByModel(modelId: number, options: PaginationOptions = { page: 1, limit: 50 }): Promise<ApiResponse<VehicleType[]>> {
    try {
      const supabase = this.supabaseService.getClient();
      
      let query = supabase
        .from('auto_type')
        .select('*')
        .eq('type_modele_id', modelId)
        .eq('type_display', 1);

      if (options.search) {
        query = query.ilike('type_name', `%${options.search}%`);
      }

      const { data, error, count } = await query
        .range(
          (options.page - 1) * options.limit,
          options.page * options.limit - 1
        )
        .order('type_name');

      if (error) {
        return createError('DATABASE_ERROR', `Erreur récupération types: ${error.message}`);
      }

      // Cast vers VehicleType
      const types = (data || []) as VehicleType[];

      return createSuccess(
        types,
        `${types.length} types récupérés pour le modèle ${modelId}`,
        {
          total: count || 0,
          page: options.page,
          limit: options.limit,
        }
      );

    } catch (error) {
      return createError('UNEXPECTED_ERROR', `Erreur inattendue: ${error.message}`);
    }
  }

  /**
   * Test de compatibilité avec les types unifiés
   */
  async testUnifiedTypes(): Promise<ApiResponse<{
    packageVersion: string;
    typesWorking: boolean;
    validationWorking: boolean;
    apiResponseWorking: boolean;
  }>> {
    try {
      // Test création d'une marque factice
      const testBrand: VehicleBrand = {
        marque_id: 999,
        marque_name: 'Test Brand',
        marque_alias: 'test',
        marque_display: 1,
        marque_relfollow: 1,
        marque_sitemap: 1,
      };

      // Test validation Zod
      let validationWorking = false;
      try {
        const validated = validateVehicleBrand(testBrand);
        validationWorking = validated.marque_name === 'Test Brand';
      } catch (error) {
        console.error('❌ Validation Zod échouée:', error);
      }

      // Test création réponse API
      const testResponse = createSuccess([testBrand], 'Test réussi');
      const apiResponseWorking = testResponse.success && testResponse.data?.length === 1;

      return createSuccess({
        packageVersion: '2.0.0',
        typesWorking: true,
        validationWorking,
        apiResponseWorking,
      }, 'Tests des types unifiés terminés');

    } catch (error) {
      return createError('TEST_ERROR', `Erreur tests: ${error.message}`);
    }
  }
}