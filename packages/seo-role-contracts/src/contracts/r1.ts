/**
 * R1_ROUTER — Slots gamme (5 colonnes compatibilité/sélection) + page HTML
 *
 * Services backend canon : AUCUN générateur.
 *   Les deux producteurs RAG→R1 — `r1-enricher.service.ts` (slots DB) et
 *   `r1-content-from-rag.service.ts` (page HTML) — ont été RETIRÉS : le RAG
 *   n'a aucune autorité d'écriture contenu (ADR-031/046). Les lignes
 *   `__seo_r1_gamme_slots` existantes restent servies en LECTURE via la RPC
 *   `get_buying_guide_with_r1_slots` (priorité R1 → sgpg) puis
 *   `GammeResponseBuilderService`. Un producteur WIKI→R1 reste à construire.
 *
 * Section S4_MICRO_SEO bornes 1500/3000c migrées depuis les constants
 * `R1_MICRO_SEO_MIN_CHARS`/`MAX_CHARS` (PR monorepo #346 commit
 * `9f72a0bd`). Sections supplémentaires à compléter en PR-H Phase 2 par
 * migration depuis `backend/src/config/r1-keyword-plan.constants.ts`.
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "../schema";

export const R1_ROUTER_CONTRACT: RoleContract = {
  id: RoleId.R1_ROUTER,
  allowed_sections: [
    {
      id: "R1_S4_MICRO_SEO",
      min_chars: 1500,
      max_chars: 3000,
      required: true,
      description:
        "Synth micro-SEO router (Option B canon — bump 700→1500/3000 PR #346)",
    },
  ],
  forbidden_overlap: [],
  allowed_schemas: ["Article", "BreadcrumbList"],
  content_contracts: {
    definition:
      "Router éditorial gamme — orientation pièce + véhicule, pas transactionnel pur",
  },
  semantic_intents: ["informational", "navigational"],
  uniqueness_thresholds: {
    // Seuils PR-M Phase 3B (r1-diversity-audit) — vides en PR-F structure
  },
  promotion_gate: {
    requires_validations: ["semantic", "role", "diagnostic", "license"],
  },
};
