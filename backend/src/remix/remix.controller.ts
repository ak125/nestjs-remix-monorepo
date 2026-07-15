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

/**
 * H2 — session privacy for single-fetch `.data` responses (PR #1272 review).
 *
 * React Router 8 single fetch (default; `ssr: true`) serves client navigations
 * as `GET <path>.data` requests. Those responses NEVER flow through
 * `frontend/app/entry.server.tsx`'s document arbiter: `applySessionCachePrivacy`
 * runs only inside the default `handleRequest` export (HTML documents), and RR8
 * removed the `handleDataRequest` hook. A `.data` payload embeds the REVALIDATED
 * root loader (`{ user, cart }`), and PR B gave several previously-private public
 * routes a `public, s-maxage` `headers` export — so a session-bearing `.data`
 * for one of those routes would otherwise ship a shared-cache policy over a body
 * containing the logged-in user + cart (a privacy leak the moment an edge cache
 * honours it).
 *
 * These helpers close the gap at the one server chokepoint that sees every
 * `.data` response — this façade — forcing the SAME invariant as the document
 * arbiter and Caddy `@private`. The cookie pattern MIRRORS `entry.server.tsx`
 * `SESSION_COOKIE_RE` and the Caddy `@public_cached` matcher
 * (`(?i)(connect\.sid|session)`) so all three layers agree on what "sessioned"
 * means — do not change one without the others. (Colocated here rather than in a
 * new module so the change stays inside this already-owned file.)
 */
export const SESSION_COOKIE_RE = /(?:connect\.sid|session)/i;

/** Exact invariant required on any sessioned `.data` response (three cache tiers). */
export const SESSIONED_DATA_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
} as const;

/** RR8 single-fetch data requests are `GET <path>.data` (query stripped by `req.path`). */
export function isSingleFetchDataRequest(pathname: string): boolean {
  return pathname.endsWith('.data');
}

export function isSessionedCookie(
  cookieHeader: string | undefined | null,
): boolean {
  return !!cookieHeader && SESSION_COOKIE_RE.test(cookieHeader);
}

/**
 * True iff this is a single-fetch `.data` request carrying a session cookie —
 * i.e. a response that must be forced private/no-store. Documents (non-`.data`)
 * are deliberately excluded here: they are already covered by the entry.server
 * document arbiter, so this façade guard only owns the `.data` channel.
 */
export function requiresSessionedDataPrivacy(
  pathname: string,
  cookieHeader: string | undefined | null,
): boolean {
  return isSingleFetchDataRequest(pathname) && isSessionedCookie(cookieHeader);
}

type CachePrivacyRequest = Pick<Request, 'path'> & {
  headers: { cookie?: string };
};

/**
 * Arms the `.data` privacy guard for the given request/response pair, returning
 * `true` when armed (for the controller / tests).
 *
 * The `@react-router/express` adapter writes the route's headers via
 * `res.append(...)` and then streams the body — which triggers Node's implicit
 * `res.writeHead` just before the headers are flushed. That implicit call is the
 * only reliable seam to OVERRIDE the public `Cache-Control` the route emitted
 * (the standard `on-headers` technique); headers are still mutable at that
 * point. We never touch the body — only the three cache-tier headers.
 */
export function enforceSessionedDataCachePrivacy(
  request: CachePrivacyRequest,
  response: Response,
): boolean {
  if (!requiresSessionedDataPrivacy(request.path, request.headers.cookie)) {
    return false;
  }

  const originalWriteHead = response.writeHead.bind(response);
  response.writeHead = function patchedWriteHead(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ): Response {
    for (const [name, value] of Object.entries(SESSIONED_DATA_CACHE_HEADERS)) {
      response.setHeader(name, value);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalWriteHead as any)(...args);
  } as Response['writeHead'];

  return true;
}

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

    // H2 (PR #1272 review): single-fetch `.data` responses bypass the
    // entry.server document arbiter. Arm the sessioned-`.data` privacy guard
    // BEFORE the RR handler runs so a session-bearing `.data` for a public route
    // can never ship `public, s-maxage` over a body embedding the root
    // { user, cart }. No-op for documents and anonymous `.data`.
    enforceSessionedDataCachePrivacy(request, response);

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
