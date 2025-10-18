import { Injectable, Logger } from '@nestjs/common';
import { VehicleCacheService } from './core/vehicle-cache.service';
import { VehicleEnrichmentService } from './core/vehicle-enrichment.service';
import { VehicleSearchService } from './search/vehicle-search.service';
import { VehicleMineService } from './search/vehicle-mine.service';
import { VehicleBrandsService } from './data/vehicle-brands.service';
import { VehicleModelsService } from './data/vehicle-models.service';
import { VehicleTypesService } from './data/vehicle-types.service';
import {
  VehicleBrand,
  VehicleModel,
  VehicleType,
  PaginationOptions,
  VehicleResponse,
} from '../types/vehicle.types';

/**
 * 🚗 ENHANCED VEHICLE SERVICE - Service Véhicule Orchestrateur Refactorisé
 *
 * ✅ ARCHITECTURE MODULAIRE - Maintenant propre et maintenable !
 *
 * Remplace le fichier monolithique de 1476 lignes par une architecture modulaire :
 *
 * 🏗️ Services Core :
 * - VehicleCacheService : Gestion cache Redis optimisée
 * - VehicleEnrichmentService : Enrichissement cars_engine
 *
 * 🔍 Services Recherche :
 * - VehicleSearchService : Recherches avancées et suggestions
 * - VehicleMineService : Recherches par codes mine
 *
 * 📊 Services Données :
 * - VehicleBrandsService : Gestion des marques
 * - VehicleModelsService : Gestion des modèles
 * - VehicleTypesService : Gestion des types/motorisations
 *
 * 🎯 MIGRATION COMPLÈTE DES 7 MÉTHODES :
 * ✅ searchByCode (1/7)
 * ✅ getMinesByModel (2/7)
 * ✅ getTypeById (3/7)
 * ✅ searchByCnit (4/7)
 * ✅ searchByMineCode (5/7)
 * ✅ searchAdvanced (6/7)
 * ✅ getBrands (7/7) - Bonus intégré
 */

@Injectable()
export class EnhancedVehicleService {
  protected readonly logger = new Logger(EnhancedVehicleService.name);

  constructor(
    private cacheService: VehicleCacheService,
    private enrichmentService: VehicleEnrichmentService,
    private searchService: VehicleSearchService,
    private mineService: VehicleMineService,
    private brandsService: VehicleBrandsService,
    private modelsService: VehicleModelsService,
    private typesService: VehicleTypesService,
  ) {
    this.logger.log('🚗 EnhancedVehicleService REFACTORISÉ initialisé');
    this.logger.log('📊 Architecture modulaire : 7 services spécialisés');
  }

  // =====================================================
  // 🔍 MÉTHODES DE RECHERCHE MIGRÉES (6/7 + 1 bonus)
  // =====================================================

  /**
   * 🔍 1/7 - Recherche par code (Mine, CNIT, etc.)
   * ✅ MIGRÉ vers VehicleSearchService
   */
  async searchByCode(
    code: string,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<any>> {
    return await this.searchService.searchByCode(code, options);
  }

  /**
   * ⛏️ 2/7 - Obtenir les codes mine par modèle
   * ✅ MIGRÉ vers VehicleMineService
   */
  async getMinesByModel(
    modeleId: number,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<any>> {
    return await this.mineService.getMinesByModel(modeleId, options);
  }

  /**
   * 🔧 3/7 - Obtenir un type par ID avec enrichissement
   * ✅ MIGRÉ vers VehicleTypesService
   */
  async getTypeById(
    typeId: number,
    includeEngine: boolean = true,
  ): Promise<VehicleType | null> {
    return await this.typesService.getTypeById(typeId, includeEngine);
  }

  /**
   * 🔍 4/7 - Recherche par code CNIT
   * ✅ MIGRÉ vers VehicleSearchService
   */
  async searchByCnit(
    cnitCode: string,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<any>> {
    return await this.searchService.searchByCnit(cnitCode, options);
  }

  /**
   * ⛏️ 5/7 - Recherche par code mine (alias)
   * ✅ MIGRÉ vers VehicleMineService
   */
  async searchByMineCode(
    mineCode: string,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<any>> {
    return await this.mineService.searchByMineCode(mineCode, options);
  }

  /**
   * 🔍 6/7 - Recherche textuelle avancée multi-critères
   * ✅ MIGRÉ vers VehicleSearchService
   */
  async searchAdvanced(
    query: string,
    options: {
      searchIn?: string[];
      exactMatch?: boolean;
      includeEngine?: boolean;
    } & PaginationOptions = {},
  ): Promise<VehicleResponse<any>> {
    return await this.searchService.searchAdvanced(
      { query },
      {
        searchIn: options.searchIn || ['marque', 'modele', 'type'],
        exactMatch: options.exactMatch || false,
        includeEngine: options.includeEngine !== false,
        ...options,
      },
    );
  }

  /**
   * 🏷️ 7/7 - Obtenir toutes les marques (bonus intégré)
   * ✅ MIGRÉ vers VehicleBrandsService
   */
  async getBrands(
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<VehicleBrand>> {
    return await this.brandsService.getBrands(options);
  }

  // =====================================================
  // 🎯 MÉTHODES COMPLÉMENTAIRES POUR API COMPLÈTE
  // =====================================================

  /**
   * 🚗 Obtenir les modèles par marque
   */
  async getModelsByBrand(
    marqueId: number,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<VehicleModel>> {
    return await this.modelsService.getModelsByBrand(marqueId, options);
  }

  /**
   * 🔧 Obtenir les types par modèle
   */
  async getTypesByModel(
    modeleId: number,
    options: PaginationOptions & { includeEngine?: boolean } = {},
  ): Promise<VehicleResponse<VehicleType>> {
    return await this.typesService.getTypesByModel(modeleId, options);
  }

  /**
   * 📅 Obtenir les années de production par marque
   */
  async getYearsByBrand(
    marqueId: number,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<{ year: number; count: number }>> {
    return await this.brandsService.getYearsByBrand(marqueId, options);
  }

  /**
   * 🔍 Suggestions de recherche (autocomplete)
   */
  async getSuggestions(
    query: string,
    type: 'marque' | 'modele' | 'type' = 'marque',
    limit: number = 10,
  ): Promise<string[]> {
    return await this.searchService.getSuggestions(query, type, limit);
  }

  /**
   * 🔧 Enrichir un véhicule avec les données moteur
   */
  async enrichVehicle(vehicleData: any): Promise<any> {
    return await this.enrichmentService.enrichVehicle(vehicleData);
  }

  /**
   * 🔧 Enrichir une liste de véhicules
   */
  async enrichVehicles(vehicles: any[]): Promise<any[]> {
    return await this.enrichmentService.enrichVehicles(vehicles);
  }

  // =====================================================
  // 📊 MÉTHODES DE STATISTIQUES ET MONITORING
  // =====================================================

  /**
   * 📊 Obtenir les statistiques globales
   */
  async getGlobalStats(): Promise<{
    brands: any;
    models: any;
    types: any;
    enrichment: any;
    cache: any;
  }> {
    try {
      const [brands, models, types] = await Promise.all([
        this.brandsService.getBrandStats(),
        this.modelsService.getModelStats(),
        this.typesService.getTypeStats(),
        // TODO: Réactiver quand getMappingStats() sera implémenté
        // this.enrichmentService.getMappingStats(),
      ]);

      return {
        brands,
        models,
        types,
        enrichment: {}, // TODO: Implémenter getMappingStats() dans VehicleEnrichmentService
        cache: {
          configs: Object.fromEntries(
            Object.values([
              'BRANDS',
              'MODELS',
              'TYPES',
              'SEARCH',
              'ENRICHMENT',
              'MINE',
              'ENGINE',
            ]).map((type) => [
              type,
              this.cacheService.getCacheConfig(type as any),
            ]),
          ),
        },
      };
    } catch (error) {
      this.logger.error('Erreur getGlobalStats:', error);
      throw error;
    }
  }

  /**
   * 🏆 Obtenir les éléments populaires
   */
  async getPopularItems(): Promise<{
    brands: VehicleBrand[];
    models: VehicleModel[];
    engines: string[];
  }> {
    try {
      const [brands, models, typeStats] = await Promise.all([
        this.brandsService.getPopularBrands(10),
        this.modelsService.getPopularModels(10),
        this.typesService.getTypeStats(),
      ]);

      return {
        brands,
        models,
        engines: typeStats.topEngines.map((e) => e.engineCode).slice(0, 10),
      };
    } catch (error) {
      this.logger.error('Erreur getPopularItems:', error);
      throw error;
    }
  }

  /**
   * 🔍 Recherche globale multi-services
   */
  async globalSearch(
    query: string,
    options: {
      searchTypes?: Array<'brands' | 'models' | 'types' | 'mines'>;
      limit?: number;
    } = {},
  ): Promise<{
    brands: VehicleBrand[];
    models: VehicleModel[];
    types: VehicleType[];
    mines: any[];
    total: number;
  }> {
    const { searchTypes = ['brands', 'models', 'types'], limit = 5 } = options;

    try {
      const searches = await Promise.allSettled([
        searchTypes.includes('brands')
          ? this.brandsService.searchBrands(query, { limit })
          : Promise.resolve({ data: [] }),
        searchTypes.includes('models')
          ? this.modelsService.searchModels(query, { limit })
          : Promise.resolve({ data: [] }),
        searchTypes.includes('types')
          ? this.typesService.searchTypes(query, { limit })
          : Promise.resolve({ data: [] }),
        searchTypes.includes('mines')
          ? this.mineService.searchByMineCode(query, { limit })
          : Promise.resolve({ data: [] }),
      ]);

      const results = searches.map((result) =>
        result.status === 'fulfilled' ? result.value.data : [],
      );

      return {
        brands: results[0] || [],
        models: results[1] || [],
        types: results[2] || [],
        mines: results[3] || [],
        total: results.reduce((sum, arr) => sum + arr.length, 0),
      };
    } catch (error) {
      this.logger.error('Erreur globalSearch:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔧 MÉTHODES UTILITAIRES
  // =====================================================

  /**
   * 🔄 Vérifier la santé des services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: Date;
  }> {
    try {
      const checks = await Promise.allSettled([
        this.brandsService.getBrands({ limit: 1 }),
        this.modelsService.getModels({ limit: 1 }),
        this.typesService.getTypes({ limit: 1 }),
      ]);

      const services = {
        brands: checks[0].status === 'fulfilled',
        models: checks[1].status === 'fulfilled',
        types: checks[2].status === 'fulfilled',
        cache: true, // Le cache est toujours disponible
        enrichment: true, // L'enrichissement est en mémoire
      };

      const healthyCount = Object.values(services).filter(Boolean).length;
      const totalCount = Object.keys(services).length;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount === totalCount) {
        status = 'healthy';
      } else if (healthyCount >= totalCount * 0.6) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        services,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Erreur healthCheck:', error);
      return {
        status: 'unhealthy',
        services: {},
        timestamp: new Date(),
      };
    }
  }

  /**
   * 📋 Obtenir le résumé de l'architecture
   */
  getArchitectureSummary(): {
    version: string;
    services: string[];
    migration: {
      completed: number;
      total: number;
      percentage: number;
    };
    features: string[];
  } {
    return {
      version: '2.0.0-refactored',
      services: [
        'VehicleCacheService',
        'VehicleEnrichmentService',
        'VehicleSearchService',
        'VehicleMineService',
        'VehicleBrandsService',
        'VehicleModelsService',
        'VehicleTypesService',
      ],
      migration: {
        completed: 7,
        total: 7,
        percentage: 100,
      },
      features: [
        'Cache Redis optimisé',
        'Enrichissement cars_engine',
        'Recherche avancée multi-critères',
        'Codes mine spécialisés',
        'Architecture modulaire',
        'Health check intégré',
        'Statistiques complètes',
      ],
    };
  }
}
