import { Controller, Get, Param, Logger } from '@nestjs/common';
import { PiecesV4WorkingService } from '../services/pieces-v4-working.service';
import { VehiclePiecesCompatibilityService } from '../services/vehicle-pieces-compatibility.service';
import { PiecesPhpLogicCompleteService } from '../services/pieces-php-logic-complete.service';
import { PiecesEnhancedService } from '../services/pieces-enhanced.service';
import { PricingServiceV5UltimateFinal } from '../../products/pricing-service-v5-ultimate-final.service';

/**
 * 🎯 CONTRÔLEUR PIÈCES NETTOYÉ
 *
 * Contient uniquement les endpoints essentiels avec les services finaux :
 * - VehiclePiecesCompatibilityService : Service de compatibilité pièces/véhicules
 * - PiecesV4WorkingService : Service de référence validé
 */
@Controller('api/catalog/pieces')
export class PiecesCleanController {
  private readonly logger = new Logger(PiecesCleanController.name);

  constructor(
    private readonly vehiclePiecesService: VehiclePiecesCompatibilityService,
    private readonly piecesV4Service: PiecesV4WorkingService,
    private readonly piecesCompleteService: PiecesPhpLogicCompleteService,
    private readonly piecesEnhancedService: PiecesEnhancedService,
    private readonly pricingService: PricingServiceV5UltimateFinal,
  ) {}

  /**
   * 🎯 SERVICE FINAL - Logique de compatibilité pièces/véhicules
   * GET /api/catalog/pieces/php-logic/:typeId/:pgId
   */
  @Get('php-logic/:typeId/:pgId')
  async phpLogic(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    const startTime = Date.now();

    try {
      this.logger.log(`🎯 [COMPATIBILITY] type_id=${typeId}, pg_id=${pgId}`);

      const result = await this.vehiclePiecesService.getPiecesExactPHP(
        parseInt(typeId),
        parseInt(pgId),
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: result.success,
        data: result,
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
        version: 'PHP_LOGIC_COMPLETE',
      };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`❌ [PHP-LOGIC] Erreur: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🎯 SERVICE DE RÉFÉRENCE - Version validée V4
   * GET /api/catalog/pieces/v4-working/:typeId/:pgId
   */
  @Get('v4-working/:typeId/:pgId')
  async v4Working(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🎯 [V4-WORKING] type_id=${typeId}, pg_id=${pgId}`);
      
      const result = await this.piecesV4Service.getPiecesV4Working(
        parseInt(typeId),
        parseInt(pgId),
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: result.success,
        data: result,
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
        version: 'V4_WORKING_CLEAN',
      };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 COMPARAISON - Compare les deux services
   * GET /api/catalog/pieces/compare/:typeId/:pgId
   */
  @Get('compare/:typeId/:pgId')
  async compareBothServices(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🔍 [COMPARE] type_id=${typeId}, pg_id=${pgId}`);
      
      const [phpResult, v4Result] = await Promise.all([
        this.vehiclePiecesService.getPiecesExactPHP(
          parseInt(typeId),
          parseInt(pgId),
        ),
        this.piecesV4Service.getPiecesV4Working(
          parseInt(typeId),
          parseInt(pgId),
        ),
      ]);
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        comparison: {
          php_logic: {
            count: phpResult.count,
            minPrice: phpResult.minPrice,
            duration: phpResult.duration,
            success: phpResult.success,
          },
          v4_working: {
            count: v4Result.count,
            minPrice: v4Result.minPrice,
            duration: v4Result.duration,
            success: v4Result.success,
          },
          match: phpResult.count === v4Result.count,
        },
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🚀 SERVICE COMPLET - TOUTES les fonctionnalités PHP
   * GET /api/catalog/pieces/php-complete/:typeId/:pgId
   */
  @Get('php-complete/:typeId/:pgId')
  async phpComplete(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🚀 [PHP-COMPLETE] type_id=${typeId}, pg_id=${pgId}`);
      
      const result = await this.piecesCompleteService.getPiecesCompletePHP(
        parseInt(typeId),
        parseInt(pgId),
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: result.success,
        data: result,
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
        version: 'PHP_COMPLETE_ALL_FEATURES',
      };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`❌ [PHP-COMPLETE] Erreur: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
        statistics: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 DEBUG - Diagnostic des données
   * GET /api/catalog/pieces/debug/:typeId/:pgId  
   */
  @Get('debug/:typeId/:pgId')
  async debug(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    try {
      const typeIdNum = parseInt(typeId);
      const pgIdNum = parseInt(pgId);
      
      // 1. Relations
      const relationsResult = await this.piecesCompleteService['client']
        .from('pieces_relation_type')
        .select('*')
        .eq('rtp_type_id', typeIdNum)
        .eq('rtp_pg_id', pgIdNum)
        .limit(3);

      const relations = relationsResult.data || [];
      const pieceId = relations[0]?.rtp_piece_id;

      // Variables pour compatibilité ancienne structure
      let enhancedPricing = null;
      let rawPrices = [];
      let criterias = [];
      let images = [];
      
      if (pieceId) {
        // 🎯 V5 ULTIMATE PRICING SERVICE - Plus besoin de logique manuelle !
        enhancedPricing = await this.pricingService.getAdvancedPricing(
          pieceId.toString(),
        );
        
        // Récupération des données pour compatibilité (optionnel pour debug)
        const pricesResult = await this.piecesCompleteService['client']
          .from('pieces_price')
          .select('*')
          .eq('pri_piece_id', pieceId)
          .limit(5);
        rawPrices = pricesResult.data || [];

        // 3. Critères
        const criteriasResult = await this.piecesCompleteService['client']
          .from('pieces_criteria')
          .select('*')
          .eq('pc_piece_id', pieceId)
          .limit(5);
        criterias = criteriasResult.data || [];

        // 4. Images
        const imagesResult = await this.piecesCompleteService['client']
          .from('pieces_media_img')
          .select('*')
          .eq('pmi_piece_id', pieceId)
          .limit(5);
        images = imagesResult.data || [];
      }

      return {
        success: true,
        // 🎯 V5 ULTIMATE DATA - Pricing avancé intégré !
        enhanced_pricing: enhancedPricing,
        debug: {
          relations_count: relations.length,
          first_relation: relations[0] || null,
          piece_id: pieceId,
          // Anciennes données pour compatibilité
          raw_prices_count: rawPrices?.length || 0,
          raw_prices_sample: rawPrices?.slice(0, 2) || [],
          criterias_count: criterias.length,
          criterias_sample: criterias.slice(0, 2),
          images_count: images.length,
          images_sample: images.slice(0, 2),
          // ✨ Nouveau : Service V5 Ultimate utilisé
          v5_ultimate_active: true,
          pricing_service: 'PricingServiceV5UltimateFinal',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🎯 CATALOGUE ENHANCED - Structure HTML optimisée
   * GET /api/catalog/pieces/enhanced/:typeId/:pgId
   */
  @Get('enhanced/:typeId/:pgId')
  async enhanced(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🎯 [ENHANCED] type_id=${typeId}, pg_id=${pgId}`);
      
      const result = await this.piecesEnhancedService.getPiecesEnhancedCatalog(
        parseInt(typeId),
        parseInt(pgId),
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        ...result,
        api_info: {
          response_time: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          version: 'ENHANCED_CATALOG_V1',
        },
      };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`❌ [ENHANCED] Erreur: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
        api_info: {
          response_time: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}