/**
 * `api/ai-content/prompts` — access boundary.
 *
 * Every route (read, write, delete and test rendering of prompt templates) is
 * reserved to administrators: `AuthenticatedGuard + IsAdminGuard` on the
 * class, as on `ai-content.controller.ts`.
 *
 * The handler list below is EXHAUSTIVE: a handler added later without a
 * classification fails the test. The guard chain is evaluated for real, with
 * the real handler in the execution context.
 *
 * @see backend/src/auth/is-admin.guard.ts
 * @see backend/src/auth/session-privilege.ts
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
import { PromptTemplateController } from '../../src/modules/ai-content/prompt-template.controller';

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
 * the execution context. An empty chain => allowed (how an unguarded endpoint
 * behaves).
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

// ─── Sessions ───────────────────────────────────────────────────────────────

/**
 * Session opened by an account, built with the rule `AuthService` applies:
 * the stored level is a privilege only for a staff account.
 */
const accountSession = (authSource: AuthSource, storedLevel: number) => ({
  path: '/x',
  isAuthenticated: () => true,
  user: {
    id: '42',
    email: 'someone@example.test',
    level: sessionPrivilegeLevel(authSource, storedLevel),
    isAdmin: isAdminSession(authSource, storedLevel),
    authSource,
  },
});

const anonymous = { path: '/x', isAuthenticated: () => false, user: undefined };

/** Customer tiers that reuse a number of the staff scale (3, 5, 7, 9) or go above it. */
const HIGH_CUSTOMER_TIERS = [3, 5, 7, 9, 10];

// ─── Access contract ────────────────────────────────────────────────────────

const controller = PromptTemplateController;

/** Every handler is admin-only. Must stay exhaustive. */
const ADMIN = [
  'listTemplates',
  'getTemplate',
  'createTemplate',
  'updateTemplate',
  'deleteTemplate',
  'testTemplate',
];

describe('api/ai-content/prompts — access boundary', () => {
  it('classifies every route handler', () => {
    expect([...routeHandlers(controller)].sort()).toEqual([...ADMIN].sort());
  });

  describe.each(ADMIN)('%s', (method) => {
    it('requires AuthenticatedGuard then IsAdminGuard', () => {
      expect(effectiveGuards(controller, method)).toEqual([
        AuthenticatedGuard,
        IsAdminGuard,
      ]);
    });

    it('refuses anonymous, customers of any tier and staff below admin', async () => {
      const refused = [
        anonymous,
        accountSession('admin', 3),
        accountSession('admin', 5),
        ...[1, ...HIGH_CUSTOMER_TIERS].map((tier) =>
          accountSession('customer', tier),
        ),
      ];
      for (const request of refused) {
        expect(await isAllowed(controller, method, request)).toBe(false);
      }
    });

    it('allows an admin', async () => {
      for (const level of [7, 9]) {
        expect(
          await isAllowed(controller, method, accountSession('admin', level)),
        ).toBe(true);
      }
    });
  });
});
