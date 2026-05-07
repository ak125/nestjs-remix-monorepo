/**
 * R3GuideController — Single endpoint for R3 conseil guide pages.
 * GET /api/r3-guide/:pg_alias → R3GuidePayload
 *
 * @deprecated Misnamed legacy: serves R3_CONSEILS canonical content (per
 * @repo/seo-roles), not the deprecated R3_GUIDE role. Will be renamed to
 * `R3ConseilsController @Controller('api/r3-conseils')` after a 30-day
 * deprecation window. See ADR-044 (vault). Do not extend this controller —
 * add new endpoints to its successor when it lands.
 */

import { Controller, Get, Param, Logger } from '@nestjs/common';
import { R3GuideService } from '../services/r3-guide.service';
import {
  DomainNotFoundException,
  OperationFailedException,
} from '@common/exceptions';
import { getErrorMessage } from '@common/utils/error.utils';

/**
 * @deprecated See file-level note. Replacement: `R3ConseilsController`
 * (post-2026-06-05, per ADR-044).
 */
@Controller('api/r3-guide')
export class R3GuideController {
  private readonly logger = new Logger(R3GuideController.name);

  constructor(private readonly r3GuideService: R3GuideService) {}

  /**
   * GET /api/r3-guide/:pg_alias
   * Returns the complete page payload for rendering an R3 conseil guide.
   */
  @Get(':pg_alias')
  async getGuide(@Param('pg_alias') pg_alias: string) {
    try {
      this.logger.log(`GET /api/r3-guide/${pg_alias}`);

      const payload = await this.r3GuideService.getR3GuidePayload(pg_alias);

      if (!payload) {
        throw new DomainNotFoundException({
          message: `Guide "${pg_alias}" non trouvé`,
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
        `Error loading R3 guide for "${pg_alias}": ${getErrorMessage(error)}`,
      );
      throw new OperationFailedException({
        message: `Erreur lors du chargement du guide "${pg_alias}"`,
      });
    }
  }
}
