/**
 * Canonical SEO Role IDs — single source of truth.
 *
 * See `.spec/00-canon/db-governance/legacy-canon-map.md` for the canonical
 * series and the rule "Legacy accepté en entrée, canon obligatoire en sortie".
 */

export enum RoleId {
  R0_HOME = "R0_HOME",
  R1_ROUTER = "R1_ROUTER",
  R2_PRODUCT = "R2_PRODUCT",
  /** @deprecated R3_GUIDE is an orphan role — no route, no contract, no prompts. Use R3_CONSEILS for how-to or R6_GUIDE_ACHAT for buying guides. */
  R3_GUIDE = "R3_GUIDE",
  R3_CONSEILS = "R3_CONSEILS",
  R4_REFERENCE = "R4_REFERENCE",
  R5_DIAGNOSTIC = "R5_DIAGNOSTIC",
  R6_SUPPORT = "R6_SUPPORT",
  R6_GUIDE_ACHAT = "R6_GUIDE_ACHAT",
  R7_BRAND = "R7_BRAND",
  R8_VEHICLE = "R8_VEHICLE",
  /** @deprecated R9 n'est plus un rôle canonique R*. La gouvernance est G*, pas R*. */
  R9_GOVERNANCE = "R9_GOVERNANCE",
  /** Orchestrateurs du moteur agentique (planner, critic, solver). NON_WRITING — pas dans EXECUTION_REGISTRY. ADR-037. */
  AGENTIC_ENGINE = "AGENTIC_ENGINE",
  /** Utilitaires partagés transversaux (brief-enricher, keyword-planner, research-agent…). NON_WRITING — pas dans EXECUTION_REGISTRY. ADR-037. */
  FOUNDATION = "FOUNDATION",
}

/** All role IDs as an array (useful for iteration / validation). */
export const ROLE_ID_LIST: RoleId[] = Object.values(RoleId);

/**
 * Worker page_type strings (legacy DB vocabulary kept for backwards compat with
 * `__rag_content_refresh_log.page_type` and similar columns).
 *
 * NOTE : these are *not* canonical roles. They are accepted as input; output
 * paths must use `RoleId` enum values via `assertCanonicalRole()`.
 */
export type WorkerPageType =
  | "R1_pieces"
  | "R2_product"
  | "R3_conseils"
  | "R3_guide_howto"
  | "R4_reference"
  | "R5_diagnostic"
  | "R6_guide_achat"
  | "R7_brand"
  | "R8_vehicle";
