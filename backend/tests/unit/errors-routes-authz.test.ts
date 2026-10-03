/**
 * Error logs, redirects and search metrics — access boundary.
 *
 * Error logs (with client IPs), raw search queries and the redirect table are
 * staff data. Their routes require `AuthenticatedGuard + IsAdminGuard`; the
 * few routes the storefront SSR calls without a session (404 suggestions,
 * error logging, redirect lookup, search) stay public on purpose.
 *
 * The handler → access maps below are EXHAUSTIVE: a handler added later
 * without a classification fails the test, and so does a controller added to
 * `ErrorsModule` or `ApiModule`.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `dashboard-routes-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
 * @see frontend/app/routes/$.tsx (the public consumers)
 */
import { ExecutionContext, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { InternalApiKeyGuard } from '../../src/auth/internal-api-key.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { ApiModule } from '../../src/api/api.module';
import {
  ErrorsApiController,
  RedirectsApiController,
} from '../../src/api/errors-api.controller';
import { ErrorController } from '../../src/modules/errors/controllers/error.controller';
import { InternalErrorLogController } from '../../src/modules/errors/controllers/internal-error-log.controller';
import { ErrorsModule } from '../../src/modules/errors/errors.module';
import { SearchController } from '../../src/modules/search/controllers/search.controller';
import { SearchModule } from '../../src/modules/search/search.module';

// NestJS reflection keys (`@nestjs/common/constants` — stable literals).
const GUARDS_METADATA = '__guards__';
const METHOD_METADATA = 'method';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Route handlers declared on a controller, in declaration order. */
function routeHandlers(controller: Type<any>): string[] {
  return Object.getOwnPropertyNames(controller.prototype).filter(
    (name) =>
      name !== 'constructor' &&
      typeof controller.prototype[name] === 'function' &&
      Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) !==
        undefined,
  );
}

/** Class-level guards ++ method-level guards (both must pass in NestJS). */
function effectiveGuards(
  controller: Type<any>,
  method: string,
): Array<Type<any>> {
  const classGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller) || [];
  const methodGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller.prototype[method]) || [];
  return [...classGuards, ...methodGuards];
}

/**
 * Runs the applied guard chain against a request, with the REAL handler in
 * the execution context. A guard may answer asynchronously, as NestJS allows.
 * An empty chain => allowed (how an unguarded endpoint behaves).
 */
async function isAllowed(
  controller: Type<any>,
  method: string,
  request: any,
): Promise<boolean> {
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => controller.prototype[method],
    getClass: () => controller,
  } as unknown as ExecutionContext;
  for (const Guard of effectiveGuards(controller, method)) {
    let result: unknown;
    try {
      result = await new Guard(new Reflector()).canActivate(ctx);
    } catch {
      return false;
    }
    if (result !== true) return false;
  }
  return true;
}

// ─── Principals ───────────────────────────────────────────────────────────────

const principal = (level: number | null) =>
  level === null
    ? { path: '/x', isAuthenticated: () => false, user: undefined }
    : {
        path: '/x',
        isAuthenticated: () => true,
        user: {
          id: 'u1',
          email: 'someone@example.test',
          level: String(level),
          isAdmin: level >= 7,
        },
      };

/**
 * Session opened by an account, built with the rule `AuthService` applies:
 * the stored level is a privilege only for a staff account. A customer tier
 * shares its numbers with the staff scale and must never open a staff route.
 */
const accountSession = (authSource: AuthSource, storedLevel: number) => ({
  path: '/x',
  isAuthenticated: () => true,
  user: {
    id: 'u1',
    email: 'someone@example.test',
    level: String(sessionPrivilegeLevel(authSource, storedLevel)),
    isAdmin: isAdminSession(authSource, storedLevel),
  },
});

/** Customer tiers that reuse a number of the staff scale (3, 5, 7, 9) or go above it. */
const HIGH_CUSTOMER_TIERS = [3, 5, 7, 9, 10];

// ─── Access contract ──────────────────────────────────────────────────────────

type Access = 'admin' | 'public';

/** Controller → handler → access. Must stay exhaustive per controller. */
const EXPECTED: Array<[Type<any>, Record<string, Access>]> = [
  [
    ErrorController,
    {
      getErrors: 'admin',
      getMetrics: 'admin',
      getAdminDashboard: 'admin',
      getFrequentErrors: 'admin',
      resolveError: 'admin',
      getRedirects: 'admin',
      createRedirect: 'admin',
      updateRedirect: 'admin',
      deleteRedirect: 'admin',
      getRedirectStats: 'admin',
      cleanupLogs: 'admin',
      testRedirect: 'admin',
      test412: 'admin',
      testOldLinkDetection: 'admin',
    },
  ],
  [
    ErrorsApiController,
    {
      getSuggestions: 'public',
      logError: 'public',
      getStatistics: 'admin',
      getRecentErrors: 'admin',
    },
  ],
  [
    RedirectsApiController,
    {
      checkRedirect: 'public',
      resolveLegacyUrl: 'public',
      addRedirect: 'admin',
      getRedirectStatistics: 'admin',
    },
  ],
  [
    SearchController,
    {
      healthCheck: 'public',
      searchPieces: 'public',
      getMetrics: 'admin',
      getPerformanceReport: 'admin',
    },
  ],
];

const ROUTES = EXPECTED.flatMap(([controller, handlers]) =>
  Object.entries(handlers).map(
    ([method, access]) =>
      [`${controller.name}.${method}`, controller, method, access] as const,
  ),
);
const ADMIN_ROUTES = ROUTES.filter(([, , , access]) => access === 'admin');
const PUBLIC_ROUTES = ROUTES.filter(([, , , access]) => access === 'public');

describe('error logs, redirects and search metrics — access boundary', () => {
  it('ErrorsModule registers ErrorController and InternalErrorLogController only', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ErrorsModule),
    ).toEqual([ErrorController, InternalErrorLogController]);
  });

  it('ApiModule registers ErrorsApiController and RedirectsApiController only', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ApiModule)).toEqual(
      [ErrorsApiController, RedirectsApiController],
    );
  });

  it('SearchModule mounts SearchController', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SearchModule),
    ).toContain(SearchController);
  });

  it('ErrorController is guarded as a whole (AuthenticatedGuard + IsAdminGuard)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ErrorController)).toEqual([
      AuthenticatedGuard,
      IsAdminGuard,
    ]);
  });

  it('InternalErrorLogController stays behind the internal API key', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, InternalErrorLogController),
    ).toEqual([InternalApiKeyGuard]);
  });

  it.each(
    EXPECTED.map(
      ([controller, handlers]) =>
        [controller.name, controller, handlers] as const,
    ),
  )('%s: classifies every route handler', (_name, controller, handlers) => {
    expect([...routeHandlers(controller)].sort()).toEqual(
      Object.keys(handlers).sort(),
    );
  });

  describe.each(ADMIN_ROUTES)('%s (admin)', (_name, controller, method) => {
    it('requires AuthenticatedGuard then IsAdminGuard', () => {
      expect(effectiveGuards(controller, method)).toEqual([
        AuthenticatedGuard,
        IsAdminGuard,
      ]);
    });

    it('refuses anonymous, customers and staff below admin', async () => {
      for (const level of [null, 1, 3, 5]) {
        expect(await isAllowed(controller, method, principal(level))).toBe(
          false,
        );
      }
    });

    it('allows an admin', async () => {
      expect(await isAllowed(controller, method, principal(7))).toBe(true);
    });

    it('refuses a customer account whatever its tier, allows a staff admin', async () => {
      for (const storedLevel of HIGH_CUSTOMER_TIERS) {
        expect(
          await isAllowed(
            controller,
            method,
            accountSession('customer', storedLevel),
          ),
        ).toBe(false);
      }
      expect(
        await isAllowed(controller, method, accountSession('admin', 7)),
      ).toBe(true);
    });
  });

  describe.each(PUBLIC_ROUTES)('%s (public)', (_name, controller, method) => {
    it('has no guard: the storefront calls it without a session', async () => {
      expect(effectiveGuards(controller, method)).toEqual([]);
      expect(await isAllowed(controller, method, principal(null))).toBe(true);
    });
  });
});
