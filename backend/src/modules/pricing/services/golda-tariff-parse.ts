/**
 * L0 — Golda tariff file parser (pure, zero I/O).
 *
 * Golda (tariff aggregator) publishes every manufacturer tariff in one shared
 * layout: a `;`-separated CSV, latin-1, CRLF, one header line, 105 columns
 * (fields 2–106 of Golda's "structure fichier tarif"). This module turns the
 * COMPLETE file (`complet` part — never the delta parts) into typed lines plus
 * a report. It decides neither the purchase price nor the availability:
 *   - AP = public (gross) price, NTP = net price, DIS = distributor price.
 *     DIS is neither gross nor our purchase price until a portal sample proves
 *     it; the gross is then the PPC column when present.
 *   - Qte_cond > 1 → the price is for the whole pack: emitted, never divided.
 *   - The deposit (consigne) is never part of the price: emitted apart.
 *   - SUP = discontinued by the manufacturer (positive proof). FIN or an
 *     end-of-life mention = end of life: a portal check, never a withdrawal.
 *
 * Every line the parser cannot interpret is rejected with a reason and counted
 * — never guessed, rounded or defaulted. Price outliers are NOT judged here: the
 * import dry-run compares against the DB (DELTA_EXCEEDS_MAX, VENTE_BELOW_ACHAT).
 *
 * Rules measured on 18 real files; the measurement notes stay with the tariff
 * files, outside this public repo.
 */

/** The 105 header columns, in file order. Any other header = format change → refuse the file. */
export const GOLDA_TARIFF_COLUMNS = [
  'Code_EAN',
  'Ref_fournisseur',
  'Art_substitution',
  'Art_remplace',
  'Description',
  'Qte_mini',
  'Udm_qte_mini',
  'Qte_cond',
  'Udm_qte_cond',
  'Prix_ppc',
  'Base_ppc',
  'Prix_euro',
  'Base_prix_euro',
  'Type_prix',
  'Poids',
  'Udm_poids',
  'Code_remise',
  'Code_sousfamille_NU',
  'Montant_consigne',
  'Code_classe_consigne',
  'Reference_consigne',
  'Ref_complementaire',
  'Code_metier',
  'Prix2',
  'Qte2',
  'Prix3',
  'Qte3',
  'Prix4',
  'Qte4',
  'Prix5',
  'Qte5',
  'Prix6',
  'Qte6',
  'Prix7',
  'Qte7',
  'Art_remplacement',
  'Qte_multiple',
  'Codes_constructeurs',
  'Code_marque',
  'ValeurHT_DEA_DEEE',
  'Code_DEA_DEEE',
  'Coefficient_TICPE',
  'Mention_Coeff_TICPE',
  'Valeur_TICPE',
  'Coeff_TGAP',
  'Mention_Coeff_TGAP',
  'Valeur_TGAP',
  'Udm_prix2x_qte2x',
  'Description_courte',
  'Qte_contenant',
  'Udm_qte_contenant',
  'Hauteur',
  'Longueur',
  'Largeur',
  'Udm_dimensions',
  'Classe_ADR',
  'Code_ONU',
  'Grp_emballage',
  'Symbol_danger',
  'Point_eclair',
  'Description_ADR',
  'Statut',
  'Description_complementaire',
  'Date_application',
  'Code_famille_NU',
  'Prefixe_tarif',
  'Date_fin_validite',
  'Num_jour_creation',
  'Ref_TecDoc',
  'Volume',
  'Udm_volume',
  'Code_pays',
  'GTIN_14',
  'Code_EAN_1',
  'Code_EAN_2',
  'Code_EAN_3',
  'Code_EAN_4',
  'Valeur_DDS',
  'DLC',
  'DLU',
  'Code_douane',
  'Code_famille_fournisseur',
  'Poids_net',
  'Qte_palette',
  'Surcharge_valeur',
  'Surcharge_type',
  'Surcharge_incluse',
  'URL',
  'Qte_mpack',
  'Poids_mpack',
  'Hauteur_mpack',
  'Largeur_mpack',
  'Longueur_mpack',
  'Volume_mpack',
  'Poids_palette',
  'Hauteur_palette',
  'Largeur_palette',
  'Longueur_palette',
  'Volume_palette',
  'Udm_qte_mpackpalette',
  'Udm_poids_mpackpalette',
  'Udm_dimensions_mpackpalette',
  'Udm_volume_mpackpalette',
  'Emballage',
  'GenArt_TecDoc',
] as const;

export type GoldaColumn = (typeof GOLDA_TARIFF_COLUMNS)[number];

/**
 * Price-affecting columns never seen populated (quantity prices, taxes,
 * surcharges, eco-contribution, price end date). A priced line that fills one
 * is rejected: the parser does not know how it combines with the price yet.
 */
export const GOLDA_UNSUPPORTED_COLUMNS: readonly GoldaColumn[] = [
  'Prix2',
  'Qte2',
  'Prix3',
  'Qte3',
  'Prix4',
  'Qte4',
  'Prix5',
  'Qte5',
  'Prix6',
  'Qte6',
  'Prix7',
  'Qte7',
  'Udm_prix2x_qte2x',
  'ValeurHT_DEA_DEEE',
  'Code_DEA_DEEE',
  'Coefficient_TICPE',
  'Mention_Coeff_TICPE',
  'Valeur_TICPE',
  'Coeff_TGAP',
  'Mention_Coeff_TGAP',
  'Valeur_TGAP',
  'Valeur_DDS',
  'Surcharge_valeur',
  'Surcharge_type',
  'Surcharge_incluse',
  'Date_fin_validite',
];

export type GoldaPriceType = 'AP' | 'NTP' | 'DIS';
export type GoldaStatus = 'UNCHANGED' | 'NOU' | 'MOD' | 'FIN' | 'SUP';
export type GoldaMentionClass =
  | 'END_OF_LIFE'
  | 'SUCCESSOR_ANNOUNCED'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'UNCLASSIFIED';
export type GoldaLifecycle = 'ACTIVE' | 'END_OF_LIFE' | 'DISCONTINUED';
export type GoldaSuccessorSource =
  | 'ART_REMPLACEMENT'
  | 'ART_SUBSTITUTION'
  | 'ART_REMPLACE_LOOKUP';

export type GoldaRejectReason =
  | 'WRONG_COLUMN_COUNT'
  | 'STRAY_LINE_BREAK'
  | 'MISSING_BRAND_CODE'
  | 'MISSING_REF'
  | 'UNKNOWN_STATUS'
  | 'UNSUPPORTED_PRICE_TYPE'
  | 'MISSING_PRICE'
  | 'PRICE_BASE_NOT_ONE'
  | 'INVALID_NUMBER'
  | 'NON_POSITIVE_PRICE'
  | 'SUB_CENT_PRICE'
  | 'PACK_UNIT_NOT_PCE'
  | 'MISSING_PACK_QTY'
  | 'UNSUPPORTED_FIELD'
  | 'INVALID_DATE'
  | 'DEPOSIT_RECORD'
  | 'DUPLICATE_KEY';

export interface GoldaTariffLine {
  /** 1-based physical line in the file (the header is line 1). */
  lineNo: number;
  /** Code_marque, trimmed and uppercased. With `ref`, the line's unique key. */
  brandCode: string;
  /** Ref_fournisseur uppercased, whitespace removed. Separators are KEPT (no A-Z0-9 folding). */
  ref: string;
  /** Ref_fournisseur as published (trimmed) — for portal searches. */
  refPublished: string;
  refComplementary: string | null;
  ean: string | null;
  /** null only on a SUP line whose Type_prix is not a supported type. */
  priceType: GoldaPriceType | null;
  /** Prix_euro (Base_prix_euro = 1) in cents; null on SUP lines. Price of the whole pack when packQty > 1. */
  priceCents: number | null;
  ppcCents: number | null;
  /** Public/gross price: AP price, else the PPC when present. */
  grossCents: number | null;
  /** Net price: NTP price only. */
  netCents: number | null;
  /** Distributor price: DIS price only — not a purchase price until a portal sample proves it. */
  distributorCents: number | null;
  /** True when an AP line carries a PPC different from its price. */
  ppcMismatch: boolean;
  /** Qte_cond (unit PCE): set on every priced line, null on SUP lines. */
  packQty: number | null;
  minQty: number | null;
  minQtyUnit: string | null;
  multipleQty: number | null;
  /** Never included in any price. Not read on SUP lines. */
  depositCents: number | null;
  depositClass: string | null;
  depositRef: string | null;
  /** Code_remise — same key as pieces_price.pri_code_remise. */
  remiseCode: string | null;
  subfamilyNu: string | null;
  status: GoldaStatus;
  /** Art_substitution when it is not a reference (no digit), spaces collapsed, uppercased. */
  mention: string | null;
  mentionClass: GoldaMentionClass | null;
  lifecycle: GoldaLifecycle;
  /** Successor key (same normalization as `ref`), or null. */
  successor: string | null;
  successorSource: GoldaSuccessorSource | null;
  /** Date_application (yyyy-mm-dd, a real calendar day), the line's price effective date. Not read on SUP lines. */
  effectiveDate: string | null;
}

export interface GoldaRejectedLine {
  lineNo: number;
  reason: GoldaRejectReason;
  detail?: string;
}

export interface GoldaParseReport {
  dataLines: number;
  acceptedLines: number;
  rejectedLines: number;
  rejectedByReason: Partial<Record<GoldaRejectReason, number>>;
  byStatus: Record<GoldaStatus, number>;
  byLifecycle: Record<GoldaLifecycle, number>;
  byPriceType: Partial<Record<GoldaPriceType, number>>;
  byBrandCode: Record<string, number>;
  /** Priced lines whose price is for a pack (Qte_cond > 1) — unit check required before import. */
  packQtyAboveOne: number;
  /** Lines that cannot be bought one by one (Qte_mini or Qte_multiple > 1). */
  orderQtyAboveOne: number;
  withDeposit: number;
  ppcMismatch: number;
  /**
   * Lines whose `Art_remplace` lookup picks no successor although the file
   * declares one: several active lines declare `Art_remplace` = this ref, or a
   * line rejected for its content does (its lifecycle is unknown).
   */
  successorAmbiguous: number;
  /** Lines whose Art_remplacement or Art_substitution names the line itself: ignored, next step tried. */
  successorSelf: number;
  /** Mentions outside the closed list, by text (`<column>: <text>`). */
  unclassifiedMentions: Record<string, number>;
}

export interface GoldaParseResult {
  lines: GoldaTariffLine[];
  rejected: GoldaRejectedLine[];
  report: GoldaParseReport;
}

/** File-level format error: the whole file is refused. */
export class GoldaFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldaFormatError';
  }
}

class LineReject extends Error {
  constructor(
    readonly reason: GoldaRejectReason,
    readonly detail?: string,
  ) {
    super(reason);
  }
}

const COLUMN_INDEX = new Map<GoldaColumn, number>(
  GOLDA_TARIFF_COLUMNS.map((c, i) => [c, i]),
);
const PRICE_TYPES: readonly string[] = ['AP', 'NTP', 'DIS'];
// A Map, not an object literal: a Statut such as 'constructor' must not resolve.
const STATUS_BY_CODE: ReadonlyMap<string, GoldaStatus> = new Map([
  ['', 'UNCHANGED'],
  ['NOU', 'NOU'],
  ['MOD', 'MOD'],
  ['FIN', 'FIN'],
  ['SUP', 'SUP'],
]);
const DECIMAL = /^(\d+)(?:\.(\d{1,3}))?$/;
const INTEGER = /^\d+$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_DIGIT = /\d/;

/** Line key form: uppercase, all whitespace removed. Never folds separators. */
export function goldaRefKey(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}

/** Closed mention list (Art_substitution without a digit). Anything else = UNCLASSIFIED. */
export function classifyGoldaMention(mention: string): GoldaMentionClass {
  if (mention.includes('EPUISEMENT') || mention === 'STOCK') {
    return 'END_OF_LIFE';
  }
  if (mention === 'REFERENCE REMPLACEE') return 'SUCCESSOR_ANNOUNCED';
  if (mention === 'TEMPORAIREMENT INDISPONIBLE') {
    return 'TEMPORARILY_UNAVAILABLE';
  }
  return 'UNCLASSIFIED';
}

function normalizeMention(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Euros with up to 3 decimals → integer cents, no floating point. A non-zero 3rd decimal is refused. */
function parseCents(raw: string, column: GoldaColumn): number {
  const m = DECIMAL.exec(raw);
  if (!m) throw new LineReject('INVALID_NUMBER', column);
  const decimals = (m[2] ?? '').padEnd(3, '0');
  if (decimals[2] !== '0') throw new LineReject('SUB_CENT_PRICE', column);
  const cents = Number(m[1]) * 100 + Number(decimals.slice(0, 2));
  if (!Number.isSafeInteger(cents)) {
    throw new LineReject('INVALID_NUMBER', column);
  }
  return cents;
}

function parseQty(raw: string, column: GoldaColumn): number | null {
  if (raw === '') return null;
  const qty = Number(raw);
  if (!INTEGER.test(raw) || !Number.isSafeInteger(qty) || qty < 1) {
    throw new LineReject('INVALID_NUMBER', column);
  }
  return qty;
}

/** yyyy-mm-dd naming a real calendar day (rejects 0000-00-00, 2026-02-31). */
function isCalendarDate(raw: string): boolean {
  const m = ISO_DATE.exec(raw);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === mo - 1 &&
    t.getUTCDate() === d
  );
}

function orNull(v: string): string | null {
  return v === '' ? null : v;
}

interface DraftLine {
  line: GoldaTariffLine;
  /**
   * Art_remplace key — for the successor lookup. Never split: ',' and '+'
   * occur inside real refs, so a list cannot be told from a single ref.
   */
  replacesKey: string | null;
  /** Art_remplacement / Art_substitution keys, when they are references. */
  replacementKey: string | null;
  substitutionKey: string | null;
}

type ColumnReader = (c: GoldaColumn) => string;

function columnReader(fields: string[]): ColumnReader {
  return (c) => fields[COLUMN_INDEX.get(c) as number].trim();
}

/** `brand|ref` line key, or null when the brand code or the ref is empty. */
function lineKeyOf(get: ColumnReader): string | null {
  const brandCode = get('Code_marque').toUpperCase();
  const ref = goldaRefKey(get('Ref_fournisseur'));
  return brandCode === '' || ref === '' ? null : `${brandCode}|${ref}`;
}

function parseLine(
  get: ColumnReader,
  lineNo: number,
  unclassified: Map<string, number>,
): DraftLine {
  const brandCode = get('Code_marque').toUpperCase();
  if (brandCode === '') throw new LineReject('MISSING_BRAND_CODE');
  const refPublished = get('Ref_fournisseur');
  const ref = goldaRefKey(refPublished);
  if (ref === '') throw new LineReject('MISSING_REF');
  const depositRef = orNull(get('Reference_consigne'));
  if (depositRef !== null && goldaRefKey(depositRef) === ref) {
    // Possibly the deposit take-back record (structure field 22): reported, not an article.
    throw new LineReject('DEPOSIT_RECORD');
  }

  const statusCode = get('Statut');
  const status = STATUS_BY_CODE.get(statusCode);
  if (status === undefined) {
    throw new LineReject('UNKNOWN_STATUS', statusCode);
  }
  const discontinued = status === 'SUP';

  const typeCode = get('Type_prix');
  const priceType = PRICE_TYPES.includes(typeCode)
    ? (typeCode as GoldaPriceType)
    : null;

  // SUP lines carry no price, base, deposit amount nor date: those fields are
  // not read, so an odd value there never costs the withdrawal proof.
  let priceCents: number | null = null;
  let ppcCents: number | null = null;
  let packQty: number | null = null;
  if (!discontinued) {
    if (priceType === null) {
      throw new LineReject('UNSUPPORTED_PRICE_TYPE', typeCode);
    }
    for (const c of GOLDA_UNSUPPORTED_COLUMNS) {
      if (get(c) !== '') throw new LineReject('UNSUPPORTED_FIELD', c);
    }
    const price = get('Prix_euro');
    if (price === '') throw new LineReject('MISSING_PRICE');
    if (get('Base_prix_euro') !== '1') {
      throw new LineReject('PRICE_BASE_NOT_ONE', 'Base_prix_euro');
    }
    priceCents = parseCents(price, 'Prix_euro');
    if (priceCents <= 0)
      throw new LineReject('NON_POSITIVE_PRICE', 'Prix_euro');
    const ppc = get('Prix_ppc');
    if (ppc !== '') {
      if (get('Base_ppc') !== '1') {
        throw new LineReject('PRICE_BASE_NOT_ONE', 'Base_ppc');
      }
      ppcCents = parseCents(ppc, 'Prix_ppc');
      if (ppcCents <= 0) throw new LineReject('NON_POSITIVE_PRICE', 'Prix_ppc');
    }
    // The price unit must be known: a pack of PCE, quantity given.
    const packUnit = get('Udm_qte_cond');
    if (packUnit !== 'PCE') throw new LineReject('PACK_UNIT_NOT_PCE', packUnit);
    packQty = parseQty(get('Qte_cond'), 'Qte_cond');
    if (packQty === null) throw new LineReject('MISSING_PACK_QTY');
  }

  const minQty = discontinued ? null : parseQty(get('Qte_mini'), 'Qte_mini');
  const multipleQty = discontinued
    ? null
    : parseQty(get('Qte_multiple'), 'Qte_multiple');

  const depositRaw = discontinued ? '' : get('Montant_consigne');
  const depositCents =
    depositRaw === '' ? null : parseCents(depositRaw, 'Montant_consigne');

  const effectiveDate = discontinued ? null : orNull(get('Date_application'));
  if (effectiveDate !== null && !isCalendarDate(effectiveDate)) {
    throw new LineReject('INVALID_DATE', 'Date_application');
  }

  const substitution = get('Art_substitution');
  let mention: string | null = null;
  let mentionClass: GoldaMentionClass | null = null;
  let substitutionKey: string | null = null;
  if (substitution !== '') {
    if (HAS_DIGIT.test(substitution)) {
      substitutionKey = goldaRefKey(substitution);
    } else {
      mention = normalizeMention(substitution);
      mentionClass = classifyGoldaMention(mention);
      if (mentionClass === 'UNCLASSIFIED') {
        const k = `Art_substitution: ${mention}`;
        unclassified.set(k, (unclassified.get(k) ?? 0) + 1);
      }
    }
  }
  const replacement = get('Art_remplacement');
  let replacementKey: string | null = null;
  if (replacement !== '') {
    if (HAS_DIGIT.test(replacement)) {
      replacementKey = goldaRefKey(replacement);
    } else {
      const k = `Art_remplacement: ${normalizeMention(replacement)}`;
      unclassified.set(k, (unclassified.get(k) ?? 0) + 1);
    }
  }
  const replaces = get('Art_remplace');

  const lifecycle: GoldaLifecycle = discontinued
    ? 'DISCONTINUED'
    : status === 'FIN' || mentionClass === 'END_OF_LIFE'
      ? 'END_OF_LIFE'
      : 'ACTIVE';

  return {
    line: {
      lineNo,
      brandCode,
      ref,
      refPublished,
      refComplementary: orNull(get('Ref_complementaire')),
      ean: orNull(get('Code_EAN')),
      priceType,
      priceCents,
      ppcCents,
      grossCents: priceType === 'AP' ? priceCents : ppcCents,
      netCents: priceType === 'NTP' ? priceCents : null,
      distributorCents: priceType === 'DIS' ? priceCents : null,
      ppcMismatch:
        priceType === 'AP' && ppcCents !== null && ppcCents !== priceCents,
      packQty,
      minQty,
      minQtyUnit: discontinued ? null : orNull(get('Udm_qte_mini')),
      multipleQty,
      depositCents,
      depositClass: orNull(get('Code_classe_consigne')),
      depositRef,
      remiseCode: orNull(get('Code_remise')),
      subfamilyNu: orNull(get('Code_sousfamille_NU')),
      status,
      mention,
      mentionClass,
      lifecycle,
      successor: null,
      successorSource: null,
      effectiveDate,
    },
    replacesKey: replaces === '' ? null : goldaRefKey(replaces),
    replacementKey,
    substitutionKey,
  };
}

/**
 * Parse a COMPLETE Golda tariff CSV (raw bytes, decoded as latin-1).
 * Throws GoldaFormatError when the file itself is not a Golda tariff CSV.
 */
export function parseGoldaTariffCsv(bytes: Uint8Array): GoldaParseResult {
  const text = Buffer.from(bytes).toString('latin1');
  const physical = text.split('\r\n');
  if (physical.length > 0 && physical[physical.length - 1] === '') {
    physical.pop();
  }
  if (physical.length === 0) throw new GoldaFormatError('empty file');
  const header = physical[0].split(';');
  if (
    header.length !== GOLDA_TARIFF_COLUMNS.length ||
    header.some((c, i) => c !== GOLDA_TARIFF_COLUMNS[i])
  ) {
    throw new GoldaFormatError(
      `header is not the ${GOLDA_TARIFF_COLUMNS.length}-column Golda layout`,
    );
  }
  if (physical.length === 1) throw new GoldaFormatError('no data line');

  const rejected: GoldaRejectedLine[] = [];
  const rows: { lineNo: number; get: ColumnReader; key: string | null }[] = [];
  for (let i = 1; i < physical.length; i++) {
    const lineNo = i + 1;
    const raw = physical[i];
    if (raw.includes('\n') || raw.includes('\r')) {
      // A whole record behind a bare CR or LF = mixed line endings, not a
      // stray break.
      if (
        raw
          .split(/[\r\n]/)
          .some((p) => p.split(';').length === GOLDA_TARIFF_COLUMNS.length)
      ) {
        throw new GoldaFormatError(
          `line ${lineNo}: records separated by a bare CR or LF`,
        );
      }
      rejected.push({ lineNo, reason: 'STRAY_LINE_BREAK' });
      continue;
    }
    const fields = raw.split(';');
    if (fields.length !== GOLDA_TARIFF_COLUMNS.length) {
      rejected.push({
        lineNo,
        reason: 'WRONG_COLUMN_COUNT',
        detail: String(fields.length),
      });
      continue;
    }
    const get = columnReader(fields);
    rows.push({ lineNo, get, key: lineKeyOf(get) });
  }

  // A key seen twice is ambiguous: every occurrence is rejected, none is picked.
  // Counted over every readable line, so a twin rejected for another reason
  // still blocks the other occurrence.
  const keyCount = new Map<string, number>();
  for (const r of rows) {
    if (r.key !== null) keyCount.set(r.key, (keyCount.get(r.key) ?? 0) + 1);
  }
  const kept: DraftLine[] = [];
  /** `brand|ref` keys declared in Art_remplace by a rejected line. */
  const replacedByRejected = new Set<string>();
  const unclassified = new Map<string, number>();
  for (const r of rows) {
    try {
      const d = parseLine(r.get, r.lineNo, unclassified);
      if ((keyCount.get(r.key as string) ?? 0) > 1) {
        throw new LineReject('DUPLICATE_KEY', d.line.ref);
      }
      kept.push(d);
    } catch (e) {
      if (!(e instanceof LineReject)) throw e;
      rejected.push({ lineNo: r.lineNo, reason: e.reason, detail: e.detail });
      const brandCode = r.get('Code_marque').toUpperCase();
      const replaces = goldaRefKey(r.get('Art_remplace'));
      if (brandCode !== '' && replaces !== '') {
        replacedByRejected.add(`${brandCode}|${replaces}`);
      }
    }
  }
  rejected.sort((a, b) => a.lineNo - b.lineNo);

  // Successor: Art_remplacement, then Art_substitution (each ignored when it
  // names the line itself), then the single ACTIVE line of the same brand whose
  // Art_remplace is this ref. Several, or a rejected declarer = ambiguous.
  const replacedBy = new Map<string, string[]>();
  for (const d of kept) {
    if (d.replacesKey === null || d.line.lifecycle !== 'ACTIVE') continue;
    const k = `${d.line.brandCode}|${d.replacesKey}`;
    const group = replacedBy.get(k);
    if (group) group.push(d.line.ref);
    else replacedBy.set(k, [d.line.ref]);
  }
  let successorAmbiguous = 0;
  let successorSelf = 0;
  for (const d of kept) {
    const own = d.line.ref;
    if (d.replacementKey === own || d.substitutionKey === own) successorSelf++;
    if (d.replacementKey !== null && d.replacementKey !== own) {
      d.line.successor = d.replacementKey;
      d.line.successorSource = 'ART_REMPLACEMENT';
    } else if (d.substitutionKey !== null && d.substitutionKey !== own) {
      d.line.successor = d.substitutionKey;
      d.line.successorSource = 'ART_SUBSTITUTION';
    } else {
      const k = `${d.line.brandCode}|${own}`;
      const candidates = (replacedBy.get(k) ?? []).filter((r) => r !== own);
      if (candidates.length > 1 || replacedByRejected.has(k)) {
        successorAmbiguous++;
      } else if (candidates.length === 1) {
        d.line.successor = candidates[0];
        d.line.successorSource = 'ART_REMPLACE_LOOKUP';
      }
    }
  }

  const lines = kept.map((d) => d.line);
  const report: GoldaParseReport = {
    dataLines: physical.length - 1,
    acceptedLines: lines.length,
    rejectedLines: rejected.length,
    rejectedByReason: {},
    byStatus: { UNCHANGED: 0, NOU: 0, MOD: 0, FIN: 0, SUP: 0 },
    byLifecycle: { ACTIVE: 0, END_OF_LIFE: 0, DISCONTINUED: 0 },
    byPriceType: {},
    byBrandCode: {},
    packQtyAboveOne: 0,
    orderQtyAboveOne: 0,
    withDeposit: 0,
    ppcMismatch: 0,
    successorAmbiguous,
    successorSelf,
    unclassifiedMentions: Object.fromEntries(unclassified),
  };
  for (const r of rejected) {
    report.rejectedByReason[r.reason] =
      (report.rejectedByReason[r.reason] ?? 0) + 1;
  }
  for (const l of lines) {
    report.byStatus[l.status]++;
    report.byLifecycle[l.lifecycle]++;
    report.byBrandCode[l.brandCode] =
      (report.byBrandCode[l.brandCode] ?? 0) + 1;
    if (l.priceCents !== null && l.priceType !== null) {
      report.byPriceType[l.priceType] =
        (report.byPriceType[l.priceType] ?? 0) + 1;
    }
    if ((l.packQty ?? 1) > 1) report.packQtyAboveOne++;
    if ((l.minQty ?? 1) > 1 || (l.multipleQty ?? 1) > 1) {
      report.orderQtyAboveOne++;
    }
    if (l.depositCents !== null && l.depositCents > 0) report.withDeposit++;
    if (l.ppcMismatch) report.ppcMismatch++;
  }
  return { lines, rejected, report };
}
