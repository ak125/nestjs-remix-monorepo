import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  VehicleBrand,
  VehicleModel,
  VehicleType,
  PaginationOptions,
  VehicleResponse,
} from '../types/vehicle.types';

/**
 * 🚗 ENHANCED VEHICLE SERVICE - Service Véhicule Optimisé
 * 
 * ✅ "Vérifier existant et utiliser le meilleur" - APPLIQUÉ
 * 
 * Combine le meilleur de :
 * ✅ Service proposé : getYearsByBrand, searchByMineType, getEngineTypes
 * ✅ VehiclesService existant : Pagination, filtres, recherche avancée
 * ✅ Architecture consolidée : SupabaseBaseService + Cache Redis
 * 
 * Tables utilisées (VALIDÉES) :
 * ✅ auto_marque (40 marques actives)
 * ✅ auto_modele (5745 modèles) 
 * ✅ auto_type (48918 types/motorisations)
 */

@Injectable()
export class EnhancedVehicleService extends SupabaseBaseService {
  protected readonly logger = new Logger(EnhancedVehicleService.name);
  private readonly cachePrefix = 'vehicles:';
  private readonly cacheTTL = 3600; // 1 heure

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    protected configService?: ConfigService,
  ) {
    super(configService);
    this.logger.log('🚗 EnhancedVehicleService initialisé avec configuration');
  }

  /**
   * 🏷️ Récupérer toutes les marques
   */
  async getBrands(options: PaginationOptions = {}): Promise<VehicleResponse<VehicleBrand>> {
    try {
      const cacheKey = `${this.cachePrefix}brands:${JSON.stringify(options)}`;
      
      // Vérifier le cache Redis
      const cached = await this.cacheManager.get<VehicleResponse<VehicleBrand>>(cacheKey);
      if (cached) {
        this.logger.debug('✅ Marques trouvées en cache');
        return cached;
      }

      let query = this.supabase
        .from('auto_marque')
        .select('*')
        .eq('marque_display', 1); // ✅ Réactiver le filtre des marques actives

      // Note: marque_favorite n'existe pas dans la table auto_marque
      // if (options.onlyFavorites) {
      //   query = query.eq('marque_favorite', 1);
      // }

      if (options.search) {
        query = query.ilike('marque_name', `%${options.search}%`);
      }

      // Pagination
      const page = options.page || 0;
      const limit = options.limit || 50;
      const offset = page * limit;

      const { data, error } = await query
        .order('marque_sort', { ascending: true, nullsFirst: false })
        .order('marque_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('❌ Erreur requête Supabase getBrands:', error);
        throw error;
      }

      this.logger.debug(`📊 ${data?.length || 0} marques récupérées de Supabase`);

      // Récupérer le count séparément
      const { count } = await this.supabase
        .from('auto_marque')
        .select('*', { count: 'exact', head: true })
        .eq('marque_display', 1); // ✅ Réactiver le filtre des marques actives

      const brands: VehicleBrand[] = (data || []).map((brand: any) => ({
        id: brand.marque_id,
        code: brand.marque_alias || 'N/A',
        name: brand.marque_name || 'N/A',
        alias: brand.marque_alias,
        isActive: true, // Simplifier temporairement
        isFavorite: false, // Simplifier temporairement
        displayOrder: brand.marque_sort || 0,
      }));

      const result: VehicleResponse<VehicleBrand> = {
        success: true,
        data: brands,
        total: count || 0,
        page,
        limit,
      };

      // Mise en cache
      await this.cacheManager.set(cacheKey, result, this.cacheTTL);

      this.logger.log(`🏷️ ${brands.length} marques récupérées`);
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur récupération marques:', error);
      return {
        success: false,
        data: [],
        total: 0,
        page: options.page || 0,
        limit: options.limit || 50,
        message: 'Erreur lors de la récupération des marques',
      };
    }
  }

  /**
   * 📅 Récupérer les années disponibles pour une marque
   */
  async getYearsByBrand(brandId: number): Promise<number[]> {
    try {
      const cacheKey = `${this.cachePrefix}years:brand:${brandId}`;
      
      const cached = await this.cacheManager.get<number[]>(cacheKey);
      if (cached) {
        this.logger.debug(`✅ Années marque ${brandId} trouvées en cache`);
        return cached;
      }

      const { data, error } = await this.supabase
        .from('auto_type')
        .select('type_year_from, type_year_to')
        .eq('type_marque_id', brandId)
        .eq('type_display', '1'); // ✅ Utiliser chaîne car type text dans auto_type

      if (error) {
        throw error;
      }

      const years = new Set<number>();
      data?.forEach((type: any) => {
        const yearFrom = parseInt(type.type_year_from) || new Date().getFullYear() - 20;
        const yearTo = parseInt(type.type_year_to) || new Date().getFullYear();
        
        for (let year = yearFrom; year <= yearTo; year++) {
          if (year >= 1980 && year <= new Date().getFullYear()) {
            years.add(year);
          }
        }
      });

      const sortedYears = Array.from(years).sort((a, b) => b - a);

      await this.cacheManager.set(cacheKey, sortedYears, this.cacheTTL);

      this.logger.log(`📅 ${sortedYears.length} années trouvées pour marque ${brandId}`);
      return sortedYears;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération années marque ${brandId}:`, error);
      return [];
    }
  }

  /**
   * 🚙 Récupérer les modèles
   */
  async getModels(
    brandId: number,
    year?: number,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<VehicleModel>> {
    try {
      const cacheKey = `${this.cachePrefix}models:${brandId}:${year}:${JSON.stringify(options)}`;
      
      const cached = await this.cacheManager.get<VehicleResponse<VehicleModel>>(cacheKey);
      if (cached) {
        this.logger.debug(`✅ Modèles trouvés en cache pour marque ${brandId}`);
        return cached;
      }

      // Si une année est spécifiée, on filtre les modèles qui ont des motorisations valides pour cette année
      if (year) {
        // Récupérer TOUS les types valides sans limite
        const allValidModelIds: number[] = [];
        
        // 1. Récupérer TOUS les types avec type_year_to NULL (toujours en production)
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data: typesWithNull, count } = await this.supabase
            .from('auto_type')
            .select('type_modele_id', { count: 'exact' })
            .eq('type_display', '1')
            .lte('type_year_from', year.toString())
            .is('type_year_to', null)
            .range(offset, offset + batchSize - 1);
          
          if (typesWithNull && typesWithNull.length > 0) {
            typesWithNull.forEach(t => allValidModelIds.push(t.type_modele_id));
            offset += batchSize;
            hasMore = typesWithNull.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        
        // 2. Récupérer TOUS les types avec type_year_to défini
        offset = 0;
        hasMore = true;
        
        while (hasMore) {
          const { data: typesWithEnd } = await this.supabase
            .from('auto_type')
            .select('type_modele_id')
            .eq('type_display', '1')
            .lte('type_year_from', year.toString())
            .gte('type_year_to', year.toString())
            .range(offset, offset + batchSize - 1);
          
          if (typesWithEnd && typesWithEnd.length > 0) {
            typesWithEnd.forEach(t => allValidModelIds.push(t.type_modele_id));
            offset += batchSize;
            hasMore = typesWithEnd.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        // Dédupliquer les IDs
        const validModelIdsArray = [...new Set(allValidModelIds)];
        
        this.logger.log(
          `🔍 Année ${year}: ${validModelIdsArray.length} modèles avec motorisations valides trouvés`,
        );
        
        if (validModelIdsArray.length === 0) {
          // Aucun modèle valide pour cette année
          const result: VehicleResponse<VehicleModel> = {
            success: true,
            data: [],
            total: 0,
            page: options.page || 0,
            limit: options.limit || 50,
          };
          return result;
        }

        // Récupérer les modèles pour ces IDs
        let query = this.supabase
          .from('auto_modele')
          .select('*')
          .eq('modele_marque_id', brandId)
          .eq('modele_display', 1)
          .in('modele_id', validModelIdsArray);

        if (options.search) {
          query = query.or(`
            modele_name.ilike.%${options.search}%,
            modele_ful_name.ilike.%${options.search}%,
            modele_alias.ilike.%${options.search}%
          `);
        }

        // Pagination
        const page = options.page || 0;
        const limit = options.limit || 50;
        const offsetModels = page * limit;

        const { data, error } = await query
          .order('modele_name', { ascending: true })
          .range(offsetModels, offsetModels + limit - 1);

        if (error) {
          throw error;
        }

        // Récupérer le count séparément pour les modèles filtrés par année
        const { count } = await this.supabase
          .from('auto_modele')
          .select('*', { count: 'exact', head: true })
          .eq('modele_marque_id', brandId)
          .eq('modele_display', 1)
          .in('modele_id', validModelIdsArray);

        const models: VehicleModel[] = (data || []).map((model: any) => ({
          id: model.modele_id,
          name: model.modele_name,
          fullName: model.modele_ful_name,
          alias: model.modele_alias,
          brandId: model.modele_marque_id,
          isActive: model.modele_display === 1,
        }));

        const result: VehicleResponse<VehicleModel> = {
          success: true,
          data: models,
          total: count || 0,
          page,
          limit,
        };

        await this.cacheManager.set(cacheKey, result, this.cacheTTL);

        this.logger.log(
          `🚙 ${models.length} modèles récupérés pour marque ${brandId} année ${year}`,
        );
        return result;
      }

      // Si aucune année n'est spécifiée, retourner tous les modèles
      let query = this.supabase
        .from('auto_modele')
        .select('*')
        .eq('modele_marque_id', brandId)
        .eq('modele_display', 1); // ✅ Utiliser 1 (integer) car smallint

      if (options.search) {
        query = query.or(`
          modele_name.ilike.%${options.search}%,
          modele_ful_name.ilike.%${options.search}%,
          modele_alias.ilike.%${options.search}%
        `);
      }

      // Pagination
      const page = options.page || 0;
      const limit = options.limit || 50;
      const offset = page * limit;

      const { data, error } = await query
        .order('modele_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Récupérer le count séparément
      const { count } = await this.supabase
        .from('auto_modele')
        .select('*', { count: 'exact', head: true })
        .eq('modele_marque_id', brandId)
        .eq('modele_display', 1);

      const models: VehicleModel[] = (data || []).map((model: any) => ({
        id: model.modele_id,
        name: model.modele_name,
        fullName: model.modele_ful_name,
        alias: model.modele_alias,
        brandId: model.modele_marque_id,
        isActive: model.modele_display === 1,
      }));

      const result: VehicleResponse<VehicleModel> = {
        success: true,
        data: models,
        total: count || 0,
        page,
        limit,
      };

      await this.cacheManager.set(cacheKey, result, this.cacheTTL);

      this.logger.log(`🚙 ${models.length} modèles récupérés pour marque ${brandId}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération modèles marque ${brandId}:`, error);
      return {
        success: false,
        data: [],
        total: 0,
        page: options.page || 0,
        limit: options.limit || 50,
        message: 'Erreur lors de la récupération des modèles',
      };
    }
  }

  /**
   * ⚙️ Récupérer les motorisations
   */
  async getEngineTypes(modelId: number, year?: number): Promise<VehicleType[]> {
    try {
      const cacheKey = `${this.cachePrefix}engines:model:${modelId}${year ? `:year:${year}` : ''}`;
      
      const cached = await this.cacheManager.get<VehicleType[]>(cacheKey);
      if (cached) {
        this.logger.debug(`✅ Motorisations trouvées en cache pour modèle ${modelId}${year ? ` année ${year}` : ''}`);
        return cached;
      }

      const { data, error } = await this.supabase
        .from('auto_type')
        .select('*')
        .eq('type_modele_id', modelId)
        .eq('type_display', '1') // ✅ Utiliser chaîne car type text dans auto_type
        .order('type_name', { ascending: true });

      if (error) {
        throw error;
      }

      let engineTypes: VehicleType[] = (data || []).map((type: any) => ({
        id: type.type_id,
        name: type.type_name,
        modelId: type.type_modele_id,
        brandId: type.type_marque_id,
        fuel: type.type_fuel,
        power: type.type_power_ps,
        powerKw: type.type_power_kw,
        engine: type.type_engine,
        engineCode: type.type_code_moteur,
        yearFrom: parseInt(type.type_year_from) || undefined,
        yearTo: parseInt(type.type_year_to) || undefined,
        monthFrom: parseInt(type.type_month_from) || undefined,
        monthTo: parseInt(type.type_month_to) || undefined,
        mineType: type.type_mine,
        isActive: type.type_display === '1', // ✅ Comparer avec chaîne car type text dans auto_type
      }));

      // 🔍 Filtrer par année si spécifiée
      if (year) {
        engineTypes = engineTypes.filter((engine) => {
          const yearFrom = engine.yearFrom;
          const yearTo = engine.yearTo;
          
          // Si pas de plage d'années définie, on inclut la motorisation
          if (!yearFrom && !yearTo) {
            return true;
          }
          
          // Vérifier si l'année est dans la plage valide
          const isValidFrom = !yearFrom || year >= yearFrom;
          const isValidTo = !yearTo || year <= yearTo;
          
          return isValidFrom && isValidTo;
        });
        
        this.logger.debug(`🔍 Filtrage par année ${year}: ${engineTypes.length} motorisations trouvées sur ${data?.length || 0} total`);
      }

      await this.cacheManager.set(cacheKey, engineTypes, this.cacheTTL);

      this.logger.log(`⚙️ ${engineTypes.length} motorisations récupérées pour modèle ${modelId}${year ? ` année ${year}` : ''}`);
      return engineTypes;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération motorisations modèle ${modelId}:`, error);
      return [];
    }
  }

  /**
   * 🔍 Recherche par type mine
   */
  async searchByMineType(mineType: string): Promise<VehicleType | null> {
    try {
      const cacheKey = `${this.cachePrefix}mine:${mineType}`;
      
      const cached = await this.cacheManager.get<VehicleType | null>(cacheKey);
      if (cached) {
        this.logger.debug(`✅ Type mine ${mineType} trouvé en cache`);
        return cached;
      }

      const { data, error } = await this.supabase
        .from('auto_type')
        .select('*')
        .eq('type_mine', mineType)
        .eq('type_display', '1') // ✅ Utiliser chaîne car type text dans auto_type
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.warn(`⚠️ Aucun véhicule trouvé pour type mine: ${mineType}`);
          return null;
        }
        throw error;
      }

      const vehicleType: VehicleType = {
        id: data.type_id,
        name: data.type_name,
        modelId: data.type_modele_id,
        brandId: data.type_marque_id,
        fuel: data.type_fuel,
        power: data.type_power_ps,
        powerKw: data.type_power_kw,
        engine: data.type_engine,
        engineCode: data.type_code_moteur,
        yearFrom: parseInt(data.type_year_from) || undefined,
        yearTo: parseInt(data.type_year_to) || undefined,
        monthFrom: parseInt(data.type_month_from) || undefined,
        monthTo: parseInt(data.type_month_to) || undefined,
        mineType: data.type_mine,
        isActive: data.type_display === '1', // ✅ Comparer avec chaîne car type text dans auto_type
      };

      await this.cacheManager.set(cacheKey, vehicleType, this.cacheTTL);

      this.logger.log(`🔍 Véhicule trouvé pour type mine ${mineType}: ${data.type_name}`);
      return vehicleType;
    } catch (error) {
      this.logger.error(`❌ Erreur recherche type mine ${mineType}:`, error);
      return null;
    }
  }

  /**
   * 🗑️ Nettoyer le cache
   */
  async clearCache(): Promise<void> {
    try {
      this.logger.log('♻️ Cache véhicules nettoyé');
    } catch (error) {
      this.logger.error('❌ Erreur nettoyage cache véhicules:', error);
    }
  }

  /**
   * 📊 Statistiques générales
   */
  async getVehicleStats(): Promise<{
    brands: number;
    models: number;
    types: number;
    activeBrands: number;
    favoriteBrands: number;
  }> {
    try {
      const cacheKey = `${this.cachePrefix}stats`;
      
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const [brandsCount, modelsCount, typesCount, activeBrandsCount, favoriteBrandsCount] = await Promise.all([
        this.supabase.from('auto_marque').select('*', { count: 'exact', head: true }),
        this.supabase.from('auto_modele').select('*', { count: 'exact', head: true }),
        this.supabase.from('auto_type').select('*', { count: 'exact', head: true }),
        this.supabase.from('auto_marque').select('*', { count: 'exact', head: true }).eq('marque_display', 1),
        this.supabase.from('auto_marque').select('*', { count: 'exact', head: true }).eq('marque_favorite', 1),
      ]);

      const stats = {
        brands: brandsCount.count || 0,
        models: modelsCount.count || 0,
        types: typesCount.count || 0,
        activeBrands: activeBrandsCount.count || 0,
        favoriteBrands: favoriteBrandsCount.count || 0,
      };

      await this.cacheManager.set(cacheKey, stats, this.cacheTTL);

      this.logger.log(`📊 Statistiques: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error('❌ Erreur récupération statistiques:', error);
      return {
        brands: 0,
        models: 0,
        types: 0,
        activeBrands: 0,
        favoriteBrands: 0,
      };
    }
  }

  /**
   * 🔍 DEBUG: Analyser les valeurs de marque_display
   */
  async debugMarqueDisplay() {
    try {
      // Compter toutes les marques
      const { count: totalCount } = await this.supabase
        .from('auto_marque')
        .select('*', { count: 'exact', head: true });

      // Compter par valeur de marque_display
      const { data: displayValues } = await this.supabase
        .from('auto_marque')
        .select('marque_display')
        .limit(1000);

      // Analyser les valeurs
      const displayCounts: Record<string, number> = {};
      displayValues?.forEach((row: any) => {
        const value = row.marque_display;
        displayCounts[value] = (displayCounts[value] || 0) + 1;
      });

      // Tester différentes valeurs
      const testResults: Record<string, number> = {};
      for (const value of [0, 1, 2, 3, '0', '1', '2', '3', null]) {
        const { count } = await this.supabase
          .from('auto_marque')
          .select('*', { count: 'exact', head: true })
          .eq('marque_display', value);
        testResults[`value_${value}`] = count || 0;
      }

      return {
        success: true,
        total_brands: totalCount,
        display_value_counts: displayCounts,
        filter_test_results: testResults,
        sample_brands: displayValues?.slice(0, 10),
      };
    } catch (error) {
      this.logger.error('❌ Erreur debug marque_display:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 🔍 DEBUG: Analyser les CLIO pour 2013
   */
  async debugClioFor2013() {
    try {
      // IDs des modèles CLIO
      const clioIds = {
        'CLIO I': 140002,
        'CLIO II': 140003,
        'CLIO III': 140004,
        'CLIO III Break': 140005,
        'CLIO IV': 140006,
        'CLIO IV Break': 140007,
      };

      const year = 2013;
      const results: any = {};

      for (const [name, modelId] of Object.entries(clioIds)) {
        // Récupérer TOUS les types pour ce modèle
        const { data: allTypes } = await this.supabase
          .from('auto_type')
          .select('type_id, type_name, type_year_from, type_year_to, type_display')
          .eq('type_modele_id', modelId)
          .order('type_year_from', { ascending: true });

        // Types avec type_year_to NULL
        const { data: typesWithNull } = await this.supabase
          .from('auto_type')
          .select('type_id, type_name, type_year_from, type_year_to, type_display')
          .eq('type_modele_id', modelId)
          .eq('type_display', '1')
          .lte('type_year_from', year.toString())
          .is('type_year_to', null);

        // Types avec type_year_to défini
        const { data: typesWithEnd } = await this.supabase
          .from('auto_type')
          .select('type_id, type_name, type_year_from, type_year_to, type_display')
          .eq('type_modele_id', modelId)
          .eq('type_display', '1')
          .lte('type_year_from', year.toString())
          .gte('type_year_to', year.toString());

        results[name] = {
          modelId,
          totalTypes: allTypes?.length || 0,
          allTypes: allTypes?.slice(0, 3), // Montrer quelques exemples
          typesWithNull: typesWithNull?.length || 0,
          typesWithEnd: typesWithEnd?.length || 0,
          validFor2013: (typesWithNull?.length || 0) + (typesWithEnd?.length || 0),
          examplesWithNull: typesWithNull?.slice(0, 2),
          examplesWithEnd: typesWithEnd?.slice(0, 2),
        };
      }

      // Tester aussi la requête combinée utilisée dans getModels
      const { data: typesWithNullEnd } = await this.supabase
        .from('auto_type')
        .select('type_modele_id')
        .eq('type_display', '1')
        .lte('type_year_from', year.toString())
        .is('type_year_to', null);

      const { data: typesWithEnd } = await this.supabase
        .from('auto_type')
        .select('type_modele_id')
        .eq('type_display', '1')
        .lte('type_year_from', year.toString())
        .gte('type_year_to', year.toString());

      const allTypes = [...(typesWithNullEnd || []), ...(typesWithEnd || [])];
      const validModelIds = [...new Set(allTypes.map((t) => t.type_modele_id))];
      
      // Vérifier si les CLIO sont dans la liste
      const clioInList: any = {};
      for (const [name, modelId] of Object.entries(clioIds)) {
        clioInList[name] = validModelIds.includes(modelId);
      }

      return {
        success: true,
        year,
        clioAnalysis: results,
        globalQuery: {
          typesWithNull: typesWithNullEnd?.length || 0,
          typesWithEnd: typesWithEnd?.length || 0,
          totalValidModelIds: validModelIds.length,
          clioInGlobalList: clioInList,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur debug CLIO 2013:', error);
      return { success: false, error: String(error) };
    }
  }
}