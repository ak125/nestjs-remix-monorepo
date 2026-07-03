import { getServerBuild, getCreateAppLoadContext } from '@fafa/frontend';
import {
  All,
  Controller,
  HttpStatus,
  Logger,
  Next,
  Req,
  Res,
} from '@nestjs/common';
import { createRequestHandler } from '@react-router/express';
import * as Sentry from '@sentry/nestjs';
import { NextFunction, Request, Response } from 'express';
import { RemixService } from './remix.service';
import { RemixApiService } from './remix-api.service';

// RR8 (Temps B): middleware is always-on, so `@react-router/express`'s
// `getLoadContext` is natively typed to return a `RouterContextProvider` — no
// `Future` augmentation needed. (Under RR7.18 the A6 flag-gated form required a
// `declare module 'react-router' { interface Future { v8_middleware: true } }`
// ambient augmentation here so the separate backend tsconfig saw the flag; RR8
// removed the flag, and that augmentation now fails `tsc --build` with TS2664.)

/**
 * Pont d'observabilité serveur — UNIQUE client Sentry = `@sentry/nestjs` (init dans
 * `backend/src/instrument.ts`). Le bundle SSR React Router ne charge AUCUN SDK serveur
 * (single-server-SDK, incident #1106 / getsentry#21696) ; il remonte loaders/actions/
 * handleError/onError via ce reporter injecté dans `AppLoadContext.serverObservability`.
 * Contrat structurel mirroir de `frontend/app/utils/observability-contract.ts` (frontière des
 * bundles CJS↔ESM dans le même process Node). `withScope` isole tags/extra par
 * événement ; seul le `mechanism` (hint) part dans `captureException`.
 */
type ServerCaptureContext = {
  mechanism?: { type: string; handled: boolean };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};
interface ServerObservabilityPort {
  captureException(error: unknown, context?: ServerCaptureContext): void;
}
const serverObservability = {
  captureException(error: unknown, context?: ServerCaptureContext): void {
    try {
      Sentry.withScope((scope) => {
        if (context?.tags) scope.setTags(context.tags);
        if (context?.extra) scope.setExtras(context.extra);
        Sentry.captureException(
          error,
          context?.mechanism ? { mechanism: context.mechanism } : undefined,
        );
      });
    } catch {
      // reporter passif : ne jamais perturber le rendu
    }
  },
} satisfies ServerObservabilityPort;

@Controller()
export class RemixController {
  private readonly logger = new Logger(RemixController.name);

  constructor(
    private readonly remixService: RemixService,
    private readonly remixApiService: RemixApiService,
  ) {}

  @All('{*path}')
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
      // v8_middleware: `getLoadContext` must return a `RouterContextProvider`.
      // The factory is sourced from the SSR build's `entry.module` via the
      // façade bridge (`getCreateAppLoadContext`), so NestJS (CJS) never imports
      // the identity-keyed `createContext()` keys — dual-realm safety (#1106).
      // `parsedBody` dropped (DEAD).
      const [build, createAppLoadContext] = await Promise.all([
        getServerBuild(),
        getCreateAppLoadContext(),
      ]);
      return createRequestHandler({
        build,
        getLoadContext: () =>
          createAppLoadContext({
            user: request.user,
            remixService: this.remixService,
            remixIntegration: this.remixApiService,
            cspNonce: response.locals.cspNonce ?? '',
            serverObservability,
          }),
      })(request, response, next);
    } catch (error) {
      // L'échec de chargement du build SSR survient AVANT que entry.server.tsx prenne
      // la main → invisible dans Sentry sans capture explicite ici (le catch avale en 500).
      serverObservability.captureException(error, {
        mechanism: { type: 'react-router-build-load', handled: true },
        tags: { observability_channel: 'react-router-build-load' },
        extra: { method: request.method, pathname: request.path },
      });
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
