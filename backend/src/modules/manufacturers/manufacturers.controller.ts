/**
 * 🏭 MANUFACTURERS CONTROLLER - Version Optimisée
 *
 * API REST complète pour les constructeurs automobiles
 * Utilise les tables existantes auto_* avec cache intelligent
 * Routes: /api/manufacturers/*
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';

@Controller('api/manufacturers')
export class ManufacturersController {
  private readonly logger = new Logger(ManufacturersController.name);

  constructor(private readonly manufacturersService: ManufacturersService) {}

  /**
   * GET /api/manufacturers
   * Récupérer tous les constructeurs
   */
  @Get('/debug')
  async debugConfig() {
    try {
      const configInfo = await this.manufacturersService.debugConfiguration();
      const connectionTest =
        await this.manufacturersService.testDatabaseConnection();

      return {
        config: configInfo,
        testResult: connectionTest,
        cache: {
          enabled: true,
          ttl: '300s (5 minutes)',
          maxEntries: 1000,
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : null,
      };
    }
  }

  @Get('/cache/clear')
  async clearCache(@Query('pattern') pattern?: string) {
    try {
      await this.manufacturersService.clearCache(pattern);
      return {
        success: true,
        message: pattern
          ? `Cache nettoyé pour pattern: ${pattern}`
          : 'Cache entièrement nettoyé',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  @Get()
  async getAllManufacturers(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.manufacturersService.getAllManufacturers(search);
  }

  /**
   * GET /api/manufacturers/popular
   * Récupérer les constructeurs populaires
   */
  @Get('popular')
  async getPopular(@Query('limit') limit?: string) {
    this.logger.log('GET /api/manufacturers/popular');
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.manufacturersService.getPopularManufacturers(limitNumber);
  }

  /**
   * GET /api/manufacturers/featured
   * Récupérer les constructeurs en vedette
   */
  @Get('featured')
  async getFeatured(@Query('limit') limit?: string) {
    this.logger.log('GET /api/manufacturers/featured');
    const limitNumber = limit ? parseInt(limit, 10) : 6;
    return this.manufacturersService.getFeaturedManufacturers(limitNumber);
  }

  /**
   * GET /api/manufacturers/popular-models
   * 🚗 Récupérer les modèles les plus consultés avec images
   * Pour carousel homepage (comme PHP)
   */
  @Get('popular-models')
  async getPopularModels(@Query('limit') limit?: string) {
    this.logger.log('GET /api/manufacturers/popular-models');
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    const models =
      await this.manufacturersService.getPopularModelsWithImages(limitNumber);

    return {
      success: true,
      data: models,
      total: models.length,
      message: `${models.length} modèles populaires récupérés`,
    };
  }

  /**
   * GET /api/manufacturers/brands-logos
   * 🎨 Récupérer les logos de marques pour carousel horizontal
   * Pour section "Marques les plus consultées" (comme PHP)
   */
  @Get('brands-logos')
  async getBrandsLogos(@Query('limit') limit?: string) {
    this.logger.log('GET /api/manufacturers/brands-logos');
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    const brands =
      await this.manufacturersService.getBrandsWithLogos(limitNumber);

    return {
      success: true,
      data: brands,
      total: brands.length,
      message: `${brands.length} logos de marques récupérés`,
    };
  }

  /**
   * GET /api/manufacturers/page-metadata/:alias
   * 📄 Récupérer les métadonnées SEO d'une page depuis __blog_meta_tags_ariane
   * Exemple: /api/manufacturers/page-metadata/blog-pieces-auto-auto
   */
  @Get('page-metadata/:alias')
  async getPageMetadata(@Param('alias') alias: string) {
    this.logger.log(`GET /api/manufacturers/page-metadata/${alias}`);
    const metadata = await this.manufacturersService.getPageMetadata(alias);

    return {
      success: true,
      data: metadata,
      message: `Métadonnées récupérées pour "${alias}"`,
    };
  }

  /**
   * GET /api/manufacturers/brand/:alias
   * 🔍 Récupérer une marque et ses modèles par alias (ex: "audi")
   */
  @Get('brand/:alias')
  async getBrandByAlias(@Param('alias') alias: string) {
    this.logger.log(`GET /api/manufacturers/brand/${alias}`);

    try {
      const result =
        await this.manufacturersService.getBrandWithModelsByAlias(alias);

      return {
        success: true,
        data: result,
        message: `Marque "${alias}" récupérée avec ${result.models.length} modèles`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur getBrandByAlias: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        data: { brand: null, models: [] },
      };
    }
  }

  /**
   * GET /api/manufacturers/brand/:brandAlias/model/:modelAlias
   * 🔍 Récupérer un modèle et ses motorisations par alias
   * Exemple: /api/manufacturers/brand/citroen/model/berlingo-ii
   */
  @Get('brand/:brandAlias/model/:modelAlias')
  async getModelByAlias(
    @Param('brandAlias') brandAlias: string,
    @Param('modelAlias') modelAlias: string,
  ) {
    this.logger.log(
      `GET /api/manufacturers/brand/${brandAlias}/model/${modelAlias}`,
    );

    try {
      const result = await this.manufacturersService.getModelWithTypesByAlias(
        brandAlias,
        modelAlias,
      );

      return {
        success: true,
        data: result,
        message: `Modèle "${modelAlias}" de "${brandAlias}" récupéré avec ${result.types.length} motorisations`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur getModelByAlias: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        data: { brand: null, model: null, types: [] },
      };
    }
  }

  /**
   * GET /api/manufacturers/seo/:marqueId
   * 🔍 Récupérer les données SEO dynamiques pour une page constructeur
   * Supporte 3 niveaux : marque, modèle, type
   */
  @Get('seo/:marqueId')
  async getDynamicSeo(
    @Param('marqueId', ParseIntPipe) marqueId: number,
    @Query('modeleId') modeleId?: string,
    @Query('typeId') typeId?: string,
  ) {
    this.logger.log(
      `GET /api/manufacturers/seo/${marqueId}?modeleId=${modeleId}&typeId=${typeId}`,
    );

    const modeleIdNum = modeleId ? parseInt(modeleId, 10) : undefined;
    const typeIdNum = typeId ? parseInt(typeId, 10) : undefined;

    const seoData = await this.manufacturersService.getDynamicSeoData(
      marqueId,
      modeleIdNum,
      typeIdNum,
    );

    return {
      success: true,
      data: seoData,
      message: 'Données SEO générées avec succès',
    };
  }

  /**
   * GET /api/manufacturers/stats
   * Récupérer les statistiques globales
   */
  @Get('stats')
  async getStats() {
    this.logger.log('GET /api/manufacturers/stats');
    return this.manufacturersService.getStats();
  }

  /**
   * GET /api/manufacturers/types/fuel-types
   * Récupérer les types de carburant disponibles
   */
  @Get('types/fuel-types')
  async getFuelTypes() {
    this.logger.log('GET /api/manufacturers/types/fuel-types');
    return this.manufacturersService.getFuelTypes();
  }

  /**
   * GET /api/manufacturers/types/power-ranges
   * Récupérer les gammes de puissance
   */
  @Get('types/power-ranges')
  async getPowerRanges() {
    this.logger.log('GET /api/manufacturers/types/power-ranges');
    return this.manufacturersService.getPowerRanges();
  }

  /**
   * GET /api/manufacturers/types/search
   * Rechercher des types par critères multiples
   */
  @Get('types/search')
  async searchTypes(
    @Query('manufacturerId') manufacturerId?: string,
    @Query('search') search?: string,
    @Query('fuel_type') fuelType?: string,
    @Query('min_power') minPower?: string,
    @Query('max_power') maxPower?: string,
    @Query('year_from') yearFrom?: string,
    @Query('year_to') yearTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log('GET /api/manufacturers/types/search');

    const filters = {
      manufacturerId: manufacturerId ? parseInt(manufacturerId, 10) : undefined,
      search,
      fuel_type: fuelType,
      min_power: minPower ? parseInt(minPower, 10) : undefined,
      max_power: maxPower ? parseInt(maxPower, 10) : undefined,
      year_from: yearFrom ? parseInt(yearFrom, 10) : undefined,
      year_to: yearTo ? parseInt(yearTo, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    return this.manufacturersService.searchTypes(filters);
  }

  /**
   * GET /api/manufacturers/search
   * Recherche de constructeurs (inspiré de votre version)
   */
  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    this.logger.log(`GET /api/manufacturers/search?q=${query}`);
    return this.manufacturersService.getAllManufacturers(query);
  }

  /**
   * GET /api/manufacturers/types/categories
   * Catégories de types (comme dans votre version)
   */
  @Get('types/categories')
  async getCategories() {
    this.logger.log('GET /api/manufacturers/types/categories');
    return {
      categories: [
        'passenger',
        'commercial',
        'motorcycle',
        'sports',
        'electric',
      ],
      message: 'Catégories disponibles',
    };
  }

  /**
   * GET /api/manufacturers/:id
   * Récupérer un constructeur par ID
   */
  @Get(':id')
  async getManufacturerById(
    @Param('id') id: string,
    @Query('include_models') includeModels?: boolean,
  ) {
    this.logger.log(`GET /api/manufacturers/${id}`);

    const manufacturerId = parseInt(id, 10);
    if (isNaN(manufacturerId)) {
      return {
        success: false,
        error: 'ID constructeur invalide',
        data: null,
      };
    }

    return this.manufacturersService.getManufacturerById(
      manufacturerId,
      includeModels !== false, // Par défaut true
    );
  }

  /**
   * GET /api/manufacturers/:id/models
   * Récupérer les modèles d'un constructeur
   */
  @Get(':id/models')
  async getModelsByManufacturer(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('active_only') activeOnly?: boolean,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log(`GET /api/manufacturers/${id}/models`);

    const manufacturerId = parseInt(id, 10);
    if (isNaN(manufacturerId)) {
      return {
        success: false,
        error: 'ID constructeur invalide',
        data: [],
      };
    }

    const filters = {
      search,
      active_only: activeOnly,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    return this.manufacturersService.getModelsByManufacturer(
      manufacturerId,
      filters,
    );
  }

  /**
   * GET /api/manufacturers/models/:modelId/types
   * Récupérer les types d'un modèle
   */
  @Get('models/:modelId/types')
  async getTypesByModel(
    @Param('modelId') modelId: string,
    @Query('search') search?: string,
    @Query('fuel_type') fuelType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log(`GET /api/manufacturers/models/${modelId}/types`);

    const modelIdNumber = parseInt(modelId, 10);
    if (isNaN(modelIdNumber)) {
      return {
        success: false,
        error: 'ID modèle invalide',
        data: [],
      };
    }

    const filters = {
      search,
      fuel_type: fuelType,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    return this.manufacturersService.getTypesByModel(modelIdNumber, filters);
  }

  /**
   * GET /api/manufacturers/types/fuel-types
   * Récupérer tous les types de carburant
   */
  @Get('types/fuel-types')
  async getFuelTypes() {
    this.logger.log('GET /api/manufacturers/types/fuel-types');
    return this.manufacturersService.getFuelTypes();
  }

  /**
   * GET /api/manufacturers/types/by-fuel/:fuelType
   * Récupérer les types par carburant
   */
  @Get('types/by-fuel/:fuelType')
  async getTypesByFuel(
    @Param('fuelType') fuelType: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /api/manufacturers/types/by-fuel/${fuelType}`);
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.manufacturersService.getTypesByFuelType(fuelType, limitNumber);
  }

  /**
   * GET /api/manufacturers/:id/history
   * Historique d'un constructeur (inspiré de votre version)
   */
  @Get(':id/history')
  async getHistory(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`GET /api/manufacturers/${id}/history`);
    const manufacturer =
      await this.manufacturersService.getManufacturerById(id);
    if (!manufacturer.success) {
      return { success: false, error: 'Constructeur non trouvé', data: null };
    }

    return {
      success: true,
      data: {
        manufacturer: manufacturer.data?.manufacturer,
        founded: 'Information non disponible',
        milestones: [],
        current_models_count: manufacturer.data?.models?.length || 0,
        message: 'Historique basé sur les modèles disponibles',
      },
    };
  }

  /**
   * GET /api/manufacturers/:id/stats
   * Statistiques d'un constructeur (comme votre version)
   */
  @Get(':id/stats')
  async getManufacturerStats(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year?: string,
  ) {
    this.logger.log(`GET /api/manufacturers/${id}/stats`);
    const manufacturer =
      await this.manufacturersService.getManufacturerById(id);
    if (!manufacturer.success) {
      return { success: false, error: 'Constructeur non trouvé', data: null };
    }

    const models = manufacturer.data?.models || [];
    return {
      success: true,
      data: {
        manufacturer_id: id,
        manufacturer_name: manufacturer.data?.manufacturer?.name,
        total_models: models.length,
        active_models: models.filter((m: any) => m.is_active).length,
        year_filter: year || 'all',
        models_by_decade: this.groupModelsByDecade(models),
      },
    };
  }

  /**
   * Helper pour grouper les modèles par décennie
   */
  private groupModelsByDecade(models: any[]) {
    const decades: { [key: string]: number } = {};
    models.forEach((model) => {
      if (model.year_start) {
        const decade = Math.floor(model.year_start / 10) * 10;
        const key = `${decade}s`;
        decades[key] = (decades[key] || 0) + 1;
      }
    });
    return decades;
  }

  /**
   * 🆕 GET /api/manufacturers/search-advanced
   * Test des nouvelles fonctions SQL avec similarity
   */
  @Get('search-advanced')
  async searchAdvanced(
    @Query('q') query: string = 'BMW',
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /api/manufacturers/search-advanced?q=${query}`);

    if (!query || query.length < 2) {
      return {
        success: false,
        error: 'Query trop courte (minimum 2 caractères)',
        data: [],
      };
    }

    try {
      // Test direct avec Supabase RPC
      const { data, error } = await this.manufacturersService.client.rpc(
        'search_manufacturers_advanced',
        {
          search_query: query,
          limit_count: limit ? parseInt(limit) : 20,
        },
      );

      if (error) {
        this.logger.error('Erreur search_manufacturers_advanced:', error);
        return {
          success: false,
          error: `Fonction SQL non disponible: ${error.message}`,
          fallback: true,
          data: await this.fallbackSearch(query),
        };
      }

      return {
        success: true,
        method: 'similarity_sql',
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error: any) {
      this.logger.error('Erreur search-advanced:', error);
      return {
        success: false,
        error: error.message,
        fallback: true,
        data: await this.fallbackSearch(query),
      };
    }
  }

  /**
   * 🆕 GET /api/manufacturers/types/search-advanced
   * Test recherche types avec similarity
   */
  @Get('types/search-advanced')
  async searchTypesAdvanced(
    @Query('q') query: string = 'GTI',
    @Query('manufacturer_id') manufacturerId?: string,
    @Query('fuel_type') fuelType?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /api/manufacturers/types/search-advanced?q=${query}`);

    try {
      const { data, error } = await this.manufacturersService.client.rpc(
        'search_types_advanced',
        {
          search_query: query,
          filter_manufacturer_id: manufacturerId
            ? parseInt(manufacturerId)
            : null,
          filter_fuel_type: fuelType || null,
          limit_count: limit ? parseInt(limit) : 50,
        },
      );

      if (error) {
        return {
          success: false,
          error: `Fonction SQL non disponible: ${error.message}`,
          data: [],
        };
      }

      return {
        success: true,
        method: 'similarity_sql',
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * 🆕 GET /api/manufacturers/overview-enhanced
   * Test vue enrichie manufacturer_overview_enhanced
   */
  @Get('overview-enhanced')
  async getOverviewEnhanced(@Query('limit') limit?: string) {
    this.logger.log('GET /api/manufacturers/overview-enhanced');

    try {
      const { data, error } = await this.manufacturersService.client
        .from('manufacturer_overview_enhanced')
        .select('*')
        .order('types_count', { ascending: false })
        .limit(limit ? parseInt(limit) : 10);

      if (error) {
        return {
          success: false,
          error: `Vue SQL non disponible: ${error.message}`,
          data: [],
        };
      }

      return {
        success: true,
        method: 'enhanced_view',
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * 🆕 GET /api/manufacturers/test-sql-functions
   * Test de toutes les fonctions SQL
   */
  @Get('test-sql-functions')
  async testSqlFunctions() {
    this.logger.log('GET /api/manufacturers/test-sql-functions');

    try {
      // Essayer d'exécuter les fonctions de test
      const { data, error } = await this.manufacturersService.client.rpc(
        'test_search_functions',
      );

      if (error) {
        return {
          success: false,
          error: `Fonctions SQL non disponibles: ${error.message}`,
          install_note:
            'Exécutez le fichier sql/manufacturers-search-functions.sql pour installer les fonctions',
        };
      }

      return {
        success: true,
        results: data || [],
        message: 'Toutes les fonctions SQL sont opérationnelles',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        install_note: 'Les fonctions SQL ne sont pas installées',
      };
    }
  }

  /**
   * Recherche fallback avec l'API existante
   */
  /**
   * Recherche fallback avec l'API existante
   */
  private async fallbackSearch(query: string) {
    const manufacturers = await this.manufacturersService.getAllManufacturers();
    return (
      manufacturers.data?.filter((m: any) =>
        m.name.toLowerCase().includes(query.toLowerCase()),
      ) || []
    );
  }

  /**
   * GET /api/manufacturers/types/stats
   * Récupérer les statistiques des types
   */
  @Get('types/stats')
  async getTypesStats() {
    this.logger.log('GET /api/manufacturers/types/stats');
    return this.manufacturersService.getTypesStats();
  }

  /**
   * GET /api/manufacturers/display-levels
   * Analyser les niveaux de marque_display
   */
  @Get('display-levels')
  async getDisplayLevels() {
    this.logger.log('GET /api/manufacturers/display-levels');

    try {
      const { data, error } = await this.manufacturersService.client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_display, marque_logo')
        .order('marque_display', { ascending: false })
        .order('marque_name', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      // Grouper par niveau de display
      const grouped: Record<number, any[]> = {};
      const stats: Record<number, number> = {};

      data.forEach((m) => {
        const level = m.marque_display ?? 0;
        if (!grouped[level]) {
          grouped[level] = [];
          stats[level] = 0;
        }
        grouped[level].push({
          id: m.marque_id,
          name: m.marque_name,
          logo: m.marque_logo ? true : false,
        });
        stats[level]++;
      });

      return {
        success: true,
        total: data.length,
        statistics: stats,
        levels: Object.keys(grouped)
          .sort((a, b) => Number(b) - Number(a))
          .map((level) => ({
            display: Number(level),
            count: stats[Number(level)],
            brands: grouped[Number(level)],
          })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
