/**
 * @repo/seo-role-contracts — entry point
 *
 * Single source of truth comportementale R-stack. Lit identité depuis
 * `@repo/seo-roles` (RoleId enum), expose `CONTRACTS: Record<RoleId, RoleContract>`
 * pour les enrichers, validators, frontend badges, AGENTS.md.
 *
 * Cf. ADR-046 + ADR-047 (vault PR #183 accepted 2026-05-07).
 */
import { RoleId } from "@repo/seo-roles";
import type { RoleContract } from "./schema";

import { R0_HOME_CONTRACT } from "./contracts/r0";
import { R1_ROUTER_CONTRACT } from "./contracts/r1";
import { R2_PRODUCT_CONTRACT } from "./contracts/r2";
import { R3_CONSEILS_CONTRACT } from "./contracts/r3";
import { R4_REFERENCE_CONTRACT } from "./contracts/r4";
import { R6_GUIDE_ACHAT_CONTRACT } from "./contracts/r6";
import { R7_BRAND_CONTRACT } from "./contracts/r7";
import { R8_VEHICLE_CONTRACT } from "./contracts/r8";

// Schema + types
export {
  RoleContract,
  SectionSpec,
  SchemaOrgType,
  SemanticIntent,
  ValidationDomain,
  ContentContracts,
  UniquenessThresholds,
  PromotionGate,
} from "./schema";

// Per-role contracts (named exports for direct import)
export {
  R0_HOME_CONTRACT,
  R1_ROUTER_CONTRACT,
  R2_PRODUCT_CONTRACT,
  R3_CONSEILS_CONTRACT,
  R4_REFERENCE_CONTRACT,
  R6_GUIDE_ACHAT_CONTRACT,
  R7_BRAND_CONTRACT,
  R8_VEHICLE_CONTRACT,
};

/**
 * Master registry — `Partial<Record<RoleId, RoleContract>>` car les rôles
 * deprecated/sunset/non-content (R3_GUIDE, R5_DIAGNOSTIC, R6_SUPPORT,
 * R9_GOVERNANCE, AGENTIC_ENGINE, FOUNDATION) n'ont pas de contract de
 * page indexable.
 *
 * Pour résolution stricte d'un rôle canon-content, utiliser :
 *   `getContract(roleId)` qui throw si manquant.
 */
export const CONTRACTS: Partial<Record<RoleId, RoleContract>> = {
  [RoleId.R0_HOME]: R0_HOME_CONTRACT,
  [RoleId.R1_ROUTER]: R1_ROUTER_CONTRACT,
  [RoleId.R2_PRODUCT]: R2_PRODUCT_CONTRACT,
  [RoleId.R3_CONSEILS]: R3_CONSEILS_CONTRACT,
  [RoleId.R4_REFERENCE]: R4_REFERENCE_CONTRACT,
  [RoleId.R6_GUIDE_ACHAT]: R6_GUIDE_ACHAT_CONTRACT,
  [RoleId.R7_BRAND]: R7_BRAND_CONTRACT,
  [RoleId.R8_VEHICLE]: R8_VEHICLE_CONTRACT,
};

/** Liste des rôles canon-content qui DOIVENT avoir un contract. */
export const CANON_CONTENT_ROLES: ReadonlyArray<RoleId> = [
  RoleId.R0_HOME,
  RoleId.R1_ROUTER,
  RoleId.R2_PRODUCT,
  RoleId.R3_CONSEILS,
  RoleId.R4_REFERENCE,
  RoleId.R6_GUIDE_ACHAT,
  RoleId.R7_BRAND,
  RoleId.R8_VEHICLE,
];

/**
 * Strict accessor — throw si le rôle n'a pas de contract.
 * Préférer cette fonction dans les enrichers (fail-fast au lieu de
 * undefined silencieux).
 */
export function getContract(roleId: RoleId): RoleContract {
  const contract = CONTRACTS[roleId];
  if (!contract) {
    throw new Error(
      `[seo-role-contracts] No contract registered for role ${roleId}. ` +
        `Canon-content roles : ${CANON_CONTENT_ROLES.join(", ")}.`,
    );
  }
  return contract;
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-2a (plan seo-v9) — registries SoT : surfaces, seuils noindex, gate R2.
// Catalogues purs (pas de logique métier hors des fonctions utilitaires
// déterministes). Consommés par `backend/src/modules/seo/registries/*.ts`.
// ─────────────────────────────────────────────────────────────────────────────

// Surface keys (PR-2a)
export {
  SurfaceKeySchema,
  type SurfaceKey,
  SURFACE_TO_ROLE,
  surfaceToRole,
} from "./surface-keys";

// Noindex thresholds (PR-2a, plan seo-v9 section 3.6)
export {
  NoindexThresholdsSchema,
  type NoindexThresholds,
  NOINDEX_THRESHOLDS,
  getThresholds,
} from "./noindex-thresholds";

// R2 indexability gate conditions (PR-2a)
export {
  R2IndexabilityConditionsSchema,
  type R2IndexabilityConditions,
  type R2IndexabilityVerdict,
  evaluateR2Indexability,
} from "./r2-indexability-conditions";

// ─────────────────────────────────────────────────────────────────────────────
// PR-UIDP-1 (v5) — Unified Indexability Decision Plane :
// composer pure function + emitter unique + types canon.
// Cf. ADR-NN UIDP V1 (governance-vault).
// ─────────────────────────────────────────────────────────────────────────────

// RobotsVerdict types (PR-UIDP-1)
export {
  RobotsVerdictKind,
  RobotsVerdictKindSchema,
  ReasonCode,
  ReasonCodeSchema,
  IndexabilityVerdictContextSchema,
  type IndexabilityVerdictContext,
  IndexabilityVerdictSchema,
  type IndexabilityVerdict,
  IndexabilityInputSchema,
  type IndexabilityInput,
  // Backward compat (déprécié, retrait V1.5 — cf. v5/C4)
  type RobotsValue,
  legacyStringFromKind,
} from "./robots-verdict";

// Pure cascade composer (PR-UIDP-1)
export { computeIndexabilityVerdict } from "./compose-indexability";

// Single emission point meta + header (PR-UIDP-1)
export { emitRobotsForVerdict, type RobotsEmission } from "./emit-robots";
