/**
 * Command Center — Orchestration Phase 1 « shadow » : contrat des actions exécutables.
 *
 * Gouvernance : ADR-087 (vault) lève la pause `new-control-plane` UNIQUEMENT pour ce
 * périmètre, avec un design phasé `off → shadow → approved → auto`. Phase 1 (ce module)
 * n'autorise QUE `off` (rien) et `shadow` (calcule l'effet *would-be*, 0 écriture).
 *
 * Invariants (ADR-087) repris ici, mécaniquement :
 *   - flag défaut OFF · PROD forcé OFF (orchestration PROD = décision owner séparée)
 *   - le canon décide : on n'oriente QUE des actions déjà gouvernées (OwnerActionQueue)
 *   - réversibilité obligatoire : un plan exécutable porte un inverse (Phase 2)
 *   - no-silent-fallback : tout run shadow sera tracé au ledger (admin_audit)
 *
 * Scope du ledger (ADR-087 shadow-1 = « mode resolution + ledger admin_audit ») :
 * shadow-1 fige ICI le *type* `ExecutionLedgerEntry` (le contrat). Le *write path* vers
 * `admin_audit` est CONSCIEMMENT déféré à shadow-2 — premier PR où `planShadow` produit
 * un plan réel à tracer. Le câbler dès shadow-1 = code mort non exercé + dépendance
 * Supabase injectée dans un squelette inerte (blast radius inutile). Déféré ≠ abandonné.
 *
 * Ce fichier ne contient AUCUN planner et AUCUNE I/O — c'est le squelette de typage +
 * la résolution de mode. Les planners (① regen-artifact, ② pr-proposition) arrivent en
 * shadow-2/3 ; l'exécution réelle (HITL) en Phase 2 (`approved`), gated séparément.
 */

/** Modes d'orchestration (ADR-087). Défaut OFF ; Phase 1 = off|shadow seulement. */
export type OrchestrationMode = 'off' | 'shadow' | 'approved' | 'auto';

/** Familles d'actions mécaniques réversibles éligibles (Annexe A ADR-087, Phase 1). */
export type ExecutableActionKind = 'regen-artifact' | 'pr-proposition';

/**
 * Plan d'exécution *would-be* produit par un planner en mode `shadow` : il DÉCRIT la
 * mutation qui serait faite, sans l'appliquer. `would_change=false` ⇒ no-op (rien à faire).
 */
export interface ExecutionPlan {
  /** id de l'OwnerAction source (ex. `seo:gsc-data-gap`, un owner_action du snapshot). */
  action_id: string;
  kind: ExecutableActionKind;
  /** résumé humain de l'effet would-be (1 ligne). */
  summary: string;
  /** la mutation changerait-elle réellement l'état ? false = no-op. */
  would_change: boolean;
  /** détail structuré non exécuté (ex. diff d'artefact, corps de PR). */
  details: Record<string, unknown>;
  /** l'action est-elle réversible (prérequis d'exécution Phase 2) ? */
  reversible: boolean;
}

/** Entrée append-only du ledger d'orchestration (réutilise la table `admin_audit`). */
export interface ExecutionLedgerEntry {
  actor: string;
  action_id: string;
  mode: OrchestrationMode;
  /** hash déterministe du plan (dédup / idempotence). */
  plan_hash: string;
  would_change: boolean;
}

/**
 * Résolution du mode (mirroir strict de `resolveCommandCenterMode`, mais **défaut OFF**
 * et **PROD toujours OFF** — Phase 1 est DEV/PREPROD only par ADR-087).
 * Explicit `COMMAND_CENTER_ORCHESTRATION` valide gagne hors-prod ; sinon `off`.
 */
export function resolveOrchestrationMode(): OrchestrationMode {
  // PROD : orchestration jamais auto-activée (décision owner séparée, tag-gated).
  if (process.env.NODE_ENV === 'production') return 'off';
  const raw = (process.env.COMMAND_CENTER_ORCHESTRATION || '')
    .trim()
    .toLowerCase();
  if (
    raw === 'shadow' ||
    raw === 'approved' ||
    raw === 'auto' ||
    raw === 'off'
  ) {
    // Phase 1 : seuls off|shadow sont implémentés ; approved|auto restent inertes ici.
    return raw === 'approved' || raw === 'auto' ? 'off' : raw;
  }
  return 'off';
}
