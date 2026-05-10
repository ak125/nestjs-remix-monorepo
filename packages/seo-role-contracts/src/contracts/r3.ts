/**
 * R3_CONSEILS — Conseils maintenance / montage / usage
 *
 * Service backend canon : `conseil-enricher.service.ts`.
 *
 * Inclut la section S2_DIAG (diagnostic intégré dans R3 — ADR-027 R5
 * sub-pages sunset, R5 vit comme section dans R3 avec ancre
 * `#diagnostic-rapide`).
 *
 * Stub initial — sections + thresholds à affiner en PR-H Phase 2 par
 * migration depuis `r3-keyword-plan.constants.ts`.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R3_CONSEILS_CONTRACT: RoleContract = {
  id: RoleId.R3_CONSEILS,
  allowed_sections: [],
  forbidden_overlap: [],
  allowed_schemas: ["Article", "HowTo", "BreadcrumbList"],
  content_contracts: {
    procedure: "Étapes de montage / entretien / vérification",
    diagnostic:
      "Section S2_DIAG (ADR-027) — symptômes/causes/checks intégrés via RPC " +
      "`get_diagnostic_for_gamme()` post Phase D",
  },
  semantic_intents: ["informational", "investigational"],
  uniqueness_thresholds: {},
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
