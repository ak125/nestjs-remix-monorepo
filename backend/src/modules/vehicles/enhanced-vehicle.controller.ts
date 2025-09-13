import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { EnhancedVehicleService } from './services/enhanced-vehicle.service';

/**
 * 🚗 ENHANCED VEHICLE CONTROLLER - Contrôleur minimaliste pour sélecteur véhicule
 * 
 * ✅ 3 endpoints essentiels seulement
 * ✅ Compatible avec le sélecteur véhicule frontend
 */
@ApiTags('vehicles')
@Controller('api/vehicles')
export class EnhancedVehicleController {
  private readonly logger = new Logger(EnhancedVehicleController.name);

  constructor(
    private readonly vehicleService: EnhancedVehicleService,
  ) {}

  /**
   * 🏷️ Endpoint 1 - Toutes les marques
   */
  @Get('brands')
  @ApiOperation({
    summary: '🏷️ Liste des marques',
    description: 'Récupère toutes les marques automobiles disponibles'
  })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiQuery({ name: 'search', required: false, type: 'string', example: 'BMW' })
  @ApiResponse({ status: 200, description: 'Liste des marques véhicules' })
  async getBrands(
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 50,
    @Query('search') search?: string,
  ) {
    try {
      this.logger.debug(`🏷️ getBrands appelé: page=${page}, limit=${limit}, search=${search}`);
      
      const result = await this.vehicleService.getBrands({
        page,
        limit,
        search,
      });
      
      this.logger.debug(`✅ getBrands réussi: ${result.data?.length} marques`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur getBrands: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 🚗 Endpoint 2 - Modèles par marque
   */
  @Get('brands/:brandId/models')
  @ApiOperation({ 
    summary: '🚗 Modèles par marque',
    description: 'Récupère tous les modèles d\'une marque spécifique'
  })
  @ApiParam({ name: 'brandId', description: 'ID de la marque', example: 1 })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiResponse({ status: 200, description: 'Liste des modèles de la marque' })
  async getModelsByBrand(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 50,
  ) {
    try {
      this.logger.debug(`🚗 getModelsByBrand appelé: brandId=${brandId}, page=${page}, limit=${limit}`);
      
      const result = await this.vehicleService.getModelsByBrand(brandId, {
        page,
        limit,
      });
      
      this.logger.debug(`✅ getModelsByBrand réussi: ${result.data?.length} modèles`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur getModelsByBrand: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 🔧 Endpoint 3 - Types par modèle
   */
  @Get('models/:modelId/types')
  @ApiOperation({ 
    summary: '🔧 Types par modèle',
    description: 'Récupère tous les types/motorisations d\'un modèle spécifique'
  })
  @ApiParam({ name: 'modelId', description: 'ID du modèle', example: 1 })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiResponse({ status: 200, description: 'Liste des types du modèle' })
  async getTypesByModel(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 50,
  ) {
    try {
      this.logger.debug(`🔧 getTypesByModel appelé: modelId=${modelId}, page=${page}, limit=${limit}`);
      
      const result = await this.vehicleService.getTypesByModel(modelId, {
        page,
        limit,
      });
      
      this.logger.debug(`✅ getTypesByModel réussi: ${result.data?.length} types`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur getTypesByModel: ${error.message}`, error.stack);
      throw error;
    }
  }
}