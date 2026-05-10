/**
 * Surface keys — catalogue Zod des 16 surfaces SEO opérationnelles.
 *
 * Une "surface" est une vue applicative discriminée (router R1 catalogue vs.
 * router R1 véhicule, fiche produit isolée vs. fiche produit dans un véhicule).
 * Plusieurs surfaces se réduisent à un même `RoleId` canonique (ADR-037) — cette
 * granularité est utile pour le branchement des seuils noindex (cf. plan
 * `seo-v9` itération 5) et pour le futur dispatch des chains SEO.
 *
 * @see noindex-thresholds.ts — seuils par surface.
 * @see @repo/seo-roles — RoleId canon.
 */
import { z } from "zod";
import { RoleId } from "@repo/seo-roles";

export const SurfaceKeySchema = z.enum([
  "R0_HOME",
  "R1_GAMME_ROUTER",
  "R1_GAMME_VEHICLE_ROUTER",
  "R2_PRODUCT_LIST",
  "R2_PRODUCT",
  "R2_PRODUCT_IN_VEHICLE",
  "R3_ADVICE",
  "R3_DIAG_SECTION",
  "R6_BUYING_GUIDE",
  "R7_BRAND_HUB",
  "R8_VEHICLE",
  "BLOG_ADVICE",
  "BLOG_ARTICLE",
  "STATIC_PAGE",
  "UNAVAILABLE_410",
  "UNAVAILABLE_412",
]);
export type SurfaceKey = z.infer<typeof SurfaceKeySchema>;

/** Map surface_key opérationnel → role_id canonique (ADR-037). */
export const SURFACE_TO_ROLE: Record<SurfaceKey, RoleId> = {
  R0_HOME: RoleId.R0_HOME,
  R1_GAMME_ROUTER: RoleId.R1_ROUTER,
  R1_GAMME_VEHICLE_ROUTER: RoleId.R1_ROUTER,
  R2_PRODUCT_LIST: RoleId.R2_PRODUCT,
  R2_PRODUCT: RoleId.R2_PRODUCT,
  R2_PRODUCT_IN_VEHICLE: RoleId.R2_PRODUCT,
  R3_ADVICE: RoleId.R3_CONSEILS,
  R3_DIAG_SECTION: RoleId.R3_CONSEILS,
  R6_BUYING_GUIDE: RoleId.R6_GUIDE_ACHAT,
  R7_BRAND_HUB: RoleId.R7_BRAND,
  R8_VEHICLE: RoleId.R8_VEHICLE,
  BLOG_ADVICE: RoleId.R3_CONSEILS,
  BLOG_ARTICLE: RoleId.R3_CONSEILS,
  STATIC_PAGE: RoleId.R0_HOME,
  UNAVAILABLE_410: RoleId.R0_HOME,
  UNAVAILABLE_412: RoleId.R0_HOME,
};

export function surfaceToRole(key: SurfaceKey): RoleId {
  return SURFACE_TO_ROLE[key];
}
