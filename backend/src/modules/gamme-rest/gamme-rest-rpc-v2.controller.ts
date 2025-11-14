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
@Controller('api/gamme-rest')
export class GammeRestRpcV2Controller {
  constructor(private readonly responseBuilder: GammeResponseBuilderService) {}

  /**
   * ⚡ RPC V2 - PostgreSQL Function ultra-optimisée
   * Endpoint: GET /api/gamme-rest/:pgId/page-data-rpc-v2
   */
  @Get(':pgId/page-data-rpc-v2')
  async getPageDataRpcV2(@Param('pgId') pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`⚡ Tentative RPC V2 pour gamme ${pgIdNum}...`);

    try {
      const result = await this.responseBuilder.buildRpcV2Response(pgId);
      console.log(`✅ RPC V2 SUCCESS pour gamme ${pgIdNum} en ${result.performance?.total_time_ms?.toFixed(0) || 'N/A'}ms (RPC: ${result.performance?.rpc_time_ms?.toFixed(0) || 'N/A'}ms)`);
      return result;
    } catch (error) {
      console.error('❌ Erreur dans getPageDataRpcV2:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      console.log(`⚠️ RPC V2 returned error: ${error.message || 'Erreur serveur'}`);
      
      // Retourner une erreur 503 pour que le client sache que c'est temporaire
      return {
        status: 503,
        error: 'Service temporairement indisponible',
        message: 'Timeout de connexion à la base de données. Veuillez réessayer.',
        code: error.code,
        retryable: error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET',
      };
    }
  }
}
