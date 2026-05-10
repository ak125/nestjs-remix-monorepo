/**
 * R8_VEHICLE — Hub véhicule × motorisation × type
 *
 * Service backend canon : `r8-vehicle-enricher.service.ts`.
 *
 * Anti-duplicate motorisations sœurs via skill `r8-diversity-check`
 * (memory `r7-vs-r8-content-rule.md`). Les seuils de diversité
 * (`R8_DIVERSITY_FORMULA_WEIGHTS`, `R8_DIVERSITY_THRESHOLDS`) seront
 * migrés depuis `backend/src/config/r8-keyword-plan.constants.ts` en
 * PR-H Phase 2 vers `uniqueness_thresholds`.
 *
 * Stub initial — sections + thresholds à affiner en PR-H/I Phase 2.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R8_VEHICLE_CONTRACT: RoleContract = {
  id: RoleId.R8_VEHICLE,
  allowed_sections: [],
  forbidden_overlap: [],
  allowed_schemas: ["Vehicle", "BreadcrumbList"],
  content_contracts: {
    definition:
      "Hub véhicule — long-tail volumique. Pas de dérive vers gamme (R1) " +
      "ni marque (R7). Anti-duplicate motorisations sœurs (memory " +
      "r7-vs-r8-content-rule).",
  },
  semantic_intents: ["informational", "investigational", "navigational"],
  uniqueness_thresholds: {
    // R8_DIVERSITY_THRESHOLDS migré en PR-H — vide en structure PR-F
  },
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
