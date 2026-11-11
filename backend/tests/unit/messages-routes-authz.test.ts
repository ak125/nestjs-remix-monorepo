/**
 * `api/messages` — access boundary and holder rule.
 *
 * Two guard classes:
 * - `admin`   : `AuthenticatedGuard + IsAdminGuard` (`close`, `customers`).
 * - `session` : `AuthenticatedGuard`, then the handler rule: an administrator
 *   reads and acts on every message; a customer only on their own, and their
 *   identifier comes from the session, never from the request. A staff
 *   session below administrator is refused: its identifier is not a customer
 *   identifier.
 *
 * The handler → access map below is EXHAUSTIVE: a handler added later without
 * a classification fails the test.
 *
 * The guard chain is evaluated for real, with the real handler in the
 * execution context (same shape as `payment-core-routes-authz.test.ts`).
 *
 * @see backend/src/auth/is-admin.guard.ts
 * @see backend/src/auth/session-privilege.ts
 */
import { ExecutionContext, NotFoundException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { MessagesController } from '../../src/modules/messages/messages.controller';

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
const accountSession = (
  authSource: AuthSource,
  storedLevel: number,
  id: string,
) => ({
  path: '/x',
  isAuthenticated: () => true,
  user: {
    id,
    email: 'someone@example.test',
    level: sessionPrivilegeLevel(authSource, storedLevel),
    isAdmin: isAdminSession(authSource, storedLevel),
    authSource,
  },
});

const anonymous = { path: '/x', isAuthenticated: () => false, user: undefined };
const customer = (id: string, tier = 1) => accountSession('customer', tier, id);
const admin = accountSession('admin', 7, '900');
const commercial = accountSession('admin', 3, '42');

/** Customer tiers that reuse a number of the staff scale (3, 5, 7, 9) or go above it. */
const HIGH_CUSTOMER_TIERS = [3, 5, 7, 9, 10];

// ─── Access contract ────────────────────────────────────────────────────────

/** Handlers by guard class. Must stay exhaustive. */
const ACCESS = {
  admin: ['closeMessage', 'getCustomers'],
  session: [
    'getMessages',
    'getMessageById',
    'createMessage',
    'markAsRead',
    'getMessageStats',
    'getMessageStatsOverview',
    'archiveMessage',
    'deleteMessage',
    'replyToMessage',
  ],
};

const controller = MessagesController;

// ─── Service double ─────────────────────────────────────────────────────────

const MESSAGE_OF_42 = { id: 'm1', customerId: '42', staffId: '1' };

function build() {
  const service = {
    getMessages: jest
      .fn()
      .mockResolvedValue({ messages: [], total: 0, page: 1, limit: 20 }),
    getMessageById: jest.fn().mockResolvedValue(MESSAGE_OF_42),
    createMessage: jest.fn().mockResolvedValue({ id: 'm2' }),
    closeMessage: jest.fn().mockResolvedValue(MESSAGE_OF_42),
    markAsRead: jest.fn().mockResolvedValue(MESSAGE_OF_42),
    getStatistics: jest
      .fn()
      .mockResolvedValue({ total: 0, open: 0, closed: 0, unread: 0 }),
    getCustomers: jest.fn().mockResolvedValue([]),
    archiveMessage: jest.fn().mockResolvedValue(MESSAGE_OF_42),
    deleteMessage: jest.fn().mockResolvedValue(true),
    replyToMessage: jest.fn().mockResolvedValue({ id: 'm3' }),
  };
  return { service, ctrl: new MessagesController(service as never) };
}

/** HTTP status a handler call ends with (200 when it resolves). */
const status = async (run: () => Promise<unknown>): Promise<number> => {
  try {
    await run();
    return 200;
  } catch (error) {
    return (error as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};

type Call = (ctrl: MessagesController, request: any) => Promise<unknown>;

// ─── Guards ─────────────────────────────────────────────────────────────────

describe('api/messages — access boundary', () => {
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

    it('refuses anonymous, customers of any tier and staff below admin', async () => {
      const refused = [
        anonymous,
        commercial,
        accountSession('admin', 5, '43'),
        ...[1, ...HIGH_CUSTOMER_TIERS].map((tier) => customer('42', tier)),
      ];
      for (const request of refused) {
        expect(await isAllowed(controller, method, request)).toBe(false);
      }
    });

    it('allows an admin', async () => {
      expect(await isAllowed(controller, method, admin)).toBe(true);
    });
  });

  describe.each(ACCESS.session)('%s (session)', (method) => {
    it('requires AuthenticatedGuard only', () => {
      expect(effectiveGuards(controller, method)).toEqual([AuthenticatedGuard]);
    });

    it('refuses a request without a session', async () => {
      expect(await isAllowed(controller, method, anonymous)).toBe(false);
    });

    it('lets a customer session reach the handler', async () => {
      expect(await isAllowed(controller, method, customer('42'))).toBe(true);
    });
  });
});

// ─── Holder rule ────────────────────────────────────────────────────────────

describe('api/messages — holder rule', () => {
  /** Every session-class handler, called for customer 42 or message m1. */
  const CALLS: Array<[string, Call]> = [
    ['getMessages', (c, r) => c.getMessages(r)],
    ['getMessageById', (c, r) => c.getMessageById(r, 'm1')],
    [
      'createMessage',
      (c, r) =>
        c.createMessage(r, {
          customerId: '42',
          staffId: '1',
          subject: 's',
          content: 'c',
        }),
    ],
    ['markAsRead', (c, r) => c.markAsRead(r, 'm1', {})],
    ['getMessageStats', (c, r) => c.getMessageStats(r)],
    ['getMessageStatsOverview', (c, r) => c.getMessageStatsOverview(r)],
    ['archiveMessage', (c, r) => c.archiveMessage(r, 'm1', { userId: '42' })],
    ['deleteMessage', (c, r) => c.deleteMessage(r, 'm1', { userId: '42' })],
    [
      'replyToMessage',
      (c, r) => c.replyToMessage(r, 'm1', { userId: '42', content: 'c' }),
    ],
  ];

  it('covers every session-class handler', () => {
    expect(CALLS.map(([name]) => name).sort()).toEqual(
      [...ACCESS.session].sort(),
    );
  });

  describe.each(CALLS)('%s', (_name, call) => {
    it('refuses a staff session below administrator, even with the id of a customer', async () => {
      const { ctrl, service } = build();
      expect(await status(() => call(ctrl, commercial))).toBe(403);
      for (const fn of Object.values(service)) {
        expect(fn).not.toHaveBeenCalled();
      }
    });

    it('serves the holder, whatever the tier of the account', async () => {
      for (const tier of [1, ...HIGH_CUSTOMER_TIERS]) {
        const { ctrl } = build();
        expect(await status(() => call(ctrl, customer('42', tier)))).toBe(200);
      }
    });

    it('serves an administrator', async () => {
      const { ctrl } = build();
      expect(await status(() => call(ctrl, admin))).toBe(200);
    });
  });

  describe('list', () => {
    it('binds a customer to their own messages when no customer is named', async () => {
      const { ctrl, service } = build();
      await ctrl.getMessages(customer('42') as never);
      expect(service.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: '42' }),
      );
    });

    it('refuses a customer naming another customer', async () => {
      const { ctrl, service } = build();
      expect(
        await status(() =>
          ctrl.getMessages(customer('42') as never, '1', '20', undefined, '43'),
        ),
      ).toBe(403);
      expect(service.getMessages).not.toHaveBeenCalled();
    });

    it('lets an administrator read all messages or those of a named customer', async () => {
      const { ctrl, service } = build();
      await ctrl.getMessages(admin as never);
      expect(service.getMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ customerId: undefined }),
      );
      await ctrl.getMessages(admin as never, '1', '20', undefined, '43');
      expect(service.getMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ customerId: '43' }),
      );
    });
  });

  describe('single message', () => {
    it('answers "not found" to a customer who is not the holder', async () => {
      const { ctrl } = build();
      expect(
        await status(() => ctrl.getMessageById(customer('43') as never, 'm1')),
      ).toBe(404);
    });

    it('does not mark as read the message of another customer', async () => {
      const { ctrl, service } = build();
      expect(
        await status(() => ctrl.markAsRead(customer('43') as never, 'm1', {})),
      ).toBe(404);
      expect(service.markAsRead).not.toHaveBeenCalled();
    });

    it('records the session customer as reader, not the body', async () => {
      const { ctrl, service } = build();
      await ctrl.markAsRead(customer('42') as never, 'm1', {
        readerId: '999',
      });
      expect(service.markAsRead).toHaveBeenCalledWith('m1', '42');
    });

    it('keeps "not found" for a missing message', async () => {
      const { ctrl, service } = build();
      service.getMessageById.mockRejectedValue(new NotFoundException());
      expect(
        await status(() => ctrl.getMessageById(customer('42') as never, 'x')),
      ).toBe(404);
      expect(
        await status(() => ctrl.markAsRead(customer('42') as never, 'x')),
      ).toBe(404);
    });
  });

  describe('create', () => {
    it('writes the session customer when the body names none', async () => {
      const { ctrl, service } = build();
      await ctrl.createMessage(customer('42') as never, {
        staffId: '1',
        subject: 's',
        content: 'c',
      });
      expect(service.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: '42' }),
      );
    });

    it('refuses a customer writing in the name of another customer', async () => {
      const { ctrl, service } = build();
      expect(
        await status(() =>
          ctrl.createMessage(customer('42') as never, {
            customerId: '43',
            staffId: '1',
            subject: 's',
            content: 'c',
          }),
        ),
      ).toBe(403);
      expect(service.createMessage).not.toHaveBeenCalled();
    });

    it('requires an administrator to name the customer', async () => {
      const { ctrl, service } = build();
      expect(
        await status(() =>
          ctrl.createMessage(admin as never, {
            staffId: '1',
            subject: 's',
            content: 'c',
          }),
        ),
      ).toBe(400);
      expect(service.createMessage).not.toHaveBeenCalled();
    });
  });

  type HolderAction = (
    ctrl: MessagesController,
    request: any,
    body?: { userId?: string },
  ) => Promise<unknown>;

  const HOLDER_ACTIONS: Array<
    ['archiveMessage' | 'deleteMessage' | 'replyToMessage', HolderAction]
  > = [
    ['archiveMessage', (c, r, body) => c.archiveMessage(r, 'm1', body)],
    ['deleteMessage', (c, r, body) => c.deleteMessage(r, 'm1', body)],
    [
      'replyToMessage',
      (c, r, body) => c.replyToMessage(r, 'm1', { ...body, content: 'c' }),
    ],
  ];

  describe.each(HOLDER_ACTIONS)('%s', (serviceMethod, call) => {
    it('passes the session customer to the service, with or without a body id', async () => {
      for (const body of [undefined, {}, { userId: '42' }]) {
        const { ctrl, service } = build();
        await call(ctrl, customer('42'), body);
        expect(service[serviceMethod].mock.calls[0].slice(0, 2)).toEqual([
          'm1',
          '42',
        ]);
      }
    });

    it('refuses a customer naming another customer', async () => {
      const { ctrl, service } = build();
      expect(
        await status(() => call(ctrl, customer('43'), { userId: '42' })),
      ).toBe(403);
      expect(service[serviceMethod]).not.toHaveBeenCalled();
    });

    it('requires an administrator to name the customer', async () => {
      const { ctrl, service } = build();
      expect(await status(() => call(ctrl, admin, {}))).toBe(400);
      expect(service[serviceMethod]).not.toHaveBeenCalled();
    });
  });

  it('requires a reply content', async () => {
    const { ctrl, service } = build();
    expect(
      await status(() =>
        ctrl.replyToMessage(customer('42') as never, 'm1', {}),
      ),
    ).toBe(400);
    expect(service.replyToMessage).not.toHaveBeenCalled();
  });

  describe('statistics', () => {
    it('gives a customer their own figures, an administrator the global ones', async () => {
      const { ctrl, service } = build();
      await ctrl.getMessageStatsOverview(customer('42') as never);
      expect(service.getStatistics).toHaveBeenLastCalledWith('42');
      await ctrl.getMessageStatsOverview(admin as never);
      expect(service.getStatistics).toHaveBeenLastCalledWith(undefined);
    });

    it('refuses a customer asking for the figures of another customer', async () => {
      const { ctrl, service } = build();
      expect(
        await status(() => ctrl.getMessageStats(customer('42') as never, '43')),
      ).toBe(403);
      expect(service.getStatistics).not.toHaveBeenCalled();
    });
  });
});

// ─── Route declaration order ────────────────────────────────────────────────

describe('api/messages — route declaration order', () => {
  /** NestJS registers handlers in declaration order; the first match wins. */
  const declared = routeHandlers(controller).map((name) => ({
    name,
    verb: Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]),
    path: String(
      Reflect.getMetadata(PATH_METADATA, controller.prototype[name]),
    ),
  }));

  /** `:id` captures any one-segment path declared after it. */
  const captures = (pattern: string, path: string): boolean => {
    const wanted = pattern.split('/');
    const given = path.split('/');
    return (
      wanted.length === given.length &&
      wanted.every((part, i) => part.startsWith(':') || part === given[i])
    );
  };

  it.each(['getMessageStats', 'getMessageStatsOverview', 'getCustomers'])(
    '%s is not captured by a parameter route declared before it',
    (name) => {
      const index = declared.findIndex((route) => route.name === name);
      const target = declared[index];

      expect(index).toBeGreaterThanOrEqual(0);
      expect(target.path).not.toContain(':');
      const shadowing = declared
        .slice(0, index)
        .filter(
          (route) =>
            route.verb === target.verb &&
            route.path.includes(':') &&
            captures(route.path, target.path),
        )
        .map((route) => route.name);
      expect(shadowing).toEqual([]);
    },
  );
});

// ─── Status filter ──────────────────────────────────────────────────────────

describe('api/messages — status filter', () => {
  const list = (ctrl: MessagesController, value?: string) =>
    ctrl.getMessages(
      admin as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      value,
    );

  it.each(['all', 'open', 'closed', 'unread'])(
    'passes %s to the service',
    async (value) => {
      const { ctrl, service } = build();
      await list(ctrl, value);
      expect(service.getMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: value }),
      );
    },
  );

  it.each([undefined, ''])(
    'lists every message without a status (%p)',
    async (value) => {
      const { ctrl, service } = build();
      await list(ctrl, value);
      expect(service.getMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'all' }),
      );
    },
  );

  it('refuses an unknown status instead of reading it as another one', async () => {
    const { ctrl, service } = build();
    expect(await status(() => list(ctrl, 'system'))).toBe(400);
    expect(service.getMessages).not.toHaveBeenCalled();
  });
});
