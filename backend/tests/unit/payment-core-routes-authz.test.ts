/**
 * `api/payments` client and utility routes — access boundary.
 *
 * Three classes:
 * - `admin`   : `AuthenticatedGuard + IsAdminGuard`. Direct payment creation,
 *   reads by order / reference / transactions and the test route: the site
 *   does not call them and their handlers do not check the account holder.
 * - `session` : `AuthenticatedGuard`. The handler then applies "own account or
 *   administrator" (`user/:userId`, `:id`, `:id/cancel`) or order ownership
 *   (`proceed-supplement`).
 * - `public`  : `methods/available`, read by the checkout page without a
 *   session cookie.
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
import { PaymentCoreController } from '../../src/modules/payments/controllers/payment-core.controller';
import { PaymentMethodsController } from '../../src/modules/payments/controllers/payment-methods.controller';

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
      admin: ['testCreatePaymentWithConsignes', 'getPaymentTransactions'],
      session: [],
      public: ['getAvailablePaymentMethods'],
    },
  ],
];

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
