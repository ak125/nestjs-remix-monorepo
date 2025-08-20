import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { AutoDataEnhancedService } from '../services/auto-data-enhanced.service';

/**
 * 🚗 Contrôleur enrichi pour les données automobiles
 * Expose les API pour marques, modèles, types, pièces + fonctionnalités véhicules avancées
 * Routes: /api/catalog/vehicles/*
 */
@Controller('catalog/vehicles')
export class VehiclesController {
  private readonly logger = new Logger(VehiclesController.name);

  constructor(private readonly autoDataService: AutoDataEnhancedService) {}

  /**
   * GET /api/catalog/vehicles/stats
   * Statistiques générales des véhicules
   */
  @Get('stats')
  async getVehicleStats() {
    this.logger.log('GET /catalog/vehicles/stats');
    return this.autoDataService.getVehicleStats();
  }

  /**
   * GET /api/catalog/vehicles/brands
   * Récupérer toutes les marques automobiles
   */
  @Get('brands')
  async getBrands() {
    this.logger.log('GET /catalog/vehicles/brands');
    return this.autoDataService.getBrands();
  }

  /**
   * GET /api/catalog/vehicles/brands/:brandId/models
   * Récupérer les modèles d'une marque
   */
  @Get('brands/:brandId/models')
  async getModelsByBrand(@Param('brandId') brandId: string) {
    this.logger.log(`GET /catalog/vehicles/brands/${brandId}/models`);
    return this.autoDataService.getModelsByBrand(brandId);
  }

  /**
   * GET /api/catalog/vehicles/models/:modelId/types
   * Récupérer les types/versions d'un modèle
   */
  @Get('models/:modelId/types')
  async getTypesByModel(@Param('modelId') modelId: string) {
    this.logger.log(`GET /catalog/vehicles/models/${modelId}/types`);
    return this.autoDataService.getTypesByModel(modelId);
  }

  /**
   * GET /api/catalog/vehicles/search
   * Recherche avancée de véhicules par critères multiples
   */
  @Get('search')
  async searchVehicles(
    @Query('brandId') brandId?: string,
    @Query('modelId') modelId?: string,
    @Query('typeId') typeId?: string,
    @Query('year') year?: string,
    @Query('engineCode') engineCode?: string,
    @Query('fuelType') fuelType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log(
      `GET /catalog/vehicles/search - brand:${brandId}, model:${modelId}, type:${typeId}, year:${year}`,
    );

    return this.autoDataService.searchVehicles({
      brandId,
      modelId,
      typeId,
      year: year ? parseInt(year, 10) : undefined,
      engineCode,
      fuelType,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * GET /api/catalog/vehicles/compatibility/:pieceId
   * Véhicules compatibles avec une pièce
   */
  @Get('compatibility/:pieceId')
  async getCompatibleVehicles(@Param('pieceId') pieceId: string) {
    this.logger.log(`GET /catalog/vehicles/compatibility/${pieceId}`);
    return this.autoDataService.getCompatibleVehicles(pieceId);
  }

  /**
   * GET /api/catalog/vehicles/parts/by-vehicle
   * Pièces disponibles pour un véhicule spécifique
   */
  @Get('parts/by-vehicle')
  async getPartsByVehicle(
    @Query('brandId') brandId: string,
    @Query('modelId') modelId: string,
    @Query('typeId') typeId?: string,
  ) {
    this.logger.log(
      `GET /catalog/vehicles/parts/by-vehicle - brand:${brandId}, model:${modelId}, type:${typeId}`,
    );

    if (!brandId || !modelId) {
      return {
        success: false,
        error: 'brandId et modelId sont requis',
        data: [],
      };
    }

    return this.autoDataService.getPartsByVehicle(brandId, modelId, typeId);
  }

  /**
   * GET /api/catalog/vehicles/parts/search
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
      `GET /catalog/vehicles/parts/search - brand:${brandId}, model:${modelId}, type:${typeId}, gamme:${gamme}`,
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
   * GET /api/catalog/vehicles/parts/:partId
   * Récupérer les détails d'une pièce
   */
  @Get('parts/:partId')
  async getPartDetails(@Param('partId') partId: string) {
    this.logger.log(`GET /catalog/vehicles/parts/${partId}`);
    return this.autoDataService.getPartDetails(partId);
  }

  /**
   * GET /api/catalog/vehicles/parts/quick-search
   * Recherche rapide de pièces par référence ou titre
   */
  @Get('parts/quick-search')
  async quickSearchParts(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(
      `GET /catalog/vehicles/parts/quick-search - q:${searchTerm}`,
    );

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
}
