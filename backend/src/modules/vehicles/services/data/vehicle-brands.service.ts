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

  constructor(private cacheService: VehicleCacheService) {
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

          let query = this.client
            .from(TABLES.auto_marque)
            .select('*')
            .eq('marque_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

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

          // Requête avec agrégation par année
          const { data, error } = await this.client
            .from(TABLES.auto_type)
            .select(
              `
              type_year,
              auto_modele!inner(
                auto_marque!inner(marque_id)
              )
            `,
            )
            .eq('auto_modele.auto_marque.marque_id', marqueId)
            .eq('type_display', 1)
            .not('type_year', 'is', null)
            .order('type_year', { ascending: false });

          if (error) {
            this.logger.error('Erreur getYearsByBrand:', error);
            throw error;
          }

          // Agrégation côté client (peut être optimisé avec une vue SQL)
          const yearCounts = new Map<number, number>();
          data?.forEach((item) => {
            const year = item.type_year;
            if (year) {
              yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
            }
          });

          const years = Array.from(yearCounts.entries())
            .map(([year, count]) => ({ year, count }))
            .sort((a, b) => b.year - a.year)
            .slice(offset, offset + limit);

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

          const brandPromises = topBrands.map(async (brand) => {
            return await this.getBrandByName(brand.marque_name);
          });

          const brands = await Promise.all(brandPromises);
          return brands.filter((brand) => brand !== null) as VehicleBrand[];
        } catch (error) {
          this.logger.error('Erreur getPopularBrands:', error);
          return [];
        }
      },
    );
  }
}
