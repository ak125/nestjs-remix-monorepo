/**
 * Routable surface registry — runtime backend.
 *
 * Indique quels `RoleId` exposent une URL publique routable indexable.
 * Utilisé par `isRenderableLinkAllowed()` pour distinguer :
 *   - **handoff conceptuel** (autorisé par `ROLE_HANDOFF_GRAPH` canon)
 *   - **lien public rendu** (handoff + surface routable existante)
 *
 * À distinguer du canon `@repo/seo-roles` :
 *   - `ROLE_HANDOFF_GRAPH` = règle de navigation conceptuelle (cf canon
 *     `.spec/00-canon/role-matrix.md`)
 *   - `ROUTABLE_SURFACES` = réalité runtime (routes Remix exposées,
 *     ADR-027 R5 sunset autonome, ADR-031 wiki sources, etc.)
 *
 * Source d'exclusion :
 *   - **R5_DIAGNOSTIC** : ADR-027 — R5 = section S2_DIAG sous R3, pas
 *     d'URL autonome publique. Handoff conceptuel R6→R5 reste valide
 *     (l'utilisateur qui veut comprendre un symptôme passe par R3).
 *   - **R3_GUIDE** : `@deprecated` dans `canonical.ts` (orphan role).
 *   - **R6_SUPPORT** : information pure non publique (légal, FAQ support).
 *   - **R9_GOVERNANCE** : déprécié (couche G* a son propre modèle).
 *   - **AGENTIC_ENGINE / FOUNDATION** : utilitaires non-page (ADR-037).
 *
 * @see ADR-052 (governance-vault) — split handoff conceptuel / rendu lien.
 */

import { RoleId } from '@repo/seo-roles';

/** Rôles qui exposent une URL publique routable indexable. */
export const ROUTABLE_SURFACES: ReadonlySet<RoleId> = new Set<RoleId>([
  RoleId.R0_HOME,
  RoleId.R1_ROUTER,
  RoleId.R2_PRODUCT,
  RoleId.R3_CONSEILS,
  RoleId.R4_REFERENCE,
  RoleId.R6_GUIDE_ACHAT,
  RoleId.R7_BRAND,
  RoleId.R8_VEHICLE,
  // Exclus volontairement : R5_DIAGNOSTIC, R3_GUIDE, R6_SUPPORT,
  // R9_GOVERNANCE, AGENTIC_ENGINE, FOUNDATION (cf doc fichier).
]);

/** Predicate : le rôle expose-t-il une URL publique routable ? */
export function hasRoutableSurface(role: RoleId): boolean {
  return ROUTABLE_SURFACES.has(role);
}
