import { Controller, Get, Query, Logger } from '@nestjs/common';
import { VehicleFilteredCatalogServiceV3 } from '../services/vehicle-filtered-catalog-v3-simple.service';

@Controller('api/vehicle-catalog-v3')
export class VehicleFilteredCatalogV3Controller {
  private readonly logger = new Logger(VehicleFilteredCatalogV3Controller.name);

  constructor(
    private readonly catalogV3Service: VehicleFilteredCatalogServiceV3,
  ) {}

  /**
   * 🎯 Endpoint V3 - Catalogue véhicule avec logique PHP exacte
   * Test: /api/vehicle-catalog-v3/catalog?typeId=8408
   */
  @Get('catalog')
  async getCatalogForVehicle(@Query('typeId') typeId: string) {
    this.logger.log(`🚀 [V3 ENDPOINT] Demande catalogue pour typeId: ${typeId}`);
    
    if (!typeId) {
      return {
        success: false,
        error: 'typeId requis',
        message: 'Exemple: /api/vehicle-catalog-v3/catalog?typeId=8408'
      };
    }

    const numericTypeId = parseInt(typeId, 10);
    if (isNaN(numericTypeId)) {
      return {
        success: false,
        error: 'typeId doit être un nombre',
        message: 'Exemple: /api/vehicle-catalog-v3/catalog?typeId=8408'
      };
    }

    try {
      const result = await this.catalogV3Service.getCatalogFamiliesForVehicle(numericTypeId);
      this.logger.log(`✅ [V3 ENDPOINT] Catalogue récupéré: ${result.families?.length || 0} familles`);
      return result;
    } catch (error) {
      this.logger.error(`❌ [V3 ENDPOINT] Erreur: ${error.message}`);
      return {
        success: false,
        error: error.message,
        typeId: numericTypeId
      };
    }
  }

  /**
   * 🎯 Test rapide - Vérification type_id CITROEN C4 II
   */
  @Get('test-citroen')
  async testCitroenC4() {
    this.logger.log(`🧪 [TEST] Test CITROEN C4 II 16 HDi 110 ch`);
    return this.getCatalogForVehicle('8408');
  }
}