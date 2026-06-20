// @role-purity-skip
// Cross-cutting FAMILY guard: legitimately references both the R4 `composition` and
// the `symptomes_associes` columns it protects — it is a guard, not R4 content. The
// role-overlap rule targets role content comments, not protective utilities.
/**
 * R4 cross-family pollution guard — pure functions, zero NestJS/DB dependency.
 *
 * Problem (read-only audit 2026-06-03): R4 reference content
 * (`__seo_reference.composition` / `symptomes_associes`) was polluted with bare-slug
 * "related parts" belonging to OTHER product families (e.g. electrical slugs in a
 * brake gamme), copied verbatim from an earlier RAG corpus. The legacy guard
 * (`validateReferenceQuality`) only checked cross-ROLE procedure terms, never
 * cross-FAMILY, so `contamination_flags` stayed empty on 239/239 rows.
 *
 * Authoritative family key = `mf_id` (catalog_family), resolved per gamme via
 * `__seo_family_gamme_car_switch` (pg_id → mf_id). We compare `mf_id` directly — no
 * fragile keyword/name matching, no denylist. A related-part bare-slug is OFF_FAMILY
 * iff its resolved `mf_id` is KNOWN and differs from the target gamme's `mf_id`. Prose
 * entries and unknown slugs are kept (conservative: never drop on uncertainty).
 *
 * Shared by:
 *  - ReferenceService.filterCompositionByFamily()  (write-time prevention — consommé par
 *    SeoGeneratorService.buildR4FromRag, writer R4 live)
 *  - ReferenceService.validateReferenceQuality() / auditAllReferences()  (detection flag)
 */

export type FamilyVerdict = 'SAME' | 'UNKNOWN' | 'OFF_FAMILY';

/** A bare slug = kebab token: lowercase alnum + hyphens, no spaces/punctuation. */
const BARE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True if `value` is a bare kebab-slug (a resolvable part reference, not prose). */
export function isBareSlug(value: string): boolean {
  return BARE_SLUG_RE.test(value.trim().toLowerCase());
}

/**
 * Classify a single related-part entry against the target gamme's family.
 *
 * @param entry      related-part value (bare slug or prose phrase)
 * @param targetMfId mf_id of the gamme owning the page (null = unknown → never OFF_FAMILY)
 * @param slugToMfId resolved map: bare-slug → mf_id
 *
 * Conservative contract: only a bare-slug whose family is KNOWN *and* differs from the
 * target is OFF_FAMILY. Prose, unresolved slugs, or unknown target family ⇒ UNKNOWN (kept).
 */
export function classifyPartFamily(
  entry: string,
  targetMfId: number | null,
  slugToMfId: ReadonlyMap<string, number>,
): FamilyVerdict {
  const slug = entry.trim().toLowerCase();
  if (!isBareSlug(slug)) return 'UNKNOWN'; // prose phrase → cannot resolve a family
  const mf = slugToMfId.get(slug);
  if (mf == null || targetMfId == null) return 'UNKNOWN';
  return mf === targetMfId ? 'SAME' : 'OFF_FAMILY';
}

export interface FamilyFilterResult {
  kept: string[];
  dropped: string[];
}

/**
 * Filter related-part entries: keep SAME + UNKNOWN, drop OFF_FAMILY.
 * Returns `{ kept, dropped }` — the caller MUST log `dropped` (never a silent skip).
 */
export function filterOffFamilyParts(
  parts: readonly string[] | null | undefined,
  targetMfId: number | null,
  slugToMfId: ReadonlyMap<string, number>,
): FamilyFilterResult {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const part of parts ?? []) {
    if (classifyPartFamily(part, targetMfId, slugToMfId) === 'OFF_FAMILY') {
      dropped.push(part);
    } else {
      kept.push(part);
    }
  }
  return { kept, dropped };
}

/**
 * Detect off-family bare-slug artifacts across any content arrays (audit/guard use).
 * Returns the DISTINCT off-family slugs found (lowercased) — non-empty ⇒ flag R4_OFF_GAMME.
 *
 * Scope note: this catches the bare-slug pollution vector (e.g. `alternateur` in a brake
 * gamme). Prose symptom blocks (free text, no slug) are NOT family-resolvable here and are
 * covered by the cross-row audit sweep, not this per-row detector.
 */
export function detectOffFamilyArtifacts(
  arrays: ReadonlyArray<readonly string[] | null | undefined>,
  targetMfId: number | null,
  slugToMfId: ReadonlyMap<string, number>,
): string[] {
  const found = new Set<string>();
  for (const arr of arrays) {
    for (const entry of arr ?? []) {
      if (classifyPartFamily(entry, targetMfId, slugToMfId) === 'OFF_FAMILY') {
        found.add(entry.trim().toLowerCase());
      }
    }
  }
  return [...found];
}
