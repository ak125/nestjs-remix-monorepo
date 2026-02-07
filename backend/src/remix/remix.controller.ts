import { getServerBuild } from '@fafa/frontend';
import { All, Controller, Logger, Next, Req, Res } from '@nestjs/common';
import { createRequestHandler } from '@remix-run/express';
import { NextFunction, Request, Response } from 'express';
import { RemixService } from './remix.service';
import { RemixApiService } from './remix-api.service';

@Controller()
export class RemixController {
  private readonly logger = new Logger(RemixController.name);

  constructor(
    private remixService: RemixService,
    private remixApiService: RemixApiService,
  ) {}

  @All(':path*')
  async handler(
    @Req() request: Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    // console.log('--- RemixController handler ---');
    // console.log('Request URL:', request.url);

    // Ne pas capturer les routes qui sont déjà gérées par d'autres contrôleurs backend
    // Les routes /admin/breadcrumbs/* sont gérées par le BreadcrumbAdminController
    if (
      request.url.startsWith('/api/') ||
      request.url.startsWith('/sitemap-v2/') ||
      request.url.startsWith('/admin/breadcrumbs') ||
      request.url.startsWith('/authenticate') ||
      request.url.startsWith('/auth/')
    ) {
      // console.log('🔀 Skipping API/Auth route, calling next()');
      return next();
    }

    // console.log('Request user:', request.user);
    // console.log('Request session:', request.session);

    // Debug: Vérifier si le body est disponible
    if (request.method === 'POST') {
      // console.log('🔍 DEBUG: POST request body:', request.body);
      // console.log('🔍 DEBUG: POST request.body type:', typeof request.body);
    }

    // 🛑 410 Gone - Legacy supplier URLs
    // URLs format: /pieces-{supplier}.html (ex: /pieces-al-ko.html, /pieces-bosch.html)
    const supplierUrlRegex = /^\/pieces-[a-z0-9-]+\.html$/i;
    if (supplierUrlRegex.test(request.url)) {
      this.logger.log(`[410] Legacy supplier URL: ${request.url}`);
      response.status(410).send('Gone');
      return;
    }

    try {
      const build = await getServerBuild();
      // console.log('✅ Server build loaded successfully');

      return createRequestHandler({
        build,
        getLoadContext: () => ({
          user: request.user,
          remixService: this.remixService,
          remixIntegration: this.remixApiService,
          // Passer le body parsé par Express
          parsedBody: request.body,
        }),
      })(request, response, next);
    } catch (error) {
      this.logger.error(`Error loading server build: ${error}`);
      response.status(500).json({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Frontend build not available',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
