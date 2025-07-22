import { getServerBuild } from '@fafa/frontend';
import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { createRequestHandler } from '@remix-run/express';
import { NextFunction, Request, Response } from 'express';
import { RemixService } from './remix.service';

@Controller()
export class RemixController {
  constructor(private remixService: RemixService) {}

  @All('*')
  async handler(
    @Req() request: Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    console.log('--- RemixController handler ---');
    console.log('Request URL:', request.url);

    // Ne pas capturer les routes /api/*
    if (request.url.startsWith('/api/')) {
      console.log('🔀 Skipping API route, calling next()');
      return next();
    }

    console.log('Request user:', request.user);
    console.log('Request session:', request.session);

    // Debug: Vérifier si le body est disponible
    if (request.method === 'POST') {
      console.log('🔍 DEBUG: POST request body:', request.body);
      console.log('🔍 DEBUG: POST request.body type:', typeof request.body);
    }

    return createRequestHandler({
      build: await getServerBuild(),
      getLoadContext: () => ({
        user: request.user,
        remixService: this.remixService,
        // Passer le body parsé par Express
        parsedBody: request.body,
      }),
    })(request, response, next);
  }
}
