import { Controller, Get, Param, ParseIntPipe, Logger } from '@nestjs/common';
import { VehicleFilteredCatalogV4HybridService } from '../services/vehicle-filtered-catalog-v4-hybrid.service';
import {
  getErrorMessage,
  getErrorStack,
} from '../../../common/utils/error.utils';

@Controller('api/catalog/families')
export class VehicleFilteredCatalogV4Controller {
  private readonly logger = new Logger(VehicleFilteredCatalogV4Controller.name);

  constructor(
    private readonly catalogV4Service: VehicleFilteredCatalogV4HybridService,
  ) {}

  /**
   * 🚀 ENDPOINT V4 HYBRIDE ULTIME
   * GET /api/catalog/families/vehicle-v4/:typeId
   */
  @Get('vehicle-v4/:typeId')
  async getCatalogV4(@Param('typeId', ParseIntPipe) typeId: number) {
    const startTime = Date.now();

    try {
      this.logger.log(`🚀 [V4] Requête catalogue pour type_id: ${typeId}`);

      const result = await this.catalogV4Service.getCatalogV4Optimized(typeId);
      const responseTime = Date.now() - startTime;

      this.logger.log(
        `✅ [V4] type_id ${typeId}: ${responseTime}ms ` +
          `(${result.metrics.source}, ${result.catalog.totalGammes} gammes)`,
      );

      return {
        success: true,
        catalog: result.catalog,
        popularParts: result.catalog.popularParts || [],
        seoValidation: result.catalog.seoValidation || {
          familyCount: result.catalog.totalFamilies || 0,
          gammeCount: result.catalog.totalGammes || 0,
          isIndexable:
            (result.catalog.totalFamilies || 0) >= 3 &&
            (result.catalog.totalGammes || 0) >= 5,
        },
        performance: {
          responseTime: `${responseTime}ms`,
          source: result.metrics.source,
          cacheHitRatio: result.metrics.cacheHitRatio,
          completenessScore: result.metrics.completenessScore,
        },
        timestamp: result.timestamp,
        version: 'V4_HYBRID_ULTIMATE',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.error(
        `❌ [V4] Erreur type_id ${typeId}: ${getErrorMessage(error)} (${responseTime}ms)`,
        getErrorStack(error),
      );

      return {
        success: false,
        error: getErrorMessage(error),
        catalog: {
          queryType: 'ERROR_V4',
          families: [],
          totalFamilies: 0,
          totalGammes: 0,
        },
        performance: {
          responseTime: `${responseTime}ms`,
          source: 'ERROR',
        },
        timestamp: new Date(),
        version: 'V4_HYBRID_ULTIMATE',
      };
    }
  }

  /**
   * 📊 MÉTRIQUES AVANCÉES V4
   * GET /api/catalog/families/metrics-v4
   */
  @Get('metrics-v4')
  async getV4Metrics() {
    try {
      const metrics = await this.catalogV4Service.getAdvancedMetrics();

      return {
        success: true,
        metrics,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ [V4 METRICS] Erreur: ${getErrorMessage(error)}`);

      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * 🔄 ENDPOINT FORCE PRECOMPUTE
   * GET /api/catalog/families/precompute-v4
   */
  @Get('precompute-v4')
  async forcePrecompute() {
    try {
      this.logger.log('🔄 [V4] Déclenchement pré-calcul manuel...');

      // Déclencher en arrière-plan (non-bloquant)
      this.catalogV4Service.precomputePopularCatalogs();

      return {
        success: true,
        message: 'Pré-calcul des catalogues populaires démarré en arrière-plan',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ [V4 PRECOMPUTE] Erreur: ${getErrorMessage(error)}`);

      return {
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date(),
      };
    }
  }
}
