import { Controller, Get, Param, Query, Injectable } from '@nestjs/common';
import { GammePageDataService } from './services/gamme-page-data.service';

/**
 * 🚀 GAMME REST CONTROLLER OPTIMISÉ - Fallback classique
 *
 * Version avec requêtes parallélisées (~680ms)
 * Utilisé automatiquement si RPC V2 échoue
 * Toute la logique métier est déléguée à GammePageDataService
 */
@Injectable()
@Controller('api/gamme-rest-optimized')
export class GammeRestOptimizedController {
  constructor(private readonly pageDataService: GammePageDataService) {}

  /**
   * ⚡ MÉTHODE CLASSIQUE - Fallback automatique
   * Endpoint: GET /api/gamme-rest-optimized/:pgId/page-data
   *
   * Toute la logique est déléguée au service pour la maintenabilité
   */
  @Get(':pgId/page-data')
  async getPageData(@Param('pgId') pgId: string, @Query() query: any) {
    try {
      return await this.pageDataService.getCompletePageData(pgId, query);
    } catch (error) {
      console.error('❌ Erreur dans getPageData:', error);
      return {
        status: 500,
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }
  }

  /**
   * Endpoint détails gamme (métadonnées simples)
   */
  @Get(':pgId/details')
  async getGammeDetails(@Param('pgId') pgId: string) {
    try {
      return await this.pageDataService.getGammeDetails(pgId);
    } catch (error) {
      console.error('❌ Erreur dans getGammeDetails:', error);
      return {
        status: 500,
        error: 'Internal server error',
        message: error.message,
      };
    }
  }
}
