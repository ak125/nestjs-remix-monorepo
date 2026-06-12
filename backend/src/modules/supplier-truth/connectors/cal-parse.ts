/**
 * CAL (PF Préférence Seine, Société CAL 92) — pure parsing (Layer 1 logic, no I/O).
 *
 * Encodes the contract for what the connector extracts from a CAL product page
 * (post-login):
 *   - prixNetHt   : displayed "Prix net HT" (the value AutoMecanik pays after
 *                   applying CAL's grid to Valeo's catalogue) — in €.
 *   - dispoLabel  : human "Disponibilité" badge — "En stock", "Sur commande Xj",
 *                   "Indisponible", or specific to CAL's UI (verified live).
 *   - delayDays   : if the badge encodes a delay, parsed to int days.
 *
 * Pure mapping; the DOM adapter (connector class) only feeds these primitives in.
 *
 * NOTE: selector strings live in the connector. The parsers here are
 * encoding-agnostic and unit-tested. Real CAL UI labels MUST be verified on the
 * first live run; today's mapping is the safe-degradation default — unknown =
 * parseError: true → never a false in-stock.
 */

import {
  SupplierObservationSchema,
  type SupplierObservation,
} from './supplier-connector.interface';

/** Parse a CAL price label like "12,15 €", "12.15 € HT", "Prix net : 12,15 €". */
export function parseCalPriceHt(
  text: string | null | undefined,
): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*€/);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse a CAL discount label like "50%", "50 %", "50% ". Returns 0..100 or null. */
export function parseCalRemisePct(
  text: string | null | undefined,
): number | null {
  if (!text) return null;
  // Require start-of-string or a non-numeric char before the digits, so that
  // strings like "-5%" or "1.50%" embedded in "1.51.50%" don't accidentally match.
  const m = text.match(/(?:^|[^\d.,-])(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** Parse a delay badge like "Sur commande 3 j", "Délai 5 jours", "J+2". */
export function parseCalDelayDays(
  text: string | null | undefined,
): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  // "j+2", "j +2"
  const jPlus = t.match(/\bj\s*\+\s*(\d+)/);
  if (jPlus) return Number.parseInt(jPlus[1], 10);
  // "5 jours", "3 j", "2j", "sous 4 jours"
  const dj = t.match(/(\d+)\s*(?:j(?:our)?s?)\b/);
  if (dj) return Number.parseInt(dj[1], 10);
  return null;
}

export type CalDispoState = 'in_stock' | 'on_order' | 'unavailable' | 'unknown';

/**
 * Classify CAL's stock icon by `<img src>` filename. This is the AUTHORITATIVE
 * stock signal on the article line (the red/green/orange puce). The legend is
 * literally embedded in the page:
 *   ico_dispo0.png = Sur commande / Indisponible   (red)
 *   ico_dispo1.png = Disponible                    (green)
 *   ico_dispo3.png = Disponible à J+1 / Call Center
 * `puceRed.png` is the same red-state icon used elsewhere in the UI.
 *
 * The `qte` field returned by the autocomplete JSONP is NOT the available stock
 * — it appears to be a packaging/min-order quantity. Always trust this icon
 * instead. Verified live on 2026-05-23 (ref 715899 had ico_dispo0 = red).
 */
export type CalStockIcon =
  | 'available'
  | 'unavailable'
  | 'on_order_j1'
  | 'unknown';
export function classifyCalStockIcon(
  src: string | null | undefined,
): CalStockIcon {
  if (!src) return 'unknown';
  if (/ico_dispo1\b/i.test(src)) return 'available';
  if (/ico_dispo3\b/i.test(src)) return 'on_order_j1';
  if (/ico_dispo0\b/i.test(src) || /puceRed/i.test(src)) return 'unavailable';
  return 'unknown';
}

/** Classify a CAL availability badge to a coarse state. */
export function classifyCalDispo(
  text: string | null | undefined,
): CalDispoState {
  if (!text) return 'unknown';
  const t = text.toLowerCase();
  // Word boundaries so "indisponible" doesn't match "disponible" as a substring.
  if (
    /(\ben\s+stock\b|\bdisponible\b|\bdispo\b)/.test(t) &&
    !/(non\s*disponible|\bindisponible\b)/.test(t)
  ) {
    return 'in_stock';
  }
  if (
    /(sur\s+commande|commande|sous\s+\d+\s*j|\bj\s*\+|\d+\s*j(?:our)?s?\b|d[ée]lai)/.test(
      t,
    )
  ) {
    return 'on_order';
  }
  if (
    /(rupture|indisponible|non\s*disponible|\bnd\b|épuis[ée]|non\s+r[ée]f[ée]renc)/.test(
      t,
    )
  ) {
    return 'unavailable';
  }
  return 'unknown';
}

/** Fields extracted from one CAL product page by the connector. */
export interface CalProduct {
  supplierId: string;
  rawRef: string;
  /** "Prix net HT" displayed on the product page, in €. */
  prixNetHt: number | null;
  /** "Prix de base" (public/list HT) displayed on the product page, in €. */
  prixBaseHt?: number | null;
  /** CAL-specific discount % displayed alongside the net (0..100). */
  remisePct?: number | null;
  /** Raw availability badge text (fallback, used when no icon found). */
  dispoLabel: string | null;
  /** Explicit delay text if present (sometimes alongside dispoLabel). */
  delayLabel?: string | null;
  /** Authoritative stock-icon `<img src>` (ico_dispo0/1/3 or puceRed). */
  stockIconSrc?: string | null;
}

/** Map one CAL extracted product to a validated SupplierObservation. */
export function calProductToObservation(p: CalProduct): SupplierObservation {
  // The icon is authoritative — defer to text only when no icon was captured.
  const icon = classifyCalStockIcon(p.stockIconSrc);
  const textState = classifyCalDispo(p.dispoLabel);
  const state: CalStockIcon | CalDispoState =
    icon !== 'unknown' ? icon : textState;
  const delayDays =
    icon === 'on_order_j1'
      ? 1
      : parseCalDelayDays(p.delayLabel ?? p.dispoLabel);

  const nothingExtracted = p.prixNetHt == null && state === 'unknown';
  const available = state === 'available' || state === 'in_stock';

  // delayDays only meaningful when not in stock; null when in stock or unknown.
  const obs = {
    supplierId: p.supplierId,
    rawRef: p.rawRef,
    available,
    delayDays: available ? null : delayDays,
    sourceVerifiedAt: null,
    freshnessProvenance: 'CONNECTOR_FETCHED' as const,
    parseError: nothingExtracted,
    priceBuyHt: p.prixNetHt,
    priceBaseHt: p.prixBaseHt ?? null,
    remisePct: p.remisePct ?? null,
  };
  return SupplierObservationSchema.parse(obs);
}
