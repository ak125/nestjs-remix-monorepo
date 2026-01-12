import {
  Controller,
  Get,
  Query,
  Headers,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { SubstitutionService } from '../services/substitution.service';
import { SubstitutionLoggerService } from '../services/substitution-logger.service';
import { SubstitutionResult } from '../types/substitution.types';

/**
 * SubstitutionController - API du Moteur de Substitution Sémantique
 *
 * Paradigme "200 Always":
 * - L'API retourne toujours HTTP 200
 * - Le statut (200/404/410) est dans response.httpStatus
 * - Le frontend utilise httpStatus pour définir le code HTTP réel
 */
@Controller('api/substitution')
export class SubstitutionController {
  private readonly logger = new Logger(SubstitutionController.name);

  constructor(
    private readonly substitutionService: SubstitutionService,
    private readonly substitutionLogger: SubstitutionLoggerService,
  ) {}

  /**
   * GET /api/substitution/check?url=/pieces/freinage-402.html
   *
   * Point d'entrée principal du Moteur de Substitution.
   * Retourne toujours HTTP 200, le statut métier est dans response.httpStatus.
   *
   * @param url - URL à analyser (ex: /pieces/freinage-402.html)
   * @param userAgent - User-Agent pour détection bot
   * @returns SubstitutionResult avec httpStatus, lock, et contenu
   *
   * @example
   * // Gamme seule → 200 avec Lock vehicle (page SEO enrichie)
   * curl "http://localhost:3000/api/substitution/check?url=/pieces/freinage-402.html"
   * {
   *   "httpStatus": 200,
   *   "type": "vehicle_incomplete",
   *   "lock": { "type": "vehicle", "missing": "Marque, modèle et motorisation" },
   *   "message": "Sélectionnez votre véhicule pour voir les pièces compatibles"
   * }
   *
   * @example
   * // Véhicule complet → 200 (catalogue normal)
   * curl "http://localhost:3000/api/substitution/check?url=/pieces/freinage-402/renault-4/clio-5/type-456.html"
   * {
   *   "httpStatus": 200,
   *   "type": "none",
   *   "message": "Catalogue disponible"
   * }
   */
  @Get('check')
  @HttpCode(200)
  async checkSubstitution(
    @Query('url') url: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<SubstitutionResult> {
    if (!url) {
      return {
        type: 'unknown_slug',
        httpStatus: 404,
        robots: 'noindex',
        message: 'URL manquante',
        seo: {
          title: 'Erreur - URL manquante | AutoMecanik',
          description: 'Une URL est requise pour analyser la page.',
          h1: 'Erreur - URL manquante',
          canonical: '',
        },
      };
    }

    this.logger.debug(`Checking substitution for: ${url}`);
    return this.substitutionService.checkSubstitution(url, userAgent || '');
  }

  /**
   * GET /api/substitution/stats
   *
   * Dashboard analytics des pages enrichies.
   * Retourne les taux de conversion par type de lock.
   */
  @Get('stats')
  async getStats(): Promise<{
    funnel: Record<string, { total: number; completed: number; rate: number }>;
    daily: Array<{
      day: string;
      status_200: number;
      status_404: number;
      status_410: number;
      status_412: number; // Legacy: historique avant migration SEO
    }>;
  }> {
    const [funnelStats, dailyStats] = await Promise.all([
      this.substitutionLogger.getFunnelStats(),
      this.substitutionLogger.getDailyStats(),
    ]);

    return {
      funnel: funnelStats.funnel,
      daily: dailyStats.daily,
    };
  }

  /**
   * GET /api/substitution/top-urls?type=vehicle_incomplete&limit=20
   *
   * URLs les plus fréquentes par type de substitution.
   * Utile pour identifier les patterns récurrents.
   */
  @Get('top-urls')
  async getTopUrls(
    @Query('type') substitutionType: string = 'vehicle_incomplete',
    @Query('limit') limit: string = '20',
  ): Promise<Array<{ url: string; count: number }>> {
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    return this.substitutionLogger.getTopUrls(substitutionType, limitNum);
  }

  /**
   * GET /api/substitution/health
   *
   * Health check du module de substitution.
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
