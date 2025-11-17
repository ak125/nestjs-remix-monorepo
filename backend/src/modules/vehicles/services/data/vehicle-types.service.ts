import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../core/vehicle-cache.service';
import { VehicleEnrichmentService } from '../core/vehicle-enrichment.service';
import {
  VehicleType,
  PaginationOptions,
  VehicleResponse,
} from '../../types/vehicle.types';

/**
 * 🔧 VEHICLE TYPES SERVICE - Service dédié à la gestion des types/motorisations
 *
 * Responsabilités :
 * - CRUD des types automobiles
 * - Recherche et filtrage par type
 * - Types par modèle/marque
 * - Enrichissement avec données moteur
 * - Cache optimisé pour les types
 */

export interface TypeSearchOptions extends PaginationOptions {
  modeleId?: number;
  marqueId?: number;
  year?: number;
  engineCode?: string;
  includeEngine?: boolean;
}

export interface TypeStats {
  totalTypes: number;
  activeTypes: number;
  typesWithEngine: number;
  byYear: Record<number, number>;
  topEngines: Array<{
    engineCode: string;
    count: number;
  }>;
}

@Injectable()
export class VehicleTypesService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleTypesService.name);

  constructor(
    private cacheService: VehicleCacheService,
    private enrichmentService: VehicleEnrichmentService,
  ) {
    super();
    this.logger.log('🔧 VehicleTypesService initialisé');
  }

  /**
   * 🔧 Obtenir tous les types avec pagination
   */
  async getTypes(
    options: TypeSearchOptions = {},
  ): Promise<VehicleResponse<VehicleType>> {
    const cacheKey = `all_types:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          this.logger.debug('🔧 Récupération des types');

          const {
            page = 0,
            limit = 50,
            search,
            includeEngine = true,
          } = options;
          const offset = page * limit;

          let query = this.client
            .from('auto_type')
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('type_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          // Filtres
          if (options.modeleId) {
            query = query.eq('auto_modele.modele_id', options.modeleId);
          }

          if (options.marqueId) {
            query = query.eq(
              'auto_modele.auto_marque.marque_id',
              options.marqueId,
            );
          }

          if (options.year) {
            query = query.eq('type_year', options.year);
          }

          if (options.engineCode) {
            query = query.ilike('type_engine_code', `%${options.engineCode}%`);
          }

          if (search?.trim()) {
            query = query.ilike('type_name', `%${search}%`);
          }

          const { data, error, count } = await query.order('type_name');

          if (error) {
            this.logger.error('Erreur getTypes:', error);
            throw error;
          }

          // Enrichissement si demandé
          let enrichedData = data || [];
          if (includeEngine) {
            enrichedData =
              await this.enrichmentService.enrichVehicles(enrichedData);
          }

          return {
            success: true,
            data: enrichedData,
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error('Erreur getTypes:', error);
          throw error;
        }
      },
    );
  }

  /**
   * 🔧 Obtenir un type par ID
   */
  async getTypeById(
    typeId: number,
    includeEngine: boolean = true,
  ): Promise<VehicleType | null> {
    const cacheKey = `type_id:${typeId}:${includeEngine}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from('auto_type')
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('type_id', typeId)
            .eq('type_display', 1)
            .maybeSingle();

          if (error || !data) {
            this.logger.debug(`Type non trouvé: ${typeId}`);
            return null;
          }

          // Enrichissement si demandé
          if (includeEngine) {
            return await this.enrichmentService.enrichVehicle(data);
          }

          return data;
        } catch (error) {
          this.logger.error(`Erreur getTypeById ${typeId}:`, error);
          return null;
        }
      },
    );
  }

  /**
   * 🔧 Obtenir les types par modèle
   */
  async getTypesByModel(
    modeleId: number,
    options: PaginationOptions & { includeEngine?: boolean } = {},
  ): Promise<VehicleResponse<VehicleType>> {
    const cacheKey = `types_by_model:${modeleId}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          this.logger.debug(
            `🔧 Récupération des types pour modèle: ${modeleId}`,
          );

          const {
            page = 0,
            limit = 50,
            search,
            includeEngine = true,
          } = options;
          const offset = page * limit;

          let query = this.client
            .from('auto_type')
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('auto_modele.modele_id', modeleId)
            .eq('type_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          if (search?.trim()) {
            query = query.ilike('type_name', `%${search}%`);
          }

          const { data, error, count } = await query.order('type_name');

          if (error) {
            this.logger.error('Erreur getTypesByModel:', error);
            throw error;
          }

          // Enrichissement si demandé
          let enrichedData = data || [];
          if (includeEngine) {
            enrichedData =
              await this.enrichmentService.enrichVehicles(enrichedData);
          }

          return {
            success: true,
            data: enrichedData,
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error(`Erreur getTypesByModel ${modeleId}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * 🔍 Rechercher des types
   */
  async searchTypes(
    query: string,
    options: TypeSearchOptions = {},
  ): Promise<VehicleResponse<VehicleType>> {
    if (!query?.trim()) {
      return await this.getTypes(options);
    }

    const cacheKey = `search_types:${query}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`🔍 Recherche types: ${query}`);

          const { page = 0, limit = 50, includeEngine = true } = options;
          const offset = page * limit;

          let dbQuery = this.client
            .from('auto_type')
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('type_display', 1)
            .or(
              `type_name.ilike.%${query}%,` +
                `type_mine_code.ilike.%${query}%,` +
                `type_cnit_code.ilike.%${query}%,` +
                `type_engine_code.ilike.%${query}%`,
            )
            .limit(limit)
            .range(offset, offset + limit - 1);

          // Filtres additionnels
          if (options.modeleId) {
            dbQuery = dbQuery.eq('auto_modele.modele_id', options.modeleId);
          }

          if (options.marqueId) {
            dbQuery = dbQuery.eq(
              'auto_modele.auto_marque.marque_id',
              options.marqueId,
            );
          }

          const { data, error, count } = await dbQuery.order('type_name');

          if (error) {
            this.logger.error('Erreur searchTypes:', error);
            throw error;
          }

          // Enrichissement si demandé
          let enrichedData = data || [];
          if (includeEngine) {
            enrichedData =
              await this.enrichmentService.enrichVehicles(enrichedData);
          }

          return {
            success: true,
            data: enrichedData,
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error(`Erreur searchTypes ${query}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * 📊 Obtenir les statistiques des types
   */
  async getTypeStats(): Promise<TypeStats> {
    const cacheKey = 'type_stats:global';

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          this.logger.debug('📊 Calcul des statistiques types');

          // Total des types
          const { count: totalTypes } = await this.client
            .from('auto_type')
            .select('type_id', { count: 'exact' });

          // Types actifs
          const { count: activeTypes } = await this.client
            .from('auto_type')
            .select('type_id', { count: 'exact' })
            .eq('type_display', 1);

          // Types avec moteur
          const { count: typesWithEngine } = await this.client
            .from('auto_type')
            .select('type_id', { count: 'exact' })
            .eq('type_display', 1)
            .not('type_engine_code', 'is', null);

          // Par année
          const { data: yearData } = await this.client
            .from('auto_type')
            .select('type_year')
            .eq('type_display', 1)
            .not('type_year', 'is', null);

          const byYear: Record<number, number> = {};
          yearData?.forEach((item) => {
            if (item.type_year) {
              byYear[item.type_year] = (byYear[item.type_year] || 0) + 1;
            }
          });

          // Top moteurs
          const topEngines = await this.getTopEngines();

          return {
            totalTypes: totalTypes || 0,
            activeTypes: activeTypes || 0,
            typesWithEngine: typesWithEngine || 0,
            byYear,
            topEngines,
          };
        } catch (error) {
          this.logger.error('Erreur getTypeStats:', error);
          return {
            totalTypes: 0,
            activeTypes: 0,
            typesWithEngine: 0,
            byYear: {},
            topEngines: [],
          };
        }
      },
    );
  }

  /**
   * 🏆 Obtenir le top des moteurs
   */
  private async getTopEngines(limit: number = 10): Promise<
    Array<{
      engineCode: string;
      count: number;
    }>
  > {
    try {
      const { data } = await this.client
        .from('auto_type')
        .select('type_engine_code')
        .eq('type_display', 1)
        .not('type_engine_code', 'is', null);

      // Compter les occurrences
      const engineCounts = new Map<string, number>();
      data?.forEach((item) => {
        if (item.type_engine_code) {
          const code = item.type_engine_code;
          engineCounts.set(code, (engineCounts.get(code) || 0) + 1);
        }
      });

      return Array.from(engineCounts.entries())
        .map(([engineCode, count]) => ({ engineCode, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Erreur getTopEngines:', error);
      return [];
    }
  }

  /**
   * 🔧 Obtenir tous les types d'un modèle (pour sélecteurs)
   */
  async getTypesForSelect(modeleId: number): Promise<
    Array<{
      id: number;
      name: string;
      year?: number;
      engineCode?: string;
    }>
  > {
    const cacheKey = `types_select:${modeleId}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from('auto_type')
            .select('type_id, type_name, type_year, type_engine_code')
            .eq('type_modele_id', modeleId)
            .eq('type_display', 1)
            .order('type_name');

          if (error) {
            this.logger.error('Erreur getTypesForSelect:', error);
            return [];
          }

          return (data || []).map((type) => ({
            id: type.type_id,
            name: type.type_name,
            year: type.type_year,
            engineCode: type.type_engine_code,
          }));
        } catch (error) {
          this.logger.error('Erreur getTypesForSelect:', error);
          return [];
        }
      },
    );
  }

  /**
   * 🔄 Vérifier si un type existe
   */
  async typeExists(typeId: number): Promise<boolean> {
    try {
      const type = await this.getTypeById(typeId, false);
      return type !== null;
    } catch (error) {
      this.logger.error(`Erreur typeExists ${typeId}:`, error);
      return false;
    }
  }

  /**
   * 📅 Obtenir les années disponibles pour un modèle
   */
  async getYearsByModel(modeleId: number): Promise<number[]> {
    const cacheKey = `years_by_model:${modeleId}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from('auto_type')
            .select('type_year')
            .eq('type_modele_id', modeleId)
            .eq('type_display', 1)
            .not('type_year', 'is', null)
            .order('type_year', { ascending: false });

          if (error) {
            this.logger.error('Erreur getYearsByModel:', error);
            return [];
          }

          // Supprimer les doublons et trier
          const years = [
            ...new Set(
              data?.map((item) => item.type_year).filter(Boolean) || [],
            ),
          ];
          return years.sort((a, b) => b - a);
        } catch (error) {
          this.logger.error(`Erreur getYearsByModel ${modeleId}:`, error);
          return [];
        }
      },
    );
  }

  /**
   * 🔧 Obtenir les codes moteur disponibles pour un modèle
   */
  async getEngineCodesByModel(modeleId: number): Promise<string[]> {
    const cacheKey = `engine_codes_by_model:${modeleId}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from('auto_type')
            .select('type_engine_code')
            .eq('type_modele_id', modeleId)
            .eq('type_display', 1)
            .not('type_engine_code', 'is', null)
            .order('type_engine_code');

          if (error) {
            this.logger.error('Erreur getEngineCodesByModel:', error);
            return [];
          }

          // Supprimer les doublons
          const engines = [
            ...new Set(
              data?.map((item) => item.type_engine_code).filter(Boolean) || [],
            ),
          ];
          return engines.sort();
        } catch (error) {
          this.logger.error(`Erreur getEngineCodesByModel ${modeleId}:`, error);
          return [];
        }
      },
    );
  }

  /**
   * 🔍 Obtenir les suggestions de types (autocomplete)
   */
  async getTypeSuggestions(
    query: string,
    modeleId?: number,
    limit: number = 10,
  ): Promise<string[]> {
    if (!query?.trim()) return [];

    const cacheKey = `type_suggestions:${query}:${modeleId || 'all'}:${limit}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          let dbQuery = this.client
            .from('auto_type')
            .select('type_name')
            .eq('type_display', 1)
            .ilike('type_name', `%${query}%`)
            .limit(limit)
            .order('type_name');

          if (modeleId) {
            dbQuery = dbQuery.eq('type_modele_id', modeleId);
          }

          const { data } = await dbQuery;

          return data?.map((t) => t.type_name) || [];
        } catch (error) {
          this.logger.error(`Erreur getTypeSuggestions ${query}:`, error);
          return [];
        }
      },
    );
  }

  /**
   * 📋 Obtenir le résumé d'un type avec enrichissement
   */
  async getTypeSummary(typeId: number): Promise<{
    type: VehicleType;
    enriched: boolean;
    relatedTypes: VehicleType[];
  } | null> {
    const cacheKey = `type_summary:${typeId}`;

    return await this.cacheService.getOrSet(
      CacheType.TYPES,
      cacheKey,
      async () => {
        try {
          // Type principal avec enrichissement
          const type = await this.getTypeById(typeId, true);
          if (!type) return null;

          // Types similaires du même modèle
          const { data: relatedData } = await this.client
            .from('auto_type')
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq(
              'type_modele_id',
              ((type as any).auto_modele as any)?.modele_id ||
                (type as any).type_modele_id,
            )
            .eq('type_display', 1)
            .neq('type_id', typeId)
            .limit(5)
            .order('type_name');

          const relatedTypes = await this.enrichmentService.enrichVehicles(
            relatedData || [],
          );

          return {
            type,
            enriched: !!(type as any).engineDetails?.enriched,
            relatedTypes,
          };
        } catch (error) {
          this.logger.error(`Erreur getTypeSummary ${typeId}:`, error);
          return null;
        }
      },
    );
  }
}
