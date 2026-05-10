/**
 * R7_BRAND — Hub marque transversal
 *
 * Service backend canon : `r7-brand-enricher.service.ts`.
 *
 * R7 = pattern de référence (36/36 sync `automecanik-wiki/exports/rag/constructeurs/`).
 * Sert de modèle pour Phase 3 (gammes + vehicles).
 *
 * FAQPage conditionnel : émis uniquement si ≥ 3 Q/R curées en DB
 * (`__seo_brand_editorial.faq` JSONB) — ADR-046 § S5 Schema.org véracité.
 *
 * Stub initial — sections + thresholds à affiner en PR-H Phase 2.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R7_BRAND_CONTRACT: RoleContract = {
  id: RoleId.R7_BRAND,
  allowed_sections: [],
  forbidden_overlap: [],
  allowed_schemas: [
    "Brand",
    "BreadcrumbList",
    // FAQPage émise UNIQUEMENT si ≥ 3 Q/R curées en DB.
    "FAQPage",
  ],
  content_contracts: {
    definition:
      "Hub marque transversal — pas dérive vers fiche véhicule (R8) ni " +
      "produit (R2). E-E-A-T via citations OEM + expertise cross-gammes.",
  },
  semantic_intents: ["informational", "navigational", "investigational"],
  uniqueness_thresholds: {},
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
