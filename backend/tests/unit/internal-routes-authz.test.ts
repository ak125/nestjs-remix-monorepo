/**
 * Internal back-office read routes — access boundary.
 *
 * These controllers serve back-office screens (customers, orders, invoices,
 * shipments). Every one of their handlers must require an authenticated
 * session AND a staff role; a logged-in customer must be refused.
 *
 * Two boundaries are used, both canonical in this codebase:
 *   - `AuthenticatedGuard + PermissionsGuard + @RequirePermission(action)` —
 *     the per-action matrix (`PermissionsService`), same wiring as
 *     `OrderActionsController`. PermissionsGuard lets a handler WITHOUT
 *     `@RequirePermission` through, so this test asserts the metadata on
 *     EVERY handler of those controllers (a new handler added without it fails).
 *   - `AuthenticatedGuard + IsAdminGuard` — admin-only screens.
 *
 * The customer dashboard route `GET /api/legacy-users/dashboard` stays
 * reachable by any authenticated customer (it serves the account page).
 *
 * Known limit, out of this test's scope: the boundary is level-based. A
 * principal's account source (customer vs staff table) is not consulted, so a
 * customer account whose stored level is staff-grade passes like staff.
 *
 * The test enumerates the handlers from NestJS route metadata rather than a
 * hand-kept list, so the contract covers routes added later.
 *
 * @see backend/src/auth/guards/permissions.guard.ts
 * @see backend/src/auth/permissions.service.ts
 * @see backend/tests/unit/seo-metadata-authz.test.ts (same test shape)
 */
import { ExecutionContext, RequestMethod, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '@auth/decorators/require-permission.decorator';
import { PermissionsService } from '../../src/auth/permissions.service';
import { OrdersController as LegacyOrdersController } from '../../src/controllers/orders.controller';
import { UsersController as LegacyUsersController } from '../../src/controllers/users.controller';
import { DashboardController } from '../../src/modules/dashboard/dashboard.controller';
import { InvoicesController } from '../../src/modules/invoices/invoices.controller';
import { TicketsController } from '../../src/modules/orders/controllers/tickets.controller';
import { OrderArchiveController } from '../../src/modules/orders/controllers/order-archive.controller';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';

// NestJS reflection keys (`@nestjs/common/constants` — stable literals).
const GUARDS_METADATA = '__guards__';
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Route handlers declared on a controller (methods carrying route metadata). */
function routeHandlers(controller: Type<any>): string[] {
  return Object.getOwnPropertyNames(controller.prototype).filter(
    (name) =>
      name !== 'constructor' &&
      typeof controller.prototype[name] === 'function' &&
      Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) !==
        undefined,
  );
}

function routeOf(controller: Type<any>, method: string) {
  const handler = controller.prototype[method];
  return {
    path: String(Reflect.getMetadata(PATH_METADATA, handler)),
    verb: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
  };
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
  return new Guard();
}

/**
 * Runs the applied guard chain against a request, with the REAL handler in
 * the execution context so PermissionsGuard reads the real metadata.
 * An empty chain => allowed (how an unguarded endpoint behaves).
 */
function isAllowed(
  controller: Type<any>,
  method: string,
  request: any,
): boolean {
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
      result = instantiate(Guard).canActivate(ctx);
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
          email: 'someone@test.invalid',
          level: String(level),
          isAdmin: level >= 7,
        },
      };

const anonymous = () => principal(null);
const customer = () => principal(1);
const commercial = () => principal(3);
const manager = () => principal(5);
const admin = () => principal(7);

// ─── Staff-only controllers (per-action matrix) ──────────────────────────────

const LEGACY_USERS_CUSTOMER_ROUTES = new Set(['getDashboardStats']);

const STAFF_CONTROLLERS: Array<{ label: string; controller: Type<any> }> = [
  { label: 'api/legacy-orders', controller: LegacyOrdersController },
  { label: 'api/legacy-users', controller: LegacyUsersController },
  { label: 'api/dashboard', controller: DashboardController },
];

describe('back-office read controllers refuse anonymous and customers', () => {
  describe.each(STAFF_CONTROLLERS)('$label', ({ controller }) => {
    const handlers = routeHandlers(controller).filter(
      (m) =>
        !(
          controller === LegacyUsersController &&
          LEGACY_USERS_CUSTOMER_ROUTES.has(m)
        ),
    );

    it('has route handlers to check', () => {
      expect(handlers.length).toBeGreaterThan(0);
    });

    it.each(handlers)(
      '%s wires AuthenticatedGuard + PermissionsGuard + @RequirePermission',
      (method) => {
        const guards = effectiveGuards(controller, method);
        expect(guards).toContain(AuthenticatedGuard);
        expect(guards).toContain(PermissionsGuard);
        expect(
          Reflect.getMetadata(
            REQUIRE_PERMISSION_KEY,
            controller.prototype[method],
          ),
        ).toBe('canSeeCustomerDetails');
      },
    );

    it.each(handlers)('%s refuses anonymous and customers', (method) => {
      expect(isAllowed(controller, method, anonymous())).toBe(false);
      expect(isAllowed(controller, method, customer())).toBe(false);
    });

    it.each(handlers)('%s allows staff (level 3, 5, 7)', (method) => {
      expect(isAllowed(controller, method, commercial())).toBe(true);
      expect(isAllowed(controller, method, manager())).toBe(true);
      expect(isAllowed(controller, method, admin())).toBe(true);
    });
  });

  describe('GET api/legacy-users/dashboard (customer account page)', () => {
    it('requires a session but no staff role', () => {
      const guards = effectiveGuards(
        LegacyUsersController,
        'getDashboardStats',
      );
      expect(guards).toEqual([AuthenticatedGuard]);
      expect(
        isAllowed(LegacyUsersController, 'getDashboardStats', anonymous()),
      ).toBe(false);
      expect(
        isAllowed(LegacyUsersController, 'getDashboardStats', customer()),
      ).toBe(true);
    });
  });
});

// ─── Admin-only controllers ──────────────────────────────────────────────────

const ADMIN_CONTROLLERS: Array<{ label: string; controller: Type<any> }> = [
  { label: 'api/invoices', controller: InvoicesController },
  { label: 'api/tickets', controller: TicketsController },
  { label: 'order-archive', controller: OrderArchiveController },
];

describe.each(ADMIN_CONTROLLERS)('$label is admin-only', ({ controller }) => {
  const handlers = routeHandlers(controller);

  it('has route handlers to check', () => {
    expect(handlers.length).toBeGreaterThan(0);
  });

  it.each(handlers)('%s wires AuthenticatedGuard + IsAdminGuard', (method) => {
    const guards = effectiveGuards(controller, method);
    expect(guards).toContain(AuthenticatedGuard);
    expect(guards).toContain(IsAdminGuard);
  });

  it.each(handlers)('%s: anonymous, customer and level 5 refused', (method) => {
    expect(isAllowed(controller, method, anonymous())).toBe(false);
    expect(isAllowed(controller, method, customer())).toBe(false);
    expect(isAllowed(controller, method, manager())).toBe(false);
  });

  it.each(handlers)('%s: admin allowed', (method) => {
    expect(isAllowed(controller, method, admin())).toBe(true);
  });
});

// ─── api/orders: removed routes stay removed ─────────────────────────────────

describe('api/orders exposes no legacy, test or unowned update route', () => {
  const routes = routeHandlers(OrdersController).map((m) =>
    routeOf(OrdersController, m),
  );

  it('has no legacy/* or test/* route', () => {
    for (const { path } of routes) {
      expect(path.startsWith('legacy')).toBe(false);
      expect(path.startsWith('test')).toBe(false);
    }
  });

  it('has no PATCH :id route', () => {
    expect(
      routes.some(
        ({ path, verb }) => verb === RequestMethod.PATCH && path === ':id',
      ),
    ).toBe(false);
  });

  it('only the token-bearing resume route is unguarded', () => {
    // `resume-token/:token` is public by design: the token is the credential.
    const unguarded = routeHandlers(OrdersController).filter(
      (method) => effectiveGuards(OrdersController, method).length === 0,
    );
    expect(unguarded).toEqual(['validateResumeToken']);
  });
});
