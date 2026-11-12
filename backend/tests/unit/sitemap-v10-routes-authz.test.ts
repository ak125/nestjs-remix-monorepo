/**
 * Sitemap v10 routes (`api/sitemap/v10`) — access boundary.
 *
 * Two classes of access:
 * - `write`  : generation, score refresh, hub generation and ping. One of
 *   three identities opens them: an admin session, the OIDC token of the
 *   scheduled workflow, or the internal key while its switch is on.
 * - `public` : the `stats` read.
 *
 * The handler → access map below is EXHAUSTIVE: a handler added later without
 * a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context. The composite resolves its three atomic guards through a
 * simulated `ModuleRef`, as `AuthModule` provides them at runtime. Only the
 * OIDC token validation is simulated (it reads the issuer's public keys).
 *
 * @see backend/src/auth/any-of.guard.ts
 * @see .github/workflows/sitemap-daily-regen.yml (the scheduled caller)
 */
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';

import { AdminSessionGuard } from '@auth/admin-session.guard';
import { GithubOidcGuard } from '@auth/github-oidc.guard';
import { GithubOidcService } from '@auth/github-oidc.service';
import { InternalApiKeyGuard } from '@auth/internal-api-key.guard';
import { LegacyInternalKeyGuard } from '@auth/legacy-internal-key.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { SitemapV10Controller } from '../../src/modules/seo/controllers/sitemap-v10.controller';

jest.mock('@sentry/nestjs', () => ({
  captureMessage: jest.fn(),
}));

/** Value of `INTERNAL_API_KEY` in the simulated config (not a real key). */
const CONFIGURED_KEY = 'unit-test-internal-key';
/** Token the simulated OIDC validation accepts (not a real token). */
const ACCEPTED_TOKEN = 'unit-test-accepted-token';

/** Simulated environment of one request. */
interface Env {
  internalKey: string;
  legacySwitch: string | undefined;
}
const DEFAULT_ENV: Env = { internalKey: CONFIGURED_KEY, legacySwitch: 'true' };

/**
 * Builds the composite as the application does: a `ModuleRef` resolves the
 * three atomic guards. `provided` lets a test withdraw one of them.
 */
function instantiate(
  Guard: Type<any>,
  env: Env,
  provided: Array<Type<any>> = [
    AdminSessionGuard,
    GithubOidcGuard,
    LegacyInternalKeyGuard,
  ],
): CanActivate {
  const values: Record<string, string | undefined> = {
    INTERNAL_API_KEY: env.internalKey,
    SITEMAP_LEGACY_INTERNAL_KEY_ENABLED: env.legacySwitch,
  };
  const config = {
    get: (name: string, fallback?: string) => values[name] ?? fallback,
  } as unknown as ConfigService;
  const oidc = {
    validate: async (token: string) => {
      if (token !== ACCEPTED_TOKEN) {
        throw new UnauthorizedException('Invalid token');
      }
      return { sub: 'unit-test' };
    },
  } as unknown as GithubOidcService;
  const atomic = new Map<Type<any>, CanActivate>([
    [AdminSessionGuard, new AdminSessionGuard()],
    [GithubOidcGuard, new GithubOidcGuard(oidc)],
    [
      LegacyInternalKeyGuard,
      new LegacyInternalKeyGuard(new InternalApiKeyGuard(config), config),
    ],
  ]);
  const moduleRef = {
    get: (cls: Type<any>) => {
      const guard = provided.includes(cls) ? atomic.get(cls) : undefined;
      if (!guard) throw new Error(`${cls.name} is not provided`);
      return guard;
    },
  } as unknown as ModuleRef;
  return new Guard(moduleRef);
}

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
 * the execution context. Returns `'allowed'`, or the HTTP status of the
 * refusal (`500` for an error that is not an HTTP exception).
 * An empty chain => allowed (how an unguarded endpoint behaves).
 */
async function outcome(
  method: string,
  request: any,
  env: Env = DEFAULT_ENV,
  provided?: Array<Type<any>>,
): Promise<'allowed' | number> {
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => SitemapV10Controller.prototype[method],
    getClass: () => SitemapV10Controller,
  } as unknown as ExecutionContext;
  for (const Guard of effectiveGuards(SitemapV10Controller, method)) {
    try {
      const result = await instantiate(Guard, env, provided).canActivate(ctx);
      if (result !== true) return 403;
    } catch (err) {
      return err instanceof HttpException ? err.getStatus() : 500;
    }
  }
  return 'allowed';
}

// ─── Principals ─────────────────────────────────────────────────────────────

const principal = (
  level: number | null,
  headers: Record<string, string> = {},
): any =>
  level === null
    ? {
        method: 'POST',
        url: '/x',
        headers,
        isAuthenticated: () => false,
        user: undefined,
      }
    : {
        method: 'POST',
        url: '/x',
        headers,
        isAuthenticated: () => true,
        user: {
          id: 'u1',
          email: 'someone@example.test',
          level: String(level),
          isAdmin: level >= 7,
        },
      };

/** Request without a session, carrying `X-Internal-Key`. */
const withKey = (key: string) => principal(null, { 'x-internal-key': key });

/** Request without a session, carrying an `Authorization` header. */
const withAuthorization = (value: string) =>
  principal(null, { authorization: value });

/**
 * Session opened by an account, built with the rule `AuthService` applies:
 * the stored level is a privilege only for a staff account. A customer tier
 * shares its numbers with the staff scale and must never open a staff route.
 */
const accountSession = (authSource: AuthSource, storedLevel: number): any => ({
  method: 'POST',
  url: '/x',
  headers: {},
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

// ─── Access contract ────────────────────────────────────────────────────────

/** Handler → access. Must stay exhaustive. */
const EXPECTED: Record<string, 'write' | 'public'> = {
  generateAll: 'write',
  generateBucket: 'write',
  refreshScores: 'write',
  generateHubs: 'write',
  generateHubsRobust: 'write',
  pingGoogle: 'write',
  pingGoogleBucket: 'write',
  getStats: 'public',
};

const WRITE = Object.keys(EXPECTED).filter((m) => EXPECTED[m] === 'write');
const PUBLIC = Object.keys(EXPECTED).filter((m) => EXPECTED[m] === 'public');

describe('Sitemap v10 routes — access boundary', () => {
  it('classifies every route handler', () => {
    expect([...routeHandlers(SitemapV10Controller)].sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it('every POST route is classified as a write', () => {
    // RequestMethod.POST === 1 (`@nestjs/common` enum, stable).
    const posts = routeHandlers(SitemapV10Controller).filter(
      (name) =>
        Reflect.getMetadata(
          METHOD_METADATA,
          SitemapV10Controller.prototype[name],
        ) === 1,
    );
    expect(posts.sort()).toEqual([...WRITE].sort());
  });

  it('every write route carries the same single composite guard', () => {
    const chains = WRITE.map((m) => effectiveGuards(SitemapV10Controller, m));
    for (const chain of chains) {
      expect(chain).toHaveLength(1);
      expect(chain[0]).toBe(chains[0][0]);
    }
  });

  describe.each(WRITE)('%s (write)', (method) => {
    it('answers 401 to a request without any identity', async () => {
      expect(await outcome(method, principal(null))).toBe(401);
    });

    it('answers 401 to customers and to staff below admin', async () => {
      for (const level of [1, 3, 5, 6]) {
        expect(await outcome(method, principal(level))).toBe(401);
      }
    });

    it('refuses a customer account whatever its tier, allows a staff admin', async () => {
      for (const storedLevel of HIGH_CUSTOMER_TIERS) {
        expect(
          await outcome(method, accountSession('customer', storedLevel)),
        ).toBe(401);
      }
      expect(await outcome(method, accountSession('admin', 7))).toBe('allowed');
    });

    it('allows an admin session and records the identity used', async () => {
      const request = principal(7);
      expect(await outcome(method, request)).toBe('allowed');
      expect(request._authPath).toBe('admin-session');
    });

    it('allows the scheduled workflow token, refuses any other bearer', async () => {
      const request = withAuthorization(`Bearer ${ACCEPTED_TOKEN}`);
      expect(await outcome(method, request)).toBe('allowed');
      expect(request._authPath).toBe('github-oidc');

      expect(await outcome(method, withAuthorization('Bearer other'))).toBe(
        401,
      );
      expect(await outcome(method, withAuthorization('Bearer '))).toBe(401);
      expect(
        await outcome(method, withAuthorization(`Basic ${ACCEPTED_TOKEN}`)),
      ).toBe(401);
    });

    it('allows the internal key only while its switch is on', async () => {
      const request = withKey(CONFIGURED_KEY);
      expect(await outcome(method, request)).toBe('allowed');
      expect(request._authPath).toBe('internal-key-legacy');

      for (const legacySwitch of [undefined, 'false', '', 'TRUE', '1']) {
        expect(
          await outcome(method, withKey(CONFIGURED_KEY), {
            internalKey: CONFIGURED_KEY,
            legacySwitch,
          }),
        ).toBe(401);
      }
    });

    it('refuses a wrong key, and any key when none is configured', async () => {
      expect(await outcome(method, withKey('wrong-key'))).toBe(401);
      expect(
        await outcome(method, withKey(''), {
          internalKey: '',
          legacySwitch: 'true',
        }),
      ).toBe(401);
      expect(
        await outcome(method, withKey('anything'), {
          internalKey: '',
          legacySwitch: 'true',
        }),
      ).toBe(401);
    });

    it('fails closed when an atomic guard is not provided', async () => {
      const result = await outcome(method, principal(7), DEFAULT_ENV, [
        GithubOidcGuard,
        LegacyInternalKeyGuard,
      ]);
      expect(result).not.toBe('allowed');
    });
  });

  describe.each(PUBLIC)('%s (public)', (method) => {
    it('carries no guard and answers without a session', async () => {
      expect(effectiveGuards(SitemapV10Controller, method)).toEqual([]);
      expect(await outcome(method, principal(null))).toBe('allowed');
    });
  });
});
