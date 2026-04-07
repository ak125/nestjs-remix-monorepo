/**
 * 🤖 CONTRÔLEUR ROBOTS.TXT
 *
 * IMPORTANT: Deux endpoints disponibles:
 * - /api/seo/robots.txt → Utilisé par Remix (évite la boucle récursive)
 * - /robots.txt → Route directe (interceptée par Remix, donc non utilisée)
 */

import { Controller, Get, Header } from '@nestjs/common';
import { RobotsTxtService } from '../infrastructure/robots-txt.service';

@Controller()
export class RobotsTxtController {
  constructor(private readonly robotsTxtService: RobotsTxtService) {}

  /**
   * GET /api/seo/robots.txt
   * Endpoint API pour Remix - Évite la boucle récursive localhost:3000/robots.txt
   */
  @Get('api/seo/robots.txt')
  @Header('Content-Type', 'text/plain')
  @Header('Cache-Control', 'public, max-age=86400') // 24h
  getRobotsTxtApi(): string {
    return this.robotsTxtService.generate();
  }

  /**
   * GET /robots.txt
   * Route directe (NOTE: interceptée par Remix en production)
   * Conservée pour compatibilité si NestJS est exposé directement
   */
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  @Header('Cache-Control', 'public, max-age=86400') // 24h
  getRobotsTxt(): string {
    return this.robotsTxtService.generate();
  }
}
