/**
 * `api/orders` — access boundary.
 *
 * Three classes:
 * - `admin`   : `AuthenticatedGuard + IsAdminGuard`. Back-office reads and
 *   status changes on any order.
 * - `session` : `AuthenticatedGuard`. The handler then works on the orders of
 *   the account in session.
 * - `open`    : reachable without a session. Each entry of `OPEN_ROUTES`
 *   carries the exact guard chain it declares and the reason it is open.
 *   `OptionalAuthGuard` never refuses a request, so a route that carries only
 *   that guard is open and must be listed here like a route with no guard.
 *
 * The handler → access map below is EXHAUSTIVE: a handler added later without
 * a classification fails the test, and so does a handler whose guard chain
 * differs from its class. A new route without a guard therefore needs an
 * explicit, reasoned entry in `OPEN_ROUTES` to pass.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `payment-core-routes-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
 * @see backend/src/auth/guards/optional-auth.guard.ts
 */
import { ExecutionContext, NotFoundException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { OptionalAuthGuard } from '../../src/auth/guards/optional-auth.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';

// NestJS reflection keys (`@nestjs/common/constants` — stable literals).
const GUARDS_METADATA = '__guards__';
const METHOD_METADATA = 'method';
const PATH_METADATA = 'path';

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
    ? { path: '/x', headers: {}, isAuthenticated: () => false, user: undefined }
    : {
        path: '/x',
        headers: {},
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

/** `AuthenticatedGuard + IsAdminGuard`. */
const ADMIN_ROUTES = [
  'getAllOrders',
  'getOrderByIdAdmin',
  'updateOrderStatusAdmin',
  'getGlobalStats',
  'getCustomerOrders',
];

/** `AuthenticatedGuard` only; the handler works on the account in session. */
const SESSION_ROUTES = [
  'listMyOrders',
  'createOrder',
  'updateOrder',
  'cancelOrder',
  'getMyStats',
];

/**
 * Routes reachable without a session, on purpose. Adding an entry is a
 * decision: state the guard chain the route declares and why no session is
 * required. Must stay as short as the storefront allows.
 */
const OPEN_ROUTES: Record<
  string,
  { guards: Array<Type<any>>; reason: string }
> = {
  // GET resume-token/:token — the link of a payment-resume email is opened
  // by a customer who is not logged in; the unguessable token is the proof.
  validateResumeToken: {
    guards: [],
    reason: 'payment-resume link: the token stands in for the session',
  },
  // POST guest — guest checkout creates the order before any account
  // exists; with a session the handler delegates to `createOrder`.
  createGuestOrder: {
    guards: [OptionalAuthGuard],
    reason: 'guest checkout: no account exists yet',
  },
  // GET :id — the guard lets the request through, the handler then answers
  // 404 without a session or for another account (asserted below).
  getOrderById: {
    guards: [OptionalAuthGuard],
    reason: 'handler rule: 404 unless the session owns the order',
  },
};

describe('api/orders — access boundary', () => {
  it('classifies every route handler, each in one class only', () => {
    const classified = [
      ...ADMIN_ROUTES,
      ...SESSION_ROUTES,
      ...Object.keys(OPEN_ROUTES),
    ];
    expect(new Set(classified).size).toBe(classified.length);
    expect([...routeHandlers(OrdersController)].sort()).toEqual(
      [...classified].sort(),
    );
  });

  it('declares no class-level guard that would hide a missing method guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrdersController)).toBe(
      undefined,
    );
  });

  describe.each(ADMIN_ROUTES)('%s (admin)', (method) => {
    it('requires AuthenticatedGuard then IsAdminGuard', () => {
      expect(effectiveGuards(OrdersController, method)).toEqual([
        AuthenticatedGuard,
        IsAdminGuard,
      ]);
    });

    it('refuses anonymous, customers and staff below admin', async () => {
      for (const level of [null, 1, 3, 5]) {
        expect(
          await isAllowed(OrdersController, method, principal(level)),
        ).toBe(false);
      }
    });

    it('allows an admin', async () => {
      expect(await isAllowed(OrdersController, method, principal(7))).toBe(
        true,
      );
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

  describe.each(SESSION_ROUTES)('%s (session)', (method) => {
    it('requires AuthenticatedGuard only', () => {
      expect(effectiveGuards(OrdersController, method)).toEqual([
        AuthenticatedGuard,
      ]);
    });

    it('refuses a request without a session', async () => {
      expect(await isAllowed(OrdersController, method, principal(null))).toBe(
        false,
      );
    });

    it('lets a customer session reach the handler', async () => {
      expect(
        await isAllowed(
          OrdersController,
          method,
          accountSession('customer', 1),
        ),
      ).toBe(true);
    });
  });

  describe.each(Object.entries(OPEN_ROUTES))(
    '%s (open)',
    (method, { guards, reason }) => {
      it('carries exactly the declared guard chain and a stated reason', () => {
        expect(effectiveGuards(OrdersController, method)).toEqual(guards);
        expect(reason.trim()).not.toBe('');
      });

      it('answers without a session', async () => {
        expect(await isAllowed(OrdersController, method, principal(null))).toBe(
          true,
        );
      });
    },
  );

  // ─── Handler rule behind the optional guard ───────────────────────────────
  //
  // `getOrderById` is listed open only because its handler refuses on its own.
  // That rule is the access control of the route: it is asserted here so the
  // entry in `OPEN_ROUTES` cannot outlive it.

  describe('getOrderById — session owner only', () => {
    const order = {
      ord_id: 'ORD-1758000000000-123',
      ord_cst_id: 'owner',
      ord_ords_id: '1',
      ord_is_pay: '0',
      customer: null,
      lines: [],
      statusHistory: [],
    };
    const ordersService = { getOrderById: jest.fn(async () => order) };
    const controller = new OrdersController(
      ordersService as never,
      {} as never, // authService — unused on this path
      {} as never, // mailService — unused on this path
      {} as never, // cacheService — unused on this path
    );
    const req = (userId?: string) =>
      ({ user: userId ? { id: userId } : undefined, session: {} }) as never;

    it('answers 404 without a session, even for an existing order', async () => {
      await expect(
        controller.getOrderById(order.ord_id, req()),
      ).rejects.toThrow(NotFoundException);
    });

    it('answers 404 to another account', async () => {
      await expect(
        controller.getOrderById(order.ord_id, req('other')),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the order to its owner', async () => {
      await expect(
        controller.getOrderById(order.ord_id, req('owner')),
      ).resolves.toMatchObject({
        success: true,
        data: { ord_id: order.ord_id },
      });
    });
  });

  // ─── Handler rule behind the session guard ────────────────────────────────
  //
  // `AuthenticatedGuard` proves a session, not that the session owns the order
  // named in the URL. A session route that takes an order id must refuse
  // another account in its handler, before any write. The list is EXHAUSTIVE:
  // a session route with an `:id` added later without an entry fails the test.

  describe('session routes on one order — session owner only', () => {
    const ORDER_ID = 1234567;
    const order = {
      ord_id: String(ORDER_ID),
      ord_cst_id: 'owner',
      ord_ords_id: '1',
      ord_is_pay: '0',
      customer: null,
      lines: [],
      statusHistory: [],
    };
    const req = (userId?: string) =>
      ({ user: userId ? { id: userId } : undefined, session: {} }) as never;

    /** How each handler is called, and the service writes it must not reach. */
    const OWNER_ONLY: Record<
      string,
      (controller: OrdersController, request: never) => Promise<unknown>
    > = {
      updateOrder: (controller, request) =>
        controller.updateOrder(ORDER_ID, { comment: 'note' }, request),
      cancelOrder: (controller, request) =>
        controller.cancelOrder(String(ORDER_ID), request),
    };

    function makeController() {
      const ordersService = {
        getOrderById: jest.fn(async () => order),
        updateOrder: jest.fn(async () => order),
        cancelOrder: jest.fn(async () => order),
      };
      const controller = new OrdersController(
        ordersService as never,
        {} as never, // authService — unused on these paths
        {} as never, // mailService — unused on these paths
        {} as never, // cacheService — unused on these paths
      );
      return { controller, ordersService };
    }

    it('lists every session route that takes an order id', () => {
      const withOrderId = SESSION_ROUTES.filter((method) =>
        String(
          Reflect.getMetadata(
            PATH_METADATA,
            OrdersController.prototype[method as keyof OrdersController],
          ),
        ).includes(':id'),
      );
      expect(withOrderId.sort()).toEqual(Object.keys(OWNER_ONLY).sort());
    });

    describe.each(Object.entries(OWNER_ONLY))('%s', (_method, call) => {
      it.each([
        ['another account', 'other'],
        ['a request without a user', undefined],
      ])('answers 404 to %s, without any write', async (_label, userId) => {
        const { controller, ordersService } = makeController();

        await expect(call(controller, req(userId))).rejects.toThrow(
          NotFoundException,
        );
        expect(ordersService.updateOrder).not.toHaveBeenCalled();
        expect(ordersService.cancelOrder).not.toHaveBeenCalled();
      });
    });
  });
});
