/**
 * Handoff graph canon — mirror typé consommable de
 * `.spec/00-canon/role-matrix.md` (champ `handoff_targets`).
 *
 * Le canon `role-matrix.md` reste le SoT humain (21+ champs par rôle :
 * authorized_linking, purity_gates, blocking_conditions, ...). Ce fichier
 * en projette le seul champ `handoff_targets` pour consommation TS
 * backend (et futur frontend / skills). Le golden test set-equality
 * `handoff-graph.golden.test.ts` garantit l'absence de drift.
 *
 * Forward-compat : la future PR-A.bis (cf `intents.ts:18-19` —
 * "future canon.json build pipeline derives this matrix from prompts")
 * rendra `ROLE_HANDOFF_GRAPH` dérivé d'un `canon.json`. Cette PR pose
 * les rails ; la SoT canonique reste markdown jusque-là.
 *
 * À NE PAS confondre avec `forbidden-overlap.ts` :
 *   - `handoff_targets` = navigation conceptuelle autorisée entre rôles
 *   - `forbidden_overlap` = pollution sémantique de contenu interdite
 * Les deux axes sont **orthogonaux** : R6 peut linker vers R3 sans
 * absorber le contenu procédural R3.
 *
 * @see ADR-052 (governance-vault) — hoist + amendement R6 → R1.
 */

import { RoleId } from "./canonical";

/** Une arête du graphe canonique : depuis un rôle, on peut basculer vers `target` si le besoin matche `condition`. */
export interface HandoffEdge {
  readonly target: RoleId;
  readonly condition: string;
}

/**
 * Graphe canonique des handoffs inter-rôles.
 *
 * Mirror exact du champ `handoff_targets` de `.spec/00-canon/role-matrix.md`
 * (sections R0..R8). Tout RoleId valide a une entrée, même les rôles sans
 * handoffs (R6_SUPPORT, R3_GUIDE déprécié, R9_GOVERNANCE déprécié,
 * AGENTIC_ENGINE et FOUNDATION non-page) — exhaustivité garantie par
 * `Record<RoleId, ...>`.
 */
export const ROLE_HANDOFF_GRAPH: Readonly<Record<RoleId, readonly HandoffEdge[]>> =
  Object.freeze({
    [RoleId.R0_HOME]: Object.freeze([
      { target: RoleId.R1_ROUTER, condition: "besoin gamme" },
      { target: RoleId.R7_BRAND, condition: "besoin marque" },
      { target: RoleId.R8_VEHICLE, condition: "besoin vehicule" },
      { target: RoleId.R5_DIAGNOSTIC, condition: "besoin symptome" },
      { target: RoleId.R6_GUIDE_ACHAT, condition: "besoin guide achat" },
    ]),
    [RoleId.R1_ROUTER]: Object.freeze([
      { target: RoleId.R2_PRODUCT, condition: "besoin transactionnel exact" },
      { target: RoleId.R4_REFERENCE, condition: "besoin definition" },
      { target: RoleId.R5_DIAGNOSTIC, condition: "besoin symptome" },
      { target: RoleId.R3_CONSEILS, condition: "besoin comment remplacer" },
      { target: RoleId.R6_GUIDE_ACHAT, condition: "besoin comment choisir" },
    ]),
    [RoleId.R2_PRODUCT]: Object.freeze([
      { target: RoleId.R1_ROUTER, condition: "besoin navigation gamme" },
      { target: RoleId.R3_CONSEILS, condition: "besoin tutoriel" },
      { target: RoleId.R4_REFERENCE, condition: "besoin definition" },
      { target: RoleId.R6_GUIDE_ACHAT, condition: "besoin guide achat" },
    ]),
    [RoleId.R3_CONSEILS]: Object.freeze([
      {
        target: RoleId.R6_GUIDE_ACHAT,
        condition: "besoin principal = choix avant achat",
      },
      {
        target: RoleId.R5_DIAGNOSTIC,
        condition: "besoin principal = interpretation symptome",
      },
      {
        target: RoleId.R4_REFERENCE,
        condition: "besoin principal = comprehension definitionnelle",
      },
    ]),
    [RoleId.R4_REFERENCE]: Object.freeze([
      { target: RoleId.R3_CONSEILS, condition: "besoin = comment intervenir" },
      {
        target: RoleId.R5_DIAGNOSTIC,
        condition: "besoin = interpreter un symptome",
      },
      { target: RoleId.R1_ROUTER, condition: "besoin = trouver la bonne gamme" },
      { target: RoleId.R6_GUIDE_ACHAT, condition: "besoin = choisir avant achat" },
    ]),
    [RoleId.R5_DIAGNOSTIC]: Object.freeze([
      { target: RoleId.R3_CONSEILS, condition: "besoin = comment intervenir" },
      {
        target: RoleId.R4_REFERENCE,
        condition: "besoin = comprendre ce que c'est",
      },
      { target: RoleId.R1_ROUTER, condition: "besoin = trouver la bonne gamme" },
    ]),
    [RoleId.R6_GUIDE_ACHAT]: Object.freeze([
      // R1 ajouté par amendement canon ADR-052 (2026-05-08) — corrige
      // un trou empirique : R6 mission inclut "identifier la bonne pièce
      // avant commande" → compatibilité véhicule = R1.
      {
        target: RoleId.R1_ROUTER,
        condition: "besoin = verifier compatibilite avant commande",
      },
      { target: RoleId.R2_PRODUCT, condition: "decision prise, pret a acheter" },
      { target: RoleId.R3_CONSEILS, condition: "besoin = comment remplacer" },
      {
        target: RoleId.R5_DIAGNOSTIC,
        condition: "besoin = comprendre un symptome",
      },
      { target: RoleId.R4_REFERENCE, condition: "besoin = definition technique" },
    ]),
    [RoleId.R7_BRAND]: Object.freeze([
      { target: RoleId.R8_VEHICLE, condition: "besoin = fiche vehicule precise" },
      {
        target: RoleId.R1_ROUTER,
        condition: "besoin = trouver gamme compatible",
      },
      { target: RoleId.R2_PRODUCT, condition: "besoin = acheter reference" },
    ]),
    [RoleId.R8_VEHICLE]: Object.freeze([
      { target: RoleId.R1_ROUTER, condition: "besoin = trouver gamme" },
      { target: RoleId.R3_CONSEILS, condition: "besoin = comment intervenir" },
      {
        target: RoleId.R5_DIAGNOSTIC,
        condition: "besoin = interpreter symptome",
      },
      { target: RoleId.R7_BRAND, condition: "besoin = explorer marque" },
    ]),
    // Rôles sans handoffs explicites :
    [RoleId.R6_SUPPORT]: Object.freeze([]),
    [RoleId.R3_GUIDE]: Object.freeze([]),
    [RoleId.R9_GOVERNANCE]: Object.freeze([]),
    [RoleId.AGENTIC_ENGINE]: Object.freeze([]),
    [RoleId.FOUNDATION]: Object.freeze([]),
  });

/**
 * Version sémantique du graphe — incrémentée à chaque amendement canon.
 * Exposée pour traçabilité (logs structurés, debug headers, observabilité drift).
 *
 * 1.0.0 = état initial post-amendement R1 ∈ R6 (ADR-052, 2026-05-08).
 * Toute modification de `ROLE_HANDOFF_GRAPH` doit incrémenter SemVer
 * et référencer un ADR (sinon le golden test ne passera pas tant que
 * `role-matrix.md` n'est pas amendé en parallèle).
 */
export const ROLE_HANDOFF_GRAPH_VERSION = "1.0.0" as const;

/** Liste plate des cibles autorisées depuis un rôle source. */
export function getHandoffTargets(role: RoleId): readonly RoleId[] {
  return ROLE_HANDOFF_GRAPH[role].map((edge) => edge.target);
}

/** Predicate : le rôle source peut-il linker vers la cible (handoff conceptuel) ? */
export function isHandoffAllowed(source: RoleId, target: RoleId): boolean {
  return ROLE_HANDOFF_GRAPH[source].some((edge) => edge.target === target);
}
