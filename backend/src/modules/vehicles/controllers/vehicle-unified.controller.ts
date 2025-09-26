/**
 * 🚗 CONTRÔLEUR VÉHICULES UNIFIÉ
 * 
 * Contrôleur NestJS utilisant les types unifiés @monorepo/shared-types
 * Démonstration API endpoints avec types partagés
 */

import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { VehicleUnifiedService } from '../services/vehicle-unified.service';
import type {
  VehicleBrand,
  VehicleModel,
  VehicleType,
  ApiResponse,
  PaginationOptions,
} from '@monorepo/shared-types';

// Type temporaire étendu pour les options de recherche
interface SearchablePaginationOptions extends PaginationOptions {
  search?: string;
}

@Controller('api/vehicles-unified')
export class VehicleUnifiedController {
  
  constructor(private readonly vehicleService: VehicleUnifiedService) {}

  /**
   * GET /api/vehicles-unified/brands
   * Récupère les marques avec types unifiés
   */
  @Get('brands')
  async getBrands(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search?: string,
  ): Promise<ApiResponse<VehicleBrand[]>> {
    const options: SearchablePaginationOptions = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Limite max 100
      search,
    };

    return this.vehicleService.getBrands(options);
  }

  /**
   * GET /api/vehicles-unified/brands/:brandId/models
   * Récupère les modèles d'une marque
   */
  @Get('brands/:brandId/models')
  async getModelsByBrand(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search?: string,
  ): Promise<ApiResponse<VehicleModel[]>> {
    const options: PaginationOptions = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      search,
    };

    return this.vehicleService.getModelsByBrand(brandId, options);
  }

  /**
   * GET /api/vehicles-unified/models/:modelId/types
   * Récupère les types d'un modèle
   */
  @Get('models/:modelId/types')
  async getTypesByModel(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search?: string,
  ): Promise<ApiResponse<VehicleType[]>> {
    const options: PaginationOptions = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      search,
    };

    return this.vehicleService.getTypesByModel(modelId, options);
  }

  /**
   * GET /api/vehicles-unified/test
   * Test de compatibilité des types unifiés
   */
  @Get('test')
  async testUnifiedTypes(): Promise<ApiResponse<{
    packageVersion: string;
    typesWorking: boolean;
    validationWorking: boolean;
    apiResponseWorking: boolean;
  }>> {
    return this.vehicleService.testUnifiedTypes();
  }
}