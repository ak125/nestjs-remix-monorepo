import {
  Controller,
  Get,
  Query,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CacheInterceptor } from '@nestjs/cache-manager';

/**
 * 🚗 CONTROLLER VEHICLES FORMS - Version optimisée
 *
 * Controller pour les formulaires basé sur le service principal
 * Endpoints compatibles avec les anciens _form.get.car.*.php
 *
 * ✨ Nouvelles fonctionnalités:
 * - Logging détaillé avec métriques
 * - Mise en cache intelligente
 * - Gestion d'erreurs améliorée
 * - Monitoring des performances
 */
@Controller('api/vehicles/forms')
@UseInterceptors(CacheInterceptor)
export class VehiclesFormsController {
  private readonly logger = new Logger(VehiclesFormsController.name);

  constructor(private readonly vehiclesService: VehiclesService) {}

  /**
   * GET /api/vehicles/forms/models
   * Tous les modèles avec marques
   */
  @Get('models')
  async getAllModels(@Query() query: any) {
    const startTime = Date.now();
    this.logger.log(`🔍 GET /models - search: ${query.search || 'none'}, limit: ${query.limit || 'default'}`);
    
    try {
      // Pour récupérer tous les modèles, on fait appel à la recherche avancée
      const result = await this.vehiclesService.searchAdvanced(
        query.search || '',
        1000,
      );
      
      const responseTime = Date.now() - startTime;
      this.logger.log(`✅ Models retrieved: ${result.models?.length || 0} items in ${responseTime}ms`);
      
      return result.models;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`❌ Error in getAllModels: ${error.message} (${responseTime}ms)`, error.stack);
      throw error;
    }
  }

    /**
   * GET /api/vehicles/forms/types
   * Tous les types avec modèles et marques
   */
  @Get('types')
  async getAllTypes(@Query() query: any) {
    const startTime = Date.now();
    this.logger.log(
      `🔍 GET /types - modelId: ${query.modelId || 'none'}, search: ${query.search || 'none'}`,
    );
    
    try {
      // Si modelId est fourni, utiliser l'endpoint spécifique
      if (query.modelId) {
        const result = await this.vehiclesService.findTypesByModel(
          query.modelId.toString(),
          {
            search: query.search,
            limit: parseInt(query.limit) || 200,
            page: parseInt(query.page) || 0,
          },
        );
        
        // Adapter le format pour correspondre à celui attendu par le TypeSelector
        const formattedTypes = result.data.map((type) => ({
          type_id: type.type_id,
          type_name: type.type_name,
          type_year_from: type.type_year_from,
          type_year_to: type.type_year_to,
          type_engine_description: type.type_engine_description,
          type_power_ps: type.type_power_ps
            ? parseInt(type.type_power_ps)
            : undefined,
          type_power_kw: type.type_power_kw
            ? parseInt(type.type_power_kw)
            : undefined,
          model: result.model,
        }));

        const responseTime = Date.now() - startTime;
        this.logger.log(`✅ Types by model retrieved: ${formattedTypes.length} items in ${responseTime}ms`);
        return formattedTypes;
      }

      // Sinon, récupérer tous les types
      const result = await this.vehiclesService.searchAdvanced(
        query.search || '',
        2000,
      );
      
      const responseTime = Date.now() - startTime;
      this.logger.log(`✅ All types retrieved: ${result.types?.length || 0} items in ${responseTime}ms`);
      return result.types;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `❌ Error in getAllTypes: ${error.message} (${responseTime}ms)`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * GET /api/vehicles/forms/search
   * Recherche complète
   */
  @Get('search')
  async searchVehicles(@Query() query: any) {
    return this.vehiclesService.searchAdvanced(query.q || query.search || '', 100);
  }

  /**
   * GET /api/vehicles/forms/years
   * Années disponibles pour un type
   */
  @Get('years')
  async getAllYears(@Query() query: any) {
    // Si typeId est fourni, on peut calculer les années à partir des données du type
    if (query.typeId) {
      // Récupérer le type spécifique pour obtenir ses années
      const typesResult = await this.vehiclesService.findTypesByModel('', {
        search: '',
        limit: 50000, // Grande limite pour chercher le type
        page: 0
      });
      
      const specificType = typesResult.data.find(
        type => type.type_id === query.typeId.toString()
      );
      
      if (specificType && specificType.type_year_from) {
        const startYear = parseInt(specificType.type_year_from);
        const endYear = specificType.type_year_to 
          ? parseInt(specificType.type_year_to) 
          : new Date().getFullYear();
        
        const years = [];
        for (let year = startYear; year <= endYear; year++) {
          years.push({ 
            year, 
            count: 1,
            available: true 
          });
        }
        
        return {
          years: years.reverse(), // Plus récent en premier
          totalYears: years.length,
          typeId: query.typeId
        };
      }
    }
    
    // Sinon, retourner une plage d'années génériques
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 1990; year <= currentYear; year++) {
      years.push({ 
        year, 
        count: 1,
        available: true 
      });
    }
    
    return {
      years: years.reverse(),
      totalYears: years.length
    };
  }

  /**
   * GET /api/vehicles/forms/stats
   * Statistiques des véhicules avec monitoring avancé
   */
  @Get('stats')
  async getStats() {
    const startTime = Date.now();
    this.logger.log('📊 GET /stats - Fetching vehicle statistics');
    
    try {
      const stats = await this.vehiclesService.getVehicleStats();
      const responseTime = Date.now() - startTime;
      
      this.logger.log(
        `✅ Stats retrieved: ${JSON.stringify({
          brands: stats.totalBrands,
          models: stats.totalModels,
          types: stats.totalTypes,
          products: stats.totalProducts,
          responseTime: `${responseTime}ms`
        })}`,
      );
      
      return {
        ...stats,
        performance: {
          responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `❌ Error in getStats: ${error.message} (${responseTime}ms)`,
        error.stack,
      );
      
      return {
        totalBrands: 0,
        totalModels: 0,
        totalTypes: 0,
        totalProducts: 0,
        error: 'Erreur lors du chargement des statistiques',
        performance: {
          responseTime,
          timestamp: new Date().toISOString(),
          hasError: true,
        },
      };
    }
  }

  /**
   * GET /api/vehicles/forms/compatible-products
   * Recherche de produits compatibles
   */
  @Get('compatible-products')
  async getCompatibleProducts(@Query() query: any) {
    try {
      const { modelId, typeId, year } = query;
      
      if (!modelId && !typeId && !year) {
        return {
          products: [],
          total: 0,
          message: 'Aucun critère de recherche fourni'
        };
      }

      // Pour le moment, retournons des données simulées
      // En production, ceci ferait appel à votre service de produits
      const mockProducts = [
        {
          id: '1',
          name: 'Filtre à huile premium',
          reference: 'FO-2024-001',
          price: 24.99,
          brand: 'AutoParts Pro',
          category: 'Filtration',
          description: 
            'Filtre à huile haute performance pour moteurs essence et diesel',
        },
        {
          id: '2',
          name: 'Plaquettes de frein avant',
          reference: 'BR-2024-045',
          price: 89.99,
          brand: 'SafeBrake',
          category: 'Freinage',
          description: 'Plaquettes de frein céramiques longue durée',
        },
        {
          id: '3',
          name: "Bougies d'allumage (x4)",
          reference: 'SP-2024-123',
          price: 45.99,
          brand: 'IgnitionMax',
          category: 'Allumage',
          description: 'Jeu de 4 bougies iridium haute performance',
        },
      ];

      return {
        products: mockProducts,
        total: mockProducts.length,
        searchCriteria: {
          modelId,
          typeId,
          year,
        },
      };

    } catch (error) {
      console.error('Erreur dans getCompatibleProducts:', error);
      return {
        products: [],
        total: 0,
        error: 'Erreur lors de la recherche de produits'
      };
    }
  }
}
