/**
 * inoshop (DistriCash family) — SEARCH-RESULTS bulk parser (Layer 1 logic, pure, no I/O).
 *
 * Companion to `inoshop-parse.ts`. Where that module maps ONE already-extracted
 * `.ARTICLE` row to a SupplierObservation, THIS module parses the full HTML of a
 * `POST /search` multi-ref response (schema captured 2026-06-05) and resolves, per
 * searched feed ref, the article row that is genuinely OURS — brand- and EAN-locked —
 * then classifies it into the ACTIVATION buckets used by the price-load pipeline.
 *
 * GENERIC over the brand: the caller passes a {@link BrandMatcher} (the portal labels
 * / short-codes that identify the brand being loaded — e.g. NK → ['NK','SBS'],
 * MECAFILTER → ['MECAFILTER','MEFI']). Nothing here is hardcoded to a single supplier
 * or brand, so the same classifier serves every future supplier/tariff.
 *
 * WHY a separate activation classifier (not `articleToObservation`): the truth engine
 * treats orange/orange+ as "available". The pricing-activation decision is STRICTER —
 * only `ag`/vert (local agency) and `grp`/vert+ (group) may ever become sellable;
 * everything else (arrivage, orange, partner, gris, contradictions, missing signal)
 * goes to REVIEW (human), and only `none`/rouge is auto-BLOCK. No false in-stock.
 *
 * Raw-HTML schema (per `<tr class="ARTICLE ARTICLE_CONTENT" ...>`), attribute names are
 * Capitalised in source but HTML attrs are case-insensitive so we read them so:
 *   data-Filtrecodearticle            internal code (e.g. SBS251908) — DEDUP KEY
 *   data-Filtrecodearticlefournisseur supplier ref (== our feed ref)
 *   data-Filtremarques                brand label (e.g. NK / SASIC / VALEO)
 *   data-ean                          EAN-13 — strongest product identity
 *   data-prix                         portal price
 *   data-stock                        NOISY integer/decimal — NOT the decision signal
 *   data-dispo-type                   ag | grp | arrivage | none — PRIMARY signal
 * Plus a child `<img src="/stock/{vert,vert+,orange,...}.png">` icon (corroboration).
 *
 * Pure: HTML string in → structured rows / verdicts out. Unit-testable without HTTP.
 */
import { classifyStockIcon, type StockIcon } from './inoshop-parse';

/** One product row extracted from the search-results HTML. */
export interface SearchRow {
  /** data-Filtrecodearticle — internal code (dedup key). */
  code: string;
  /** data-Filtrecodearticlefournisseur — supplier ref (matches our feed ref). */
  refFournisseur: string | null;
  /** data-Filtremarques — brand label. */
  marque: string | null;
  /** data-Filtremrq — short brand code (NK uses 'SBS'). */
  mrq: string | null;
  ean: string | null;
  prix: number | null;
  /** data-stock — kept for audit; NOT used for classification (noisy). */
  stockRaw: string | null;
  /** data-dispo-type lowercased — the decision signal. */
  dispoType: string | null;
  libelle: string | null;
  sousFamille: string | null;
  /** Stock icon filename (best-effort, corroboration only). */
  icon: string | null;
}

/**
 * Identifies which search rows belong to the brand currently being loaded.
 * `tokens` are matched case-insensitively against BOTH the brand label
 * (`data-Filtremarques`) and the short code (`data-Filtremrq`). A brand whose
 * portal short-code differs from its label (NK ⇒ code 'SBS') just lists both.
 */
export interface BrandMatcher {
  tokens: string[];
}

/** Build a normalized matcher (uppercased token set) once, reuse per row. */
export function brandTokenSet(brand: BrandMatcher): Set<string> {
  return new Set(
    brand.tokens.map((t) => t.trim().toUpperCase()).filter(Boolean),
  );
}

function attr(tag: string, name: string): string | null {
  // attribute names are case-insensitive in HTML; values are exact
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}
function numOrNull(s: string | null): number | null {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a STRUCTURAL code→icon map from the real (non-legend) stock images.
 * The portal binds each row's availability icon to its article code via a class
 * `icone-dispo-<code>` on the `<img src=".../stock/<state>.png">`. We key the icon
 * to the code (not a positional window) so the legend palette — which is HTML-entity
 * escaped (`&lt;img …&gt;`) and therefore never matches a raw `src="…"` — can never
 * be mistaken for a row's signal. Hardening from the 2026-06-05 adversarial review.
 */
function buildIconMap(html: string): Map<string, string> {
  const m = new Map<string, string>();
  const re =
    /icone-dispo-([A-Za-z0-9_-]+)"[^>]*?src="[^"]*\/stock\/([a-z+]+)\.png"/gi;
  let x: RegExpExecArray | null;
  while ((x = re.exec(html)) !== null) {
    if (!m.has(x[1])) m.set(x[1], `/stock/${x[2].toLowerCase()}.png`);
  }
  return m;
}

/**
 * Parse a `POST /search` results HTML into deduped product rows.
 * Each article renders as ≥2 `<tr>` (main row with `id`, plus a detail/responsive
 * row with `data-target`) — both carry the data-* attrs; we dedup by `code` and
 * bind each row's icon STRUCTURALLY via `icone-dispo-<code>` (no positional window).
 */
export function parseSearchHtml(html: string): SearchRow[] {
  const byCode = new Map<string, SearchRow>();
  const iconByCode = buildIconMap(html);
  // split on <tr ...>; the decision data-* live on the <tr> opening tag
  const segs = html.split(/<tr\b/i);
  for (let i = 1; i < segs.length; i++) {
    const seg = `<tr${segs[i]}`;
    const gt = seg.indexOf('>');
    if (gt < 0) continue;
    const tag = seg.slice(0, gt + 1);
    if (!/\bARTICLE\b/i.test(tag)) continue;
    const code = attr(tag, 'data-Filtrecodearticle');
    if (!code) continue; // header/sub rows without a product code
    const icon = iconByCode.get(code) ?? null;
    const row: SearchRow = {
      code,
      refFournisseur: attr(tag, 'data-Filtrecodearticlefournisseur'),
      marque: attr(tag, 'data-Filtremarques'),
      mrq: attr(tag, 'data-Filtremrq'),
      ean: attr(tag, 'data-ean'),
      prix: numOrNull(attr(tag, 'data-prix')),
      stockRaw: attr(tag, 'data-stock'),
      dispoType: (attr(tag, 'data-dispo-type') ?? '').toLowerCase() || null,
      libelle: attr(tag, 'data-Filtrelibelle'),
      sousFamille: attr(tag, 'data-Filtresous-familles-lib'),
      icon,
    };
    const prev = byCode.get(code);
    if (!prev) {
      byCode.set(code, row);
    } else {
      // merge richer signal across the duplicate rows of the same article
      if (!prev.icon && row.icon) prev.icon = row.icon;
      if (!prev.dispoType && row.dispoType) prev.dispoType = row.dispoType;
      if (!prev.ean && row.ean) prev.ean = row.ean;
      if (prev.prix == null && row.prix != null) prev.prix = row.prix;
    }
  }
  return [...byCode.values()];
}

/** Is this row our brand? (matches the brand label OR the short code, case-insensitive) */
export function isBrandRow(row: SearchRow, tokens: Set<string>): boolean {
  const m = (row.marque ?? '').toUpperCase();
  const q = (row.mrq ?? '').toUpperCase();
  return (m !== '' && tokens.has(m)) || (q !== '' && tokens.has(q));
}

export type MatchKind =
  | 'EAN'
  | 'REF_BRAND'
  | 'REF_BRAND_AMBIGUOUS'
  | 'FALSE_MATCH'
  | 'NOT_FOUND';

/** Prefer a row that actually carries a decision signal. */
function pickBestSignal(rows: SearchRow[]): SearchRow {
  return rows.find((r) => r.dispoType) ?? rows.find((r) => r.icon) ?? rows[0];
}

/**
 * Resolve the one row that IS our feed ref, brand- and EAN-locked.
 * EAN-first (globally unique product identity), then supplier-ref + our brand.
 * Distinguishes FALSE_MATCH (ref present but only other brands — e.g. a VALEO part
 * sharing the number) from NOT_FOUND (ref absent from results entirely).
 */
export function matchBrandRow(
  rows: SearchRow[],
  feedRef: string,
  feedEan: string | null,
  tokens: Set<string>,
): { row: SearchRow | null; kind: MatchKind } {
  if (feedEan) {
    const eanRows = rows.filter((r) => r.ean && r.ean === feedEan);
    const eanBrand = eanRows.filter((r) => isBrandRow(r, tokens));
    if (eanBrand.length) return { row: pickBestSignal(eanBrand), kind: 'EAN' };
    // EAN matched only OTHER-brand rows → cross-brand EAN anomaly. Do NOT lock a
    // foreign brand's availability; fall through to ref+brand (no mis-attribution).
  }
  const refRows = rows.filter((r) => r.refFournisseur === feedRef);
  const brandRows = refRows.filter((r) => isBrandRow(r, tokens));
  if (brandRows.length) {
    // no EAN identity lock AND multiple SKUs share this ref number → the SKU is
    // ambiguous; caller must not auto-sell it.
    const distinctCodes = new Set(brandRows.map((r) => r.code));
    const kind: MatchKind =
      !feedEan && distinctCodes.size > 1 ? 'REF_BRAND_AMBIGUOUS' : 'REF_BRAND';
    return { row: pickBestSignal(brandRows), kind };
  }
  if (refRows.length) return { row: null, kind: 'FALSE_MATCH' };
  return { row: null, kind: 'NOT_FOUND' };
}

export type ActivationBucket =
  | 'CONFIRMED_AG' // ag / vert  → future pri_dispo='1'
  | 'CONFIRMED_GRP' // grp / vert+ → future pri_dispo='2'
  | 'REVIEW_ARRIVAGE' // transit — NOT auto-PREORDER
  | 'REVIEW_NO_SIGNAL' // missing/unknown dispo-type or non-corroborated icon
  | 'REVIEW_NO_EAN' // ref+brand match w/o EAN lock AND several SKUs share the ref
  | 'REVIEW_CONTRADICTION' // dispo says stock but icon disagrees
  | 'REVIEW_FALSE_MATCH' // ref matched only other brands
  | 'REVIEW_NOT_FOUND' // ref absent from portal results
  | 'REVIEW_PORTAL_TIMEOUT' // ref persistently fails its OWN search (504s) while the portal is healthy → portal-side problem / irrelevant ref. Terminal skip, NEVER a stock signal.
  | 'BLOCK_NONE'; // none / rouge → future pri_dispo='0'

export interface RefVerdict {
  ref: string;
  ean: string | null;
  bucket: ActivationBucket;
  matchKind: MatchKind;
  reason: string;
  code: string | null;
  marque: string | null;
  dispoType: string | null;
  icon: StockIcon | null;
  portalPrix: number | null;
}

const GREEN_ICONS: ReadonlySet<StockIcon> = new Set<StockIcon>([
  'vert',
  'vert+',
]);

/**
 * Classify a matched row into an activation bucket.
 *
 * INVARIANT (no false in-stock): a row is CONFIRMED (→ sellable) ONLY when the
 * dispo-type (ag/grp) AND the structurally-bound icon (vert/vert+) BOTH agree.
 * dispo-type alone never auto-sells — an ag/grp row with a missing/orange/transport/
 * gris/unknown icon goes to REVIEW; an ag/grp+rouge or none+green disagreement goes
 * to REVIEW_CONTRADICTION (observable). Hardened per 2026-06-05 adversarial review.
 */
export function classifyForActivation(row: SearchRow): {
  bucket: ActivationBucket;
  reason: string;
  icon: StockIcon;
} {
  const d = (row.dispoType ?? '').toLowerCase();
  const icon: StockIcon = row.icon ? classifyStockIcon(row.icon) : 'unknown';
  if (d === 'ag' || d === 'grp') {
    const bucket: ActivationBucket =
      d === 'ag' ? 'CONFIRMED_AG' : 'CONFIRMED_GRP';
    if (GREEN_ICONS.has(icon)) return { bucket, reason: `${d}/${icon}`, icon };
    if (icon === 'rouge')
      return { bucket: 'REVIEW_CONTRADICTION', reason: `${d}+rouge`, icon };
    // ag/grp without a GREEN corroborating icon → never auto-sell on dispo alone
    return {
      bucket: 'REVIEW_NO_SIGNAL',
      reason: `${d}+noncorrob:${icon}`,
      icon,
    };
  }
  if (d === 'arrivage')
    return { bucket: 'REVIEW_ARRIVAGE', reason: `arrivage/${icon}`, icon };
  if (d === 'none')
    return GREEN_ICONS.has(icon)
      ? { bucket: 'REVIEW_CONTRADICTION', reason: `none+${icon}`, icon }
      : { bucket: 'BLOCK_NONE', reason: `none/${icon}`, icon };
  // unknown / empty dispo-type → conservative (never auto-confirm on icon alone)
  if (icon === 'rouge')
    return { bucket: 'BLOCK_NONE', reason: `nodispo/rouge`, icon };
  return {
    bucket: 'REVIEW_NO_SIGNAL',
    reason: `dispo='${d}' icon=${icon}`,
    icon,
  };
}

/** End-to-end: feed ref (+ean) + parsed rows + brand → one activation verdict. */
export function verdictForRef(
  rows: SearchRow[],
  feedRef: string,
  feedEan: string | null,
  tokens: Set<string>,
): RefVerdict {
  const { row, kind } = matchBrandRow(rows, feedRef, feedEan, tokens);
  if (!row) {
    return {
      ref: feedRef,
      ean: feedEan,
      bucket:
        kind === 'FALSE_MATCH' ? 'REVIEW_FALSE_MATCH' : 'REVIEW_NOT_FOUND',
      matchKind: kind,
      reason: kind,
      code: null,
      marque: null,
      dispoType: null,
      icon: null,
      portalPrix: null,
    };
  }
  const c = classifyForActivation(row);
  // An ambiguous ref+brand match (no EAN lock, several SKUs share the ref) must
  // never auto-sell — hold any would-be CONFIRMED for human review.
  const bucket: ActivationBucket =
    kind === 'REF_BRAND_AMBIGUOUS' && c.bucket.startsWith('CONFIRMED')
      ? 'REVIEW_NO_EAN'
      : c.bucket;
  const reason =
    bucket === c.bucket ? c.reason : `${c.reason}|ref_brand_ambiguous`;
  return {
    ref: feedRef,
    ean: feedEan,
    bucket,
    matchKind: kind,
    reason,
    code: row.code,
    marque: row.marque,
    dispoType: row.dispoType,
    icon: c.icon,
    portalPrix: row.prix,
  };
}
