/**
 * R2 indexability gate — 7 conditions cumulatives.
 *
 * Une seule condition manquante (ou `is_duplicate_variant=true`) déclenche
 * `noindex,nofollow`. Default legacy = `noindex,nofollow` (cf. fichier PHP
 * historique `v7.products.fiche.php`).
 *
 * @see plan `seo-v9` section 3.6
 * @see MEMORY `seo-r2-indexability-rule`
 */
import { z } from "zod";

export const R2IndexabilityConditionsSchema = z.object({
  has_price: z.boolean(),
  has_stock: z.boolean(),
  has_image: z.boolean(),
  has_oem_ref: z.boolean(),
  has_equivalent_ref: z.boolean(),
  has_unique_product_ref: z.boolean(),
  has_valid_canonical: z.boolean(),
  is_duplicate_variant: z.boolean(),
});
export type R2IndexabilityConditions = z.infer<
  typeof R2IndexabilityConditionsSchema
>;

export interface R2IndexabilityVerdict {
  indexable: boolean;
  blockingReasons: string[];
}

/**
 * Évalue les 7 conditions cumulatives. Une seule manquante ⇒ noindex,nofollow.
 * Default legacy = noindex,nofollow (cf. v7.products.fiche.php).
 */
export function evaluateR2Indexability(
  c: R2IndexabilityConditions,
): R2IndexabilityVerdict {
  const reasons: string[] = [];
  if (!c.has_price) reasons.push("missing_price");
  if (!c.has_stock) reasons.push("missing_stock");
  if (!c.has_image) reasons.push("missing_image");
  if (!c.has_oem_ref && !c.has_equivalent_ref)
    reasons.push("missing_oem_or_equivalent_ref");
  if (!c.has_unique_product_ref) reasons.push("missing_unique_product_ref");
  if (!c.has_valid_canonical) reasons.push("invalid_canonical");
  if (c.is_duplicate_variant) reasons.push("duplicate_variant");
  return { indexable: reasons.length === 0, blockingReasons: reasons };
}
