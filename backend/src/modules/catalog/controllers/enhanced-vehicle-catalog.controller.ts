// 📁 backend/src/modules/catalog/controllers/enhanced-vehicle-catalog.controller.ts
// 🎮 Contrôleur simplifié pour les véhicules

import { 
  Controller, 
  Get, 
  Logger,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse,
} from '@nestjs/swagger';
import { EnhancedVehicleCatalogService } from '../services/enhanced-vehicle-catalog.service';

/**
 * 🎮 ENHANCED VEHICLE CATALOG CONTROLLER (VERSION SIMPLIFIÉE)
 * 
 * ✅ CONTROLLER TEMPORAIREMENT SIMPLIFIÉ pour éviter les erreurs de compilation
 * - Endpoints de base uniquement
 * - À développer ultérieurement
 */
@ApiTags('Enhanced Vehicle Catalog (Simplified)')
@Controller('enhanced-vehicle-catalog')
export class EnhancedVehicleCatalogController {
  private readonly logger = new Logger(EnhancedVehicleCatalogController.name);

  constructor(
    private readonly catalogService: EnhancedVehicleCatalogService,
  ) {}

  /**
   * 🚗 Test du service véhicules simplifié
   */
  @Get('test')
  @ApiOperation({ summary: 'Test du service véhicules simplifié' })
  @ApiResponse({ status: 200, description: 'Service véhicules testé avec succès' })
  async testVehicleService() {
    try {
      this.logger.log('🧪 Test service véhicules simplifié');

      const testResult = await this.catalogService.testVehicleConnection();
      const catalogData = await this.catalogService.getVehicleCatalog();

      return {
        success: true,
        data: {
          service_test: testResult,
          catalog_test: catalogData,
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('❌ Erreur test service véhicules:', error);
      return {
        success: false,
        error: 'Erreur lors du test du service véhicules',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🏠 Placeholder pour données véhicules homepage
   */
  @Get('homepage-data')
  @ApiOperation({ summary: 'Données véhicules pour homepage (placeholder)' })
  @ApiResponse({ status: 200, description: 'Données véhicules récupérées' })
  async getHomepageVehicleData() {
    try {
      this.logger.log('🏠 Récupération données véhicules homepage');

      const data = await this.catalogService.getVehicleCatalog();

      return {
        success: true,
        data,
        message: 'Service véhicules en cours de développement',
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('❌ Erreur données véhicules homepage:', error);
      return {
        success: false,
        error: 'Service véhicules temporairement indisponible',
        timestamp: new Date().toISOString(),
      };
    }
  }
}