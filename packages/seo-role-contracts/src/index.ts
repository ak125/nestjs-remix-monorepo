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

// PR-G — Forbidden overlap canon (migrated from @repo/seo-roles, ADR-047)
export { getForbiddenOverlap } from "./forbidden-overlap";

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

/**
 * Strict accessor pour une section d'un rôle. Throw si rôle ou section
 * absent. Helper utilisé par les enrichers (PR-H Phase 2) pour lire
 * `min_chars` / `max_chars` / `description` depuis le contract canon
 * au lieu de constants hardcodées dans le service.
 *
 * @example
 *   const s4 = getSection(RoleId.R1_ROUTER, 'R1_S4_MICRO_SEO');
 *   const minChars = s4.min_chars; // 1500
 *   const maxChars = s4.max_chars; // 3000
 */
export function getSection(
  roleId: RoleId,
  sectionId: string,
): import("./schema").SectionSpec {
  const contract = getContract(roleId);
  const section = contract.allowed_sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new Error(
      `[seo-role-contracts] Section '${sectionId}' not registered in ` +
        `${roleId} contract. Available : ${contract.allowed_sections
          .map((s) => s.id)
          .join(", ") || "(none — contract.allowed_sections is empty, see PR-H Phase 2)"}.`,
    );
  }
  return section;
}
