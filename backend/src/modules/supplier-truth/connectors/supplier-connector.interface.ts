/**
 * Supplier Availability Truth — connector contract (Layer 1).
 *
 * One connector per *platform* (e.g. inoshop covers DistriCash + any other inoshop
 * distributor), not per supplier. A connector only logs in, fetches, and parses —
 * NO business logic. Output is Zod-validated; an unparseable response yields
 * `parseError: true` rather than throwing.
 */

import { z } from 'zod';

export const FreshnessProvenance = z.enum([
  'PORTAL_REPORTED', // the portal told us its own last-sync time
  'CONNECTOR_FETCHED', // freshness = our fetch time (no portal signal)
  'ESTIMATED', // inferred / lowest trust
]);
export type FreshnessProvenance = z.infer<typeof FreshnessProvenance>;

/** A single raw observation from a supplier for one reference. */
export const SupplierObservationSchema = z.object({
  supplierId: z.string().min(1),
  rawRef: z.string().min(1),
  available: z.boolean(),
  /** Orderable delay in days when not in stock; null if unknown. */
  delayDays: z.number().int().nonnegative().nullable(),
  /** Portal's own reported last-sync; null when not exposed. */
  sourceVerifiedAt: z.date().nullable().default(null),
  freshnessProvenance: FreshnessProvenance,
  /** True when the response for this ref could not be parsed reliably. */
  parseError: z.boolean(),
  /** Purchase price HT (net "achat", post-supplier-discount); null when unknown. */
  priceBuyHt: z.number().nonnegative().nullable().default(null),
  /**
   * Supplier list price HT (the "public"/pre-discount price) when the portal
   * exposes it alongside the net. Used to derive the empirical discount grid
   * (`code_remise → %`) for recovery imports. Null when not provided.
   */
  priceBaseHt: z.number().nonnegative().nullable().default(null),
  /**
   * Supplier-specific discount applied for this ref (= 1 − priceBuyHt/priceBaseHt
   * when both are known). Percent, 0..100. Null when not provided.
   */
  remisePct: z.number().min(0).max(100).nullable().default(null),
});
export type SupplierObservation = z.infer<typeof SupplierObservationSchema>;

export interface SupplierCredentials {
  user: string;
  password: string;
}

export interface SupplierConnector {
  /** Internal supplier id (`___xtr_supplier.spl_id`). */
  readonly supplierId: string;
  /** Platform family (e.g. 'inoshop'). */
  readonly platform: string;
  /** Authenticate; throws on hard auth failure (caller may quarantine). */
  login(creds: SupplierCredentials): Promise<void>;
  /** Fetch availability for a bounded working-set of references. */
  fetchAvailability(refs: string[]): Promise<SupplierObservation[]>;
  /** Release resources (e.g. close the headless browser). Optional. */
  close?(): Promise<void>;
}
