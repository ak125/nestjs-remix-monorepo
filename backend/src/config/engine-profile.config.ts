/**
 * Engine profile derivation — pure helper functions.
 *
 * ADR-022 Pilier A — R8 duplicate content fix. Used by `R8VehicleEnricherService`
 * to derive a synthetic engine profile key (`<fuel>_<power_tier>`) and an Euro
 * norm hint from the type's first production year. These helpers carry NO
 * business content : the S_MOTOR_ISSUES content is composed at runtime by
 * `GammeSymptomReader` from the gamme RAG (`/opt/automecanik/rag/knowledge/
 * gammes/<slug>.md` frontmatter) using slugs returned by the enricher's A1
 * `fetchWearGammesByType()` query on `pieces_relation_type`.
 *
 * Why a synthetic profile then ? Only as a stable fallback key for sibling
 * grouping in metrics / future plumbing — content is never keyed on it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Fuel =
  | 'essence'
  | 'diesel'
  | 'hybride_essence'
  | 'hybride_diesel'
  | 'electrique'
  | 'gpl'
  | 'ethanol'
  | 'inconnu';

export type PowerTier =
  | 'p1_mini'
  | 'p2_basse'
  | 'p3_moyenne'
  | 'p4_haute'
  | 'p5_sport'
  | 'p6_tres_haute';

export type EngineProfileKey = `${Fuel}_${PowerTier}`;

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivations
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_ACCENTS_RE = /[̀-ͯ]/g;

/**
 * Normalize a raw fuel string from `auto_type.type_fuel` into a canonical Fuel.
 * Handles accents (Essence-Électrique / Essence-Electrique both → hybride_essence).
 */
export function normalizeFuel(raw?: string | null): Fuel {
  if (!raw) return 'inconnu';
  const s = raw
    .normalize('NFD')
    .replace(STRIP_ACCENTS_RE, '')
    .toLowerCase()
    .trim();
  if (s.includes('electrique') && s.includes('essence'))
    return 'hybride_essence';
  if (s.includes('electrique') && s.includes('diesel')) return 'hybride_diesel';
  if (s === 'electrique') return 'electrique';
  if (s === 'diesel') return 'diesel';
  if (s === 'essence') return 'essence';
  if (s.includes('gpl') || s.includes('lpg')) return 'gpl';
  if (s.includes('ethanol') || s.includes('e85')) return 'ethanol';
  return 'inconnu';
}

/**
 * Map horsepower (ps) to canonical power tier. Boundaries validated against
 * DB distribution audit 2026-04-24 — top 11 (fuel × tier) combinations cover
 * 85 % of the active catalog.
 */
export function derivePowerTier(powerPs: number): PowerTier {
  if (!Number.isFinite(powerPs) || powerPs <= 0) return 'p3_moyenne';
  if (powerPs < 75) return 'p1_mini';
  if (powerPs < 100) return 'p2_basse';
  if (powerPs < 130) return 'p3_moyenne';
  if (powerPs < 170) return 'p4_haute';
  if (powerPs < 230) return 'p5_sport';
  return 'p6_tres_haute';
}

/**
 * Compose the (fuel × tier) key. Accepts raw strings as they come from RPC.
 */
export function deriveEngineProfile(
  fuel?: string | null,
  powerPs?: string | number | null,
): EngineProfileKey {
  const f = normalizeFuel(fuel);
  const ps =
    typeof powerPs === 'number'
      ? powerPs
      : parseInt(String(powerPs || '0'), 10);
  const tier = derivePowerTier(ps);
  return `${f}_${tier}` as EngineProfileKey;
}

/**
 * Best-effort Euro norm hint from `auto_type.type_year_from`. Note : the
 * legal Euro category depends on the date d'immatriculation, not on the
 * type's year_from in the DB. Returned as an SEO hint only.
 */
export function deriveEuroNorm(
  yearFrom?: string | number | null,
): string | null {
  const y =
    typeof yearFrom === 'number'
      ? yearFrom
      : parseInt(String(yearFrom || '0'), 10);
  if (!Number.isFinite(y) || y <= 1980) return null;
  if (y < 1996) return 'Euro 1';
  if (y < 2000) return 'Euro 2';
  if (y < 2005) return 'Euro 3';
  if (y < 2009) return 'Euro 4';
  if (y < 2014) return 'Euro 5';
  if (y < 2017) return 'Euro 6b';
  if (y < 2020) return 'Euro 6c';
  return 'Euro 6d';
}
