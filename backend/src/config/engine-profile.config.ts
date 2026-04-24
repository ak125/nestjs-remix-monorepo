/**
 * Engine profile derivation — pure functions only.
 *
 * ADR-022 Pilier A — R8 duplicate content fix. Because `auto_type_motor_code`
 * is empty for ~100 % of the catalog (DB audit 2026-04-24), we cannot key
 * content on engine_codes (K9K, F4R…). Instead we derive a synthetic profile
 * from (fuel × power_tier), giving 16 profiles covering ~90 % of the catalog.
 *
 * This module holds ONLY the type aliases and derivation helpers.
 * Business content (issues per profile, descriptions, opener phrases) lives
 * in the RAG at /opt/automecanik/rag/knowledge/seo/engine-profile-mapping.yaml
 * and is read at runtime by `EngineProfileRagLoader`.
 *
 * Related :
 *   - Mapping YAML : rag/knowledge/seo/engine-profile-mapping.yaml
 *   - Loader       : modules/admin/services/engine-profile-rag-loader.service.ts
 *   - ADR-015       : RAG single source of truth for business content.
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
// Derivation helpers (pure)
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_ACCENTS_RE = /[̀-ͯ]/g;

/**
 * Normalize a raw fuel string from `auto_type.type_fuel` into a canonical Fuel.
 * Handles accents (essence-électrique / essence-electrique both → hybride_essence).
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
 * Map horsepower (ps) to canonical power tier.
 * Boundaries validated against DB distribution (audit 2026-04-24) : top 11
 * (fuel×tier) combos cover 85 % of active catalog.
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
 * Derive Euro norm from first production year. Best-effort SEO hint — the
 * actual category depends on the date d'immatriculation, not on `year_from`
 * of the type definition.
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

/**
 * Offset for the MOTOR_ISSUES variation slot (distinct from R8_SLOT_OFFSETS
 * in seo-variations.config). Kept here so the loader stays decoupled from
 * that module.
 */
export const MOTOR_ISSUES_SLOT_OFFSET = 500;
