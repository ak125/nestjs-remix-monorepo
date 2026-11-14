/**
 * `api/legacy-orders` — access boundary.
 *
 * Read-only order routes used by the staff back office (admin and commercial
 * order pages, reports, payment dashboard). The controller is guarded as a
 * whole by `AuthenticatedGuard + PermissionsGuard`, and each handler declares
 * ONE permission of the canonical matrix (`user-permissions.dto.ts`), as
 * `api/admin/orders` does. `PermissionsGuard` lets a handler without
 * `@RequirePermission` through, so the handler → permission map below is
 * EXHAUSTIVE: a handler added later without a permission fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `dashboard-routes-authz.test.ts`).
 *
 * @see backend/src/auth/guards/permissions.guard.ts
 * @see backend/src/auth/dto/user-permissions.dto.ts
 */
import { ExecutionContext, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '@auth/decorators/require-permission.decorator';
import { AuthModule } from '../../src/auth/auth.module';
import type { PermissionAction } from '../../src/auth/dto/user-permissions.dto';
import { PermissionsService } from '../../src/auth/permissions.service';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { OrdersController } from '../../src/controllers/orders.controller';
import { ApiModule } from '../../src/modules/api.module';

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

function instantiate(Guard: Type<any>) {
  if (Guard === PermissionsGuard) {
    return new PermissionsGuard(new Reflector(), new PermissionsService());
  }
  // A guard reading route metadata gets a real Reflector, as under Nest DI.
  return new Guard(new Reflector());
}

/**
 * Runs the applied guard chain against a request, with the REAL handler in
 * the execution context so PermissionsGuard reads the real metadata. A guard
 * may answer asynchronously, as NestJS allows. An empty chain => allowed (how
 * an unguarded endpoint behaves).
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
      result = await instantiate(Guard).canActivate(ctx);
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

const anonymous = () => principal(null);
const customer = () => principal(1);
const commercial = () => principal(3);
const manager = () => principal(5);
const admin = () => principal(7);

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

/** Handler → permission of the canonical matrix. Must stay exhaustive. */
const EXPECTED: Record<string, PermissionAction> = {
  getAllOrders: 'canSeeCustomerDetails',
  getOrdersStats: 'canSeeFinancials',
  getOrderById: 'canSeeCustomerDetails',
};

/** The commercial level (3) reads orders and their customer, not the revenue. */
const COMMERCIAL_ROUTES = Object.keys(EXPECTED).filter(
  (method) => EXPECTED[method] === 'canSeeCustomerDetails',
);

describe('api/legacy-orders — access boundary', () => {
  it('ApiModule registers OrdersController and can resolve PermissionsGuard', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ApiModule),
    ).toContain(OrdersController);
    // PermissionsGuard is resolved in the host module: its PermissionsService
    // dependency must be importable there.
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, ApiModule)).toContain(
      AuthModule,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule)).toEqual(
      expect.arrayContaining([PermissionsService, PermissionsGuard]),
    );
  });

  it('is guarded as a whole (AuthenticatedGuard + PermissionsGuard)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrdersController)).toEqual([
      AuthenticatedGuard,
      PermissionsGuard,
    ]);
  });

  it('classifies every route handler', () => {
    expect([...routeHandlers(OrdersController)].sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it('keeps list and detail open to the commercial level', () => {
    expect(COMMERCIAL_ROUTES.sort()).toEqual(
      ['getAllOrders', 'getOrderById'].sort(),
    );
  });

  describe.each(Object.entries(EXPECTED))('%s (%s)', (method, action) => {
    it('declares its permission and adds no guard of its own', () => {
      expect(
        Reflect.getMetadata(
          REQUIRE_PERMISSION_KEY,
          OrdersController.prototype[method],
        ),
      ).toBe(action);
      expect(effectiveGuards(OrdersController, method)).toEqual([
        AuthenticatedGuard,
        PermissionsGuard,
      ]);
    });

    it('refuses anonymous and customers', async () => {
      expect(await isAllowed(OrdersController, method, anonymous())).toBe(
        false,
      );
      expect(await isAllowed(OrdersController, method, customer())).toBe(false);
    });

    it('opens to the commercial level only for list and detail', async () => {
      expect(await isAllowed(OrdersController, method, commercial())).toBe(
        COMMERCIAL_ROUTES.includes(method),
      );
    });

    it('allows managers and admins', async () => {
      expect(await isAllowed(OrdersController, method, manager())).toBe(true);
      expect(await isAllowed(OrdersController, method, admin())).toBe(true);
    });

    it('refuses a customer account whatever its tier, allows a staff admin', async () => {
      for (const storedLevel of HIGH_CUSTOMER_TIERS) {
        expect(
          await isAllowed(
            OrdersController,
            method,
            accountSession('customer', storedLevel),
          ),
        ).toBe(false);
      }
      expect(
        await isAllowed(OrdersController, method, accountSession('admin', 7)),
      ).toBe(true);
    });
  });
});
