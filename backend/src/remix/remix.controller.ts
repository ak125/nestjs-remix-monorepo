import { getServerBuild } from '@fafa/frontend';
import {
  All,
  Controller,
  HttpStatus,
  Logger,
  Next,
  Req,
  Res,
} from '@nestjs/common';
import { createRequestHandler } from '@remix-run/express';
import { NextFunction, Request, Response } from 'express';
import { RemixService } from './remix.service';
import { RemixApiService } from './remix-api.service';

@Controller()
export class RemixController {
  private readonly logger = new Logger(RemixController.name);

  constructor(
    private readonly remixService: RemixService,
    private readonly remixApiService: RemixApiService,
  ) {}

  @All(':path*')
  async handler(
    @Req() request: Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    // Ne pas capturer les routes qui sont déjà gérées par d'autres contrôleurs backend
    // Les routes /admin/breadcrumbs/* sont gérées par le BreadcrumbAdminController
    if (
      request.url.startsWith('/api/') ||
      request.url.startsWith('/sitemap-v2/') ||
      request.url.startsWith('/admin/breadcrumbs') ||
      request.url.startsWith('/authenticate') ||
      request.url.startsWith('/auth/')
    ) {
      return next();
    }

    try {
      const build = await getServerBuild();
      return createRequestHandler({
        build,
        getLoadContext: () => ({
          user: request.user,
          remixService: this.remixService,
          remixIntegration: this.remixApiService,
          parsedBody: request.body,
          cspNonce: response.locals.cspNonce,
        }),
      })(request, response, next);
    } catch (error) {
      this.logger.error(`Error loading server build: ${error}`);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Frontend build not available',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
