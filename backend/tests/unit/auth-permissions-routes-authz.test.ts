/**
 * Account permission routes — access boundary.
 *
 * `auth/module-access` and `auth/bulk-module-access` answer for an account
 * named in the request body: `AuthenticatedGuard + IsAdminGuard`.
 * `auth/user-permissions/:userId` requires a session; the handler then lets
 * anyone read their own permissions (taken from the session, so a customer id
 * equal to a staff id never yields the staff permissions) and only an admin
 * read another account's.
 *
 * The handler → access map below is EXHAUSTIVE: a handler added later
 * without a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `seo-dynamic-v4-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
 */
import { ExecutionContext, ForbiddenException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { AuthPermissionsController } from '../../src/auth/controllers/auth-permissions.controller';
import {
  ADMIN_PERMISSIONS,
  BASE_USER_PERMISSIONS,
  COMMERCIAL_PERMISSIONS,
} from '../../src/auth/dto/user-permissions.dto';
import { PermissionsService } from '../../src/auth/permissions.service';

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

const controller = AuthPermissionsController;

/** Handlers by access. Must stay exhaustive. */
const ACCESS = {
  admin: ['checkModuleAccess', 'checkBulkModuleAccess'],
  session: ['getUserPermissions'],
};

/** Same session, with the id the account holds in its table. */
const withId = <T extends { user: { id: string } }>(
  session: T,
  id: string,
) => ({
  ...session,
  user: { ...session.user, id },
});

describe('Account permission routes — access boundary', () => {
  it('classifies every route handler', () => {
    expect([...routeHandlers(controller)].sort()).toEqual(
      [...ACCESS.admin, ...ACCESS.session].sort(),
    );
  });

  describe.each(ACCESS.admin)('%s (admin)', (method) => {
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

  describe('getUserPermissions (session, own account or admin)', () => {
    const method = 'getUserPermissions';

    it('requires AuthenticatedGuard', () => {
      expect(effectiveGuards(controller, method)).toEqual([AuthenticatedGuard]);
    });

    it('refuses anonymous, lets any session reach the handler', async () => {
      expect(await isAllowed(controller, method, principal(null))).toBe(false);
      for (const level of [1, 3, 5, 7]) {
        expect(await isAllowed(controller, method, principal(level))).toBe(
          true,
        );
      }
    });

    // The handler rule, with the real PermissionsService and a lookup spy.
    const getUserById = jest.fn();
    const handler = new AuthPermissionsController(
      { getUserById } as any,
      new PermissionsService(),
    );
    const read = (userId: string, session: { user: unknown }) =>
      handler.getUserPermissions(userId, session as any);

    beforeEach(() => {
      getUserById.mockReset();
      // The lookup searches staff first: id 42 is an admin there.
      getUserById.mockResolvedValue({ id: '42', level: 7, isActive: true });
    });

    it('answers own permissions from the session, without a lookup', async () => {
      expect(await read('u1', principal(3))).toEqual(COMMERCIAL_PERMISSIONS);
      expect(await read('u1', principal(1))).toEqual(BASE_USER_PERMISSIONS);
      expect(getUserById).not.toHaveBeenCalled();
    });

    it('never gives a customer the permissions of a staff account with the same id', async () => {
      for (const storedLevel of HIGH_CUSTOMER_TIERS) {
        expect(
          await read(
            '42',
            withId(accountSession('customer', storedLevel), '42'),
          ),
        ).toEqual(BASE_USER_PERMISSIONS);
      }
      expect(getUserById).not.toHaveBeenCalled();
    });

    it('refuses another account to customers and staff below admin', async () => {
      const sessions = [
        principal(1),
        principal(3),
        principal(5),
        ...HIGH_CUSTOMER_TIERS.map((tier) => accountSession('customer', tier)),
      ];
      for (const session of sessions) {
        await expect(read('42', session)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      }
      expect(getUserById).not.toHaveBeenCalled();
    });

    it('lets an admin read another account', async () => {
      expect(await read('42', principal(7))).toEqual(ADMIN_PERMISSIONS);
      expect(await read('42', accountSession('admin', 7))).toEqual(
        ADMIN_PERMISSIONS,
      );
      expect(getUserById).toHaveBeenCalledWith('42');
    });
  });
});
