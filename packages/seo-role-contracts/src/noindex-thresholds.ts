/**
 * Noindex thresholds — seuils chiffrés par surface SEO.
 *
 * Reprise des seuils legacy PHP (cf. plan `seo-v9` itération 5 / section 3.6) :
 *   - `families<3 ⇒ noindex,follow` sur les routers gamme + R6/R7
 *   - `gammes<5 ⇒ noindex,follow` sur les pages véhicule R1 véhicule + R8
 *   - `strict_canonical_match=true` ⇒ URL ≠ canonical force `noindex,nofollow`
 *
 * Les valeurs `null` signifient "règle non applicable à cette surface".
 *
 * @see surface-keys.ts — catalogue des surfaces.
 */
import { z } from "zod";
import { SurfaceKeySchema, type SurfaceKey } from "./surface-keys";

export const NoindexThresholdsSchema = z.object({
  /** noindex,follow si availableFamilies < ce seuil. null = règle non applicable à la surface. */
  min_families: z.number().int().nonnegative().nullable(),
  /** noindex,follow si availableGammes < ce seuil. null = règle non applicable. */
  min_gammes: z.number().int().nonnegative().nullable(),
  /** Si true, URL ≠ canonical ⇒ noindex,nofollow strict (legacy). */
  strict_canonical_match: z.boolean().default(true),
});
export type NoindexThresholds = z.infer<typeof NoindexThresholdsSchema>;

/**
 * Seuils par surface. Aligné sur les valeurs chiffrées du legacy PHP
 * (cf. plan v9 itération 5 : `families<3 ⇒ noindex`, `gammes<5 ⇒ noindex`).
 */
export const NOINDEX_THRESHOLDS: Record<SurfaceKey, NoindexThresholds> = {
  R0_HOME: { min_families: null, min_gammes: null, strict_canonical_match: true },
  R1_GAMME_ROUTER: { min_families: 3, min_gammes: null, strict_canonical_match: true },
  R1_GAMME_VEHICLE_ROUTER: { min_families: 3, min_gammes: 5, strict_canonical_match: true },
  R2_PRODUCT_LIST: { min_families: null, min_gammes: 1, strict_canonical_match: true },
  R2_PRODUCT: { min_families: null, min_gammes: null, strict_canonical_match: true },
  R2_PRODUCT_IN_VEHICLE: { min_families: null, min_gammes: null, strict_canonical_match: true },
  R3_ADVICE: { min_families: null, min_gammes: null, strict_canonical_match: true },
  R3_DIAG_SECTION: { min_families: null, min_gammes: null, strict_canonical_match: true },
  R6_BUYING_GUIDE: { min_families: 3, min_gammes: null, strict_canonical_match: true },
  R7_BRAND_HUB: { min_families: 3, min_gammes: null, strict_canonical_match: true },
  R8_VEHICLE: { min_families: null, min_gammes: 5, strict_canonical_match: true },
  BLOG_ADVICE: { min_families: null, min_gammes: null, strict_canonical_match: true },
  BLOG_ARTICLE: { min_families: null, min_gammes: null, strict_canonical_match: true },
  STATIC_PAGE: { min_families: null, min_gammes: null, strict_canonical_match: true },
  UNAVAILABLE_410: { min_families: null, min_gammes: null, strict_canonical_match: false },
  UNAVAILABLE_412: { min_families: null, min_gammes: null, strict_canonical_match: false },
};

export function getThresholds(key: SurfaceKey): NoindexThresholds {
  return NOINDEX_THRESHOLDS[key];
}

// Re-export pour discoverability depuis ce module.
export { SurfaceKeySchema };
