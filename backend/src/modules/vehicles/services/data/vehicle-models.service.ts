import { TABLES, AutoType } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../core/vehicle-cache.service';
import {
  VehicleModel,
  PaginationOptions,
  VehicleResponse,
} from '../../types/vehicle.types';

type TypePartial = Pick<
  AutoType,
  'type_id' | 'type_modele_id' | 'type_year_from' | 'type_year_to' | 'type_fuel'
>;

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

  constructor(private readonly cacheService: VehicleCacheService) {
    super();
    this.logger.log('🚗 VehicleModelsService initialisé');
  }

  /**
   * 🚗 Obtenir tous les modèles avec pagination
   */
  async getModels(
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<VehicleModel>> {
    const cacheKey = `all_models:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          this.logger.debug('🚗 Récupération des modèles');

          const { page = 0, limit = 50, search } = options;
          const offset = page * limit;

          // ⚠️ Éviter la jointure auto_marque!inner qui échoue (pas de FK dans Supabase)
          let query = this.client
            .from(TABLES.auto_modele)
            .select('*')
            .eq('modele_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          if (search?.trim()) {
            query = query.ilike('modele_name', `%${search}%`);
          }

          const { data, error, count } = await query.order('modele_name', {
            ascending: true,
          });

          if (error) {
            this.logger.error('Erreur getModels:', error);
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
          this.logger.error('Erreur getModels:', error);
          throw error;
        }
      },
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
          // ⚠️ Éviter la jointure auto_marque!inner qui échoue (pas de FK dans Supabase)
          const { data, error } = await this.client
            .from(TABLES.auto_modele)
            .select('*')
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
      },
    );
  }

  /**
   * 🚗 Obtenir un modèle par marque et alias
   * Méthode simple pour récupérer un modèle spécifique sans logique de filtrage par motorisations
   */
  async getModelByBrandAndAlias(
    marqueId: number,
    alias: string,
  ): Promise<VehicleModel | null> {
    const cacheKey = `model_by_alias:${marqueId}:${alias}`;

    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          this.logger.debug(
            `🔍 Recherche modèle par alias: ${alias} (marque: ${marqueId})`,
          );

          // Utilise .limit(1) au lieu de .single() car certains alias sont dupliqués
          // (ex: "206" correspond à "206" et "206+")
          const { data, error } = await this.client
            .from(TABLES.auto_modele)
            .select('*')
            .eq('modele_marque_id', marqueId)
            .eq('modele_alias', alias)
            .eq('modele_display', 1)
            .order('modele_id', { ascending: true })
            .limit(1);

          if (error || !data || data.length === 0) {
            this.logger.debug(`Modèle non trouvé: ${alias}`);
            return null;
          }

          return data[0];
        } catch (error) {
          this.logger.error(
            `Erreur getModelByBrandAndAlias ${marqueId}/${alias}:`,
            error,
          );
          return null;
        }
      },
    );
  }

  /**
   * 🚗 Obtenir les modèles par marque
   */
  async getModelsByBrand(
    marqueId: number,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<Record<string, unknown>>> {
    const cacheKey = `models_by_brand:${marqueId}:${JSON.stringify(options)}`;

    // 🔧 TEMPORAIRE: Désactiver le cache pour tester le filtrage des motorisations
    const skipCache = options.year !== undefined;

    if (skipCache) {
      this.logger.log(
        `⚠️ Cache désactivé pour test filtrage année ${options.year}`,
      );
    }

    const executeQuery = async () => {
      try {
        this.logger.debug(
          `🚗 Récupération des modèles pour marque: ${marqueId}, options: ${JSON.stringify(options)}`,
        );

        const { page = 0, limit = 50, search, year } = options;
        const offset = page * limit;

        // 🔧 Étape 1: Récupérer TOUS les modèles de la marque
        const { data: allModels, error: modelsError } = await this.client
          .from(TABLES.auto_modele)
          .select('modele_id')
          .eq('modele_marque_id', marqueId);

        if (modelsError || !allModels) {
          this.logger.error('Erreur récupération modèles:', modelsError);
          throw modelsError;
        }

        const allModelIds = allModels.map((m) => m.modele_id);
        // ⚠️ type_modele_id est TEXT dans auto_type, convertir en strings
        const allModelIdsStr = allModelIds.map((id) => id.toString());
        this.logger.log(
          `🔍 DEBUG: ${allModelIds.length} modèles totaux pour marque ${marqueId}`,
        );

        // 🔧 Étape 2: Récupérer les types pour ces modèles
        // ⚠️ type_modele_id est TEXT dans auto_type
        // ⚠️ Supabase PostgREST max-rows = 1000. Paginer pour les grosses marques (Toyota 3510+).
        const typesSelect =
          'type_id, type_modele_id, type_year_from, type_year_to, type_fuel';
        const allTypes: TypePartial[] = [];
        let typesOffset = 0;
        const typesBatchSize = 1000;

        while (true) {
          const { data: batch, error: typesError } = await this.client
            .from(TABLES.auto_type)
            .select(typesSelect)
            .in('type_modele_id', allModelIdsStr)
            .range(typesOffset, typesOffset + typesBatchSize - 1);

          if (typesError) {
            this.logger.error('Erreur récupération types:', typesError);
            throw typesError;
          }

          if (!batch || batch.length === 0) break;
          allTypes.push(...batch);

          // Si on a reçu moins que le batch, c'est la dernière page
          if (batch.length < typesBatchSize) break;
          typesOffset += typesBatchSize;
        }

        this.logger.debug(
          `✅ ${allTypes.length} types récupérés pour marque ${marqueId}`,
        );

        // 🔧 Étape 3: Grouper les types par modèle (type_modele_id est STRING)
        const modelIdsByType = new Map<string, TypePartial[]>();

        allTypes?.forEach((type: TypePartial) => {
          const modelIdStr = type.type_modele_id?.toString();
          if (!modelIdStr) return;
          if (!modelIdsByType.has(modelIdStr)) {
            modelIdsByType.set(modelIdStr, []);
          }
          modelIdsByType.get(modelIdStr)!.push(type);
        });

        // 🔧 Étape 4: Filtrer les modèles selon disponibilité des motorisations
        let modelIdsWithTypes: number[];

        if (year) {
          this.logger.debug(`🗓️ Filtrage par année: ${year}`);

          // Garder uniquement les modèles ayant au moins une motorisation pour cette année
          modelIdsWithTypes = Array.from(modelIdsByType.entries())
            .filter(([, types]) => {
              return types.some((type: TypePartial) => {
                const yearFrom = parseInt(String(type.type_year_from), 10) || 0;
                const yearTo = parseInt(String(type.type_year_to), 10) || 9999;
                return yearFrom <= year && year <= yearTo;
              });
            })
            .map(([modelIdStr]) => parseInt(modelIdStr, 10));

          this.logger.debug(
            `✅ ${modelIdsWithTypes.length}/${allModelIds.length} modèles avec motorisations pour ${year}`,
          );
          this.logger.log(
            `🔍 DEBUG année ${year}: IDs filtrés = [${modelIdsWithTypes.slice(0, 5).join(', ')}...]`,
          );
        } else {
          // Sans année, prendre tous les modèles qui ont au moins une motorisation
          // Convertir les clés string en numbers
          modelIdsWithTypes = Array.from(modelIdsByType.keys()).map((k) =>
            parseInt(k, 10),
          );

          this.logger.debug(
            `✅ ${modelIdsWithTypes.length}/${allModelIds.length} modèles avec motorisations`,
          );
        }

        // 🚫 Si aucun modèle avec motorisations, retourner vide
        if (modelIdsWithTypes.length === 0) {
          this.logger.debug(`❌ Aucun modèle avec motorisations disponibles`);
          return { success: true, data: [], total: 0, page, limit };
        }

        // 📋 Construire la requête principale avec filtre sur les modèles ayant des motorisations
        // ⚠️ Éviter la jointure auto_marque!inner qui échoue (pas de FK dans Supabase)
        // Utiliser modele_marque_id directement
        let query = this.client
          .from(TABLES.auto_modele)
          .select('*', { count: 'exact' })
          .eq('modele_marque_id', marqueId)
          .in('modele_id', modelIdsWithTypes);

        if (!options.includeAll) {
          query = query.eq('modele_display', 1);
        }

        if (search?.trim()) {
          // Recherche par alias OU par nom
          query = query.or(
            `modele_alias.ilike.%${search}%,modele_name.ilike.%${search}%`,
          );
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

        // Enrichir chaque modèle avec motorisationsCount et fuel_types
        const enrichedData = (data || []).map(
          (model: Record<string, unknown>) => {
            const types = modelIdsByType.get(String(model.modele_id)) || [];
            return {
              ...model,
              motorisationsCount: types.length,
              modele_fuel_types: [
                ...new Set(
                  types.map((t: TypePartial) => t.type_fuel).filter(Boolean),
                ),
              ],
            };
          },
        );

        return {
          success: true,
          data: enrichedData,
          total: count || 0,
          page,
          limit,
        };
      } catch (error) {
        this.logger.error(`Erreur getModelsByBrand ${marqueId}:`, error);
        throw error;
      }
    };

    // Exécuter avec ou sans cache selon le besoin
    if (skipCache) {
      return await executeQuery();
    } else {
      return await this.cacheService.getOrSet(
        CacheType.MODELS,
        cacheKey,
        executeQuery,
      );
    }
  }

  /**
   * 🔍 Rechercher des modèles
   */
  async searchModels(
    query: string,
    options: PaginationOptions & { marqueId?: number } = {},
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

          // ⚠️ Éviter la jointure auto_marque!inner qui échoue (pas de FK dans Supabase)
          let dbQuery = this.client
            .from(TABLES.auto_modele)
            .select('*')
            .eq('modele_display', 1)
            .or(`modele_name.ilike.%${query}%,modele_alias.ilike.%${query}%`)
            .limit(limit)
            .range(offset, offset + limit - 1);

          if (marqueId) {
            dbQuery = dbQuery.eq('modele_marque_id', marqueId);
          }

          const { data, error, count } = await dbQuery.order('modele_name');

          if (error) {
            this.logger.error('Erreur searchModels:', error);
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
          this.logger.error(`Erreur searchModels ${query}:`, error);
          throw error;
        }
      },
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
            .from(TABLES.auto_modele)
            .select('modele_id', { count: 'exact' });

          // Modèles actifs
          const { count: activeModels } = await this.client
            .from(TABLES.auto_modele)
            .select('modele_id', { count: 'exact' })
            .eq('modele_display', 1);

          // Modèles avec types
          const { data: modelsWithTypes } = await this.client
            .from(TABLES.auto_modele)
            .select(
              `
              modele_id,
              modele_name,
              auto_type(type_id)
            `,
            )
            .eq('modele_display', 1);

          const modelsWithTypesCount =
            modelsWithTypes?.filter((model) => model.auto_type?.length > 0)
              .length || 0;

          // Top modèles
          const topModels = await this.getTopModels();

          return {
            totalModels: totalModels || 0,
            activeModels: activeModels || 0,
            modelsWithTypes: modelsWithTypesCount,
            topModels,
          };
        } catch (error) {
          this.logger.error('Erreur getModelStats:', error);
          return {
            totalModels: 0,
            activeModels: 0,
            modelsWithTypes: 0,
            topModels: [],
          };
        }
      },
    );
  }

  /**
   * 🏆 Obtenir le top des modèles
   */
  private async getTopModels(limit: number = 10): Promise<
    Array<{
      modele_name: string;
      marque_name: string;
      typeCount: number;
    }>
  > {
    try {
      const { data } = await this.client
        .from(TABLES.auto_modele)
        .select(
          `
          modele_name,
          auto_marque!inner(marque_name),
          auto_type(type_id)
        `,
        )
        .eq('modele_display', 1)
        .limit(limit * 2); // Prendre plus pour filtrer ensuite

      return (data || [])
        .map((model) => ({
          modele_name: model.modele_name,
          marque_name:
            (model.auto_marque as { marque_name?: string })?.marque_name ||
            'Unknown',
          typeCount: model.auto_type?.length || 0,
        }))
        .filter((model) => model.typeCount > 0)
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
  async getModelsForSelect(
    marqueId: number,
  ): Promise<Array<{ id: number; name: string }>> {
    const cacheKey = `models_select:${marqueId}`;

    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from(TABLES.auto_modele)
            .select('modele_id, modele_name')
            .eq('modele_marque_id', marqueId)
            .eq('modele_display', 1)
            .order('modele_name');

          if (error) {
            this.logger.error('Erreur getModelsForSelect:', error);
            return [];
          }

          return (data || []).map((model) => ({
            id: model.modele_id,
            name: model.modele_name,
          }));
        } catch (error) {
          this.logger.error('Erreur getModelsForSelect:', error);
          return [];
        }
      },
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
   * ✅ P3.3 Optimisé: Batch query au lieu de N requêtes
   */
  async getPopularModels(
    limit: number = 10,
    marqueId?: number,
  ): Promise<VehicleModel[]> {
    const cacheKey = `popular_models:${limit}:${marqueId || 'all'}`;

    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          const topModels = await this.getTopModels(limit);

          if (topModels.length === 0) return [];

          // BATCH: Collecter les noms de modèles uniques
          const modelNames = [...new Set(topModels.map((m) => m.modele_name))];

          // BATCH: Récupérer tous les modèles en une seule requête
          const { data: modelsData, error } = await this.client
            .from(TABLES.auto_modele)
            .select(
              `
              *,
              auto_marque!inner(
                marque_id,
                marque_name
              )
            `,
            )
            .in('modele_name', modelNames)
            .eq('modele_display', 1);

          if (error) {
            this.logger.error('Erreur batch getPopularModels:', error);
            return [];
          }

          // Créer Map composite (modele_name + marque_name) pour lookup O(1)
          const modelMap = new Map<string, VehicleModel>();
          (modelsData || []).forEach((model) => {
            const marque = model.auto_marque as { marque_name?: string } | null;
            const key = `${model.modele_name}|${marque?.marque_name || ''}`;
            modelMap.set(key, model);
          });

          // Retourner dans l'ordre original (trié par typeCount)
          return topModels
            .filter((model) => !marqueId || model.marque_name)
            .map((top) => {
              const key = `${top.modele_name}|${top.marque_name}`;
              return modelMap.get(key);
            })
            .filter((model): model is VehicleModel => model != null);
        } catch (error) {
          this.logger.error('Erreur getPopularModels:', error);
          return [];
        }
      },
    );
  }

  /**
   * 🔍 Obtenir les suggestions de modèles (autocomplete)
   */
  async getModelSuggestions(
    query: string,
    marqueId?: number,
    limit: number = 10,
  ): Promise<string[]> {
    if (!query?.trim()) return [];

    const cacheKey = `model_suggestions:${query}:${marqueId || 'all'}:${limit}`;

    return await this.cacheService.getOrSet(
      CacheType.MODELS,
      cacheKey,
      async () => {
        try {
          let dbQuery = this.client
            .from(TABLES.auto_modele)
            .select('modele_name')
            .eq('modele_display', 1)
            .ilike('modele_name', `%${query}%`)
            .limit(limit)
            .order('modele_name');

          if (marqueId) {
            dbQuery = dbQuery.eq('modele_marque_id', marqueId);
          }

          const { data } = await dbQuery;

          return data?.map((m) => m.modele_name) || [];
        } catch (error) {
          this.logger.error(`Erreur getModelSuggestions ${query}:`, error);
          return [];
        }
      },
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
            .from(TABLES.auto_type)
            .select('type_year_from, type_year_to, type_engine_code')
            .eq('type_modele_id', modeleId)
            .eq('type_display', '1');

          const typeCount = types?.length || 0;

          // Plage d'années (type_year_from / type_year_to sont TEXT)
          const years =
            types
              ?.map((t) => parseInt(String(t.type_year_from), 10))
              .filter((y: number) => !isNaN(y)) || [];
          const yearsTo =
            types
              ?.map((t) => parseInt(String(t.type_year_to), 10))
              .filter((y: number) => !isNaN(y)) || [];
          const allYears = [...years, ...yearsTo];
          const yearRange =
            allYears.length > 0
              ? {
                  min: Math.min(...allYears),
                  max: Math.max(...allYears),
                }
              : null;

          // Moteurs uniques
          const engines = [
            ...new Set(
              types?.map((t) => t.type_engine_code).filter(Boolean) || [],
            ),
          ];

          return {
            model,
            typeCount,
            yearRange,
            engines,
          };
        } catch (error) {
          this.logger.error(`Erreur getModelSummary ${modeleId}:`, error);
          return null;
        }
      },
    );
  }
}
