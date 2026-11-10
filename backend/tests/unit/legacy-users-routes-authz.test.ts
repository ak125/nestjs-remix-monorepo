/**
 * Legacy users routes (`api/legacy-users`) — access boundary.
 *
 * The list, search, account sheet, orders and statistics of a customer
 * account are staff tools: their callers are admin pages, which forward the
 * session cookie. They require `AuthenticatedGuard + IsAdminGuard`, the same
 * boundary as `api/users` and `api/admin/users`.
 *
 * `dashboard` serves the customer area: it carries no route guard and checks
 * the session of the signed-in account by itself.
 *
 * The handler → access map below is EXHAUSTIVE: a handler added later without
 * a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `seo-dynamic-v4-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
 * @see frontend/app/routes/admin.users._index.tsx
 * @see frontend/app/routes/account.dashboard.tsx
 */
import { ExecutionContext, Type } from '@nestjs/common';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { AuthenticationException } from '../../src/common/exceptions';
import { UsersController } from '../../src/controllers/users.controller';
import type { OrdersService } from '../../src/database/services/orders.service';
import type { UserDataConsolidatedService } from '../../src/modules/users/services/user-data-consolidated.service';

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

// ─── Principals ─────────────────────────────────────────────────────────────

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

// ─── Access contract ────────────────────────────────────────────────────────

type Access = 'admin' | 'own-session';

/** Handler → access. Must stay exhaustive. */
const EXPECTED: Record<string, Access> = {
  getAllUsers: 'admin',
  searchUsers: 'admin',
  getDashboardStats: 'own-session',
  getUserById: 'admin',
  getUserOrders: 'admin',
  getUserStats: 'admin',
};

const handlersWith = (access: Access) =>
  Object.keys(EXPECTED).filter((method) => EXPECTED[method] === access);

describe('Legacy users routes — access boundary', () => {
  it('UsersController: classifies every route handler', () => {
    expect([...routeHandlers(UsersController)].sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  describe.each(handlersWith('admin'))('%s (admin)', (method) => {
    it('requires AuthenticatedGuard then IsAdminGuard', () => {
      expect(effectiveGuards(UsersController, method)).toEqual([
        AuthenticatedGuard,
        IsAdminGuard,
      ]);
    });

    it('refuses anonymous, customers and staff below admin', async () => {
      for (const level of [null, 1, 3, 5]) {
        expect(await isAllowed(UsersController, method, principal(level))).toBe(
          false,
        );
      }
    });

    it('allows an admin', async () => {
      expect(await isAllowed(UsersController, method, principal(7))).toBe(true);
    });

    it('refuses a customer account whatever its tier, allows a staff admin', async () => {
      for (const storedLevel of HIGH_CUSTOMER_TIERS) {
        expect(
          await isAllowed(
            UsersController,
            method,
            accountSession('customer', storedLevel),
          ),
        ).toBe(false);
      }
      expect(
        await isAllowed(UsersController, method, accountSession('admin', 7)),
      ).toBe(true);
    });
  });

  describe.each(handlersWith('own-session'))('%s (own session)', (method) => {
    it('refuses a request without a session, before any read', async () => {
      const userData = { findById: jest.fn(), countActive: jest.fn() };
      const orders = {
        getTotalOrdersCount: jest.fn(),
        getUserOrders: jest.fn(),
      };
      const controller = new UsersController(
        userData as unknown as UserDataConsolidatedService,
        orders as unknown as OrdersService,
      ) as unknown as Record<string, (req: Request) => Promise<unknown>>;

      await expect(
        controller[method]({ user: undefined } as unknown as Request),
      ).rejects.toBeInstanceOf(AuthenticationException);
      expect(userData.findById).not.toHaveBeenCalled();
      expect(orders.getUserOrders).not.toHaveBeenCalled();
    });
  });
});
