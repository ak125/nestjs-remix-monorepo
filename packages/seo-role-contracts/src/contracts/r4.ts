/**
 * R4_REFERENCE — Encyclopédique contexte mécanique
 *
 * Service backend canon : `r4-content-enricher.service.ts`.
 *
 * Stub initial — sections + thresholds à affiner en PR-H Phase 2.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R4_REFERENCE_CONTRACT: RoleContract = {
  id: RoleId.R4_REFERENCE,
  allowed_sections: [],
  forbidden_overlap: [],
  allowed_schemas: ["Article", "BreadcrumbList"],
  content_contracts: {
    definition:
      "Encyclopédique — termes, principes, contexte historique non-transactionnel",
  },
  semantic_intents: ["informational", "investigational"],
  uniqueness_thresholds: {},
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
