/**
 * SEO V4 diagnostic routes (`api/seo-dynamic-v4`) — access boundary.
 *
 * These routes generate, compare and audit SEO output, expose service metrics
 * and clear the service cache. They are staff tools: no storefront page calls
 * them, so every route requires `AuthenticatedGuard + IsAdminGuard`.
 *
 * The handler → access map below is EXHAUSTIVE: a handler added later without
 * a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `errors-routes-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
 * @see backend/scripts/seo/audit/diff-v4-vs-current.ts (the only HTTP consumer)
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
import { DynamicSeoController } from '../../src/modules/seo/dynamic-seo.controller';

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

/** Handler → access. Must stay exhaustive. */
const EXPECTED: Record<string, 'admin'> = {
  generateCompleteSeo: 'admin',
  generateVehicleSeo: 'admin',
  generateByTemplate: 'admin',
  compareWithOriginal: 'admin',
  clearCache: 'admin',
  getServiceStats: 'admin',
  validateVariables: 'admin',
  getMetrics: 'admin',
  runAudit: 'admin',
  generateAbTestVariants: 'admin',
  getInternalLinksMetrics: 'admin',
};

describe('SEO V4 diagnostic routes — access boundary', () => {
  it('DynamicSeoController: classifies every route handler', () => {
    expect([...routeHandlers(DynamicSeoController)].sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it('DynamicSeoController is guarded as a whole (AuthenticatedGuard + IsAdminGuard)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DynamicSeoController)).toEqual([
      AuthenticatedGuard,
      IsAdminGuard,
    ]);
  });

  describe.each(Object.keys(EXPECTED))('%s (admin)', (method) => {
    it('requires AuthenticatedGuard then IsAdminGuard', () => {
      expect(effectiveGuards(DynamicSeoController, method)).toEqual([
        AuthenticatedGuard,
        IsAdminGuard,
      ]);
    });

    it('refuses anonymous, customers and staff below admin', async () => {
      for (const level of [null, 1, 3, 5]) {
        expect(
          await isAllowed(DynamicSeoController, method, principal(level)),
        ).toBe(false);
      }
    });

    it('allows an admin', async () => {
      expect(await isAllowed(DynamicSeoController, method, principal(7))).toBe(
        true,
      );
    });

    it('refuses a customer account whatever its tier, allows a staff admin', async () => {
      for (const storedLevel of HIGH_CUSTOMER_TIERS) {
        expect(
          await isAllowed(
            DynamicSeoController,
            method,
            accountSession('customer', storedLevel),
          ),
        ).toBe(false);
      }
      expect(
        await isAllowed(
          DynamicSeoController,
          method,
          accountSession('admin', 7),
        ),
      ).toBe(true);
    });
  });
});
