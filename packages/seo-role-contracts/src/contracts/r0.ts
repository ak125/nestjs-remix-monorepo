/**
 * R0_HOME — Surface navigation globale, home page
 *
 * Pas d'enricher dédié — composé via R1+R6+R7 (cf.
 * `workspaces/seo-batch/AGENTS.md` § Ownership table).
 *
 * Stub initial — sections + thresholds à affiner en PR-H Phase 2 par
 * migration depuis les constants existants. Promotion gate canon ADR-046.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R0_HOME_CONTRACT: RoleContract = {
  id: RoleId.R0_HOME,
  allowed_sections: [],
  forbidden_overlap: [],
  allowed_schemas: ["BreadcrumbList"],
  content_contracts: {},
  semantic_intents: ["navigational", "informational"],
  uniqueness_thresholds: {},
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
