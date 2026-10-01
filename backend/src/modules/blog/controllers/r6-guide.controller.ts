/**
 * R6GuideController — Single endpoint for R6 Guide d'Achat pages.
 * GET /api/r6-guide/:pg_alias → R6GuidePayload
 */

import { Controller, Get, Header, Param, Logger } from '@nestjs/common';
import {
  R6GuideService,
  type R6IndexingPosture,
} from '../services/r6-guide.service';
import {
  DomainNotFoundException,
  OperationFailedException,
} from '@common/exceptions';
import { getErrorMessage } from '@common/utils/error.utils';

@Controller('api/r6-guide')
export class R6GuideController {
  private readonly logger = new Logger(R6GuideController.name);

  constructor(private readonly r6GuideService: R6GuideService) {}

  /**
   * Posture d'indexation d'une page R6 guide-achat sous consolidation R6→R3
   * (flag-gated OFF — mirror de /api/seo/diagnostic/redirect) : cible 301 vers
   * R3 conseils, ou directive robots `noindex, follow` quand il n'y a pas de R3.
   * Champs `redirect_to` / `pg_alias` inchangés (rétro-compatible).
   * Cache court : doit se propager vite quand l'owner active le flag.
   * IMPORTANT : doit rester déclaré AVANT @Get(':pg_alias') qui capture tout.
   * GET /api/r6-guide/redirect/:pg_alias
   */
  @Get('redirect/:pg_alias')
  @Header('Cache-Control', 'public, max-age=300')
  async getRedirectTarget(@Param('pg_alias') pgAlias: string): Promise<{
    redirect_to: string | null;
    pg_alias: string | null;
    robots: R6IndexingPosture['robots'];
  }> {
    const posture = await this.r6GuideService.getIndexingPosture(pgAlias);
    return {
      redirect_to: posture.redirect_to,
      pg_alias: posture.redirect_to ? pgAlias : null,
      robots: posture.robots,
    };
  }

  /**
   * Posture d'indexation du hub /blog-pieces-auto/guide-achat.
   * IMPORTANT : doit rester déclaré AVANT @Get(':pg_alias') qui capture tout.
   * GET /api/r6-guide/hub-posture
   */
  @Get('hub-posture')
  @Header('Cache-Control', 'public, max-age=300')
  getHubPosture(): { robots: R6IndexingPosture['robots'] } {
    return this.r6GuideService.getHubIndexingPosture();
  }

  /**
   * GET /api/r6-guide/:pg_alias
   * Returns the complete page payload for rendering an R6 guide d'achat.
   */
  @Get(':pg_alias')
  async getGuide(@Param('pg_alias') pg_alias: string) {
    try {
      this.logger.log(`GET /api/r6-guide/${pg_alias}`);

      const payload = await this.r6GuideService.getR6GuidePayload(pg_alias);

      if (!payload) {
        // Try to resolve to a canonical slug before returning 404
        const canonicalSlug =
          await this.r6GuideService.resolveCanonicalSlug(pg_alias);

        if (canonicalSlug) {
          this.logger.log(`Redirect: "${pg_alias}" → "${canonicalSlug}"`);
          return {
            success: false,
            redirect: canonicalSlug,
          };
        }

        throw new DomainNotFoundException({
          message: `Guide d'achat "${pg_alias}" non trouvé`,
        });
      }

      return {
        success: true,
        data: payload,
      };
    } catch (error) {
      if (error instanceof DomainNotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error loading R6 guide for "${pg_alias}": ${getErrorMessage(error)}`,
      );
      throw new OperationFailedException({
        message: `Erreur lors du chargement du guide d'achat "${pg_alias}"`,
      });
    }
  }
}
