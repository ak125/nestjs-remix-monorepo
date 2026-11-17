/**
 * `api/payments` client and utility routes — access boundary.
 *
 * Three classes:
 * - `admin`   : `AuthenticatedGuard + IsAdminGuard`. Direct payment creation
 *   and reads by order / reference / transactions: the site does not call
 *   them and their handlers do not check the account holder.
 * - `session` : `AuthenticatedGuard`. The handler then applies "own account or
 *   administrator" (`user/:userId`, `:id`, `:id/cancel`) or order ownership
 *   (`proceed-supplement`).
 * - `public`  : `methods/available`, read by the checkout page without a
 *   session cookie.
 *
 * - `gateway` : `PaymentCallbackController`, called by the payment gateway
 *   without a session. Each entry of `GATEWAY_ROUTES` carries the guard chain
 *   it declares and what protects it. No route of that controller reads a
 *   payment for a caller: the payment of an order is read through the
 *   `admin` and `session` routes only.
 *
 * The handler → access map below is EXHAUSTIVE: a handler added later without
 * a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `paybox-supervision-routes-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
 */
import { BadRequestException, ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { PaymentCallbackController } from '../../src/modules/payments/controllers/payment-callback.controller';
import { PaymentCoreController } from '../../src/modules/payments/controllers/payment-core.controller';
import { PaymentMethodsController } from '../../src/modules/payments/controllers/payment-methods.controller';

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

/** `<controller path>/<handler path>` of every route handler of a controller. */
function routePaths(controller: Type<any>): string[] {
  const prefix: string = Reflect.getMetadata(PATH_METADATA, controller);
  return routeHandlers(controller).map((name) => {
    const path: string = Reflect.getMetadata(
      PATH_METADATA,
      controller.prototype[name],
    );
    return path === '/' ? prefix : `${prefix}/${path}`;
  });
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

type Access = { admin: string[]; session: string[]; public: string[] };

/** Controller → handlers by access. Must stay exhaustive. */
const CONTROLLERS: Array<[string, Type<any>, Access]> = [
  [
    'PaymentCoreController',
    PaymentCoreController,
    {
      admin: ['createPayment', 'getOrderPayments', 'getPaymentByReference'],
      session: [
        'getUserPayments',
        'proceedSupplementPayment',
        'getPayment',
        'cancelPayment',
      ],
      public: [],
    },
  ],
  [
    'PaymentMethodsController',
    PaymentMethodsController,
    {
      admin: ['getPaymentTransactions'],
      session: [],
      public: ['getAvailablePaymentMethods'],
    },
  ],
];

/**
 * Routes of `PaymentCallbackController`, reachable without a session on
 * purpose: the caller is the payment gateway. Adding an entry is a decision:
 * state the guard chain the route declares and what protects it. A route that
 * answers with the payment of an order does not belong here.
 */
const GATEWAY_ROUTES: Record<
  string,
  { guards: Array<Type<any>>; reason: string }
> = {
  // POST callback/cyberplus — refused unless SYSTEMPAY_CALLBACK_ENABLED, then
  // the handler checks the gateway signature before any payment change.
  handleCyberplusCallback: {
    guards: [],
    reason:
      'gateway notification: flag then signature (systempay-callback-closure.test.ts)',
  },
  // POST callback/error — refused unless SYSTEMPAY_CALLBACK_ENABLED.
  handleErrorReturn: {
    guards: [],
    reason: 'gateway return: flag (systempay-callback-closure.test.ts)',
  },
};

describe('api/payments client and utility routes — access boundary', () => {
  describe.each(CONTROLLERS)('%s', (_name, controller, access) => {
    it('classifies every route handler', () => {
      expect([...routeHandlers(controller)].sort()).toEqual(
        [...access.admin, ...access.session, ...access.public].sort(),
      );
    });

    if (access.admin.length > 0) {
      describe.each(access.admin)('%s (admin)', (method) => {
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
    }

    if (access.session.length > 0) {
      describe.each(access.session)('%s (session)', (method) => {
        it('requires AuthenticatedGuard only', () => {
          expect(effectiveGuards(controller, method)).toEqual([
            AuthenticatedGuard,
          ]);
        });

        it('refuses a request without a session', async () => {
          expect(await isAllowed(controller, method, principal(null))).toBe(
            false,
          );
        });

        it('lets a customer session reach the handler', async () => {
          expect(
            await isAllowed(controller, method, accountSession('customer', 1)),
          ).toBe(true);
        });
      });
    }

    if (access.public.length > 0) {
      describe.each(access.public)('%s (public)', (method) => {
        it('carries no guard and answers without a session', async () => {
          expect(effectiveGuards(controller, method)).toEqual([]);
          expect(await isAllowed(controller, method, principal(null))).toBe(
            true,
          );
        });
      });
    }
  });

  // ─── Gateway routes ───────────────────────────────────────────────────────

  describe('PaymentCallbackController (gateway)', () => {
    it('classifies every route handler', () => {
      expect([...routeHandlers(PaymentCallbackController)].sort()).toEqual(
        Object.keys(GATEWAY_ROUTES).sort(),
      );
    });

    it.each(Object.entries(GATEWAY_ROUTES))(
      '%s declares the stated guard chain',
      (method, { guards, reason }) => {
        expect(reason).not.toBe('');
        expect(effectiveGuards(PaymentCallbackController, method)).toEqual(
          guards,
        );
      },
    );
  });

  // ─── Payment of an order: who reads it ────────────────────────────────────
  //
  // An order number is not a proof of ownership. No route answers with the
  // payment of an order to a caller that only knows the number.

  describe('payment of an order — read access', () => {
    it('serves no route that returns a payment on an order number alone', () => {
      const served = [
        ...CONTROLLERS.map(([, controller]) => controller),
        PaymentCallbackController,
      ].flatMap(routePaths);
      expect(served).not.toContain('api/payments/callback/success');
      // The read by order number that remains is the administration route.
      expect(served.filter((path) => path.includes(':orderId'))).toEqual([
        'api/payments/order/:orderId',
      ]);
      expect(CONTROLLERS[0][2].admin).toContain('getOrderPayments');
    });

    it('refuses a caller without right: no session, or a customer session', async () => {
      const callers = [
        principal(null),
        accountSession('customer', 1),
        ...HIGH_CUSTOMER_TIERS.map((tier) => accountSession('customer', tier)),
      ];
      for (const caller of callers) {
        expect(
          await isAllowed(PaymentCoreController, 'getOrderPayments', caller),
        ).toBe(false);
      }
      // Without a session, the holder routes are closed as well.
      for (const method of ['getPayment', 'getUserPayments']) {
        expect(
          await isAllowed(PaymentCoreController, method, principal(null)),
        ).toBe(false);
      }
    });

    it('serves the holder: session guard passed, then the handler answers with the payment', async () => {
      const payment = { id: 'pay_1', userId: 'u1', orderId: 'ORD-1' };
      const controller = new PaymentCoreController(
        { getPaymentStatus: jest.fn(async () => payment) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
      const holder = accountSession('customer', 1);

      expect(await isAllowed(PaymentCoreController, 'getPayment', holder)).toBe(
        true,
      );
      await expect(
        controller.getPayment('pay_1', holder as any),
      ).resolves.toEqual({ success: true, data: payment });

      // Same session guard passed by another account: the handler refuses.
      const other = { ...holder, user: { ...holder.user, id: 'u2' } };
      await expect(
        controller.getPayment('pay_1', other as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Handler rule behind the session guard ────────────────────────────────
  //
  // Once a session is required, the handlers' own rule decides: the account
  // holder or an administrator, nobody else.

  describe('PaymentCoreController — own account or administrator', () => {
    const payment = { id: 'pay_1', userId: 'owner', status: 'pending' };
    const paymentService = {
      getPaymentStatus: jest.fn(async () => payment),
      getUserPayments: jest.fn(async () => [payment]),
      cancelPayment: jest.fn(async () => ({ ...payment, status: 'cancelled' })),
    };
    const controller = new PaymentCoreController(
      paymentService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const owner = { user: { id: 'owner', isAdmin: false } };
    const other = { user: { id: 'other', isAdmin: false } };
    const admin = { user: { id: 'staff', isAdmin: true } };

    beforeEach(() => jest.clearAllMocks());

    it('getPayment: holder and admin read it, another account is refused', async () => {
      await expect(controller.getPayment('pay_1', owner)).resolves.toEqual({
        success: true,
        data: payment,
      });
      await expect(controller.getPayment('pay_1', admin)).resolves.toEqual({
        success: true,
        data: payment,
      });
      await expect(controller.getPayment('pay_1', other)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('getUserPayments: holder and admin read the list, another account is refused before any read', async () => {
      await expect(
        controller.getUserPayments('owner', undefined, owner),
      ).resolves.toMatchObject({ success: true, count: 1 });
      await expect(
        controller.getUserPayments('owner', undefined, admin),
      ).resolves.toMatchObject({ success: true, count: 1 });

      paymentService.getUserPayments.mockClear();
      await expect(
        controller.getUserPayments('owner', undefined, other),
      ).rejects.toThrow(BadRequestException);
      expect(paymentService.getUserPayments).not.toHaveBeenCalled();
    });

    it('cancelPayment: another account is refused and nothing is cancelled', async () => {
      await expect(controller.cancelPayment('pay_1', other)).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentService.cancelPayment).not.toHaveBeenCalled();

      await expect(
        controller.cancelPayment('pay_1', owner),
      ).resolves.toMatchObject({ success: true });
      expect(paymentService.cancelPayment).toHaveBeenCalledTimes(1);
    });
  });
});
