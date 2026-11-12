/**
 * SEO maintenance triggers and SEO dashboards — access boundary.
 *
 * Nine controllers of the SEO module. Three classes of access:
 * - `adminOrKey` : `AdminOrInternalKeyGuard`, i.e. an admin session OR the
 *   internal key (`X-Internal-Key`). Triggers a scheduled task or an
 *   operations script may call (sitemap generation and cleanup, sitemap
 *   submission, monitoring run, risk refresh) and the reads of the
 *   controllers that carry them.
 * - `admin`      : `AuthenticatedGuard + IsAdminGuard`. Read-only dashboards
 *   (keywords, crawl logs, pilotage).
 * - `public`     : the served `latest.xml` and the sitemap diagnostic reads.
 *
 * Each handler → access map below is EXHAUSTIVE: a handler added later
 * without a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context. The composite resolves its two atomic guards through a
 * simulated `ModuleRef`, as `AuthModule` provides them at runtime.
 *
 * @see backend/src/auth/admin-or-internal-key.guard.ts
 * @see backend/src/auth/any-of.guard.ts
 */
import { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef, Reflector } from '@nestjs/core';

import { AdminOrInternalKeyGuard } from '@auth/admin-or-internal-key.guard';
import { AdminSessionGuard } from '@auth/admin-session.guard';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { InternalApiKeyGuard } from '@auth/internal-api-key.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { KeywordsDashboardController } from '../../src/modules/seo/controllers/keywords-dashboard.controller';
import { SeoDashboardController } from '../../src/modules/seo/controllers/seo-dashboard.controller';
import { SeoLogsController } from '../../src/modules/seo/controllers/seo-logs.controller';
import { SeoMonitorController } from '../../src/modules/seo/controllers/seo-monitor.controller';
import { SeoMonitoringController } from '../../src/modules/seo/controllers/seo-monitoring.controller';
import { SeoPilotageController } from '../../src/modules/seo/controllers/seo-pilotage.controller';
import { SitemapDeltaController } from '../../src/modules/seo/controllers/sitemap-delta.controller';
import { SitemapStreamingController } from '../../src/modules/seo/controllers/sitemap-streaming.controller';
import { SitemapUnifiedController } from '../../src/modules/seo/controllers/sitemap-unified.controller';

/** Value of `INTERNAL_API_KEY` in the simulated config (not a real key). */
const CONFIGURED_KEY = 'unit-test-internal-key';

/**
 * Builds a guard as the application does. The composite receives a
 * `ModuleRef` that resolves its two atomic guards; `InternalApiKeyGuard`
 * reads `INTERNAL_API_KEY` from the simulated config.
 */
function instantiate(Guard: Type<any>, internalKey: string): CanActivate {
  if (Guard !== AdminOrInternalKeyGuard) {
    return new Guard(new Reflector());
  }
  const config = {
    get: (name: string, fallback?: string) =>
      name === 'INTERNAL_API_KEY' ? internalKey : fallback,
  } as unknown as ConfigService;
  const atomic = new Map<Type<any>, CanActivate>([
    [AdminSessionGuard, new AdminSessionGuard()],
    [InternalApiKeyGuard, new InternalApiKeyGuard(config)],
  ]);
  const moduleRef = {
    get: (cls: Type<any>) => {
      const guard = atomic.get(cls);
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
 * the execution context. A guard may answer asynchronously, as NestJS allows.
 * An empty chain => allowed (how an unguarded endpoint behaves).
 * `internalKey` is the value of `INTERNAL_API_KEY` in the simulated config.
 */
async function isAllowed(
  controller: Type<any>,
  method: string,
  request: any,
  internalKey: string = CONFIGURED_KEY,
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
      result = await instantiate(Guard, internalKey).canActivate(ctx);
    } catch {
      return false;
    }
    if (result !== true) return false;
  }
  return true;
}

// ─── Principals ─────────────────────────────────────────────────────────────

const principal = (
  level: number | null,
  headers: Record<string, string> = {},
) =>
  level === null
    ? { path: '/x', headers, isAuthenticated: () => false, user: undefined }
    : {
        path: '/x',
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

/**
 * Session opened by an account, built with the rule `AuthService` applies:
 * the stored level is a privilege only for a staff account. A customer tier
 * shares its numbers with the staff scale and must never open a staff route.
 */
const accountSession = (authSource: AuthSource, storedLevel: number) => ({
  path: '/x',
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

/** Handlers by access, per controller. Must stay exhaustive. */
const CONTRACTS: Array<{
  name: string;
  controller: Type<any>;
  adminOrKey: string[];
  admin: string[];
  public: string[];
}> = [
  {
    name: 'sitemap-v2/delta (SitemapDeltaController)',
    controller: SitemapDeltaController,
    adminOrKey: ['triggerGeneration', 'cleanupExpired'],
    admin: [],
    public: [
      'getLatestSitemap',
      'getDeltaStats',
      'getDeltaStatsByDate',
      'getDeltaUrls',
      'getConfig',
    ],
  },
  {
    name: 'sitemap-v2/streaming (SitemapStreamingController)',
    controller: SitemapStreamingController,
    adminOrKey: ['generate', 'cleanup'],
    admin: [],
    public: ['listFiles', 'getConfig'],
  },
  {
    name: 'api/sitemap (SitemapUnifiedController)',
    controller: SitemapUnifiedController,
    adminOrKey: ['generateAll'],
    admin: [],
    public: ['getStatus'],
  },
  {
    name: 'seo-monitoring (SeoMonitoringController)',
    controller: SeoMonitoringController,
    adminOrKey: [
      'getMonitoringReport',
      'verifySitemaps',
      'submitSitemap',
      'submitAllSitemaps',
    ],
    admin: [],
    public: [],
  },
  {
    name: 'api/seo/monitor (SeoMonitorController)',
    controller: SeoMonitorController,
    adminOrKey: [
      'getStats',
      'getRecentJobs',
      'getJobResult',
      'triggerManualCheck',
    ],
    admin: [],
    public: [],
  },
  {
    name: 'api/seo/dashboard (SeoDashboardController)',
    controller: SeoDashboardController,
    adminOrKey: [
      'getStats',
      'getUrlsAtRisk',
      'getUrlsByRiskFlag',
      'getCrawlActivity',
      'getIndexChanges',
      'getCrawlStats',
      'getRecentCrawls',
      'getUrlsNotCrawled',
      'refreshRiskFlags',
      'getSummary',
    ],
    admin: [],
    public: [],
  },
  {
    name: 'api/seo/keywords (KeywordsDashboardController)',
    controller: KeywordsDashboardController,
    adminOrKey: [],
    admin: [
      'listGammes',
      'getKeywordsByGamme',
      'getGammeStats',
      'getTopKeywords',
    ],
    public: [],
  },
  {
    name: 'seo-logs (SeoLogsController)',
    controller: SeoLogsController,
    adminOrKey: [],
    admin: [
      'searchLogs',
      'getTopCrawled',
      'getTopBots',
      'getRecentErrors',
      'getIngestionStats',
      'getTrafficAnalytics',
      'getSlowPaths',
      'getBotHits',
    ],
    public: [],
  },
  {
    name: 'api/seo/pilotage (SeoPilotageController)',
    controller: SeoPilotageController,
    adminOrKey: [],
    admin: [
      'getWeeklyReport',
      'getMonthlyReport',
      'getAutoDiagnostics',
      'diagnoseUrl',
      'getClusterHealth',
      'getAllClustersHealth',
      'getSummary',
    ],
    public: [],
  },
];

/**
 * `describe.each` over the handlers of one access class. Jest refuses an
 * empty table, and a controller need not have a handler in every class.
 */
function describeHandlers(
  handlers: string[],
  title: string,
  suite: (method: string) => void,
): void {
  if (handlers.length > 0) {
    describe.each(handlers)(title, suite);
  }
}

describe('AdminOrInternalKeyGuard', () => {
  it('is one shared class, so that every route carries the same boundary', () => {
    expect(typeof AdminOrInternalKeyGuard).toBe('function');
    expect(
      effectiveGuards(SitemapDeltaController, 'triggerGeneration')[0],
    ).toBe(effectiveGuards(SeoDashboardController, 'refreshRiskFlags')[0]);
  });
});

describe.each(CONTRACTS)('$name — access boundary', (contract) => {
  const { controller } = contract;

  it('classifies every route handler', () => {
    expect([...routeHandlers(controller)].sort()).toEqual(
      [...contract.adminOrKey, ...contract.admin, ...contract.public].sort(),
    );
  });

  describeHandlers(
    contract.adminOrKey,
    '%s (admin or internal key)',
    (method) => {
      it('requires AdminOrInternalKeyGuard alone', () => {
        expect(effectiveGuards(controller, method)).toEqual([
          AdminOrInternalKeyGuard,
        ]);
      });

      it('refuses anonymous, customers and staff below admin', async () => {
        for (const level of [null, 1, 3, 5]) {
          expect(await isAllowed(controller, method, principal(level))).toBe(
            false,
          );
        }
      });

      it('allows an admin session, with or without a configured key', async () => {
        expect(await isAllowed(controller, method, principal(7))).toBe(true);
        expect(await isAllowed(controller, method, principal(7), '')).toBe(
          true,
        );
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

      it('allows the internal key without a session', async () => {
        expect(
          await isAllowed(controller, method, withKey(CONFIGURED_KEY)),
        ).toBe(true);
      });

      it('refuses a wrong key, including one of the same length', async () => {
        expect(await isAllowed(controller, method, withKey('wrong'))).toBe(
          false,
        );
        expect(
          await isAllowed(
            controller,
            method,
            withKey(CONFIGURED_KEY.replace(/.$/, 'X')),
          ),
        ).toBe(false);
      });

      it('stays closed to any key when INTERNAL_API_KEY is not configured', async () => {
        for (const key of ['', 'anything', CONFIGURED_KEY]) {
          expect(await isAllowed(controller, method, withKey(key), '')).toBe(
            false,
          );
        }
      });
    },
  );

  describeHandlers(contract.admin, '%s (admin)', (method) => {
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

    it('does not accept the internal key', async () => {
      expect(await isAllowed(controller, method, withKey(CONFIGURED_KEY))).toBe(
        false,
      );
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

  describeHandlers(contract.public, '%s (public)', (method) => {
    it('carries no guard and answers without a session', async () => {
      expect(effectiveGuards(controller, method)).toEqual([]);
      expect(await isAllowed(controller, method, principal(null))).toBe(true);
    });
  });
});
