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

import { createHash } from 'node:crypto';

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
  /** true = exécution réelle approuvée (Phase 2) ; absent/false = run shadow (Phase 1). */
  executed?: boolean;
}

/**
 * Reçu d'une exécution approuvée (Phase 2). Décrit ce qui A ÉTÉ fait (par opposition à
 * `ExecutionPlan` = ce qui SERAIT fait) + comment l'annuler. `applied=false` ⇒ no-op
 * (plan `would_change=false`). `reverted_by` porte l'inverse exact (réversibilité ADR-087).
 */
export interface ExecutionReceipt {
  action_id: string;
  kind: ExecutableActionKind;
  /** une mutation a-t-elle réellement été appliquée ? false = no-op (rien à faire). */
  applied: boolean;
  /** hash du plan exécuté (= celui approuvé par l'humain ; traçabilité). */
  plan_hash: string;
  /** commande/inverse exact pour annuler (ex. `git checkout <fichier>`, `gh pr close N`). */
  reverted_by: string | null;
  /** détail structuré du résultat (ex. PR url, octets écrits). */
  details: Record<string, unknown>;
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
    // Phase 2a : off|shadow|approved sont résolus ; `auto` (exécution sans humain)
    // n'est PAS implémenté → reste inerte (→ off). Le mode `approved` est HITL : il ne
    // mute qu'avec une approbation explicite + un executor branché (sinon throw).
    return raw === 'auto' ? 'off' : raw;
  }
  return 'off';
}

/**
 * Hash déterministe d'un plan, porté par `ExecutionLedgerEntry.plan_hash` (dédup /
 * idempotence : deux runs shadow du même plan produisent le même hash). On ne hashe que
 * les champs signifiants de l'effet would-be — `summary`/`reversible` sont dérivés et
 * n'altèrent pas l'identité du changement décrit.
 */
export function computePlanHash(plan: ExecutionPlan): string {
  const canonical = JSON.stringify({
    action_id: plan.action_id,
    kind: plan.kind,
    would_change: plan.would_change,
    details: plan.details,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
