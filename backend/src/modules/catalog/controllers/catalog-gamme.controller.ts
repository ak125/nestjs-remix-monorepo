// 📁 backend/src/modules/catalog/controllers/catalog-gamme.controller.ts
// 🔧 Contrôleur pour les gammes de catalogue (table catalog_gamme)

import { Controller, Get, Param, Logger } from '@nestjs/common';
import { CatalogGammeService } from '../services/catalog-gamme.service';

@Controller('api/catalog/gammes')
export class CatalogGammeController {
  private readonly logger = new Logger(CatalogGammeController.name);

  constructor(private readonly catalogGammeService: CatalogGammeService) {}

  /**
   * 🔧 GET /api/catalog/gammes/all - Toutes les gammes
   */
  @Get('all')
  async getAllGammes() {
    this.logger.log('🔧 [GET] /api/catalog/gammes/all');
    
    try {
      const gammes = await this.catalogGammeService.getAllGammes();
      
      this.logger.log(`✅ Retour ${gammes.length} gammes`);
      return {
        success: true,
        data: gammes,
        count: gammes.length,
        message: `${gammes.length} gammes récupérées avec succès`
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération toutes gammes:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * 🔧 GET /api/catalog/gammes/by-manufacturer - Gammes groupées par fabricant
   */
  @Get('by-manufacturer')
  async getGammesByManufacturer() {
    this.logger.log('🔧 [GET] /api/catalog/gammes/by-manufacturer');
    
    try {
      const grouped = await this.catalogGammeService.getGammesByManufacturer();
      
      this.logger.log(`✅ Gammes groupées par ${Object.keys(grouped).length} fabricants`);
      return {
        success: true,
        data: grouped,
        manufacturers_count: Object.keys(grouped).length,
        total_gammes: Object.values(grouped).reduce((sum, gammes) => sum + gammes.length, 0),
        message: 'Gammes groupées par fabricant récupérées avec succès'
      };
    } catch (error) {
      this.logger.error('❌ Erreur groupement gammes:', error);
      return {
        success: false,
        data: {},
        manufacturers_count: 0,
        total_gammes: 0,
        error: error.message
      };
    }
  }

  /**
   * 🔧 GET /api/catalog/gammes/display - Gammes formatées pour affichage
   */
  @Get('display')
  async getGammesForDisplay() {
    this.logger.log('🔧 [GET] /api/catalog/gammes/display');
    
    try {
      const displayData = await this.catalogGammeService.getGammesForDisplay();
      
      this.logger.log(`✅ Données d'affichage préparées: ${displayData.stats.total_gammes} gammes`);
      return {
        success: true,
        ...displayData,
        message: 'Données d\'affichage préparées avec succès'
      };
    } catch (error) {
      this.logger.error('❌ Erreur préparation affichage:', error);
      return {
        success: false,
        manufacturers: {},
        stats: { total_gammes: 0, total_manufacturers: 0 },
        error: error.message
      };
    }
  }

  /**
   * 🔧 GET /api/catalog/gammes/:id - Gamme spécifique par ID
   */
  @Get(':id')
  async getGammeById(@Param('id') id: string) {
    this.logger.log(`🔧 [GET] /api/catalog/gammes/${id}`);
    
    try {
      const gamme = await this.catalogGammeService.getGammeById(id);
      
      if (!gamme) {
        this.logger.warn(`⚠️ Gamme ${id} non trouvée`);
        return {
          success: false,
          data: null,
          message: `Gamme ${id} non trouvée`
        };
      }

      this.logger.log(`✅ Gamme ${id} trouvée`);
      return {
        success: true,
        data: gamme,
        message: `Gamme ${id} récupérée avec succès`
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération gamme ${id}:`, error);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  /**
   * 🔧 GET /api/catalog/gammes/manufacturer/:manufacturerId - Gammes d'un fabricant
   */
  @Get('manufacturer/:manufacturerId')
  async getGammesByManufacturerId(@Param('manufacturerId') manufacturerId: string) {
    this.logger.log(`🔧 [GET] /api/catalog/gammes/manufacturer/${manufacturerId}`);
    
    try {
      const gammes = await this.catalogGammeService.getGammesByManufacturerId(manufacturerId);
      
      this.logger.log(`✅ ${gammes.length} gammes trouvées pour fabricant ${manufacturerId}`);
      return {
        success: true,
        data: gammes,
        count: gammes.length,
        manufacturer_id: manufacturerId,
        message: `${gammes.length} gammes récupérées pour le fabricant ${manufacturerId}`
      };
    } catch (error) {
      this.logger.error(`❌ Erreur gammes fabricant ${manufacturerId}:`, error);
      return {
        success: false,
        data: [],
        count: 0,
        manufacturer_id: manufacturerId,
        error: error.message
      };
    }
  }
}