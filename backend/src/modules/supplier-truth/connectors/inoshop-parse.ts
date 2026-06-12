/**
 * inoshop (DistriCash) — pure parsing/mapping (Layer 1 logic, no I/O).
 *
 * Encodes the captured contract: availability for an article comes from the
 * SEARCH RESULTS page `.ARTICLE` element, not the /ajax/dispo modal:
 *   - data-stock        → local agency quantity (primary signal)
 *   - data-dispo-type   → 'ag' = agence locale, etc.
 *   - per-platform stock icon filename encodes centralized availability:
 *       vert/vert+ = available, orange/orange+ = limited (still orderable),
 *       rouge = unavailable, transport = via transport, partner = partenaire,
 *       gris = no info.
 *
 * Kept pure (extracted fields in → SupplierObservation out) so it is fully
 * unit-tested without cheerio/HTTP. The DOM extraction is a thin adapter added
 * once an HTML parser dependency is installed in the backend build.
 *
 * Safety: if nothing meaningful was extracted, `parseError: true` ⇒ the truth
 * engine never promotes the piece to VERIFIED_AVAILABLE.
 */

import {
  SupplierObservationSchema,
  type SupplierObservation,
} from './supplier-connector.interface';

export type StockIcon =
  | 'vert'
  | 'vert+'
  | 'orange'
  | 'orange+'
  | 'rouge'
  | 'gris'
  | 'transport'
  | 'partner'
  | 'unknown';

/** Map a platform stock-icon URL/filename to its semantic state. */
export function classifyStockIcon(iconUrlOrName: string): StockIcon {
  const f = (iconUrlOrName || '').toLowerCase();
  if (f.includes('vert+')) return 'vert+';
  if (f.includes('vert')) return 'vert';
  if (f.includes('orange+')) return 'orange+';
  if (f.includes('orange')) return 'orange';
  if (f.includes('rouge')) return 'rouge';
  if (f.includes('transport')) return 'transport';
  if (f.includes('partner') || f.includes('partenaire')) return 'partner';
  if (f.includes('gris')) return 'gris';
  return 'unknown';
}

const AVAILABLE_ICONS: ReadonlySet<StockIcon> = new Set<StockIcon>([
  'vert',
  'vert+',
  'orange',
  'orange+',
]);
const ORDERABLE_DELAY_ICONS: ReadonlySet<StockIcon> = new Set<StockIcon>([
  'transport',
  'partner',
]);

/** Fields extracted from one `.ARTICLE` row by the DOM adapter. */
export interface InoshopArticle {
  supplierId: string;
  rawRef: string;
  /** data-filtrecodearticle (supplier article code). */
  codeArticle: string | null;
  /** data-stock — local agency quantity. */
  stock: number | null;
  /** data-dispo-type — 'ag' etc. */
  dispoType: string | null;
  /** Best (most-available) platform icon URL/name, if the modal was consulted. */
  bestIcon?: string | null;
  /** Explicit delay in days when the page exposes one. */
  delayDays?: number | null;
  /** Purchase price HT (V2 tarif), when extracted. */
  priceBuyHt?: number | null;
}

/** Map one extracted article to a validated SupplierObservation. */
export function articleToObservation(a: InoshopArticle): SupplierObservation {
  const nothingExtracted =
    !a.codeArticle &&
    (a.stock === null || a.stock === undefined) &&
    !a.bestIcon;

  const hasLocalStock = (a.stock ?? 0) > 0;
  const icon = a.bestIcon ? classifyStockIcon(a.bestIcon) : 'unknown';
  const iconAvailable = AVAILABLE_ICONS.has(icon);

  const available = !nothingExtracted && (hasLocalStock || iconAvailable);

  // Orderable-with-delay only when we actually have a delay; otherwise leave null
  // (→ SUPPLIER_PENDING, never a false in-stock promise).
  let delayDays: number | null = a.delayDays ?? null;
  if (available) delayDays = null;
  else if (delayDays == null && ORDERABLE_DELAY_ICONS.has(icon))
    delayDays = null;

  const obs = {
    supplierId: a.supplierId,
    rawRef: a.rawRef,
    available,
    delayDays,
    sourceVerifiedAt: null,
    freshnessProvenance: 'CONNECTOR_FETCHED' as const,
    parseError: nothingExtracted,
    priceBuyHt: a.priceBuyHt ?? null,
  };
  // Validate the contract at the boundary (throws only on a programming error,
  // since fields are normalized above).
  return SupplierObservationSchema.parse(obs);
}
