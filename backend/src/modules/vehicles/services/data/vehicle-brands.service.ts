import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../core/vehicle-cache.service';
import {
  VehicleBrand,
  PaginationOptions,
  VehicleResponse,
} from '../../types/vehicle.types';

/**
 * 🏷️ VEHICLE BRANDS SERVICE - Service dédié à la gestion des marques
 *
 * Responsabilités :
 * - CRUD des marques automobiles
 * - Recherche et filtrage par marque
 * - Années de production par marque
 * - Statistiques des marques
 * - Cache optimisé pour les marques
 */

export interface BrandStats {
  totalBrands: number;
  activeBrands: number;
  brandsWithModels: number;
  topBrands: Array<{
    marque_name: string;
    modelCount: number;
    typeCount: number;
  }>;
}

@Injectable()
export class VehicleBrandsService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleBrandsService.name);

  constructor(private readonly cacheService: VehicleCacheService) {
    super();
    this.logger.log('🏷️ VehicleBrandsService initialisé');
  }

  /**
   * 🏷️ Obtenir toutes les marques avec pagination
   */
  async getBrands(
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<VehicleBrand>> {
    const cacheKey = `all_brands:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          this.logger.debug('🏷️ Récupération des marques');

          const { page = 0, limit = 50, search } = options;
          const offset = page * limit;

          let query = this.client.from(TABLES.auto_marque).select('*');

          if (!options.includeAll) {
            query = query.eq('marque_display', 1);
          }

          query = query.limit(limit).range(offset, offset + limit - 1);

          if (search?.trim()) {
            query = query.ilike('marque_name', `%${search}%`);
          }

          const { data, error, count } = await query.order('marque_name', {
            ascending: true,
          });

          if (error) {
            this.logger.error('Erreur getBrands:', error);
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
          this.logger.error('Erreur getBrands:', error);
          throw error;
        }
      },
    );
  }

  /**
   * 🏷️ Obtenir une marque par ID
   */
  async getBrandById(marqueId: number): Promise<VehicleBrand | null> {
    const cacheKey = `brand_id:${marqueId}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from(TABLES.auto_marque)
            .select('*')
            .eq('marque_id', marqueId)
            .eq('marque_display', 1)
            .single();

          if (error) {
            this.logger.debug(`Marque non trouvée: ${marqueId}`);
            return null;
          }

          return data;
        } catch (error) {
          this.logger.error(`Erreur getBrandById ${marqueId}:`, error);
          return null;
        }
      },
    );
  }

  /**
   * 🏷️ Obtenir une marque par alias (slug URL)
   */
  async getBrandByAlias(alias: string): Promise<VehicleBrand | null> {
    if (!alias?.trim()) return null;

    const cacheKey = `brand_alias:${alias.toLowerCase()}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from(TABLES.auto_marque)
            .select('*')
            .eq('marque_alias', alias.toLowerCase())
            .eq('marque_display', 1)
            .single();

          if (error) {
            this.logger.debug(`Marque non trouvée pour alias: ${alias}`);
            return null;
          }

          return data;
        } catch (error) {
          this.logger.error(`Erreur getBrandByAlias ${alias}:`, error);
          return null;
        }
      },
    );
  }

  /**
   * 🏷️ Obtenir une marque par nom
   */
  async getBrandByName(marqueName: string): Promise<VehicleBrand | null> {
    if (!marqueName?.trim()) return null;

    const cacheKey = `brand_name:${marqueName.toLowerCase()}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from(TABLES.auto_marque)
            .select('*')
            .eq('marque_name', marqueName)
            .eq('marque_display', 1)
            .single();

          if (error) {
            this.logger.debug(`Marque non trouvée: ${marqueName}`);
            return null;
          }

          return data;
        } catch (error) {
          this.logger.error(`Erreur getBrandByName ${marqueName}:`, error);
          return null;
        }
      },
    );
  }

  /**
   * 📅 Obtenir les années de production par marque
   */
  async getYearsByBrand(
    marqueId: number,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<{ year: number; count: number }>> {
    const cacheKey = `years_by_brand:${marqueId}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          this.logger.debug(
            `📅 Récupération des années pour marque: ${marqueId}`,
          );

          const { page = 0, limit = 50 } = options;
          const offset = page * limit;

          // Étape 1: Récupérer les modele_id pour cette marque
          // (pas de FK auto_type → auto_modele, donc on fait 2 requêtes séparées
          //  comme getModelsByBrand dans vehicle-models.service.ts)
          const { data: models, error: modelsError } = await this.client
            .from(TABLES.auto_modele)
            .select('modele_id')
            .eq('modele_marque_id', marqueId);

          if (modelsError) {
            this.logger.error('Erreur getYearsByBrand (modèles):', modelsError);
            throw modelsError;
          }

          if (!models?.length) {
            return {
              success: true,
              data: [],
              total: 0,
              page: 0,
              limit: 0,
            };
          }

          // ⚠️ type_modele_id est TEXT dans auto_type
          const modelIdsStr = models.map((m) => m.modele_id.toString());

          // Étape 2: Récupérer type_year_from/to pour ces modèles
          // Paginer par batch de 1000 (PostgREST max-rows)
          const allTypes: any[] = [];
          let typesOffset = 0;
          const batchSize = 1000;

          while (true) {
            const { data: batch, error: typesError } = await this.client
              .from(TABLES.auto_type)
              .select('type_year_from, type_year_to')
              .in('type_modele_id', modelIdsStr)
              .eq('type_display', '1')
              .not('type_year_from', 'is', null)
              .range(typesOffset, typesOffset + batchSize - 1);

            if (typesError) {
              this.logger.error('Erreur getYearsByBrand (types):', typesError);
              throw typesError;
            }
            if (!batch?.length) break;
            allTypes.push(...batch);
            if (batch.length < batchSize) break;
            typesOffset += batchSize;
          }

          // Étape 3: Agréger les années à partir des ranges
          const currentYear = new Date().getFullYear();
          const yearSet = new Set<number>();
          allTypes.forEach((item: any) => {
            const from = parseInt(item.type_year_from, 10);
            const to = item.type_year_to
              ? parseInt(item.type_year_to, 10)
              : currentYear;
            if (!isNaN(from)) {
              for (let y = from; y <= Math.min(to, currentYear); y++) {
                yearSet.add(y);
              }
            }
          });

          const years = Array.from(yearSet)
            .sort((a, b) => b - a)
            .slice(offset, offset + limit)
            .map((y) => ({ year: y, count: 1 }));

          return {
            success: true,
            data: years,
            total: years.length,
            page: 0,
            limit: years.length,
          };
        } catch (error) {
          this.logger.error(`Erreur getYearsByBrand ${marqueId}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * 🏷️ Rechercher des marques
   */
  async searchBrands(
    query: string,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<VehicleBrand>> {
    if (!query?.trim()) {
      return await this.getBrands(options);
    }

    const cacheKey = `search_brands:${query}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`🔍 Recherche marques: ${query}`);

          const { page = 0, limit = 50 } = options;
          const offset = page * limit;

          const { data, error, count } = await this.client
            .from(TABLES.auto_marque)
            .select('*')
            .eq('marque_display', 1)
            .ilike('marque_name', `%${query}%`)
            .limit(limit)
            .range(offset, offset + limit - 1)
            .order('marque_name');

          if (error) {
            this.logger.error('Erreur searchBrands:', error);
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
          this.logger.error(`Erreur searchBrands ${query}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * 📊 Obtenir les statistiques des marques
   */
  async getBrandStats(): Promise<BrandStats> {
    const cacheKey = 'brand_stats:global';

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          this.logger.debug('📊 Calcul des statistiques marques');

          // Total des marques
          const { count: totalBrands } = await this.client
            .from(TABLES.auto_marque)
            .select('marque_id', { count: 'exact' });

          // Marques actives
          const { count: activeBrands } = await this.client
            .from(TABLES.auto_marque)
            .select('marque_id', { count: 'exact' })
            .eq('marque_display', 1);

          // Marques avec modèles
          const { data: brandsWithModels } = await this.client
            .from(TABLES.auto_marque)
            .select(
              `
              marque_id,
              marque_name,
              auto_modele(modele_id)
            `,
            )
            .eq('marque_display', 1);

          const brandsWithModelsCount =
            brandsWithModels?.filter((brand) => brand.auto_modele?.length > 0)
              .length || 0;

          // Top marques par nombre de modèles
          const topBrands = await this.getTopBrands();

          return {
            totalBrands: totalBrands || 0,
            activeBrands: activeBrands || 0,
            brandsWithModels: brandsWithModelsCount,
            topBrands,
          };
        } catch (error) {
          this.logger.error('Erreur getBrandStats:', error);
          return {
            totalBrands: 0,
            activeBrands: 0,
            brandsWithModels: 0,
            topBrands: [],
          };
        }
      },
    );
  }

  /**
   * 🏆 Obtenir le top des marques
   */
  private async getTopBrands(limit: number = 10): Promise<
    Array<{
      marque_name: string;
      modelCount: number;
      typeCount: number;
    }>
  > {
    try {
      const { data } = await this.client
        .from(TABLES.auto_marque)
        .select(
          `
          marque_name,
          auto_modele(
            modele_id,
            auto_type(type_id)
          )
        `,
        )
        .eq('marque_display', 1)
        .limit(limit);

      return (data || [])
        .map((brand) => ({
          marque_name: brand.marque_name,
          modelCount: brand.auto_modele?.length || 0,
          typeCount:
            brand.auto_modele?.reduce(
              (total, model) => total + (model.auto_type?.length || 0),
              0,
            ) || 0,
        }))
        .filter((brand) => brand.modelCount > 0)
        .sort((a, b) => b.modelCount - a.modelCount)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Erreur getTopBrands:', error);
      return [];
    }
  }

  /**
   * 🏷️ Obtenir toutes les marques (pour sélecteurs)
   */
  async getAllBrandsForSelect(): Promise<Array<{ id: number; name: string }>> {
    const cacheKey = 'all_brands_select';

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from(TABLES.auto_marque)
            .select('marque_id, marque_name')
            .eq('marque_display', 1)
            .order('marque_name');

          if (error) {
            this.logger.error('Erreur getAllBrandsForSelect:', error);
            return [];
          }

          return (data || []).map((brand) => ({
            id: brand.marque_id,
            name: brand.marque_name,
          }));
        } catch (error) {
          this.logger.error('Erreur getAllBrandsForSelect:', error);
          return [];
        }
      },
    );
  }

  /**
   * 🔄 Vérifier si une marque existe
   */
  async brandExists(marqueId: number): Promise<boolean> {
    try {
      const brand = await this.getBrandById(marqueId);
      return brand !== null;
    } catch (error) {
      this.logger.error(`Erreur brandExists ${marqueId}:`, error);
      return false;
    }
  }

  /**
   * 📈 Obtenir les marques populaires (par nombre de recherches)
   * Note: Nécessiterait un système de tracking des recherches
   * ✅ P3.3 Optimisé: Batch query au lieu de N requêtes
   */
  async getPopularBrands(limit: number = 10): Promise<VehicleBrand[]> {
    const cacheKey = `popular_brands:${limit}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          // Pour l'instant, retourne les marques avec le plus de modèles
          const topBrands = await this.getTopBrands(limit);

          if (topBrands.length === 0) return [];

          // BATCH: Récupérer toutes les marques en une seule requête
          const brandNames = topBrands.map((b) => b.marque_name);
          const { data: brandsData, error } = await this.client
            .from(TABLES.auto_marque)
            .select('*')
            .in('marque_name', brandNames)
            .eq('marque_display', 1);

          if (error) {
            this.logger.error('Erreur batch getPopularBrands:', error);
            return [];
          }

          // Créer Map pour conserver l'ordre du tri (par modelCount)
          const brandMap = new Map<string, VehicleBrand>();
          (brandsData || []).forEach((brand) => {
            brandMap.set(brand.marque_name, brand);
          });

          // Retourner dans l'ordre original (trié par popularité)
          return topBrands
            .map((top) => brandMap.get(top.marque_name))
            .filter((brand): brand is VehicleBrand => brand != null);
        } catch (error) {
          this.logger.error('Erreur getPopularBrands:', error);
          return [];
        }
      },
    );
  }

  /**
   * 🔗 Obtenir les marques similaires/liées pour le maillage interne SEO
   * Stratégie: Marques les plus populaires (marque_top = 1 en priorité)
   * Note: La colonne marque_country n'existe pas dans la BDD
   * @param currentBrandId - ID de la marque actuelle à exclure
   * @param limit - Nombre de marques à retourner (défaut: 6)
   */
  async getRelatedBrands(
    currentBrandId: number,
    limit: number = 6,
  ): Promise<
    Array<{
      marque_id: number;
      marque_name: string;
      marque_alias: string;
      marque_logo: string | null;
      marque_country: string | null;
      link: string;
    }>
  > {
    const cacheKey = `related_brands:${currentBrandId}:${limit}`;

    return await this.cacheService.getOrSet(
      CacheType.BRANDS,
      cacheKey,
      async () => {
        try {
          this.logger.log(
            `🔗 Récupération marques liées pour ID: ${currentBrandId}`,
          );

          // Récupérer les marques populaires (marque_top = 1) excluant la marque actuelle
          const { data: topBrands, error: topError } = await this.client
            .from(TABLES.auto_marque)
            .select('marque_id, marque_name, marque_alias, marque_logo')
            .eq('marque_display', 1)
            .eq('marque_top', 1)
            .neq('marque_id', currentBrandId)
            .order('marque_name')
            .limit(limit);

          let relatedBrands: any[] = [];

          if (!topError && topBrands && topBrands.length > 0) {
            relatedBrands = topBrands;
            this.logger.log(
              `✅ ${relatedBrands.length} marques TOP trouvées: ${relatedBrands.map((b) => b.marque_name).join(', ')}`,
            );
          }

          // Si pas assez de marques TOP, compléter avec d'autres marques
          if (relatedBrands.length < limit) {
            const remainingLimit = limit - relatedBrands.length;
            const excludeIds = [
              currentBrandId,
              ...relatedBrands.map((b) => b.marque_id),
            ];

            const { data: otherBrands, error: otherError } = await this.client
              .from(TABLES.auto_marque)
              .select('marque_id, marque_name, marque_alias, marque_logo')
              .eq('marque_display', 1)
              .not('marque_id', 'in', `(${excludeIds.join(',')})`)
              .order('marque_name')
              .limit(remainingLimit);

            if (!otherError && otherBrands && otherBrands.length > 0) {
              relatedBrands = [...relatedBrands, ...otherBrands];
              this.logger.log(
                `✅ Complété avec ${otherBrands.length} autres marques`,
              );
            }
          }

          if (relatedBrands.length === 0) {
            this.logger.warn(
              `Aucune marque liée trouvée pour ${currentBrandId}`,
            );
            return [];
          }

          this.logger.log(
            `🔗 Total ${relatedBrands.length} marques liées retournées`,
          );

          // Formater avec les URLs (marque_country = null car colonne inexistante)
          return relatedBrands.map((brand) => ({
            marque_id: brand.marque_id,
            marque_name: brand.marque_name,
            marque_alias: brand.marque_alias,
            marque_logo: brand.marque_logo,
            marque_country: null,
            link: `/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`,
          }));
        } catch (error) {
          this.logger.error(
            `Erreur getRelatedBrands ${currentBrandId}:`,
            error,
          );
          return [];
        }
      },
    );
  }
}
