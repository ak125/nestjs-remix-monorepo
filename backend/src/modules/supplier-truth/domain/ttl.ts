/**
 * Supplier Availability Truth — dynamic TTL resolution (pure, Layer 3).
 *
 * Freshness is not one-size-fits-all: rotation differs by supplier, by product
 * family (gamme), and by criticality (a turbo must be re-checked sooner than oil).
 * A fixed 24h TTL would over- or under-trust. Precedence:
 *   gamme override → supplier profile default → global default,  then × criticality.
 *
 * Default is intentionally conservative (Phase 0 could not derive the real
 * infeasible window from history); revisit once live verification data exists.
 */

/** Conservative global default until calibrated from live data. */
export const DEFAULT_TTL_MINUTES = 12 * 60;

const CRITICALITY_MULTIPLIER = {
  high: 0.5, // re-check sooner
  normal: 1,
  low: 2, // tolerate older data
} as const;

export interface TtlInput {
  /** Per-supplier baseline from `supplier_runtime_profile.default_ttl_minutes`. */
  supplierDefaultTtlMinutes?: number | null;
  /** Per-gamme override (most specific). */
  gammeTtlMinutes?: number | null;
  /** Product criticality. */
  criticality?: keyof typeof CRITICALITY_MULTIPLIER;
}

export function resolveTtlMinutes(i: TtlInput): number {
  const base =
    i.gammeTtlMinutes ?? i.supplierDefaultTtlMinutes ?? DEFAULT_TTL_MINUTES;
  const mult = CRITICALITY_MULTIPLIER[i.criticality ?? 'normal'];
  return Math.max(1, Math.round(base * mult));
}
