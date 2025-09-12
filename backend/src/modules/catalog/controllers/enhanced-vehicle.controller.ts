import { Controller, Get, Query, Param, Logger, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EnhancedVehicleService } from '../services/enhanced-vehicle.service';
import { VehicleBrand, VehicleModel, VehicleType, VehicleResponse } from '../types/vehicle.types';

/**
 * 🚗 ENHANCED VEHICLE CONTROLLER - Contrôleur Véhicule Optimisé
 * 
 * API RESTful pour gestion des véhicules optimisée
 */

@ApiTags('🚗 Vehicles')
@Controller('api/vehicles')
export class EnhancedVehicleController {
  private readonly logger = new Logger(EnhancedVehicleController.name);

  constructor(private readonly vehicleService: EnhancedVehicleService) {
    this.logger.log('🚗 EnhancedVehicleController initialisé');
  }

  /**
   * 🏷️ Récupérer toutes les marques avec pagination
   */
  @Get('brands')
  @ApiOperation({ summary: 'Récupérer les marques de véhicules' })
  @ApiResponse({ status: 200, description: 'Liste des marques récupérée avec succès' })
  async getBrands(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('onlyFavorites') onlyFavorites?: boolean,
    @Query('onlyActive') onlyActive?: boolean,
  ): Promise<VehicleResponse<VehicleBrand>> {
    try {
      this.logger.debug(`🏷️ Récupération marques - page: ${page}, limit: ${limit}, search: ${search}`);
      
      const result = await this.vehicleService.getBrands({
        page: page ? Math.max(0, page) : 0,
        limit: limit ? Math.min(100, Math.max(1, limit)) : 50,
        search,
        onlyFavorites,
        onlyActive,
      });

      this.logger.log(`✅ ${result.data.length} marques récupérées`);
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur récupération marques:', error);
      throw new BadRequestException('Erreur lors de la récupération des marques');
    }
  }

  /**
   * 📅 Récupérer les années disponibles pour une marque
   */
  @Get('brands/:brandId/years')
  @ApiOperation({ summary: 'Récupérer les années disponibles pour une marque' })
  @ApiResponse({ status: 200, description: 'Liste des années récupérée avec succès' })
  async getYearsByBrand(@Param('brandId', ParseIntPipe) brandId: number): Promise<number[]> {
    try {
      this.logger.debug(`📅 Récupération années pour marque: ${brandId}`);
      
      if (brandId <= 0) {
        throw new BadRequestException('ID de marque invalide');
      }

      const years = await this.vehicleService.getYearsByBrand(brandId);

      this.logger.log(`✅ ${years.length} années trouvées pour marque ${brandId}`);
      return years;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération années marque ${brandId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erreur lors de la récupération des années');
    }
  }

  /**
   * 🚙 Récupérer les modèles d'une marque
   */
  @Get('brands/:brandId/models')
  @ApiOperation({ summary: 'Récupérer les modèles d\'une marque' })
  @ApiResponse({ status: 200, description: 'Liste des modèles récupérée avec succès' })
  async getModels(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Query('year') year?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<VehicleResponse<VehicleModel>> {
    try {
      this.logger.debug(`🚙 Récupération modèles pour marque: ${brandId}, année: ${year}`);
      
      if (brandId <= 0) {
        throw new BadRequestException('ID de marque invalide');
      }

      if (year && (year < 1980 || year > new Date().getFullYear() + 2)) {
        throw new BadRequestException('Année invalide');
      }

      const result = await this.vehicleService.getModels(brandId, year, {
        page: page ? Math.max(0, page) : 0,
        limit: limit ? Math.min(100, Math.max(1, limit)) : 50,
        search,
      });

      this.logger.log(`✅ ${result.data.length} modèles récupérés pour marque ${brandId}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération modèles marque ${brandId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erreur lors de la récupération des modèles');
    }
  }

  /**
   * ⚙️ Récupérer les motorisations d'un modèle
   */
  @Get('models/:modelId/engines')
  @ApiOperation({ summary: 'Récupérer les motorisations d\'un modèle' })
  @ApiResponse({ status: 200, description: 'Liste des motorisations récupérée avec succès' })
  async getEngineTypes(@Param('modelId', ParseIntPipe) modelId: number): Promise<VehicleType[]> {
    try {
      this.logger.debug(`⚙️ Récupération motorisations pour modèle: ${modelId}`);
      
      if (modelId <= 0) {
        throw new BadRequestException('ID de modèle invalide');
      }

      const engines = await this.vehicleService.getEngineTypes(modelId);

      this.logger.log(`✅ ${engines.length} motorisations récupérées pour modèle ${modelId}`);
      return engines;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération motorisations modèle ${modelId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erreur lors de la récupération des motorisations');
    }
  }

  /**
   * 🔍 Rechercher un véhicule par type mine
   */
  @Get('search/mine/:mineType')
  @ApiOperation({ summary: 'Rechercher un véhicule par type mine' })
  @ApiResponse({ status: 200, description: 'Véhicule trouvé avec succès' })
  async searchByMineType(@Param('mineType') mineType: string) {
    try {
      this.logger.debug(`🔍 Recherche véhicule par type mine: ${mineType}`);
      
      if (!mineType || mineType.trim().length < 3) {
        throw new BadRequestException('Type mine invalide (minimum 3 caractères)');
      }

      const cleanMineType = mineType.trim().toUpperCase();
      const vehicle = await this.vehicleService.searchByMineType(cleanMineType);

      if (!vehicle) {
        this.logger.warn(`⚠️ Aucun véhicule trouvé pour type mine: ${cleanMineType}`);
        return {
          success: false,
          message: `Aucun véhicule trouvé pour le type mine: ${cleanMineType}`,
          data: null
        };
      }

      this.logger.log(`✅ Véhicule trouvé pour type mine ${cleanMineType}: ${vehicle.name}`);
      return {
        success: true,
        message: 'Véhicule trouvé avec succès',
        data: vehicle
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche type mine ${mineType}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erreur lors de la recherche par type mine');
    }
  }

  /**
   * 📊 Récupérer les statistiques générales
   */
  @Get('stats')
  @ApiOperation({ summary: 'Récupérer les statistiques des véhicules' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getVehicleStats() {
    try {
      this.logger.debug('📊 Récupération statistiques véhicules');
      
      const stats = await this.vehicleService.getVehicleStats();

      this.logger.log(`✅ Statistiques récupérées: ${JSON.stringify(stats)}`);
      return {
        success: true,
        message: 'Statistiques récupérées avec succès',
        data: stats
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération statistiques:', error);
      throw new BadRequestException('Erreur lors de la récupération des statistiques');
    }
  }

  /**
   * 🗑️ Nettoyer le cache des véhicules
   */
  @Get('cache/clear')
  @ApiOperation({ summary: 'Nettoyer le cache des véhicules' })
  @ApiResponse({ status: 200, description: 'Cache nettoyé avec succès' })
  async clearCache() {
    try {
      this.logger.debug('🗑️ Nettoyage cache véhicules');
      
      await this.vehicleService.clearCache();

      this.logger.log('✅ Cache véhicules nettoyé avec succès');
      return {
        success: true,
        message: 'Cache véhicules nettoyé avec succès',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Erreur nettoyage cache véhicules:', error);
      throw new BadRequestException('Erreur lors du nettoyage du cache');
    }
  }

  /**
   * 🔍 DEBUG: Vérifier les valeurs de marque_display
   */
  @Get('debug/marque-display')
  @ApiOperation({ summary: 'DEBUG: Valeurs marque_display' })
  async debugMarqueDisplay() {
    return await this.vehicleService.debugMarqueDisplay();
  }
}