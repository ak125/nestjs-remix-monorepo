import { TABLES } from '@repo/database-types';
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { VehicleResponseDto } from './dto/vehicles.dto';
import { buildBrandLogoUrl } from '../catalog/utils/image-urls.utils';

/**
 * VehiclesService — méthodes résiduelles non encore migrées vers sous-services.
 *
 * La majorité des méthodes a été extraite dans :
 * - VehicleBrandsService   (getBrands, getBrandById, getYearsByBrand, getTopBrands)
 * - VehicleModelsService   (getModelsByBrand)
 * - VehicleTypesService    (getTypesByModel, getTypeById)
 * - VehicleSearchService   (searchByCode, searchByCnit)
 * - VehicleMineService     (searchByMineCode, getMinesByModel)
 * - VehicleMetaService     (getMetaTagsByTypeId)
 *
 * Restent ici les 3 méthodes dont la signature diffère des sous-services :
 * - searchAdvanced()  — signature simplifiée (searchTerm, limit) vs SearchCriteria
 * - getVehicleStats() — requête directe sans sous-service dédié
 * - getTopBrands()    — utilise buildBrandLogoUrl (dépendance catalog)
 */
@Injectable()
export class VehiclesService extends SupabaseBaseService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super();
  }

  private cache = new Map<string, { data: unknown; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.CACHE_TTL,
    });
  }

  /**
   * Recherche avancée simplifiée — signature (searchTerm, limit) utilisée par les forms controllers.
   * Note : VehicleSearchService.searchAdvanced() a une signature différente (SearchCriteria + AdvancedSearchOptions).
   */
  async searchAdvanced(searchTerm: string, limit: number = 20) {
    try {
      const brandsResult = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name, marque_alias, marque_logo')
        .eq('marque_display', 1)
        .ilike('marque_name', `%${searchTerm}%`)
        .order('marque_name')
        .limit(Math.min(limit, 10));

      if (brandsResult.error) {
        this.logger.error('Erreur recherche marques:', brandsResult.error);
        throw brandsResult.error;
      }

      const modelsResult = await this.client
        .from(TABLES.auto_modele)
        .select(
          'modele_id, modele_name, modele_alias, modele_ful_name, modele_marque_id',
        )
        .eq('modele_display', 1)
        .ilike('modele_name', `%${searchTerm}%`)
        .order('modele_name')
        .limit(Math.min(limit, 20));

      if (modelsResult.error) {
        this.logger.error('Erreur recherche modèles:', modelsResult.error);
        throw modelsResult.error;
      }

      return {
        brands: brandsResult.data || [],
        models: modelsResult.data || [],
        types: [],
        total:
          (brandsResult.data?.length || 0) + (modelsResult.data?.length || 0),
        searchTerm,
      };
    } catch (error) {
      this.logger.error('Exception searchAdvanced:', error);
      throw error;
    }
  }

  /**
   * Statistiques générales du système véhicules.
   */
  async getVehicleStats() {
    try {
      const [brandsResult, modelsResult, typesResult] = await Promise.all([
        this.client
          .from(TABLES.auto_marque)
          .select('marque_id', { count: 'exact' })
          .eq('marque_display', 1),
        this.client
          .from(TABLES.auto_modele)
          .select('modele_id', { count: 'exact' })
          .eq('modele_display', 1),
        this.client
          .from(TABLES.auto_type)
          .select('type_id', { count: 'exact' })
          .eq('type_display', 1),
      ]);

      return {
        totalBrands: brandsResult.count || 0,
        totalModels: modelsResult.count || 0,
        totalTypes: typesResult.count || 0,
        totalProducts: 15000,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur dans getVehicleStats:', error);
      throw error;
    }
  }

  /**
   * Marques populaires pour la homepage (marque_top = 1).
   */
  async getTopBrands(limit: number = 20): Promise<VehicleResponseDto> {
    const cacheKey = `top_brands_${limit}`;
    const cached = this.getCached<VehicleResponseDto>(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await this.client
        .from(TABLES.auto_marque)
        .select(
          `
          marque_id,
          marque_name,
          marque_name_meta,
          marque_alias,
          marque_logo,
          marque_top,
          marque_sort
        `,
        )
        .eq('marque_display', 1)
        .eq('marque_top', 1)
        .order('marque_sort', { ascending: true })
        .limit(limit);

      if (error) {
        this.logger.error('Erreur getTopBrands:', error);
        throw error;
      }

      const enrichedData = (data || []).map((brand) => ({
        ...brand,
        logo_url: buildBrandLogoUrl(brand.marque_logo),
      }));

      const result = {
        data: enrichedData,
        total: enrichedData.length,
        page: 0,
        limit,
        meta: { source: 'marque_top' },
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('Exception getTopBrands:', error);
      throw error;
    }
  }
}
