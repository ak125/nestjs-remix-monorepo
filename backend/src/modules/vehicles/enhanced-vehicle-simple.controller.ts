import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EnhancedVehicleService } from './services/enhanced-vehicle.service';

/**
 * 🚗 ENHANCED VEHICLE CONTROLLER - Version Simplifiée
 * 
 * Contrôleur temporaire avec les endpoints essentiels pour le sélecteur véhicule
 */
@ApiTags('🚗 Enhanced Vehicles')
@Controller('api/vehicles')
export class EnhancedVehicleController {
  private readonly logger = new Logger(EnhancedVehicleController.name);

  constructor(
    private readonly vehicleService: EnhancedVehicleService
  ) {}

  /**
   * 🏷️ Récupérer toutes les marques
   */
  @Get('brands')
  @ApiOperation({ 
    summary: '🏷️ Liste des marques',
    description: 'Récupère toutes les marques de véhicules disponibles'
  })
  @ApiResponse({ status: 200, description: 'Liste des marques' })
  async getBrands(
    @Query('page') page = 0,
    @Query('limit') limit = 50,
    @Query('search') search?: string,
    @Query('onlyFavorites') onlyFavorites?: boolean,
    @Query('onlyActive') onlyActive = true,
  ) {
    try {
      return await this.vehicleService.getBrands({ 
        page: Number(page), 
        limit: Number(limit), 
        search,
        onlyFavorites: Boolean(onlyFavorites),
        onlyActive: Boolean(onlyActive)
      });
    } catch (error) {
      this.logger.error('Erreur getBrands:', error);
      return { success: false, data: [], total: 0, error: 'Erreur lors de la récupération des marques' };
    }
  }

  /**
   * 🚙 Récupérer les modèles d'une marque
   */
  @Get('models/brand/:brandId')
  @ApiOperation({ 
    summary: '🚙 Modèles par marque',
    description: 'Récupère tous les modèles pour une marque donnée'
  })
  @ApiResponse({ status: 200, description: 'Liste des modèles' })
  async getModelsByBrand(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Query('page') page = 0,
    @Query('limit') limit = 50,
    @Query('search') search?: string,
  ) {
    try {
      return await this.vehicleService.getModelsByBrand(brandId, { 
        page: Number(page), 
        limit: Number(limit), 
        search 
      });
    } catch (error) {
      this.logger.error(`Erreur getModelsByBrand ${brandId}:`, error);
      return { success: false, data: [], total: 0, error: 'Erreur lors de la récupération des modèles' };
    }
  }

  /**
   * 🔧 Récupérer les types d'un modèle
   */
  @Get('types/model/:modelId')
  @ApiOperation({ 
    summary: '🔧 Types par modèle',
    description: 'Récupère tous les types/motorisations pour un modèle donné'
  })
  @ApiResponse({ status: 200, description: 'Liste des types' })
  async getTypesByModel(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Query('page') page = 0,
    @Query('limit') limit = 50,
    @Query('includeEngine') includeEngine = true,
  ) {
    try {
      return await this.vehicleService.getTypesByModel(modelId, { 
        page: Number(page), 
        limit: Number(limit), 
        includeEngine: Boolean(includeEngine)
      });
    } catch (error) {
      this.logger.error(`Erreur getTypesByModel ${modelId}:`, error);
      return { success: false, data: [], total: 0, error: 'Erreur lors de la récupération des types' };
    }
  }

  /**
   * 📊 Stats du module véhicules
   */
  @Get('stats')
  @ApiOperation({ 
    summary: '📊 Statistiques véhicules',
    description: 'Statistiques générales du module véhicules'
  })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  async getStats() {
    try {
      return await this.vehicleService.getStats();
    } catch (error) {
      this.logger.error('Erreur getStats:', error);
      return { success: false, error: 'Erreur lors de la récupération des statistiques' };
    }
  }
}