/**
 * Gamme page cache warming — startup path and access boundary.
 *
 * At startup the gamme cache is warmed in process, by
 * `GammeCacheWarmingService` calling `GammeRpcService`. No HTTP request
 * leaves the backend for it, so `POST api/gamme-rest/cache/warm` does not
 * have to stay open: it requires `AuthenticatedGuard + IsAdminGuard`, like
 * the invalidation route.
 *
 * The handler → access map is EXHAUSTIVE: a handler added later without a
 * classification fails the test. The guard chain is evaluated for real, with
 * the real handler in the execution context (same shape as
 * `payment-core-routes-authz.test.ts`).
 */
import { ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import {
  CACHE_WARMING_STARTUP_DELAY_MS,
  CacheWarmingService,
} from '../../src/modules/catalog/services/cache-warming.service';
import { GammeRestRpcV2Controller } from '../../src/modules/gamme-rest/gamme-rest-rpc-v2.controller';
import { GammeCacheWarmingService } from '../../src/modules/gamme-rest/services/gamme-cache-warming.service';

// NestJS reflection keys (`@nestjs/common/constants` — stable literals).
const GUARDS_METADATA = '__guards__';
const METHOD_METADATA = 'method';

// ─── Startup warming ────────────────────────────────────────────────────────

/** `fetch` double: any HTTP request made while warming fails the test. */
function forbidFetch() {
  const fetchMock = jest.fn(async () => {
    throw new Error('no HTTP request is expected while warming');
  });
  const original = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, restore: () => (global.fetch = original) };
}

function buildGammeWarmer(rpc: {
  getCatalogPgIds: jest.Mock;
  warmCache: jest.Mock;
}) {
  const service = new GammeCacheWarmingService(rpc as never);
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  Object.assign(service, { logger });
  return { service, logger };
}

describe('GammeCacheWarmingService', () => {
  let http: ReturnType<typeof forbidFetch>;

  beforeEach(() => {
    http = forbidFetch();
  });
  afterEach(() => {
    http.restore();
    jest.useRealTimers();
  });

  it('warms the catalog gammes in process, without an HTTP request', async () => {
    const rpc = {
      getCatalogPgIds: jest.fn(async () => ['7', '402']),
      warmCache: jest.fn(async () => ({ success: 2, failed: 0 })),
    };
    const { service, logger } = buildGammeWarmer(rpc);

    await service.warmCatalogGammes();

    expect(rpc.warmCache).toHaveBeenCalledTimes(1);
    expect(rpc.warmCache).toHaveBeenCalledWith(['7', '402']);
    expect(http.fetchMock).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      '✅ Gamme cache warmed: 2/2 OK, 0 failed',
    );
  });

  it('reports the gammes that failed', async () => {
    const rpc = {
      getCatalogPgIds: jest.fn(async () => ['7', '402', '9']),
      warmCache: jest.fn(async () => ({ success: 1, failed: 2 })),
    };
    const { service, logger } = buildGammeWarmer(rpc);

    await service.warmCatalogGammes();

    expect(logger.log).toHaveBeenCalledWith(
      '✅ Gamme cache warmed: 1/3 OK, 2 failed',
    );
  });

  it('warms nothing when the catalog lists no gamme', async () => {
    const rpc = {
      getCatalogPgIds: jest.fn(async () => []),
      warmCache: jest.fn(),
    };
    const { service, logger } = buildGammeWarmer(rpc);

    await service.warmCatalogGammes();

    expect(rpc.warmCache).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs a failure and lets the startup go on', async () => {
    const rpc = {
      getCatalogPgIds: jest.fn(async () => {
        throw new Error('fetch failed');
      }),
      warmCache: jest.fn(),
    };
    const { service, logger } = buildGammeWarmer(rpc);

    await expect(service.warmCatalogGammes()).resolves.toBeUndefined();

    expect(rpc.warmCache).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      '⚠️ Gamme warming skipped: fetch failed',
    );
  });

  it('starts once, after the startup delay', async () => {
    jest.useFakeTimers();
    const rpc = {
      getCatalogPgIds: jest.fn(async () => ['7']),
      warmCache: jest.fn(async () => ({ success: 1, failed: 0 })),
    };
    const { service } = buildGammeWarmer(rpc);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(CACHE_WARMING_STARTUP_DELAY_MS - 1);
    expect(rpc.getCatalogPgIds).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(rpc.warmCache).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(10 * CACHE_WARMING_STARTUP_DELAY_MS);
    expect(rpc.warmCache).toHaveBeenCalledTimes(1);
  });
});

describe('CacheWarmingService (catalog)', () => {
  it('warms the homepage and the hierarchy without an HTTP request', async () => {
    jest.useFakeTimers();
    const http = forbidFetch();
    const homepage = {
      warmCache: jest.fn(async () => ({ success: true, time: 1 })),
    };
    const hierarchy = { getHierarchy: jest.fn(async () => ({})) };
    const service = new CacheWarmingService(
      homepage as never,
      hierarchy as never,
    );
    Object.assign(service, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    try {
      await service.onModuleInit();
      await jest.advanceTimersByTimeAsync(CACHE_WARMING_STARTUP_DELAY_MS);

      expect(homepage.warmCache).toHaveBeenCalledTimes(1);
      expect(hierarchy.getHierarchy).toHaveBeenCalledTimes(1);
      expect(http.fetchMock).not.toHaveBeenCalled();
    } finally {
      http.restore();
      jest.useRealTimers();
    }
  });
});

// ─── Access boundary ────────────────────────────────────────────────────────

const controller: Type<any> = GammeRestRpcV2Controller;

/** Route handlers declared on the controller, in declaration order. */
function routeHandlers(): string[] {
  return Object.getOwnPropertyNames(controller.prototype).filter(
    (name) =>
      name !== 'constructor' &&
      typeof controller.prototype[name] === 'function' &&
      Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) !==
        undefined,
  );
}

/** Class-level guards ++ method-level guards (both must pass in NestJS). */
function effectiveGuards(method: string): Array<Type<any>> {
  const classGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller) || [];
  const methodGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller.prototype[method]) || [];
  return [...classGuards, ...methodGuards];
}

/**
 * Runs the applied guard chain against a request, with the REAL handler in
 * the execution context. An empty chain => allowed (an unguarded endpoint).
 */
async function isAllowed(method: string, request: any): Promise<boolean> {
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => controller.prototype[method],
    getClass: () => controller,
  } as unknown as ExecutionContext;
  for (const Guard of effectiveGuards(method)) {
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
 * the stored level is a privilege only for a staff account.
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

/** Customer tiers that reuse a number of the staff scale or go above it. */
const HIGH_CUSTOMER_TIERS = [3, 5, 7, 9, 10];

const ADMIN_HANDLERS = ['warmCache', 'invalidateCache'];
const PUBLIC_HANDLERS = ['getPageDataRpcV2'];

describe('api/gamme-rest (GammeRestRpcV2Controller) — access boundary', () => {
  it('classifies every route handler', () => {
    expect([...routeHandlers()].sort()).toEqual(
      [...ADMIN_HANDLERS, ...PUBLIC_HANDLERS].sort(),
    );
  });

  describe.each(ADMIN_HANDLERS)('%s (admin)', (method) => {
    it('requires AuthenticatedGuard then IsAdminGuard', () => {
      expect(effectiveGuards(method)).toEqual([
        AuthenticatedGuard,
        IsAdminGuard,
      ]);
    });

    it('refuses anonymous, customers and staff below admin', async () => {
      for (const level of [null, 1, 3, 5]) {
        expect(await isAllowed(method, principal(level))).toBe(false);
      }
    });

    it('allows an admin', async () => {
      expect(await isAllowed(method, principal(7))).toBe(true);
    });

    it('refuses a customer account whatever its tier, allows a staff admin', async () => {
      for (const storedLevel of HIGH_CUSTOMER_TIERS) {
        expect(
          await isAllowed(method, accountSession('customer', storedLevel)),
        ).toBe(false);
      }
      expect(await isAllowed(method, accountSession('admin', 7))).toBe(true);
    });
  });

  describe.each(PUBLIC_HANDLERS)('%s (public)', (method) => {
    it('stays open to the site', async () => {
      expect(effectiveGuards(method)).toEqual([]);
      expect(await isAllowed(method, principal(null))).toBe(true);
    });
  });
});
