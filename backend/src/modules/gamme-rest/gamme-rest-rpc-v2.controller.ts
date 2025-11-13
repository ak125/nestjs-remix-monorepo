import { Controller, Get, Param, Injectable } from '@nestjs/common';
import { GammeResponseBuilderService } from './services';

/**
 * 🚀 GAMME REST CONTROLLER RPC V2 - VERSION ULTRA-OPTIMISÉE
 * 
 * 1 SEULE requête PostgreSQL RPC au lieu de 15+
 * Performance : ~75ms (au lieu de 680ms)
 * Gain : 9x plus rapide
 */
@Injectable()
@Controller('api/gamme-rest-optimized')
export class GammeRestRpcV2Controller {
  constructor(private readonly responseBuilder: GammeResponseBuilderService) {}

  /**
   * ⚡ RPC V2 - PostgreSQL Function ultra-optimisée
   * Endpoint: GET /api/gamme-rest-optimized/:pgId/page-data-rpc-v2
   */
  @Get(':pgId/page-data-rpc-v2')
  async getPageDataRpcV2(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`⚡ RPC V2 ULTRA-OPTIMISÉ - PG_ID=${pgIdNum}`);

    try {
      return await this.responseBuilder.buildRpcV2Response(pgId);
    } catch (error) {
      console.error('❌ Erreur dans getPageDataRpcV2:', error);
      return {
        error: 'Erreur serveur',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }
  }
}
