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
import type { MatchKind, RefVerdict } from './inoshop-search-parse';

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

/**
 * The article line first renders `ico_disposearch.gif` and swaps in the real
 * icon asynchronously (live 2026-10-10: ~0.5 s). Reading before the swap yields
 * 'unknown' — the connector waits until this is false, bounded.
 */
export function isCalStockIconPlaceholder(
  src: string | null | undefined,
): boolean {
  return !src || /ico_disposearch/i.test(src);
}

/** One entry of the `/CallWS.aspx?origine=autocomplete` JSONP response. */
export interface CalAutocompleteItem {
  /** Internal article id — the `codart` of the article line. */
  key: string;
  ref: string;
  /** Brand label as CAL lists it — may differ from the catalog brand name. */
  marq: string | null;
  /** Short brand code (a few uppercase letters). */
  codemarq: string | null;
}

/** Parse the autocomplete JSONP body. Throws on a non-JSON body (caller logs it). */
export function parseCalAutocomplete(body: string): CalAutocompleteItem[] {
  const json = body.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
  const parsed = JSON.parse(json) as {
    result?: Array<Record<string, unknown>>;
  };
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  return (parsed.result ?? []).flatMap((r) => {
    const key = str(r.key);
    const ref = str(r.ref);
    return key && ref
      ? [{ key, ref, marq: str(r.marq), codemarq: str(r.codemarq) }]
      : [];
  });
}

/** Ref identity across feed and portal: case, spaces, dots and dashes ignored. */
export function normalizeCalRef(ref: string): string {
  return ref
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '');
}

/** Is this autocomplete item our brand? (label OR short code, like inoshop's isBrandRow) */
export function isCalBrandItem(
  item: CalAutocompleteItem,
  tokens: Set<string>,
): boolean {
  const m = (item.marq ?? '').toUpperCase();
  const c = (item.codemarq ?? '').toUpperCase();
  return (m !== '' && tokens.has(m)) || (c !== '' && tokens.has(c));
}

/** CAL has no EAN in its autocomplete, so every MatchKind but 'EAN'. */
export type CalMatchKind = Exclude<MatchKind, 'EAN'>;

/**
 * Resolve the one autocomplete item that IS the requested ref. Never falls back
 * to the first result: an inexact, foreign-brand or ambiguous match returns no
 * item. An empty token set means the caller gave no brand (sync runner):
 * one article with the exact ref is then REF_ONLY.
 */
export function matchCalItem(
  items: CalAutocompleteItem[],
  ref: string,
  tokens: Set<string>,
): { item: CalAutocompleteItem | null; kind: CalMatchKind } {
  const wanted = normalizeCalRef(ref);
  const refItems = items.filter((i) => normalizeCalRef(i.ref) === wanted);
  const candidates =
    tokens.size > 0
      ? refItems.filter((i) => isCalBrandItem(i, tokens))
      : refItems;
  const keys = new Set(candidates.map((i) => i.key));
  if (keys.size === 1)
    return {
      item: candidates[0],
      kind: tokens.size > 0 ? 'REF_BRAND' : 'REF_ONLY',
    };
  if (keys.size > 1) return { item: null, kind: 'REF_BRAND_AMBIGUOUS' };
  if (refItems.length > 0) return { item: null, kind: 'FALSE_MATCH' };
  return { item: null, kind: 'NOT_FOUND' };
}

/** What the connector read on the selected article's line (and only there). */
export interface CalArticleRow {
  marque: string | null;
  refcde: string | null;
  prixBaseText: string | null;
  remiseText: string | null;
  prixNetText: string | null;
  stockIconSrc: string | null;
  /** False when the icon was still the async placeholder after the bounded wait. */
  iconSettled: boolean;
}

/** One ref looked up at CAL: the match decision, plus the line when one was selected. */
export interface CalLookup {
  ref: string;
  kind: CalMatchKind;
  item: CalAutocompleteItem | null;
  row: CalArticleRow | null;
}

const sameLabel = (a: string | null, b: string | null): boolean =>
  (a ?? '').replace(/\s+/g, ' ').trim().toUpperCase() ===
  (b ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/** The line read carries the selected article's brand and ref (not a stale/foreign line). */
export function isCalLineConsistent(
  item: CalAutocompleteItem,
  row: CalArticleRow,
): boolean {
  return (
    sameLabel(row.marque, item.marq) &&
    normalizeCalRef(row.refcde ?? '') === normalizeCalRef(item.ref)
  );
}

/**
 * Lookup → SupplierObservation. No item, or a line that is not the selected
 * article → nothing extracted (parseError). An unsettled icon is dropped, so the
 * observation stays not-available rather than guessing.
 */
export function calLookupToObservation(
  supplierId: string,
  lookup: CalLookup,
): SupplierObservation {
  const { item, row } = lookup;
  if (!item || !row || !isCalLineConsistent(item, row)) {
    return calProductToObservation({
      supplierId,
      rawRef: lookup.ref,
      prixNetHt: null,
      dispoLabel: null,
    });
  }
  return calProductToObservation({
    supplierId,
    rawRef: lookup.ref,
    prixNetHt: parseCalPriceHt(row.prixNetText),
    prixBaseHt: parseCalPriceHt(row.prixBaseText),
    remisePct: parseCalRemisePct(row.remiseText),
    dispoLabel: null, // the icon is authoritative; the line's text holds the legend
    stockIconSrc: row.iconSettled ? row.stockIconSrc : null,
  });
}

/**
 * Map one CAL lookup to an activation verdict (same buckets as the inoshop
 * classifier). Only the green icon confirms. Red ("Sur commande/Indisponible")
 * and J+1 ("Contacter le Call Center") go to REVIEW: CAL's red label does not
 * tell a back-order from a rupture, so it is never proof of rupture.
 * `dispoType` carries the CAL icon state; the inoshop `icon` field stays null.
 */
export function calVerdictForRef(
  lookup: CalLookup,
  ean: string | null,
): RefVerdict {
  const base = {
    ref: lookup.ref,
    ean,
    matchKind: lookup.kind,
    code: lookup.item?.key ?? null,
    marque: lookup.item?.marq ?? null,
    icon: null,
  };
  if (!lookup.item || !lookup.row) {
    const bucket =
      lookup.kind === 'FALSE_MATCH'
        ? 'REVIEW_FALSE_MATCH'
        : lookup.kind === 'REF_BRAND_AMBIGUOUS'
          ? 'REVIEW_NO_EAN'
          : 'REVIEW_NOT_FOUND';
    return {
      ...base,
      bucket,
      reason: lookup.kind,
      dispoType: null,
      portalPrix: null,
    };
  }
  const row = lookup.row;
  const state = classifyCalStockIcon(row.stockIconSrc);
  const iconFile = (row.stockIconSrc ?? '').split('/').pop() || 'none';
  const withRow = {
    ...base,
    dispoType: state,
    portalPrix: parseCalPriceHt(row.prixNetText),
  };
  if (!isCalLineConsistent(lookup.item, row)) {
    return {
      ...withRow,
      bucket: 'REVIEW_CONTRADICTION',
      reason: `cal:line_mismatch:${row.marque ?? ''}|${row.refcde ?? ''}`,
    };
  }
  if (!row.iconSettled)
    return {
      ...withRow,
      bucket: 'REVIEW_NO_SIGNAL',
      reason: 'cal:icon_unsettled',
    };
  switch (state) {
    case 'available':
      // No brand lock → never auto-sell, even on a green icon.
      return lookup.kind === 'REF_BRAND'
        ? { ...withRow, bucket: 'CONFIRMED_AG', reason: `cal:${iconFile}` }
        : {
            ...withRow,
            bucket: 'REVIEW_NO_SIGNAL',
            reason: `cal:${iconFile}|no_brand_lock`,
          };
    case 'on_order_j1':
      return {
        ...withRow,
        bucket: 'REVIEW_MANUAL_ORDER',
        reason: `cal:${iconFile}`,
      };
    case 'unavailable':
      return {
        ...withRow,
        bucket: 'REVIEW_ON_ORDER_OR_OUT',
        reason: `cal:${iconFile}`,
      };
    default:
      return {
        ...withRow,
        bucket: 'REVIEW_NO_SIGNAL',
        reason: `cal:${iconFile}`,
      };
  }
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
