import { Controller, Get, Logger } from '@nestjs/common';
import { PiecesRealDataService } from '../services/pieces-real-data-simple.service';

@Controller('api/catalog/pieces-direct')
export class PiecesDirectController {
  private readonly logger = new Logger(PiecesDirectController.name);

  constructor(private readonly piecesService: PiecesRealDataService) {}

  @Get('test')
  async testDirect() {
    const startTime = Date.now();
    try {
      this.logger.log('🎯 [DIRECT] Test sans complications...');
      const result = await this.piecesService.getPiecesRealData(
        'demarreur',
        'mercedes',
        'sprinter',
        '208cdi',
      );
      const responseTime = Date.now() - startTime;
      this.logger.log(
        `✅ [DIRECT] ${result.pieces.length} pièces en ${responseTime}ms`,
      );
      return {
        success: true,
        data: result,
        message: 'ENFIN ! Ça marche sans complications',
        response_time: `${responseTime}ms`,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`❌ [DIRECT] Erreur: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
        response_time: `${responseTime}ms`,
        timestamp: new Date(),
      };
    }
  }

  @Get('count')
  async countDirect() {
    const startTime = Date.now();
    try {
      const count = await this.piecesService.countPieces();
      const responseTime = Date.now() - startTime;
      this.logger.log(`📊 [COUNT] ${count} pièces en ${responseTime}ms`);
      return {
        success: true,
        count,
        message: count > 0 ? 'ENFIN des résultats !' : 'Toujours 0...',
        response_time: `${responseTime}ms`,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        error: (error as Error).message,
        response_time: `${responseTime}ms`,
        timestamp: new Date(),
      };
    }
  }

  @Get('debug')
  async debugSamples() {
    const startTime = Date.now();
    try {
      const result = await this.piecesService.debugDirectTest();
      const responseTime = Date.now() - startTime;
      return {
        success: true,
        data: result,
        message: 'Échantillons de données qui marchent',
        response_time: `${responseTime}ms`,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        error: (error as Error).message,
        response_time: `${responseTime}ms`,
        timestamp: new Date(),
      };
    }
  }
}
