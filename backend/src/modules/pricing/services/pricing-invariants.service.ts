/**
 * L2 — Pricing Invariants (business safety guards).
 *
 * Validates a computed price chain before it can be written. Failures are
 * **explicit rejects** collected as violations — never silently skipped
 * (no-silent-fallback, CLAUDE.md).
 *
 * Threshold note (CORRECTION calibrated on legacy reality): the legacy markup
 * reaches ~500% on cheap parts, so MAX_MARGE must be ≥ ~600% or the calibrated
 * no-op seed would trip its own invariants. DELTA_MAX applies to imports; a
 * deliberate grid shift passes via explicit override (`allowDeltaOverride`),
 * never blocked silently.
 *
 * Pure functions, zero I/O.
 */
import { Injectable } from '@nestjs/common';

export const DEFAULT_MAX_MARGE_PCT = 600;
export const DEFAULT_DELTA_MAX_PCT = 30;
export const TVA_WHITELIST = [0, 0.055, 0.1, 0.2] as const;

export interface PriceChainForValidation {
  achatHtCents: number;
  venteHtCents: number;
  venteTtcCents: number;
  margePct: number;
  tvaRate: number;
  /** Previous sale price HT (cents), for the delta guard. Optional. */
  currentVenteHtCents?: number;
}

export interface InvariantOptions {
  maxMargePct?: number;
  tvaWhitelist?: readonly number[];
  deltaMaxPct?: number;
  /** Deliberate, tracked grid shift — bypasses the delta guard only. */
  allowDeltaOverride?: boolean;
}

export type InvariantCode =
  | 'ACHAT_NOT_POSITIVE'
  | 'VENTE_BELOW_ACHAT'
  | 'MARGE_EXCEEDS_MAX'
  | 'TVA_NOT_WHITELISTED'
  | 'NON_FINITE_OR_NEGATIVE'
  | 'TTC_NOT_POSITIVE'
  | 'DELTA_EXCEEDS_MAX';

export interface Violation {
  code: InvariantCode;
  message: string;
}

export class PricingInvariantError extends Error {
  constructor(public readonly violations: Violation[]) {
    super(`Pricing invariants violated: ${violations.map((v) => v.code).join(', ')}`);
    this.name = 'PricingInvariantError';
  }
}

function isFiniteNumber(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Returns the list of violations (empty = valid). Never throws. */
export function validatePriceChain(
  chain: PriceChainForValidation,
  opts: InvariantOptions = {},
): Violation[] {
  const maxMarge = opts.maxMargePct ?? DEFAULT_MAX_MARGE_PCT;
  const tvaWhitelist = opts.tvaWhitelist ?? TVA_WHITELIST;
  const deltaMax = opts.deltaMaxPct ?? DEFAULT_DELTA_MAX_PCT;
  const v: Violation[] = [];

  const allCents = [chain.achatHtCents, chain.venteHtCents, chain.venteTtcCents];
  if (!allCents.every(isFiniteNumber) || allCents.some((c) => c < 0)) {
    v.push({
      code: 'NON_FINITE_OR_NEGATIVE',
      message: `Non-finite or negative cents: ${JSON.stringify(allCents)}`,
    });
    // Bail early — downstream checks are meaningless on garbage numbers.
    return v;
  }

  if (chain.achatHtCents <= 0) {
    v.push({ code: 'ACHAT_NOT_POSITIVE', message: `achat_HT must be > 0 (got ${chain.achatHtCents}c)` });
  }
  if (chain.venteHtCents < chain.achatHtCents) {
    v.push({
      code: 'VENTE_BELOW_ACHAT',
      message: `vente_HT (${chain.venteHtCents}c) < achat_HT (${chain.achatHtCents}c)`,
    });
  }
  if (chain.margePct > maxMarge) {
    v.push({
      code: 'MARGE_EXCEEDS_MAX',
      message: `marge ${chain.margePct.toFixed(2)}% > MAX_MARGE ${maxMarge}% (anti prix ×10)`,
    });
  }
  if (!tvaWhitelist.some((w) => Math.abs(w - chain.tvaRate) < 1e-9)) {
    v.push({
      code: 'TVA_NOT_WHITELISTED',
      message: `tva ${chain.tvaRate} not in {${tvaWhitelist.join(', ')}}`,
    });
  }
  if (chain.venteTtcCents <= 0) {
    v.push({ code: 'TTC_NOT_POSITIVE', message: `vente_TTC must be > 0 (got ${chain.venteTtcCents}c)` });
  }
  if (
    !opts.allowDeltaOverride &&
    chain.currentVenteHtCents != null &&
    chain.currentVenteHtCents > 0
  ) {
    const deltaPct =
      (Math.abs(chain.venteHtCents - chain.currentVenteHtCents) / chain.currentVenteHtCents) * 100;
    if (deltaPct > deltaMax) {
      v.push({
        code: 'DELTA_EXCEEDS_MAX',
        message: `|Δ vente_HT| ${deltaPct.toFixed(1)}% > DELTA_MAX ${deltaMax}% (override required)`,
      });
    }
  }
  return v;
}

/** Throws {@link PricingInvariantError} if the chain has any violation. */
export function assertValidPriceChain(
  chain: PriceChainForValidation,
  opts: InvariantOptions = {},
): void {
  const violations = validatePriceChain(chain, opts);
  if (violations.length > 0) throw new PricingInvariantError(violations);
}

@Injectable()
export class PricingInvariantsService {
  validatePriceChain = validatePriceChain;
  assertValidPriceChain = assertValidPriceChain;
}
