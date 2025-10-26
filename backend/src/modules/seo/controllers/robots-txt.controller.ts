/**
 * 🤖 CONTRÔLEUR ROBOTS.TXT
 */

import { Controller, Get, Header } from '@nestjs/common';
import { RobotsTxtService } from '../services/robots-txt.service';

@Controller()
export class RobotsTxtController {
  constructor(private readonly robotsTxtService: RobotsTxtService) {}

  /**
   * GET /robots.txt
   * Générer robots.txt dynamique
   */
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  @Header('Cache-Control', 'public, max-age=86400') // 24h
  getRobotsTxt(): string {
    return this.robotsTxtService.generate();
  }
}
