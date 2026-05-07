/**
 * @repo/seo-role-contracts — SoT comportemental R-stack.
 *
 * Pair de @repo/seo-roles (identité). Implémente ADR-047.
 *
 * Usage :
 *   import { CONTRACTS, RoleContract } from '@repo/seo-role-contracts';
 *   const r1Contract = CONTRACTS[RoleId.R1_ROUTER];
 *   const microSeoSection = r1Contract.allowed_sections.find(s => s.id === 'R1_S4_MICRO_SEO');
 *
 * Coverage MVP-0 (PR-F minimaliste) : R1_ROUTER + R3_CONSEILS.
 * Phase 2 PR-F.bis ajoutera R0/R2/R4/R6/R7/R8.
 */

import type { RoleId } from '@repo/seo-roles';
import { R1_ROUTER_CONTRACT } from './contracts/r1';
import { R3_CONSEILS_CONTRACT } from './contracts/r3';
import type { RoleContract } from './schema';

// Exports schemas + types
export * from './schema';

// Map partiel des contracts (MVP-0 = R1 + R3)
// Note : Record<RoleId, RoleContract> sera complet en PR-F.bis (R0/R2/R4/R6/R7/R8).
export const CONTRACTS: Partial<Record<RoleId, RoleContract>> = {
  [R1_ROUTER_CONTRACT.id]: R1_ROUTER_CONTRACT,
  [R3_CONSEILS_CONTRACT.id]: R3_CONSEILS_CONTRACT,
};

// Helper pour récupérer un contract avec assertion (throw si absent)
export function getRoleContract(roleId: RoleId): RoleContract {
  const contract = CONTRACTS[roleId];
  if (!contract) {
    throw new Error(
      `[seo-role-contracts] Contract absent pour rôle ${roleId}. Coverage MVP-0 = R1_ROUTER + R3_CONSEILS uniquement. Phase 2 PR-F.bis livrera R0/R2/R4/R6/R7/R8.`,
    );
  }
  return contract;
}

// Helper pour lister les rôles couverts
export function getSupportedRoles(): RoleId[] {
  return Object.keys(CONTRACTS) as RoleId[];
}
