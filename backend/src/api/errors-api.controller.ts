import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ErrorService } from '../modules/errors/services/error.service';
import { RedirectService } from '../modules/errors/services/redirect.service';
import { ErrorLogService } from '../modules/errors/services/error-log.service';
import { UrlCompatibilityService } from '../modules/seo/services/url-compatibility.service';

@Controller('api/errors')
export class ErrorsApiController {
  constructor(
    private readonly errorService: ErrorService,
    private readonly redirectService: RedirectService,
    private readonly errorLogService: ErrorLogService,
  ) {}

  @Get('suggestions')
  async getSuggestions(@Query('url') url: string) {
    if (!url) {
      throw new HttpException(
        'URL parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const suggestions = await this.errorService.getSuggestionsForUrl(url);
      return { suggestions: suggestions || [] };
    } catch (error) {
      console.error('Erreur lors de la récupération des suggestions:', error);
      return { suggestions: [] };
    }
  }

  @Post('log')
  async logError(@Body() errorData: any, @Req() request: Request) {
    try {
      // Utiliser le service ErrorLogService avec l'interface originale
      await this.errorLogService.logError({
        code: errorData.code,
        url: errorData.url,
        userAgent: errorData.userAgent,
        ipAddress: errorData.ipAddress || request.ip,
        referrer: errorData.referrer,
        userId: errorData.userId,
        sessionId: errorData.sessionId,
        metadata: errorData.metadata,
      });

      return { success: true };
    } catch (error) {
      console.error("Erreur lors du logging d'erreur:", error);
      throw new HttpException(
        'Error logging failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const statistics = await this.errorLogService.getErrorStatistics(
        start,
        end,
      );
      return { statistics };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return { statistics: [] };
    }
  }

  @Get('recent')
  async getRecentErrors(@Query('limit') limit: string = '50') {
    try {
      const limitNum = Math.min(parseInt(limit) || 50, 200); // Maximum 200
      const recentErrors = await this.errorLogService.getRecentErrors(limitNum);
      return { errors: recentErrors };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des erreurs récentes:',
        error,
      );
      return { errors: [] };
    }
  }
}

@Controller('api/redirects')
export class RedirectsApiController {
  private readonly logger = new Logger(RedirectsApiController.name);

  constructor(
    private readonly redirectService: RedirectService,
    private readonly urlCompatibilityService: UrlCompatibilityService,
  ) {}

  @Get('check')
  async checkRedirect(@Query('url') url: string) {
    if (!url) {
      throw new HttpException(
        'URL parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const redirect = await this.redirectService.findRedirect(url);

      if (redirect) {
        // Gérer les deux types d'interface
        const isRedirectRule = 'destination_path' in redirect;
        const destination = isRedirectRule
          ? (redirect as any).destination_path
          : (redirect as any).new_path;
        const statusCode = isRedirectRule
          ? (redirect as any).status_code
          : (redirect as any).redirect_type;

        return {
          destination,
          permanent: statusCode === 301 || statusCode === 308,
          found: true,
        };
      }

      return {
        destination: null,
        permanent: false,
        found: false,
      };
    } catch (error) {
      console.error('Erreur lors de la vérification de redirection:', error);
      return {
        destination: null,
        permanent: false,
        found: false,
      };
    }
  }

  /**
   * Résout une URL legacy /pieces-auto/{alias} vers la nouvelle URL
   * GET /api/redirects/resolve-legacy?url=/pieces-auto/filtre-a-huile
   *
   * Retourne:
   * - found: true + destination si l'alias correspond à une gamme
   * - found: false si l'alias n'existe pas (devrait retourner 410)
   */
  @Get('resolve-legacy')
  async resolveLegacyUrl(@Query('url') url: string) {
    if (!url) {
      throw new HttpException(
        'URL parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.debug(`Résolution URL legacy: ${url}`);

      // Vérifier si c'est une URL /pieces-auto/
      if (!url.startsWith('/pieces-auto/')) {
        return {
          found: false,
          destination: null,
          reason: 'URL does not match /pieces-auto/ pattern',
        };
      }

      // Essayer de résoudre l'URL via le service
      const result =
        await this.urlCompatibilityService.resolveLegacyGammeUrl(url);

      if (result.found && result.newUrl) {
        this.logger.log(
          `URL legacy résolue: ${url} → ${result.newUrl} (gamme: ${result.gammeName})`,
        );
        return {
          found: true,
          destination: result.newUrl,
          permanent: true,
          gammeId: result.gammeId,
          gammeName: result.gammeName,
        };
      }

      // Non trouvé - devrait être traité comme 410
      this.logger.debug(`URL legacy non résolue: ${url}`);
      return {
        found: false,
        destination: null,
        reason: 'Gamme alias not found in database',
        shouldReturn410: true,
      };
    } catch (error) {
      this.logger.error(`Erreur résolution URL legacy ${url}:`, error);
      return {
        found: false,
        destination: null,
        error: 'Resolution failed',
      };
    }
  }

  @Post('add')
  async addRedirect(
    @Body()
    redirectData: {
      source: string;
      destination: string;
      permanent: boolean;
    },
  ) {
    try {
      // Utiliser createRedirect qui existe dans le service
      await this.redirectService.createRedirect({
        old_path: redirectData.source,
        new_path: redirectData.destination,
        redirect_type: redirectData.permanent ? 301 : 302,
      });

      return { success: true };
    } catch (error) {
      console.error("Erreur lors de l'ajout de redirection:", error);
      throw new HttpException(
        'Redirect creation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  async getRedirectStatistics() {
    try {
      // Utiliser getRedirectStats qui existe dans le service
      const statistics = await this.redirectService.getRedirectStats();
      return { statistics };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des statistiques de redirection:',
        error,
      );
      return { statistics: [] };
    }
  }
}
