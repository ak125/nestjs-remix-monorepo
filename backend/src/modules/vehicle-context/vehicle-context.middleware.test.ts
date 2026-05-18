/**
 * PR-B.2 — VehicleContextMiddleware unit tests.
 *
 * Pure-unit : no NestJS Test module needed. We construct the service +
 * middleware directly with stubbed ConfigService / EventEmitter2 to exercise
 * the cookie → req.vehicleContext path without a running HTTP server.
 */

import type { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  signVehicleContext,
  VEHICLE_CTX_COOKIE_NAME,
} from '@repo/registry';
import type { FeatureFlagsService } from '../../config/feature-flags.service';
import { VehicleContextMiddleware } from './vehicle-context.middleware';
import { VehicleContextService } from './vehicle-context.service';

const SECRET_RAW = 'test-secret-must-be-at-least-32-chars-long-xyz';
const SECRET = new TextEncoder().encode(SECRET_RAW);

const stubConfig = (): ConfigService =>
  ({
    getOrThrow: (key: string) => {
      if (key === 'JWT_SECRET') return SECRET_RAW;
      throw new Error(`unexpected key ${key}`);
    },
  }) as unknown as ConfigService;

const stubFlags = (enabled: boolean): FeatureFlagsService =>
  ({ vehicleContextEnabled: enabled }) as unknown as FeatureFlagsService;

function makeReq(cookieHeader?: string): {
  headers: { cookie?: string };
  vehicleContext?: unknown;
} {
  const req: { headers: { cookie?: string }; vehicleContext?: unknown } = {
    headers: {},
  };
  if (cookieHeader !== undefined) req.headers.cookie = cookieHeader;
  return req;
}

describe('VehicleContextMiddleware', () => {
  let service: VehicleContextService;
  let events: EventEmitter2;
  let middleware: VehicleContextMiddleware;
  let emittedEvents: Array<{ name: string; payload: unknown }>;

  beforeEach(() => {
    events = new EventEmitter2();
    emittedEvents = [];
    events.onAny((eventName, payload) => {
      emittedEvents.push({
        name: String(eventName),
        payload,
      });
    });
    service = new VehicleContextService(stubConfig(), events);
    middleware = new VehicleContextMiddleware(service, events, stubFlags(true));
  });

  test('absent cookie : req.vehicleContext stays undefined, no event emitted', async () => {
    const req = makeReq();
    const next = jest.fn();
    await middleware.use(req as never, {} as never, next);
    expect(req.vehicleContext).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(emittedEvents.filter((e) => e.name.startsWith('vehicle_ctx_'))).toHaveLength(
      0,
    );
  });

  test('valid cookie : req.vehicleContext populated', async () => {
    const token = await signVehicleContext({
      payload: { source: 'diagnostic', brand_slug: 'audi', type_id: 12345 },
      secret: SECRET,
    });
    const req = makeReq(`${VEHICLE_CTX_COOKIE_NAME}=${token}; other=bar`);
    const next = jest.fn();

    await middleware.use(req as never, {} as never, next);

    expect(req.vehicleContext).toMatchObject({
      v: 1,
      source: 'diagnostic',
      brand_slug: 'audi',
      type_id: 12345,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('valid cookie : iat field present', async () => {
    const token = await signVehicleContext({
      payload: { source: 'manual' },
      secret: SECRET,
    });
    const req = makeReq(`${VEHICLE_CTX_COOKIE_NAME}=${token}`);
    await middleware.use(req as never, {} as never, jest.fn());
    expect(typeof (req.vehicleContext as { iat?: number }).iat).toBe('number');
  });

  test('cookie present but malformed : emits vehicle_ctx_invalid, req unchanged', async () => {
    const req = makeReq(`${VEHICLE_CTX_COOKIE_NAME}=not.a.real.jwt`);
    const next = jest.fn();
    await middleware.use(req as never, {} as never, next);
    expect(req.vehicleContext).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    const invalid = emittedEvents.find((e) => e.name === 'vehicle_ctx_invalid');
    expect(invalid).toBeDefined();
    expect(invalid?.payload).toMatchObject({ reason: 'bad_signature' });
  });

  test('cookie signed with another secret : emits vehicle_ctx_invalid', async () => {
    const otherToken = await signVehicleContext({
      payload: { source: 'gsc' },
      secret: new TextEncoder().encode(
        'different-secret-also-32-chars-or-more-abcd',
      ),
    });
    const req = makeReq(`${VEHICLE_CTX_COOKIE_NAME}=${otherToken}`);
    await middleware.use(req as never, {} as never, jest.fn());
    expect(req.vehicleContext).toBeUndefined();
    const invalid = emittedEvents.find((e) => e.name === 'vehicle_ctx_invalid');
    expect(invalid).toBeDefined();
  });

  test('always calls next() (silent fallback, never 401)', async () => {
    for (const header of [
      undefined,
      '',
      `${VEHICLE_CTX_COOKIE_NAME}=`,
      `${VEHICLE_CTX_COOKIE_NAME}=invalid`,
      `other=foo`,
    ]) {
      const req = makeReq(header);
      const next = jest.fn();
      await middleware.use(req as never, {} as never, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  test('VehicleContextService.persist signs + sets cookie + emits vehicle_ctx_set', async () => {
    const cookies: Array<{ name: string; value: string; options: unknown }> = [];
    const res = {
      req: { secure: false },
      cookie: (name: string, value: string, options: unknown) => {
        cookies.push({ name, value, options });
      },
    } as never;

    await service.persist({ source: 'diagnostic', type_id: 999 }, res);

    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe(VEHICLE_CTX_COOKIE_NAME);
    expect(cookies[0].value.split('.')).toHaveLength(3); // JWS compact form
    expect(cookies[0].options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    const setEvent = emittedEvents.find((e) => e.name === 'vehicle_ctx_set');
    expect(setEvent).toBeDefined();
    expect(setEvent?.payload).toMatchObject({
      source: 'diagnostic',
      type_id_present: true,
    });
  });

  test('VehicleContextService.clear clears cookie with right path', () => {
    const cleared: Array<{ name: string; options: unknown }> = [];
    const res = {
      clearCookie: (name: string, options: unknown) => {
        cleared.push({ name, options });
      },
    } as never;
    service.clear(res);
    expect(cleared).toEqual([
      { name: VEHICLE_CTX_COOKIE_NAME, options: { path: '/' } },
    ]);
  });

  test('kill-switch off : middleware passes through, valid cookie is ignored', async () => {
    const offMiddleware = new VehicleContextMiddleware(
      service,
      events,
      stubFlags(false),
    );
    const token = await signVehicleContext({
      payload: { source: 'diagnostic' },
      secret: SECRET,
    });
    const req = makeReq(`${VEHICLE_CTX_COOKIE_NAME}=${token}`);
    const next = jest.fn();

    await offMiddleware.use(req as never, {} as never, next);

    expect(req.vehicleContext).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    // No vehicle_ctx_* events emitted while flag is off (no set, no invalid, no consumed).
    expect(
      emittedEvents.filter((e) => e.name.startsWith('vehicle_ctx_')),
    ).toHaveLength(0);
  });
});
