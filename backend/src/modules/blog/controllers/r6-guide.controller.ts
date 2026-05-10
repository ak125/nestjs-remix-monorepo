/**
 * R6GuideController — Single endpoint for R6 Guide d'Achat pages.
 * GET /api/r6-guide/:pg_alias → R6GuidePayload
 */

import { Controller, Get, Param, Logger } from '@nestjs/common';
import { R6GuideService } from '../services/r6-guide.service';
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
