/**
 * R2_PRODUCT — Specs produit gamme
 *
 * Service backend canon : `r2-enricher.service.ts`.
 *
 * Stub initial — sections + thresholds à affiner en PR-H Phase 2.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R2_PRODUCT_CONTRACT: RoleContract = {
  id: RoleId.R2_PRODUCT,
  allowed_sections: [],
  forbidden_overlap: [],
  allowed_schemas: ["Product", "Offer", "BreadcrumbList"],
  content_contracts: {
    definition:
      "Fiche produit — caractéristiques techniques, non-promotionnel pur",
  },
  semantic_intents: ["transactional", "investigational"],
  uniqueness_thresholds: {},
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
