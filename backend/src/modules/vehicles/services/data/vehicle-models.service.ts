import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../core/vehicle-cache.service';
import { VehicleModel, PaginationOptions, VehicleResponse } from '../../types/vehicle.types';

/**
 * 🚗 VEHICLE MODELS SERVICE - Service dédié à la gestion des modèles
 * 
 * Responsabilités :
 * - CRUD des modèles automobiles
 * - Recherche et filtrage par modèle
 * - Modèles par marque
 * - Statistiques des modèles
 * - Cache optimisé pour les modèles
 */

export interface ModelStats {
  totalModels: number;
  activeModels: number;
  modelsWithTypes: number;
  topModels: Array<{
    modele_name: string;
    marque_name: string;
    typeCount: number;
  }>;
}

@Injectable()
export class VehicleModelsService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleModelsService.name);

  constructor(
    private cacheService: VehicleCacheService,
  ) {
    super();
    this.logger.log('🚗 VehicleModelsService initialisé');
  }

  /**
   * 🚗 Obtenir tous les modèles avec pagination
   */
  async getModels(options: PaginationOptions = {}): Promise<VehicleResponse<VehicleModel>> {
    const cacheKey = `all_models:${JSON.stringify(options)}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          this.logger.debug('🚗 Récupération des modèles');

          const { page = 0, limit = 50, search } = options;
          const offset = page * limit;

          let query = this.client
            .from('auto_modele')
            .select(`
              *,
              auto_marque!inner(
                marque_id,
                marque_name
              )
            `)
            .eq('modele_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          if (search?.trim()) {
            query = query.ilike('modele_name', `%${search}%`);
          }

          const { data, error, count } = await query.order('modele_name', { ascending: true });

          if (error) {
            this.logger.error('Erreur getModels:', error);
            throw error;
          }

          return {
            data: data || [],
            total: count || 0,
            page,
            limit
          };
        } catch (error) {
          this.logger.error('Erreur getModels:', error);
          throw error;
        }
      }
    );
  }

  /**
   * 🚗 Obtenir un modèle par ID
   */
  async getModelById(modeleId: number): Promise<VehicleModel | null> {
    const cacheKey = `model_id:${modeleId}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from('auto_modele')
            .select(`
              *,
              auto_marque!inner(
                marque_id,
                marque_name
              )
            `)
            .eq('modele_id', modeleId)
            .eq('modele_display', 1)
            .single();

          if (error) {
            this.logger.debug(`Modèle non trouvé: ${modeleId}`);
            return null;
          }

          return data;
        } catch (error) {
          this.logger.error(`Erreur getModelById ${modeleId}:`, error);
          return null;
        }
      }
    );
  }

  /**
   * 🚗 Obtenir les modèles par marque
   */
  async getModelsByBrand(
    marqueId: number,
    options: PaginationOptions = {}
  ): Promise<VehicleResponse<VehicleModel>> {
    const cacheKey = `models_by_brand:${marqueId}:${JSON.stringify(options)}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`🚗 Récupération des modèles pour marque: ${marqueId}, options: ${JSON.stringify(options)}`);

          const { page = 0, limit = 50, search, year } = options;
          const offset = page * limit;

          let query = this.client
            .from('auto_modele')
            .select(`
              *,
              auto_marque!inner(
                marque_id,
                marque_name
              )
            `)
            .eq('auto_marque.marque_id', marqueId)
            .eq('modele_display', 1);

          // 📅 Filtrage par année si spécifiée
          if (year) {
            this.logger.debug(`🗓️ Filtrage par année: ${year}`);
            
            // Requête pour obtenir les modèles qui ont des motorisations compatibles avec l'année
            const { data: compatibleModels, error: yearError } = await this.client
              .from('auto_modele')
              .select(`
                modele_id,
                auto_type!inner(
                  type_year_from,
                  type_year_to
                )
              `)
              .eq('auto_marque.marque_id', marqueId)
              .eq('modele_display', 1)
              .lte('auto_type.type_year_from', year)
              .or(`type_year_to.gte.${year},type_year_to.is.null`, { foreignTable: 'auto_type' });

            if (yearError) {
              this.logger.error('Erreur filtrage par année:', yearError);
              throw yearError;
            }

            // Extraire les IDs des modèles compatibles
            const compatibleIds = [...new Set(compatibleModels?.map(m => m.modele_id) || [])];
            
            if (compatibleIds.length === 0) {
              this.logger.debug(`❌ Aucun modèle compatible avec l'année ${year}`);
              return { success: true, data: [], total: 0, page, limit };
            }

            this.logger.debug(`✅ ${compatibleIds.length} modèles compatibles avec l'année ${year}`);
            
            // Ajouter le filtre sur les IDs compatibles
            query = query.in('modele_id', compatibleIds);
          }

          if (search?.trim()) {
            query = query.ilike('modele_name', `%${search}%`);
          }

          query = query
            .limit(limit)
            .range(offset, offset + limit - 1)
            .order('modele_name');

          const { data, error, count } = await query;

          if (error) {
            this.logger.error('Erreur getModelsByBrand:', error);
            throw error;
          }

          return {
            success: true,
            data: data || [],
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error(`Erreur getModelsByBrand ${marqueId}:`, error);
          throw error;
        }
      }
    );
  }

  /**
   * 🔍 Rechercher des modèles
   */
  async searchModels(
    query: string,
    options: PaginationOptions & { marqueId?: number } = {}
  ): Promise<VehicleResponse<VehicleModel>> {
    if (!query?.trim()) {
      return await this.getModels(options);
    }

    const cacheKey = `search_models:${query}:${JSON.stringify(options)}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`🔍 Recherche modèles: ${query}`);

          const { page = 0, limit = 50, marqueId } = options;
          const offset = page * limit;

          let dbQuery = this.client
            .from('auto_modele')
            .select(`
              *,
              auto_marque!inner(
                marque_id,
                marque_name
              )
            `)
            .eq('modele_display', 1)
            .or(
              `modele_name.ilike.%${query}%,` +
              `auto_marque.marque_name.ilike.%${query}%`
            )
            .limit(limit)
            .range(offset, offset + limit - 1);

          if (marqueId) {
            dbQuery = dbQuery.eq('auto_marque.marque_id', marqueId);
          }

          const { data, error, count } = await dbQuery.order('modele_name');

          if (error) {
            this.logger.error('Erreur searchModels:', error);
            throw error;
          }

          return {
            data: data || [],
            total: count || 0,
            page,
            limit
          };
        } catch (error) {
          this.logger.error(`Erreur searchModels ${query}:`, error);
          throw error;
        }
      }
    );
  }

  /**
   * 📊 Obtenir les statistiques des modèles
   */
  async getModelStats(): Promise<ModelStats> {
    const cacheKey = 'model_stats:global';
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          this.logger.debug('📊 Calcul des statistiques modèles');

          // Total des modèles
          const { count: totalModels } = await this.client
            .from('auto_modele')
            .select('modele_id', { count: 'exact' });

          // Modèles actifs
          const { count: activeModels } = await this.client
            .from('auto_modele')
            .select('modele_id', { count: 'exact' })
            .eq('modele_display', 1);

          // Modèles avec types
          const { data: modelsWithTypes } = await this.client
            .from('auto_modele')
            .select(`
              modele_id,
              modele_name,
              auto_type(type_id)
            `)
            .eq('modele_display', 1);

          const modelsWithTypesCount = modelsWithTypes?.filter(
            model => model.auto_type?.length > 0
          ).length || 0;

          // Top modèles
          const topModels = await this.getTopModels();

          return {
            totalModels: totalModels || 0,
            activeModels: activeModels || 0,
            modelsWithTypes: modelsWithTypesCount,
            topModels
          };
        } catch (error) {
          this.logger.error('Erreur getModelStats:', error);
          return {
            totalModels: 0,
            activeModels: 0,
            modelsWithTypes: 0,
            topModels: []
          };
        }
      }
    );
  }

  /**
   * 🏆 Obtenir le top des modèles
   */
  private async getTopModels(limit: number = 10): Promise<Array<{
    modele_name: string;
    marque_name: string;
    typeCount: number;
  }>> {
    try {
      const { data } = await this.client
        .from('auto_modele')
        .select(`
          modele_name,
          auto_marque!inner(marque_name),
          auto_type(type_id)
        `)
        .eq('modele_display', 1)
        .limit(limit * 2); // Prendre plus pour filtrer ensuite

      return (data || [])
        .map(model => ({
          modele_name: model.modele_name,
          marque_name: model.auto_marque.marque_name,
          typeCount: model.auto_type?.length || 0
        }))
        .filter(model => model.typeCount > 0)
        .sort((a, b) => b.typeCount - a.typeCount)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Erreur getTopModels:', error);
      return [];
    }
  }

  /**
   * 🚗 Obtenir tous les modèles d'une marque (pour sélecteurs)
   */
  async getModelsForSelect(marqueId: number): Promise<Array<{ id: number; name: string }>> {
    const cacheKey = `models_select:${marqueId}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from('auto_modele')
            .select('modele_id, modele_name')
            .eq('modele_marque_id', marqueId)
            .eq('modele_display', 1)
            .order('modele_name');

          if (error) {
            this.logger.error('Erreur getModelsForSelect:', error);
            return [];
          }

          return (data || []).map(model => ({
            id: model.modele_id,
            name: model.modele_name
          }));
        } catch (error) {
          this.logger.error('Erreur getModelsForSelect:', error);
          return [];
        }
      }
    );
  }

  /**
   * 🔄 Vérifier si un modèle existe
   */
  async modelExists(modeleId: number): Promise<boolean> {
    try {
      const model = await this.getModelById(modeleId);
      return model !== null;
    } catch (error) {
      this.logger.error(`Erreur modelExists ${modeleId}:`, error);
      return false;
    }
  }

  /**
   * 📈 Obtenir les modèles populaires
   */
  async getPopularModels(limit: number = 10, marqueId?: number): Promise<VehicleModel[]> {
    const cacheKey = `popular_models:${limit}:${marqueId || 'all'}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          const topModels = await this.getTopModels(limit);
          
          const modelPromises = topModels
            .filter(model => !marqueId || model.marque_name) // Filtrer par marque si spécifié
            .map(async (model) => {
              // Récupérer le modèle complet
              const { data } = await this.client
                .from('auto_modele')
                .select(`
                  *,
                  auto_marque!inner(
                    marque_id,
                    marque_name
                  )
                `)
                .eq('modele_name', model.modele_name)
                .eq('auto_marque.marque_name', model.marque_name)
                .eq('modele_display', 1)
                .single();
              
              return data;
            });
          
          const models = await Promise.all(modelPromises);
          return models.filter(model => model !== null) as VehicleModel[];
        } catch (error) {
          this.logger.error('Erreur getPopularModels:', error);
          return [];
        }
      }
    );
  }

  /**
   * 🔍 Obtenir les suggestions de modèles (autocomplete)
   */
  async getModelSuggestions(
    query: string,
    marqueId?: number,
    limit: number = 10
  ): Promise<string[]> {
    if (!query?.trim()) return [];

    const cacheKey = `model_suggestions:${query}:${marqueId || 'all'}:${limit}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          let dbQuery = this.client
            .from('auto_modele')
            .select('modele_name')
            .eq('modele_display', 1)
            .ilike('modele_name', `%${query}%`)
            .limit(limit)
            .order('modele_name');

          if (marqueId) {
            dbQuery = dbQuery.eq('modele_marque_id', marqueId);
          }

          const { data } = await dbQuery;
          
          return data?.map(m => m.modele_name) || [];
        } catch (error) {
          this.logger.error(`Erreur getModelSuggestions ${query}:`, error);
          return [];
        }
      }
    );
  }

  /**
   * 📋 Obtenir le résumé d'un modèle avec ses types
   */
  async getModelSummary(modeleId: number): Promise<{
    model: VehicleModel;
    typeCount: number;
    yearRange: { min: number; max: number } | null;
    engines: string[];
  } | null> {
    const cacheKey = `model_summary:${modeleId}`;
    
    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          // Modèle de base
          const model = await this.getModelById(modeleId);
          if (!model) return null;

          // Informations sur les types
          const { data: types } = await this.client
            .from('auto_type')
            .select('type_year, type_engine_code')
            .eq('type_modele_id', modeleId)
            .eq('type_display', 1);

          const typeCount = types?.length || 0;
          
          // Plage d'années
          const years = types?.map(t => t.type_year).filter(Boolean) || [];
          const yearRange = years.length > 0 ? {
            min: Math.min(...years),
            max: Math.max(...years)
          } : null;

          // Moteurs uniques
          const engines = [...new Set(
            types?.map(t => t.type_engine_code).filter(Boolean) || []
          )];

          return {
            model,
            typeCount,
            yearRange,
            engines
          };
        } catch (error) {
          this.logger.error(`Erreur getModelSummary ${modeleId}:`, error);
          return null;
        }
      }
    );
  }
}