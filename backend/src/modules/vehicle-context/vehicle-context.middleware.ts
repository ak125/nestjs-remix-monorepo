import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { NextFunction, Request, Response } from 'express';
import { VEHICLE_CTX_COOKIE_NAME } from '@repo/registry';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { VehicleContextService } from './vehicle-context.service';

/**
 * VehicleContextMiddleware — wires the JWS cookie into `req.vehicleContext`.
 *
 * Mount points : narrow routes only (canon : minimise surface). Wired to
 * `/api/diagnostic/*` and `/api/v1/orientation/*` from
 * `vehicle-context.module.ts`. Anything outside that scope receives no
 * context and the cookie is ignored.
 *
 * On invalid cookie : emits `vehicle_ctx_invalid` (with reason) and does
 * NOT short-circuit (silent fallback, never 401). Anonymous browsing must
 * keep working.
 */
@Injectable()
export class VehicleContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(VehicleContextMiddleware.name);

  constructor(
    private readonly service: VehicleContextService,
    private readonly events: EventEmitter2,
    private readonly flags: FeatureFlagsService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    // PR-B.6 — Kill-switch. When `VEHICLE_CTX_ENABLED=false` (or runtime
    // override), the middleware short-circuits to a pass-through. Existing
    // cookies are NOT cleared (so re-enabling restores prior sessions).
    if (!this.flags.vehicleContextEnabled) {
      next();
      return;
    }

    const token = readCookie(req.headers.cookie, VEHICLE_CTX_COOKIE_NAME);

    // Absent cookie : nothing to do. NOT an invalid event — only present-but-broken
    // cookies count as invalid (canon : alert signal must mean real anomaly).
    if (token === undefined) {
      next();
      return;
    }

    const result = await this.service.verifyToken(token);

    if (result.ok === true) {
      req.vehicleContext = result.ctx;
    } else {
      this.events.emit('vehicle_ctx_invalid', { reason: result.reason });
    }

    next();
  }
}

/**
 * Minimal RFC-6265 cookie reader. Extracts the value of `name` from a raw
 * `Cookie:` header. Stays in this file (private helper, no public surface
 * justifying a new package — canon `feedback_verify_existing_first` :
 * avoid adding a new dep when 6 lines do the job for a single use site).
 */
function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  const needle = `${name}=`;
  for (const pair of header.split(';')) {
    const trimmed = pair.trim();
    if (trimmed.startsWith(needle)) {
      return decodeURIComponent(trimmed.slice(needle.length));
    }
  }
  return undefined;
}
