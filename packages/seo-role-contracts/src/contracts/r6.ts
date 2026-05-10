/**
 * R6_GUIDE_ACHAT — Comparatifs, budgets, top marques
 *
 * Service backend canon : `buying-guide-enricher.service.ts`.
 *
 * AggregateRating et Review sont conditionnels (ADR-046 § S5 Schema.org
 * véracité — anti-spam Google) : émis uniquement si source vérifiable
 * en DB. Le contract liste les schemas potentiels ; le runtime décide
 * d'émettre selon présence de données réelles.
 *
 * Stub initial — sections + thresholds à affiner en PR-H Phase 2.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R6_GUIDE_ACHAT_CONTRACT: RoleContract = {
  id: RoleId.R6_GUIDE_ACHAT,
  allowed_sections: [],
  forbidden_overlap: [],
  allowed_schemas: [
    "Product",
    "Offer",
    "BreadcrumbList",
    // AggregateRating / Review émis UNIQUEMENT si source vérifiable
    // (ADR-046 § S5 — pas d'avis fictifs). Runtime check.
    "AggregateRating",
    "Review",
  ],
  content_contracts: {
    comparison:
      "Comparatifs marques/budgets — intent commercial, monétisable, E-E-A-T " +
      "naturel via catalogue/prix/compatibilité réels",
  },
  semantic_intents: ["transactional", "investigational", "informational"],
  uniqueness_thresholds: {},
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
