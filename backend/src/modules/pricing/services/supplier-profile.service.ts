/**
 * L0.5 — Import Profile (supplier-convention normalization).
 *
 * Each supplier/equipementier/platform ships its own file format: prices in
 * net / brut / public, derived by remise or marge, and the convention varies by
 * family / sub-family within one brand. This layer translates ANY declared
 * convention into the canonical inputs consumed by L1 — one parser, N governed
 * profiles, never per-supplier code.
 *
 * `column_mapping` is STRICTLY a column→field map + a whitelisted primitive
 * transform. No expressions / conditions / formulas (anti hidden-DSL). Any
 * unknown transform or missing required column = explicit reject (no guessing).
 *
 * Pure functions, zero I/O. Profile rows are fetched by L3 and passed in.
 */
import { Injectable } from '@nestjs/common';
import { computeAchatHtCents, eurToCents } from './pricing-formula.service';
import { normalizeSupplierReference } from '../utils/normalize-supplier-reference';

export type PriceBasis = 'NET' | 'BRUT' | 'PUBLIC' | 'NET_GROSSISTE';
export type Derivation = 'DIRECT_NET' | 'REMISE_ON_BRUT' | 'REMISE_ON_PUBLIC' | 'MARGE_ON_NET';
export type ScopeLevel = 'SUPPLIER' | 'BRAND' | 'FAMILY' | 'SUBFAMILY';
export type KeyField = 'REF' | 'EAN';
export type ParseConfidence =
  | 'HIGH_CONFIDENCE'
  | 'AMBIGUOUS_MAPPING'
  | 'FALLBACK_MATCH'
  | 'EAN_FALLBACK';

export const PRIMITIVE_TRANSFORMS = ['none', 'trim', 'decimalComma', 'percent'] as const;
export type PrimitiveTransform = (typeof PRIMITIVE_TRANSFORMS)[number];

export type CanonicalField = 'ref' | 'ean' | 'grosHt' | 'remise' | 'achatHt' | 'marge' | 'publicHt';

export interface ColumnSpec {
  column: string;
  transform?: PrimitiveTransform;
}

export interface SupplierPriceProfile {
  id: number;
  supplierId: string;
  scopeLevel: ScopeLevel;
  /** code_fam_nu / code_sfam_nu / null (SUPPLIER|BRAND). */
  scopeCode: string | null;
  priceBasis: PriceBasis;
  derivation: Derivation;
  columnMapping: Partial<Record<CanonicalField, ColumnSpec>>;
  keyField: KeyField;
  version: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  active: boolean;
}

export interface CanonicalImportRow {
  ref: string;
  ean: string;
  achatHtCents: number;
  margePct?: number;
  grosHtCents?: number;
  remisePct?: number;
  confidence: ParseConfidence;
}

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

const SCOPE_SPECIFICITY: Record<ScopeLevel, number> = {
  SUBFAMILY: 3,
  FAMILY: 2,
  BRAND: 1,
  SUPPLIER: 0,
};

/** Validate a profile's column_mapping — rejects any non-whitelisted transform (anti-DSL). */
export function validateProfile(profile: SupplierPriceProfile): void {
  for (const [field, spec] of Object.entries(profile.columnMapping)) {
    if (!spec || typeof spec.column !== 'string' || spec.column.trim() === '') {
      throw new ProfileError(`Profile ${profile.id}: field "${field}" has no column`);
    }
    if (spec.transform != null && !PRIMITIVE_TRANSFORMS.includes(spec.transform)) {
      throw new ProfileError(
        `Profile ${profile.id}: field "${field}" uses non-whitelisted transform "${spec.transform}" (anti-DSL)`,
      );
    }
  }
}

function applyTransform(raw: string, transform: PrimitiveTransform = 'none'): string {
  switch (transform) {
    case 'trim':
      return raw.trim();
    case 'decimalComma':
      return raw.replace(',', '.').trim();
    case 'percent':
      return raw.replace('%', '').trim();
    case 'none':
    default:
      return raw;
  }
}

function readField(
  row: Record<string, string>,
  profile: SupplierPriceProfile,
  field: CanonicalField,
): string | undefined {
  const spec = profile.columnMapping[field];
  if (!spec) return undefined;
  const raw = row[spec.column];
  if (raw == null) return undefined;
  return applyTransform(raw, spec.transform);
}

function readNumber(
  row: Record<string, string>,
  profile: SupplierPriceProfile,
  field: CanonicalField,
): number | undefined {
  const v = readField(row, profile, field);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new ProfileError(`Profile ${profile.id}: field "${field}" is not numeric ("${v}")`);
  }
  return n;
}

function requireField(value: number | undefined, profile: SupplierPriceProfile, field: string): number {
  if (value == null) {
    throw new ProfileError(
      `Profile ${profile.id} (${profile.derivation}): missing required column for "${field}"`,
    );
  }
  return value;
}

/** Resolve the most specific applicable profile (SUBFAMILY > FAMILY > BRAND > SUPPLIER). */
export function resolveProfile(
  profiles: readonly SupplierPriceProfile[],
  ctx: { supplierId: string; famCode?: string | null; sfamCode?: string | null; at?: Date },
): SupplierPriceProfile | null {
  const at = (ctx.at ?? new Date()).getTime();
  const matches = profiles.filter((p) => {
    if (!p.active || p.supplierId !== ctx.supplierId) return false;
    if (p.effectiveFrom && at < new Date(p.effectiveFrom).getTime()) return false;
    if (p.effectiveTo && at >= new Date(p.effectiveTo).getTime()) return false;
    if (p.scopeLevel === 'SUBFAMILY') return p.scopeCode === ctx.sfamCode;
    if (p.scopeLevel === 'FAMILY') return p.scopeCode === ctx.famCode;
    return true; // SUPPLIER / BRAND
  });
  if (matches.length === 0) return null;
  matches.sort((a, b) => SCOPE_SPECIFICITY[b.scopeLevel] - SCOPE_SPECIFICITY[a.scopeLevel]);
  return matches[0];
}

/** Translate one raw file row into canonical inputs for L1, per the profile. */
export function resolveCanonicalInputs(
  row: Record<string, string>,
  profile: SupplierPriceProfile,
): CanonicalImportRow {
  const ref = normalizeSupplierReference(readField(row, profile, 'ref'));
  const ean = (readField(row, profile, 'ean') ?? '').trim();

  let confidence: ParseConfidence;
  if (profile.keyField === 'REF' && ref !== '') confidence = 'HIGH_CONFIDENCE';
  else if (ean !== '') confidence = 'EAN_FALLBACK';
  else throw new ProfileError(`Profile ${profile.id}: row has neither usable ref nor EAN`);

  let achatHtCents: number;
  let margePct: number | undefined;
  let grosHtCents: number | undefined;
  let remisePct: number | undefined;

  switch (profile.derivation) {
    case 'DIRECT_NET': {
      achatHtCents = eurToCents(requireField(readNumber(row, profile, 'achatHt'), profile, 'achatHt'));
      break;
    }
    case 'REMISE_ON_BRUT': {
      const gros = requireField(readNumber(row, profile, 'grosHt'), profile, 'grosHt');
      remisePct = requireField(readNumber(row, profile, 'remise'), profile, 'remise');
      grosHtCents = eurToCents(gros);
      achatHtCents = computeAchatHtCents(grosHtCents, remisePct);
      break;
    }
    case 'REMISE_ON_PUBLIC': {
      const pub = requireField(readNumber(row, profile, 'publicHt'), profile, 'publicHt');
      remisePct = requireField(readNumber(row, profile, 'remise'), profile, 'remise');
      achatHtCents = computeAchatHtCents(eurToCents(pub), remisePct);
      break;
    }
    case 'MARGE_ON_NET': {
      achatHtCents = eurToCents(requireField(readNumber(row, profile, 'achatHt'), profile, 'achatHt'));
      margePct = requireField(readNumber(row, profile, 'marge'), profile, 'marge');
      break;
    }
    default:
      throw new ProfileError(`Profile ${profile.id}: unsupported derivation "${profile.derivation}"`);
  }

  return { ref, ean, achatHtCents, margePct, grosHtCents, remisePct, confidence };
}

@Injectable()
export class SupplierProfileService {
  validateProfile = validateProfile;
  resolveProfile = resolveProfile;
  resolveCanonicalInputs = resolveCanonicalInputs;
}
