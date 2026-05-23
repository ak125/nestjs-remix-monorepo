/**
 * L1 — Canon Formula Engine (Pricing Control Plane).
 *
 * Single source of truth for the legacy pricing formula, reverse-engineered and
 * confirmed to the cent on the real `pieces_price` table:
 *
 *   achat_HT  = gros_HT × (1 − remise/100)
 *   vente_HT  = round( achat_HT × (1 + marge/100), 2 )      ← marge = taux de marge (markup on cost)
 *   vente_TTC = round( (vente_HT + frais_port_HT + frais_supp_HT) × (1 + tva), 2 )
 *
 * Vocabulary (do NOT confuse — see ADR / plan):
 *   - marge_brute   = vente_HT − achat_HT
 *   - taux_de_marge = marge_brute / achat_HT   (markup on cost) ← this is `pri_marge_n`
 *   - taux_de_marque= marge_brute / vente_HT   (margin on sale) ← NOT pri_marge
 *
 * Money precision: all arithmetic is done in **integer cents** to avoid float
 * drift across 442K rows. Rounding is round-half-up at the cent boundary, applied
 * to vente_HT first, THEN to vente_TTC — reproducing the stored legacy values
 * exactly. Inputs/outputs at the euro boundary use the cents <-> euro helpers.
 *
 * Pure functions, zero I/O. The @Injectable class is a thin DI wrapper; the
 * exported functions are the testable core.
 */
import { Injectable } from '@nestjs/common';

/** Default French VAT rate (stored per-row in `pri_tva_n`, coalesced to this). */
export const DEFAULT_TVA_RATE = 0.2;

/** Canonical inputs produced by L0.5 (independent of supplier convention). */
export interface CanonicalPriceInputs {
  /** Net purchase price HT, in cents. */
  achatHtCents: number;
  /** Taux de marge (markup on cost), as a percentage, e.g. 54.6 for +54.6%. */
  margePct: number;
  /** Per-line shipping fee HT, in cents (preserved from existing row). */
  fraisPortHtCents?: number;
  /** Per-line supplementary fee HT, in cents (preserved from existing row). */
  fraisSuppHtCents?: number;
  /** VAT rate (e.g. 0.2). Defaults to {@link DEFAULT_TVA_RATE}. */
  tvaRate?: number;
}

/** Fully resolved price chain, all monetary values in cents. */
export interface PriceChain {
  achatHtCents: number;
  venteHtCents: number;
  venteTtcCents: number;
  /** Recomputed taux de marge from the rounded chain (markup on cost), percent. */
  margePct: number;
}

/** Round half-up at the unit (cent) boundary, deterministic for non-negative money. */
function roundCents(value: number): number {
  // Math.round rounds .5 toward +Infinity → round-half-up for positive amounts.
  return Math.round(value);
}

export function eurToCents(eur: number): number {
  return roundCents(eur * 100);
}

export function centsToEur(cents: number): number {
  return cents / 100;
}

/** achat_HT = gros_HT × (1 − remise/100), in cents. */
export function computeAchatHtCents(
  grosHtCents: number,
  remisePct: number,
): number {
  return roundCents((grosHtCents * (100 - remisePct)) / 100);
}

/** vente_HT = round(achat_HT × (1 + marge/100)), in cents. */
export function computeVenteHtCents(
  achatHtCents: number,
  margePct: number,
): number {
  return roundCents((achatHtCents * (100 + margePct)) / 100);
}

/** vente_TTC = round((vente_HT + frais_port + frais_supp) × (1 + tva)), in cents. */
export function computeVenteTtcCents(
  venteHtCents: number,
  fraisPortHtCents = 0,
  fraisSuppHtCents = 0,
  tvaRate: number = DEFAULT_TVA_RATE,
): number {
  return roundCents(
    (venteHtCents + fraisPortHtCents + fraisSuppHtCents) * (1 + tvaRate),
  );
}

/**
 * taux_de_marge (markup on cost) recomputed from the rounded chain, as a percent.
 * Used for display / back-fill of `pri_marge_n` — NOT taux de marque.
 */
export function computeMargePct(
  achatHtCents: number,
  venteHtCents: number,
): number {
  if (achatHtCents <= 0) return 0;
  return ((venteHtCents - achatHtCents) / achatHtCents) * 100;
}

/** Resolve the full price chain from canonical inputs. */
export function computePriceChain(inputs: CanonicalPriceInputs): PriceChain {
  const { achatHtCents, margePct } = inputs;
  const venteHtCents = computeVenteHtCents(achatHtCents, margePct);
  const venteTtcCents = computeVenteTtcCents(
    venteHtCents,
    inputs.fraisPortHtCents ?? 0,
    inputs.fraisSuppHtCents ?? 0,
    inputs.tvaRate ?? DEFAULT_TVA_RATE,
  );
  return {
    achatHtCents,
    venteHtCents,
    venteTtcCents,
    margePct: computeMargePct(achatHtCents, venteHtCents),
  };
}

@Injectable()
export class PricingFormulaService {
  readonly defaultTvaRate = DEFAULT_TVA_RATE;

  eurToCents = eurToCents;
  centsToEur = centsToEur;
  computeAchatHtCents = computeAchatHtCents;
  computeVenteHtCents = computeVenteHtCents;
  computeVenteTtcCents = computeVenteTtcCents;
  computeMargePct = computeMargePct;
  computePriceChain = computePriceChain;
}
