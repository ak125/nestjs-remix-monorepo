import type { DomainId } from '@repo/registry';
import type { Request, Response } from 'express';

/**
 * VehicleContextPort — All domains → VehicleDomain (D4 Vehicle / Compatibility).
 *
 * Provides VehicleContext (OPTION A : runtime navigation context léger éphémère,
 * canon `feedback_vehicle_context_option_a_locked.md`).
 *
 * STRICT INVARIANTS (verrou OPTION A) :
 * - VehicleContext = navigation context only, never source of truth
 * - Mileage_km est un hint, jamais une décision authority pour maintenance
 * - Schema v: 1 figé (cookie versioning obligatoire)
 * - Forbidden: user_preferences, vehicle_history, ownership, maintenance_state
 *
 * Implementation lives in `backend/src/modules/vehicle/middleware/` (D4).
 * Persistence via signed JWS cookie HttpOnly SameSite=Lax 90j (PR-B).
 *
 * Feature flag : `vehicle_ctx_enabled` (GrowthBook, default true).
 * Metrics : `vehicle_ctx_set_total` / `_invalid_total` / `_consumed_total`.
 */

export interface VehicleContext {
  readonly v: 1; // schema version, MUST be 1 in V1
  readonly type_id?: number;
  readonly brand_slug?: string;
  readonly model_slug?: string;
  readonly engine_slug?: string;
  readonly year?: number;
  readonly mileage_km?: number;
  readonly source: 'diagnostic' | 'manual' | 'gsc';
  readonly iat: number; // issued-at timestamp
}

export interface VehicleContextPort {
  /** Read current context from request (cookie + middleware exposed). Returns null if absent/invalid. */
  get(req: Request): VehicleContext | null;

  /**
   * Persist context as signed cookie on response. PR-B implementation.
   * Async because HS256 signing (jose `SignJWT.sign()`) is Promise-based —
   * callers MUST await before `res.send()` to guarantee the Set-Cookie
   * header lands on the response. Pre-merge correction to PR-A.1 port
   * (no consumers in main yet — signature widened from `void` to
   * `Promise<void>` to surface the async nature).
   */
  persist(ctx: Omit<VehicleContext, 'v' | 'iat'>, res: Response): Promise<void>;

  /** Clear cookie (logout / reset). */
  clear(res: Response): void;
}

export const VEHICLE_CONTEXT_PORT = Symbol.for(
  'DiagnosticDomain.VehicleContextPort',
);

export const TARGET_DOMAIN: DomainId = 'D4';
