import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request, Response } from 'express';
import {
  signVehicleContext,
  verifyVehicleContext,
  VEHICLE_CTX_COOKIE_NAME,
  VEHICLE_CTX_COOKIE_MAX_AGE_SECONDS,
  type VehicleContext,
  type VehicleContextPayload,
} from '@repo/registry';
import {
  TARGET_DOMAIN,
  type VehicleContextPort,
} from '../diagnostic-engine/ports/vehicle-context.port';

/**
 * VehicleContextService — D4 implementation of VehicleContextPort.
 *
 * Canon : `feedback_vehicle_context_option_a_locked.md`. Cookie-only state,
 * never DB. JWS HS256 over the canonical `JWT_SECRET`. Events emitted to
 * the NestJS event bus so PR-C can wire Prometheus counters without
 * coupling D4 to prom-client.
 */
@Injectable()
export class VehicleContextService implements VehicleContextPort {
  static readonly TARGET_DOMAIN = TARGET_DOMAIN;

  private readonly logger = new Logger(VehicleContextService.name);
  private readonly secret: Uint8Array;

  constructor(
    config: ConfigService,
    private readonly events: EventEmitter2,
  ) {
    const raw = config.getOrThrow<string>('JWT_SECRET');
    this.secret = new TextEncoder().encode(raw);
  }

  /**
   * Read context already attached to the request by the middleware.
   * Returns null if the cookie was absent or invalid.
   */
  get(req: Request): VehicleContext | null {
    return req.vehicleContext ?? null;
  }

  /**
   * Sign + set the cookie + emit `vehicle_ctx_set`. The caller MUST `await`
   * this before sending the response.
   */
  async persist(payload: VehicleContextPayload, res: Response): Promise<void> {
    const token = await signVehicleContext({ payload, secret: this.secret });

    res.cookie(VEHICLE_CTX_COOKIE_NAME, token, {
      httpOnly: true,
      secure: res.req?.secure === true,
      sameSite: 'lax',
      path: '/',
      maxAge: VEHICLE_CTX_COOKIE_MAX_AGE_SECONDS * 1000,
    });

    this.events.emit('vehicle_ctx_set', {
      source: payload.source,
      type_id_present: typeof payload.type_id === 'number',
    });
  }

  /**
   * Clear the cookie. Used on logout or explicit user reset.
   * Does NOT emit an event — clearance is not part of the funnel signal.
   */
  clear(res: Response): void {
    res.clearCookie(VEHICLE_CTX_COOKIE_NAME, { path: '/' });
  }

  /**
   * Internal — used by the middleware. Verifies a raw cookie value and
   * returns either the parsed context or a structured invalid-reason for
   * observability. Never throws.
   */
  async verifyToken(
    token: string | undefined,
  ): Promise<
    | { ok: true; ctx: VehicleContext }
    | { ok: false; reason: 'empty' | 'bad_signature' | 'bad_schema' }
  > {
    if (!token) {
      return { ok: false, reason: 'empty' };
    }
    const parsed = await verifyVehicleContext({ token, secret: this.secret });
    if (parsed === null) {
      // jose collapses bad signature / bad schema / bad version into null.
      // V1 keeps a single bucket; PR-C may split with richer error data
      // from a custom verify wrapper.
      return { ok: false, reason: 'bad_signature' };
    }
    return { ok: true, ctx: parsed };
  }

  /** Surface the configured cookie name to consumers (constants stay in @repo/registry). */
  readonly cookieName = VEHICLE_CTX_COOKIE_NAME;
}
