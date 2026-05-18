import type { DomainId } from "@repo/registry";

/**
 * CommercePort — DiagnosticDomain (D4/D7) → CommerceDomain (D11) handoff.
 *
 * Single intent-based method : given diagnosed causes + vehicle context,
 * return suggested gammes (pieces categories) navigable to /pieces/gamme-${pgId}.
 *
 * Implementation lives in `backend/src/modules/commerce/` (D11) or, until PR-D
 * extraction, can be adapted from `diagnostic-engine/engines/catalog-orientation.engine.ts`.
 *
 * Contract stability : any signature change = bump registry version + ADR L4.
 */

export interface CommerceVehicleCtx {
  readonly type_id?: number;
  readonly brand_slug?: string;
  readonly model_slug?: string;
  readonly year?: number;
}

export interface CommerceCause {
  readonly cause_slug: string;
  readonly confidence: number;
}

export interface SuggestedGamme {
  readonly pg_id: number;
  readonly confidence: "low" | "medium" | "high" | "insufficient";
  readonly estimated_cost_min?: number;
  readonly estimated_cost_max?: number;
}

export interface CommercePort {
  suggestParts(
    causes: readonly CommerceCause[],
    vehicleCtx: CommerceVehicleCtx,
  ): Promise<readonly SuggestedGamme[]>;
}

export const COMMERCE_PORT = Symbol.for("DiagnosticDomain.CommercePort");

export const TARGET_DOMAIN: DomainId = "D11";
