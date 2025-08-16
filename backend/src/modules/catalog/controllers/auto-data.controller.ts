import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { AutoDataService } from '../services/auto-data.service';

/**
 * Contrôleur pour les données automobiles
 * Expose les API pour marques, modèles, types et pièces
 */
@Controller('catalog/auto')
export class AutoDataController {
  private readonly logger = new Logger(AutoDataController.name);

  constructor(private readonly autoDataService: AutoDataService) {}

  /**
   * GET /api/catalog/auto/brands
   * Récupérer toutes les marques automobiles
   */
  @Get('brands')
  async getBrands() {
    this.logger.log('GET /catalog/auto/brands');
    return this.autoDataService.getBrands();
  }

  /**
   * GET /api/catalog/auto/brands/:brandId/models
   * Récupérer les modèles d'une marque
   */
  @Get('brands/:brandId/models')
  async getModelsByBrand(@Param('brandId') brandId: string) {
    this.logger.log(`GET /catalog/auto/brands/${brandId}/models`);
    return this.autoDataService.getModelsByBrand(brandId);
  }

  /**
   * GET /api/catalog/auto/models/:modelId/types
   * Récupérer les types/versions d'un modèle
   */
  @Get('models/:modelId/types')
  async getTypesByModel(@Param('modelId') modelId: string) {
    this.logger.log(`GET /catalog/auto/models/${modelId}/types`);
    return this.autoDataService.getTypesByModel(modelId);
  }

  /**
   * GET /api/catalog/auto/parts/search
   * Rechercher des pièces par compatibilité véhicule
   */
  @Get('parts/search')
  async searchPartsByVehicle(
    @Query('brandId') brandId?: string,
    @Query('modelId') modelId?: string,
    @Query('typeId') typeId?: string,
    @Query('gamme') gamme?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log(
      `GET /catalog/auto/parts/search - brand:${brandId}, model:${modelId}, type:${typeId}, gamme:${gamme}`,
    );

    return this.autoDataService.searchPartsByVehicle({
      brandId,
      modelId,
      typeId,
      gamme,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * GET /api/catalog/auto/parts/:partId
   * Récupérer les détails d'une pièce
   */
  @Get('parts/:partId')
  async getPartDetails(@Param('partId') partId: string) {
    this.logger.log(`GET /catalog/auto/parts/${partId}`);
    return this.autoDataService.getPartDetails(partId);
  }

  /**
   * GET /api/catalog/auto/parts/quick-search
   * Recherche rapide de pièces par référence ou titre
   */
  @Get('parts/quick-search')
  async quickSearchParts(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /catalog/auto/parts/quick-search - q:${searchTerm}`);

    if (!searchTerm || searchTerm.length < 2) {
      return {
        success: false,
        error: 'Le terme de recherche doit contenir au moins 2 caractères',
        data: [],
      };
    }

    return this.autoDataService.quickSearchParts(
      searchTerm,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * GET /api/catalog/auto/stats
   * Statistiques du catalogue automobile
   */
  @Get('stats')
  async getCatalogStats() {
    this.logger.log('GET /catalog/auto/stats');

    try {
      // Récupérer les statistiques en parallèle
      const [brands, models, types, parts] = await Promise.allSettled([
        this.autoDataService.getBrands(),
        // Simuler le comptage des modèles et types
        { success: true, data: [] },
        { success: true, data: [] },
        { success: true, data: [] },
      ]);

      return {
        success: true,
        data: {
          brands: brands.status === 'fulfilled' ? brands.value.data?.length || 0 : 0,
          models: 5745, // Valeur connue depuis la liste des tables
          types: 48918, // Valeur connue depuis la liste des tables
          parts: 4037422, // Valeur connue depuis la liste des tables
          lastUpdate: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
}
