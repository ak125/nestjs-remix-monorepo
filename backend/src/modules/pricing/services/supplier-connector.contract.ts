/**
 * Step 2 — Supplier reconciliation contract (generic, multi-supplier).
 *
 * Everything built for DistriCash (API connector: availability / price / margin)
 * applies to ALL suppliers via ONE contract. DistriCash (spl_id=26) is the
 * reference implementation and lives in Supplier Truth V1; the pricing side only
 * depends on this interface — never on per-supplier code.
 *
 * The reconciliation core is pure & testable: it confirms, after an import, that
 * the margin has not changed and the price corresponds to the supplier's
 * authoritative quote.
 */

/** A supplier's authoritative quote for one reference (from its API/feed). */
export interface SupplierQuote {
  ref: string;
  /** Authoritative net purchase price HT, in cents (if the supplier exposes it). */
  achatHtCents?: number;
  /** Expected taux de marge (markup on cost), percent (if agreed/known). */
  margePct?: number;
  /** Authoritative availability ('1' = available). */
  available?: boolean;
}

/** Contract every supplier connector implements (DistriCash = reference). */
export interface SupplierConnector {
  readonly supplierId: string;
  /** Returns the authoritative quote for a reference, or null if unknown. */
  fetchQuote(ref: string): Promise<SupplierQuote | null>;
}

export interface ReconcileTolerances {
  /** Allowed |Δ margin| in percentage points. */
  marginPpTolerance?: number;
  /** Allowed |Δ achat| in cents. */
  achatCentsTolerance?: number;
}

export interface ReconcileResult {
  ref: string;
  /** undefined when the supplier did not expose the field. */
  marginUnchanged?: boolean;
  priceMatches?: boolean;
  availabilityMatches?: boolean;
  ok: boolean;
  issues: string[];
}

export const DEFAULT_MARGIN_PP_TOLERANCE = 0.5;
export const DEFAULT_ACHAT_CENTS_TOLERANCE = 1;

/**
 * Reconcile what we applied (computed) against the supplier's authoritative quote.
 * Pure. Missing quote fields → that check is skipped (undefined), not failed —
 * but a missing quote entirely is an explicit issue (no silent pass).
 */
export function reconcile(
  computed: {
    ref: string;
    achatHtCents: number;
    margePct: number;
    active: boolean;
  },
  quote: SupplierQuote | null,
  tol: ReconcileTolerances = {},
): ReconcileResult {
  const marginTol = tol.marginPpTolerance ?? DEFAULT_MARGIN_PP_TOLERANCE;
  const achatTol = tol.achatCentsTolerance ?? DEFAULT_ACHAT_CENTS_TOLERANCE;
  const issues: string[] = [];

  if (!quote) {
    return { ref: computed.ref, ok: false, issues: ['NO_SUPPLIER_QUOTE'] };
  }

  let priceMatches: boolean | undefined;
  if (quote.achatHtCents != null) {
    priceMatches =
      Math.abs(computed.achatHtCents - quote.achatHtCents) <= achatTol;
    if (!priceMatches) {
      issues.push(
        `PRICE_MISMATCH (computed ${computed.achatHtCents}c vs supplier ${quote.achatHtCents}c)`,
      );
    }
  }

  let marginUnchanged: boolean | undefined;
  if (quote.margePct != null) {
    marginUnchanged = Math.abs(computed.margePct - quote.margePct) <= marginTol;
    if (!marginUnchanged) {
      issues.push(
        `MARGIN_CHANGED (applied ${computed.margePct.toFixed(2)}% vs expected ${quote.margePct.toFixed(2)}%)`,
      );
    }
  }

  let availabilityMatches: boolean | undefined;
  if (quote.available != null) {
    availabilityMatches = quote.available === computed.active;
    if (!availabilityMatches) {
      issues.push(
        `AVAILABILITY_MISMATCH (active=${computed.active} vs supplier=${quote.available})`,
      );
    }
  }

  return {
    ref: computed.ref,
    marginUnchanged,
    priceMatches,
    availabilityMatches,
    ok: issues.length === 0,
    issues,
  };
}
