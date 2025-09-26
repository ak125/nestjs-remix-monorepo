import { Controller, Get, Param, ParseIntPipe, Query, Logger } from '@nestjs/common';
import { PiecesDbSimpleService } from './pieces-db-simple.service';

@Controller('pieces-db')
export class PiecesDbController {
  private readonly logger = new Logger(PiecesDbController.name);

  constructor(private readonly piecesDbService: PiecesDbSimpleService) {}

  /**
   * Récupère les vraies pièces de la base de données pour un véhicule et une gamme
   * Utilise la même logique que votre code PHP
   */
  @Get('vehicle/:typeId/gamme/:pgId')
  async getPiecesForVehicleAndGamme(
    @Param('typeId', ParseIntPipe) typeId: number,
    @Param('pgId', ParseIntPipe) pgId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const startTime = Date.now();
    
    this.logger.log(`🔧 [PIECES-DB] Récupération pièces pour type_id: ${typeId}, pg_id: ${pgId}`);
    
    try {
      // Utilise votre service qui implémente la logique PHP
      const result = await this.piecesDbService.getPiecesForVehicleAndGamme(
        typeId,
        pgId,
        limit ? parseInt(limit, 10) : 20,
        offset ? parseInt(offset, 10) : 0,
      );

      const responseTime = Date.now() - startTime;
      
      this.logger.log(
        `✅ [PIECES-DB] ${result.pieces.length} pièces trouvées en ${responseTime}ms ` +
        `(prix min: ${result.stats.min_price}€)`
      );

      return {
        ...result,
        performance: {
          response_time_ms: responseTime,
          source: 'DATABASE',
          cache_status: 'MISS',
        },
      };
    } catch (error) {
      this.logger.error(`❌ [PIECES-DB] Erreur:`, error);
      return {
        pieces: [],
        stats: { total_count: 0, min_price: 0, max_price: 0 },
        filters: { equipementiers: [], qualities: [] },
        performance: {
          response_time_ms: Date.now() - startTime,
          source: 'ERROR',
          cache_status: 'ERROR',
          error: error.message,
        },
      };
    }
  }

  /**
   * Récupère les statistiques pour un véhicule et une gamme
   */
  @Get('stats/vehicle/:typeId/gamme/:pgId')
  async getStatsForVehicleAndGamme(
    @Param('typeId', ParseIntPipe) typeId: number,
    @Param('pgId', ParseIntPipe) pgId: number,
  ) {
    this.logger.log(`📊 [PIECES-DB-STATS] Stats pour type_id: ${typeId}, pg_id: ${pgId}`);
    
    try {
      const stats = await this.piecesDbService.getStatsForVehicleAndGamme(typeId, pgId);
      
      this.logger.log(
        `✅ [PIECES-DB-STATS] ${stats.total_count} pièces, prix: ${stats.min_price}€-${stats.max_price}€`
      );

      return stats;
    } catch (error) {
      this.logger.error(`❌ [PIECES-DB-STATS] Erreur:`, error);
      return {
        total_count: 0,
        min_price: 0,
        max_price: 0,
        avg_price: 0,
        equipementiers_count: 0,
      };
    }
  }
}