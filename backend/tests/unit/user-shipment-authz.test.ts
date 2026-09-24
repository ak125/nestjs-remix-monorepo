/**
 * « Mes expéditions » (`GET api/users/:userId/shipments[/stats]`) — access boundary.
 *
 * Every handler of this controller must:
 *   - require an authenticated session (`AuthenticatedGuard`), and
 *   - serve only the session's own account: a `:userId` that is not the
 *     session user answers 404 (same rule as the `api/orders` owner checks),
 *     WITHOUT calling the service.
 *
 * The refusal happens before the handler's try/catch, so it cannot be turned
 * into a 200 `success: false` response.
 *
 * Handlers are enumerated from NestJS route metadata, so a route added later
 * without the boundary fails this test.
 *
 * @see backend/tests/unit/internal-routes-authz.test.ts (same test shape)
 */
import { ExecutionContext, Type } from '@nestjs/common';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { UserShipmentController } from '../../src/modules/users/controllers/user-shipment.controller';
import { UserShipmentService } from '../../src/modules/users/services/user-shipment.service';

// NestJS reflection keys (`@nestjs/common/constants` — stable literals).
const GUARDS_METADATA = '__guards__';
const METHOD_METADATA = 'method';
const ROUTE_ARGS_METADATA = '__routeArguments__';

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

/** Runs the applied guard chain. An empty chain => allowed. */
function isAllowed(method: string, request: any): boolean {
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => UserShipmentController.prototype[method],
    getClass: () => UserShipmentController,
  } as unknown as ExecutionContext;
  for (const Guard of effectiveGuards(UserShipmentController, method)) {
    if (new Guard().canActivate(ctx) !== true) return false;
  }
  return true;
}

/** Route argument metadata of a handler, keyed by parameter index. */
function routeArgs(method: string): Record<number, any> {
  const raw: Record<string, any> =
    Reflect.getMetadata(ROUTE_ARGS_METADATA, UserShipmentController, method) ||
    {};
  const byIndex: Record<number, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    byIndex[value.index] = { key, ...value };
  }
  return byIndex;
}

function makeController() {
  const service = {
    getUserShipments: jest
      .fn()
      .mockResolvedValue({ success: true, shipments: [], count: 0 }),
    getUserShipmentStats: jest.fn().mockResolvedValue({
      total: 0,
      inTransit: 0,
      outForDelivery: 0,
      delivered: 0,
      shipped: 0,
    }),
  };
  const controller = new UserShipmentController(
    service as unknown as UserShipmentService,
  );
  return { controller, service };
}

/** Handler name → the service method it must delegate to. */
const SERVICE_CALL: Record<string, keyof UserShipmentService> = {
  getUserShipments: 'getUserShipments',
  getUserShipmentStats: 'getUserShipmentStats',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/users/:userId/shipments — owner only', () => {
  const handlers = routeHandlers(UserShipmentController);

  it('checks exactly the two shipment routes', () => {
    // A new route must be added here on purpose, with its own boundary test.
    expect([...handlers].sort()).toEqual([
      'getUserShipmentStats',
      'getUserShipments',
    ]);
  });

  it.each(handlers)('%s requires a session (AuthenticatedGuard)', (method) => {
    expect(effectiveGuards(UserShipmentController, method)).toContain(
      AuthenticatedGuard,
    );
    expect(
      isAllowed(method, { path: '/x', isAuthenticated: () => false }),
    ).toBe(false);
    expect(
      isAllowed(method, {
        path: '/x',
        isAuthenticated: () => true,
        user: { id: '42' },
      }),
    ).toBe(true);
  });

  it.each(handlers)(
    '%s compares the URL :userId with the SESSION user id',
    (method) => {
      const args = routeArgs(method);

      // 1st argument: the URL parameter.
      expect(args[0].key).toBe(`${RouteParamtypes.PARAM}:0`);
      expect(args[0].data).toBe('userId');

      // 2nd argument: resolved from the session principal, not from the request input.
      expect(typeof args[1].factory).toBe('function');
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { userId: '43' },
            query: { id: '43' },
            user: { id: '42' },
          }),
        }),
      } as unknown as ExecutionContext;
      expect(args[1].factory(args[1].data, ctx)).toBe('42');
    },
  );

  it.each(handlers)(
    '%s answers 404 for another account, without calling the service',
    async (method) => {
      const { controller, service } = makeController();

      await expect(
        (controller as any)[method]('42', '43'),
      ).rejects.toMatchObject({ status: 404 });
      await expect((controller as any)[method]('42', 43)).rejects.toMatchObject(
        { status: 404 },
      );

      expect(service[SERVICE_CALL[method]]).not.toHaveBeenCalled();
    },
  );

  it.each(handlers)(
    '%s answers 404 when the session has no usable id',
    async (method) => {
      const { controller, service } = makeController();

      for (const sessionId of [undefined, null, {}, '']) {
        await expect(
          (controller as any)[method]('undefined', sessionId),
        ).rejects.toMatchObject({ status: 404 });
      }
      await expect((controller as any)[method]('', '')).rejects.toMatchObject({
        status: 404,
      });

      expect(service[SERVICE_CALL[method]]).not.toHaveBeenCalled();
    },
  );

  it.each(handlers)(
    '%s serves the session’s own account (string or numeric id)',
    async (method) => {
      const { controller, service } = makeController();

      await expect(
        (controller as any)[method]('42', '42'),
      ).resolves.toMatchObject({ success: true });
      await expect(
        (controller as any)[method]('42', 42),
      ).resolves.toMatchObject({ success: true });

      expect(service[SERVICE_CALL[method]]).toHaveBeenCalledTimes(2);
      expect(service[SERVICE_CALL[method]]).toHaveBeenCalledWith('42');
    },
  );
});
