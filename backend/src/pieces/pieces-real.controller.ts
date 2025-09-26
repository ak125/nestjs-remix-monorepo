import { Controller, Get, Param, ParseIntPipe, Query, Logger } from '@nestjs/common';
import { PiecesRealService } from './pieces-real.service';

@Controller('pieces-real')
export class PiecesRealController {
  private readonly logger = new Logger(PiecesRealController.name);

  constructor(private readonly piecesRealService: PiecesRealService) {}

  /**
   * Récupère les vraies pièces pour un type de véhicule et une gamme
   * URL: /pieces-real/type/:typeId/gamme/:pgId
   */
  @Get('type/:typeId/gamme/:pgId')
  async getPiecesForVehicleAndGamme(
    @Param('typeId', ParseIntPipe) typeId: number,
    @Param('pgId', ParseIntPipe) pgId: number,
    @Query('limit') limit?: string,
  ) {
    const startTime = Date.now();
    
    this.logger.log(`🔧 [PIECES-REAL-API] Récupération pour type_id: ${typeId}, pg_id: ${pgId}`);
    
    try {
      const result = await this.piecesRealService.getRealPiecesForVehicleAndGamme(
        typeId,
        pgId,
        limit ? parseInt(limit, 10) : 20
      );

      const responseTime = Date.now() - startTime;
      
      this.logger.log(
        `✅ [PIECES-REAL-API] ${result.pieces.length} vraies pièces trouvées en ${responseTime}ms`
      );

      return {
        success: true,
        pieces: result.pieces,
        total_count: result.total_count,
        performance: {
          response_time_ms: responseTime,
          source: 'REAL_DATABASE_PIECES_TABLE',
        },
      };

    } catch (error) {
      this.logger.error(`❌ [PIECES-REAL-API] Erreur:`, error);
      
      return {
        success: false,
        pieces: [],
        total_count: 0,
        performance: {
          response_time_ms: Date.now() - startTime,
          source: 'ERROR',
          error: error.message,
        },
      };
    }
  }

  /**
   * Récupère les statistiques d'une gamme
   * URL: /pieces-real/gamme/:pgId/stats
   */
  @Get('gamme/:pgId/stats')
  async getGammeStats(
    @Param('pgId', ParseIntPipe) pgId: number,
  ) {
    this.logger.log(`📊 [PIECES-REAL-API] Stats pour gamme ${pgId}`);
    
    try {
      const stats = await this.piecesRealService.getGammeStats(pgId);
      
      this.logger.log(
        `✅ [PIECES-REAL-API] Stats: ${stats.total_pieces} pièces dans "${stats.gamme_name}"`
      );

      return stats;

    } catch (error) {
      this.logger.error(`❌ [PIECES-REAL-API] Erreur stats:`, error);
      
      return {
        total_pieces: 0,
        gamme_name: 'Erreur',
        gamme_alias: 'erreur',
        error: error.message,
      };
    }
  }
}