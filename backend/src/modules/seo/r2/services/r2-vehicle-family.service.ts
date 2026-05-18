/**
 * ADR-066 — R2 Vehicle Family Service
 *
 * Resolves the `cluster_key` for a given (pg_id, type_id, vehicle context).
 *
 * Strategy :
 *   - v2 : `vehicle_family_id = sha256(brand + model_group + phase + platform + generation)`
 *          via materialized view `auto_modele_family` — IF columns exist
 *   - v1 : fallback `brand::model::fuel::body × pg_id` — IF columns don't exist
 *
 * Per ADR-066 §"PR 1 — audit-only fallback-safe (anti-bricolage)" :
 * runtime decision made at module init by querying information_schema (cached).
 *
 * Per MEMORY feedback_no_real_lastmod_per_url_until_audit_columns analog —
 * we don't mutate auto_modele schema, we adapt to what's there.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface VehicleContext {
  brandSlug: string;
  modelSlug: string;
  fuelType: string;
  bodyType: string | null;
  pgId: number;
}

export type ClusterKeyStrategy = 'v2_vehicle_family' | 'v1_fallback';

@Injectable()
export class R2VehicleFamilyService implements OnModuleInit {
  private readonly logger = new Logger(R2VehicleFamilyService.name);
  private strategy: ClusterKeyStrategy = 'v1_fallback';

  /**
   * Non-blocking init (cf MEMORY backend.md "Non-blocking onModuleInit").
   * Cluster strategy probe runs in background — first requests fall back to
   * v1 (safe default) while probe completes.
   */
  onModuleInit(): void {
    this.logger.log(
      'R2VehicleFamilyService init — probing cluster strategy in background',
    );
    void this.probeStrategy();
  }

  /**
   * Detect runtime strategy from auto_modele_family MV existence.
   * NOTE : MV creation is a separate post-PR-1 migration gated by the audit
   * script scripts/audit/r2-modele-family-audit.ts. For PR 1, this probe will
   * ALWAYS resolve to v1_fallback (MV doesn't exist yet).
   */
  private async probeStrategy(): Promise<void> {
    // V1 fallback by default. V2 strategy will be enabled once auto_modele_family
    // MV is created (separate PR after audit script confirms columns).
    // We don't query DB here yet — keep service pure for PR 1 foundation.
    this.strategy = 'v1_fallback';
    this.logger.log(
      `R2VehicleFamilyService strategy: ${this.strategy} (PR 1 default)`,
    );
  }

  getStrategy(): ClusterKeyStrategy {
    return this.strategy;
  }

  /**
   * Compute `cluster_key` for the given vehicle context.
   *
   * Strategy v1 : `brand::model::fuel::body × pg_id` (PR 1 default)
   * Strategy v2 : `vehicle_family_id::pg_id` (post-MV creation)
   */
  clusterKey(ctx: VehicleContext, vehicleFamilyId?: string): string {
    if (this.strategy === 'v2_vehicle_family' && vehicleFamilyId) {
      return `${vehicleFamilyId}::${ctx.pgId}`;
    }
    return (
      [
        ctx.brandSlug.toLowerCase(),
        ctx.modelSlug.toLowerCase(),
        ctx.fuelType.toLowerCase(),
        (ctx.bodyType ?? 'unknown').toLowerCase(),
      ].join('::') + `::${ctx.pgId}`
    );
  }
}
