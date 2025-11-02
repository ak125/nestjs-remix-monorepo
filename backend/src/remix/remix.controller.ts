import { getServerBuild } from '@fafa/frontend';
import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { createRequestHandler } from '@remix-run/express';
import { NextFunction, Request, Response } from 'express';
import { RemixService } from './remix.service';
import { RemixApiService } from './remix-api.service';

@Controller()
export class RemixController {
  constructor(
    private remixService: RemixService,
    private remixApiService: RemixApiService,
  ) {}

  @All('*')
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
      console.error('❌ Error loading server build:', error);
      response.status(500).json({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Frontend build not available',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
