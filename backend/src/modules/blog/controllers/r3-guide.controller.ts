/**
 * R3GuideController — Single endpoint for R3 conseil guide pages.
 * GET /api/r3-guide/:pg_alias → R3GuidePayload
 * POST /api/r3-guide/:pg_alias/cache/invalidate → purge du cache Redis (admin)
 */

import {
  Controller,
  Get,
  Param,
  Logger,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { R3GuideService } from '../services/r3-guide.service';
import {
  DomainNotFoundException,
  OperationFailedException,
} from '@common/exceptions';
import { getErrorMessage } from '@common/utils/error.utils';

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

  /**
   * POST /api/r3-guide/:pg_alias/cache/invalidate
   * Efface le payload caché (TTL 24 h) pour les deux segments du drapeau R6,
   * sur le modèle de `POST /api/gamme-rest/:pgId/cache/invalidate`.
   * Redis indisponible → 503 : aucune réponse de succès sans purge confirmée.
   */
  @Post(':pg_alias/cache/invalidate')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async invalidateCache(@Param('pg_alias') pg_alias: string) {
    let keys: string[];
    try {
      keys = await this.r3GuideService.invalidateCache(pg_alias);
    } catch (error) {
      this.logger.error(
        `Invalidation du cache du guide "${pg_alias}" échouée: ${getErrorMessage(error)}`,
      );
      throw new ServiceUnavailableException(
        'Cache indisponible : invalidation non confirmée',
      );
    }
    return {
      status: 200,
      message: `Cache invalidé pour le guide ${pg_alias}`,
      keys,
    };
  }
}
