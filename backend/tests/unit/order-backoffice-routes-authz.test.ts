/**
 * Order back-office routes — access boundary.
 *
 * `commercial/archives`, `order-archive`, `api/tickets` and the per-order
 * routes of `shipping` read, archive, restore or annotate orders. They are
 * staff tools with no customer page behind them: every one requires
 * `AuthenticatedGuard + IsAdminGuard`. `shipping/methods/:zipCode` only reads
 * a tariff by postal code and is the single public route, by design.
 *
 * The handler → access maps below are EXHAUSTIVE: a handler added later
 * without a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `seo-dynamic-v4-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
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
import { CommercialArchivesController } from '../../src/modules/commercial/archives/archives.controller';
import { OrderArchiveController } from '../../src/modules/orders/controllers/order-archive.controller';
import { TicketsController } from '../../src/modules/orders/controllers/tickets.controller';
import { ShippingController } from '../../src/modules/shipping/shipping.controller';

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

type Access = { admin: string[]; public: string[] };

/** Controller → handlers by access. Must stay exhaustive. */
const CONTROLLERS: Array<[string, Type<any>, Access]> = [
  [
    'CommercialArchivesController',
    CommercialArchivesController,
    {
      admin: [
        'getArchives',
        'getArchiveStats',
        'manualArchiveOrder',
        'restoreArchivedOrder',
        'triggerAutoArchive',
        'testService',
      ],
      public: [],
    },
  ],
  [
    'OrderArchiveController',
    OrderArchiveController,
    {
      admin: [
        'getArchivedOrder',
        'listArchivedOrders',
        'exportOrderForPdf',
        'getArchiveStats',
        'archiveOrder',
        'restoreOrder',
        'testArchiveService',
      ],
      public: [],
    },
  ],
  [
    'TicketsController',
    TicketsController,
    {
      admin: [
        'testTicketsService',
        'createPreparationTicket',
        'createCreditNote',
        'validateTicket',
        'useTicket',
        'getOrderTickets',
      ],
      public: [],
    },
  ],
  [
    'ShippingController',
    ShippingController,
    {
      admin: [
        'getAllShipmentsTracking',
        'calculateShippingFee',
        'getDeliveryEstimate',
      ],
      public: ['getShippingMethods'],
    },
  ],
];

describe('Order back-office routes — access boundary', () => {
  describe.each(CONTROLLERS)('%s', (_name, controller, access) => {
    it('classifies every route handler', () => {
      expect([...routeHandlers(controller)].sort()).toEqual(
        [...access.admin, ...access.public].sort(),
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
});
