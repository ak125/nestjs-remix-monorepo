/**
 * 🤖 SERVICE ROBOTS.TXT DYNAMIQUE
 * Génération selon environnement — la politique elle-même vit dans
 * `@repo/seo-url-contract/robots-policy` (source unique partagée avec le repli
 * frontend de /robots.txt).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildRobotsTxt,
  isRobotsProductionEnv,
} from '@repo/seo-url-contract/robots-policy';
import { SITE_ORIGIN } from '../../../config/app.config';

@Injectable()
export class RobotsTxtService {
  private readonly logger = new Logger(RobotsTxtService.name);
  private readonly isProduction: boolean;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = isRobotsProductionEnv(
      this.configService.get('NODE_ENV'),
    );
    this.baseUrl = this.configService.get('BASE_URL', SITE_ORIGIN);

    this.logger.log(
      `🤖 RobotsTxtService initialized (${this.isProduction ? 'PRODUCTION' : 'DEV'})`,
    );
  }

  /**
   * Générer robots.txt selon environnement
   */
  generate(): string {
    return buildRobotsTxt({
      production: this.isProduction,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Générer meta robots tag
   */
  generateMetaRobots(options: {
    index?: boolean;
    follow?: boolean;
    noarchive?: boolean;
    nosnippet?: boolean;
    noimageindex?: boolean;
  }): string {
    const directives: string[] = [];

    // Index/Noindex
    directives.push(options.index !== false ? 'index' : 'noindex');

    // Follow/Nofollow
    directives.push(options.follow !== false ? 'follow' : 'nofollow');

    // Autres directives
    if (options.noarchive) directives.push('noarchive');
    if (options.nosnippet) directives.push('nosnippet');
    if (options.noimageindex) directives.push('noimageindex');

    return directives.join(', ');
  }

  /**
   * Vérifier si URL doit être indexée
   */
  shouldIndex(path: string): boolean {
    // Patterns à ne PAS indexer
    const noIndexPatterns = [
      /^\/api\//,
      /^\/admin\//,
      /^\/checkout\//,
      /^\/cart\//,
      /^\/compte\//,
      /\?utm_/,
      /\?fbclid=/,
      /\?gclid=/,
      /\/search\?/,
    ];

    return !noIndexPatterns.some((pattern) => pattern.test(path));
  }
}
