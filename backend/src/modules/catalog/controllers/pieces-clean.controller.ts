import { Controller, Get, Param, Logger, Inject } from '@nestjs/common';
import { VehiclePiecesCompatibilityService } from '../services/vehicle-pieces-compatibility.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DomainValidationException, ErrorCodes } from '@common/exceptions';

/**
 * 🎯 CONTRÔLEUR PIÈCES NETTOYÉ
 *
 * Contient uniquement les endpoints essentiels avec les services finaux :
 * - VehiclePiecesCompatibilityService : Service de compatibilité pièces/véhicules
 */
@Controller('api/catalog/pieces')
export class PiecesCleanController {
  private readonly logger = new Logger(PiecesCleanController.name);

  constructor(
    private readonly vehiclePiecesService: VehiclePiecesCompatibilityService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * 🎯 SERVICE FINAL - Logique de compatibilité pièces/véhicules
   * GET /api/catalog/pieces/php-logic/:typeId/:pgId
   */
  @Get('php-logic/:typeId/:pgId')
  async phpLogic(@Param('typeId') typeId: string, @Param('pgId') pgId: string) {
    const startTime = Date.now();

    try {
      // ✅ VALIDATION CRITIQUE: Vérifier que les IDs sont valides
      const typeIdNum = parseInt(typeId);
      const pgIdNum = parseInt(pgId);

      if (isNaN(typeIdNum) || typeIdNum <= 0) {
        this.logger.error(`❌ [PHP-LOGIC] typeId invalide: ${typeId}`);
        throw new DomainValidationException({
          code: ErrorCodes.CATALOG.INVALID_TYPE_ID,
          message: `typeId invalide: ${typeId}. Doit être un nombre > 0`,
          field: 'typeId',
        });
      }

      if (isNaN(pgIdNum) || pgIdNum <= 0) {
        this.logger.error(`❌ [PHP-LOGIC] pgId invalide: ${pgId}`);
        throw new DomainValidationException({
          code: ErrorCodes.CATALOG.INVALID_PG_ID,
          message: `pgId invalide: ${pgId}. Doit être un nombre > 0`,
          field: 'pgId',
        });
      }

      // ✅ CACHE REDIS: Vérifier le cache (5 minutes TTL)
      const cacheKey = `pieces:php-logic:${typeIdNum}:${pgIdNum}`;
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        const responseTime = Date.now() - startTime;
        this.logger.log(
          `⚡ [PHP-LOGIC] Cache HIT pour type=${typeIdNum}, gamme=${pgIdNum} (${responseTime}ms)`,
        );
        const cachedData = cached as Record<string, unknown>;
        return {
          ...cachedData,
          statistics: {
            ...(cachedData.statistics as Record<string, unknown>),
            response_time: `${responseTime}ms`,
            cache_hit: true,
          },
        };
      }

      this.logger.log(
        `🎯 [COMPATIBILITY] type_id=${typeIdNum}, pg_id=${pgIdNum}`,
      );

      // ⚡ RPC optimisée: 1 requête au lieu de 9
      const result = await this.vehiclePiecesService.getPiecesViaRPC(
        typeIdNum,
        pgIdNum,
      );

      const responseTime = Date.now() - startTime;

      // ✅ VALIDATION: Vérifier qu'on a bien des pièces
      if (!result.success || !result.pieces || result.pieces.length === 0) {
        this.logger.warn(
          `⚠️ [PHP-LOGIC] Aucune pièce trouvée pour type=${typeIdNum}, gamme=${pgIdNum}`,
        );
      } else {
        this.logger.log(
          `✅ [PHP-LOGIC] ${result.pieces.length} pièces trouvées`,
        );
      }

      const response = {
        success: result.success,
        data: result,
        statistics: {
          response_time: `${responseTime}ms`,
          cache_hit: false,
        },
        timestamp: new Date().toISOString(),
        version: 'PHP_LOGIC_COMPLETE',
      };

      // ✅ METTRE EN CACHE (5 minutes = 300 secondes)
      if (result.success && result.pieces && result.pieces.length > 0) {
        await this.cacheManager.set(cacheKey, response, 300000); // 5 minutes en ms
        this.logger.log(`💾 [PHP-LOGIC] Mis en cache: ${cacheKey}`);
      }

      return response;
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`❌ [PHP-LOGIC] Erreur: ${message}`, stack);

      return {
        success: false,
        error: message,
        statistics: {
          response_time: `${responseTime}ms`,
          cache_hit: false,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
