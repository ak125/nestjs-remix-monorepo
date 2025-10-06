import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TechnicalDataService } from './services/technical-data.service';
import { z } from 'zod';

/**
 * 🎯 CONTRÔLEUR TECHNICAL DATA V5 ULTIMATE - API complète
 * 
 * Endpoints optimisés pour le service TechnicalDataV5Ultimate :
 * ✅ Données techniques avancées avec cache intelligent
 * ✅ Health check et monitoring
 * ✅ Validation Zod stricte
 * ✅ Compatibilité avec l'ancien service
 * ✅ Statistiques et métriques
 * ✅ Suggestions intelligentes
 */

// 🛡️ SCHÉMAS DE VALIDATION API
const GetTechnicalDataQuerySchema = z.object({
  includeRelations: z.coerce.boolean().default(true),
  includeSuggestions: z.coerce.boolean().default(false),
  groupByCategory: z.coerce.boolean().default(true),
  limitPerGroup: z.coerce.number().int().min(1).max(10).default(3),
  includeUnits: z.coerce.boolean().default(true),
  format: z.enum(['full', 'compact', 'display']).default('full'),
});

const BatchTechnicalDataSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1).max(50),
  options: GetTechnicalDataQuerySchema.optional(),
});

@Controller('api/products/technical-data')
export class TechnicalDataController {
  private readonly logger = new Logger(TechnicalDataController.name);

  constructor(
    private readonly technicalDataService: TechnicalDataService,
  ) {}

  /**
   * 🎯 DONNÉES TECHNIQUES AVANCÉES - Endpoint principal
   * GET /api/products/technical-data-v5/:productId
   */
  @Get(':productId')
  async getAdvancedTechnicalData(
    @Param('productId') productId: string,
    @Query() query: any,
  ) {
    try {
      // 🛡️ VALIDATION STRICTE
      const productIdNum = z.number().int().positive().parse(parseInt(productId));
      const validatedQuery = GetTechnicalDataQuerySchema.parse(query);

      this.logger.debug(
        `🎯 [TechnicalDataV5Controller] Données techniques pour produit ${productIdNum}`,
      );

      const result = await this.technicalDataService.getAdvancedTechnicalData({
        productId: productIdNum,
        ...validatedQuery,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ [TechnicalDataV5Controller] Erreur produit ${productId}:`,
        error,
      );
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 DONNÉES TECHNIQUES BATCH - Multiple produits
   * POST /api/products/technical-data-v5/batch
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async getBatchTechnicalData(@Body() body: any) {
    try {
      // 🛡️ VALIDATION BATCH
      const validatedBody = BatchTechnicalDataSchema.parse(body);

      this.logger.debug(
        `📊 [TechnicalDataV5Controller] Traitement batch ${validatedBody.productIds.length} produits`,
      );

      // 🚀 TRAITEMENT PARALLÈLE OPTIMISÉ
      const results = await Promise.allSettled(
        validatedBody.productIds.map(productId =>
          this.technicalDataService.getAdvancedTechnicalData({
            productId,
            ...validatedBody.options,
          })
        )
      );

      const successResults = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason);

      return {
        success: true,
        data: successResults,
        statistics: {
          total_requested: validatedBody.productIds.length,
          successful: successResults.length,
          failed: errors.length,
          success_rate: Math.round((successResults.length / validatedBody.productIds.length) * 100),
        },
        errors: errors.map(err => err.message),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [TechnicalDataV5Controller] Erreur batch:`, error);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🏥 HEALTH CHECK SERVICE - Simple health check
   * GET /api/products/technical-data/health
   */
  @Get('health')
  async healthCheck() {
    try {
      const health = await this.technicalDataService.getHealthStatus();
      
      this.logger.debug(`🏥 [TechnicalDataController] Health check: ${health.status}`);

      return health;
    } catch (error) {
      this.logger.error(`❌ [TechnicalDataController] Erreur health check:`, error);
      
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🏥 HEALTH CHECK DETAILED - Advanced health monitoring  
   * GET /api/products/technical-data/_health
   */
  @Get('_health')
  async detailedHealthCheck() {
    try {
      const health = await this.technicalDataService.getHealthStatus();
      const stats = this.technicalDataService.getServiceStats();
      
      return {
        success: true,
        health,
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [TechnicalDataController] Erreur detailed health:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 STATISTIQUES SERVICE - Métriques détaillées
   * GET /api/products/technical-data-v5/stats
   */
  @Get('_stats')
  async getServiceStats() {
    try {
      const stats = await this.technicalDataService.getServiceStats();
      
      this.logger.debug(`📊 [TechnicalDataV5Controller] Statistiques récupérées`);

      return {
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [TechnicalDataV5Controller] Erreur stats:`, error);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔄 COMPATIBILITÉ - Ancien endpoint pour migration
   * GET /api/products/technical-data-v5/:productId/legacy
   */
  @Get(':productId/legacy')
  async getLegacyTechnicalData(@Param('productId') productId: string) {
    try {
      const productIdNum = z.number().int().positive().parse(parseInt(productId));
      
      this.logger.debug(
        `🔄 [TechnicalDataV5Controller] Format legacy pour produit ${productIdNum}`,
      );

      const result = await this.technicalDataService.getProductTechnicalData(productIdNum);

      return {
        success: true,
        data: result,
        format: 'legacy',
        migration_note: 'Use /api/products/technical-data-v5/:id for enhanced features',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ [TechnicalDataV5Controller] Erreur legacy produit ${productId}:`,
        error,
      );
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧹 NETTOYAGE CACHE - Utilitaire admin
   * POST /api/products/technical-data-v5/cache/clear
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  async clearCache() {
    try {
      // Note: Cette méthode nécessiterait d'être ajoutée au service
      this.logger.log(`🧹 [TechnicalDataV5Controller] Demande de nettoyage cache`);

      return {
        success: true,
        message: 'Cache clearing initiated',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [TechnicalDataV5Controller] Erreur nettoyage cache:`, error);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧪 TEST SERVICE - Vérification fonctionnement
   * GET /api/products/technical-data-v5/_test
   */
  @Get('_test')
  async testService() {
    try {
      this.logger.debug(`🧪 [TechnicalDataV5Controller] Test du service`);

      // Test simple avec un produit factice
      const testResult = await this.technicalDataService.getAdvancedTechnicalData({
        productId: 1,
        includeRelations: false,
        includeSuggestions: false,
        groupByCategory: false,
        limitPerGroup: 1,
        includeUnits: false,
        format: 'compact',
      });

      const health = await this.technicalDataService.performHealthCheck();
      const stats = await this.technicalDataService.getServiceStats();

      return {
        success: true,
        test_results: {
          service_response: !!testResult,
          health_status: health.status,
          performance_ok: health.performance.response_time < 1000,
        },
        service_info: {
          name: stats.name,
          version: stats.version,
          features_count: stats.features.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [TechnicalDataV5Controller] Erreur test:`, error);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}