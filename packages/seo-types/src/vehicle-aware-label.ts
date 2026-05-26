/**
 * 🚗 Vehicle-aware label helper for R2 SEO headings (H1 + meta_title)
 *
 * Shared between backend (`seo-template.service.ts:processTemplates`) and
 * frontend (`PiecesHeader.tsx`, `pieces-vehicle.loader.server.ts`).
 *
 * Enrichit conditionnellement `type_name` avec `power_ps` (et `fuel` si non
 * implicite) quand `type_name` est ambigu — deux `type_ids` peuvent partager
 * un même `type_name` (ex. `"2.0 HDi"` pour 140 ch et 163 ch).
 *
 * Cause racine : audit empirique 2026-05-26
 * (`audit/seo-h1-meta-empirical-verification-2026-05-26.md`) a confirmé 3
 * duplicates R2 H1 + 1 duplicate R2 title (1 EXACT lev=0) sur 100 paires
 * intra-gamme.
 *
 * GATE 1 doctrine — empirical implementation path proven 2026-05-26 :
 * - Backend `seo-template.service.ts` couvre <title> HEAD pour les ~118
 *   pg_ids avec template DB existant (~1.2% du catalogue), via Redis cache
 *   `seo:processed:{pg_id}:{type_id}:{modifier}` TTL 24h.
 * - Frontend `PiecesHeader.tsx` couvre le `<h1>` visible utilisateur + le
 *   `<title>` HEAD pour les pg_ids sans template DB (fallback dans
 *   `pieces-vehicle.loader.server.ts`).
 *
 * Invariants critiques :
 * - **Idempotent** : si `type_name` contient déjà `${powerPs} ch`, no-op.
 * - **Normalisation `powerPs`** : `"140 ch"` accepté en input → strip suffixe
 *   → pas de `"140 ch ch"`.
 * - **Conditionnel strict** : si `isAmbiguous === false` → no-op exact, zero
 *   régression sur 97% des paires non-ambiguës.
 * - **Fallback safe** : si `power_ps` absent, type_name vide, ou pattern
 *   non-match → no-op.
 */

export interface VehicleLabelInput {
  typeName?: string;
  powerPs?: string;
  fuel?: string;
}

export interface EnrichedTypeName {
  value: string;
  isEnriched: boolean;
}

/**
 * Pattern conservateur : `type_name` ambigu = motorisation au format standard
 * `<displacement>[.<decimal>]( <abbrev>)?` où abbrev ≤ 5 chars (ex. "2.0 HDi",
 * "1.4", "1.6 TDI", "3.0 V6", "2.0 RC", "2,0 HDi" virgule décimale FR).
 *
 * Cas non-matchés (fallback no-op safe) :
 *   - "2.0i" (sans espace) — pattern requiert `\s+` avant abbrev
 *   - "1.4 HDI 16V" (3 parties) — pattern accepte 1 abbrev max
 *   - "GTI", "Dynamique Cuir", "Hybrid Touring" — pas de displacement initial
 */
const AMBIGUOUS_TYPE_NAME_PATTERN = /^\d+([.,]\d+)?(\s+[A-Za-z0-9]{1,5})?$/i;

/**
 * Carburants implicites dans les abréviations communes (Ford TDCI, Hyundai/Kia
 * CRDI, Citroën/Peugeot HDI, VAG TDI, Fiat JTD, Mercedes CDI, Renault DCI).
 * Quand `type_name` contient un de ces tokens, on n'ajoute pas le `fuel`
 * (`"Diesel"`) explicitement → évite redondance "Diesel HDI 140 ch".
 */
const FUEL_IMPLICIT_PATTERN =
  /\b(HDI|HDi|TDI|TDi|DCI|dCi|CDI|JTD|TDCI|CRDI|D)\b/i;

function normalizePowerPs(powerPs?: string): string {
  return (powerPs ?? "").replace(/\s*ch\s*$/i, "").trim();
}

function alreadyContainsPower(typeName: string, powerPs?: string): boolean {
  const power = normalizePowerPs(powerPs);
  if (!power) return false;
  const escaped = power.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\s*ch\\b`, "i").test(typeName);
}

export function isTypeNameAmbiguousForSeo(
  typeName?: string,
  powerPs?: string,
): boolean {
  const baseName = (typeName ?? "").trim();
  const power = normalizePowerPs(powerPs);
  if (!baseName || !power) return false;
  if (alreadyContainsPower(baseName, power)) return false;
  return AMBIGUOUS_TYPE_NAME_PATTERN.test(baseName);
}

export function enrichTypeNameForHeadings(
  input: VehicleLabelInput,
): EnrichedTypeName {
  const baseName = (input.typeName ?? "").trim();
  const power = normalizePowerPs(input.powerPs);

  if (!isTypeNameAmbiguousForSeo(baseName, power)) {
    return { value: baseName, isEnriched: false };
  }

  const fuelImplicit = FUEL_IMPLICIT_PATTERN.test(baseName);
  const fuel = (input.fuel ?? "").trim();
  const suffix = !fuelImplicit && fuel ? `${fuel} ${power} ch` : `${power} ch`;

  return {
    value: `${baseName} ${suffix}`.replace(/\s+/g, " ").trim(),
    isEnriched: true,
  };
}
