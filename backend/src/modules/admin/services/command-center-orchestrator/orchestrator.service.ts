import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleInit,
} from '@nestjs/common';
import {
  computePlanHash,
  resolveOrchestrationMode,
  type ExecutableActionKind,
  type ExecutionLedgerEntry,
  type ExecutionPlan,
  type ExecutionReceipt,
  type OrchestrationMode,
} from './executable-action.contract';

/**
 * Token DI pour la liste des planners shadow à auto-enregistrer au boot. Le module
 * fournit ce tableau (regen-artifact en shadow-2, pr-proposition en shadow-3) ; l'unité
 * de test peut construire l'orchestrateur sans (defaut `[]`) → reste découplé.
 */
export const SHADOW_PLANNERS = Symbol('CC_SHADOW_PLANNERS');

/** Token DI pour le sink ledger (optionnel — l'unité de test construit sans). */
export const SHADOW_LEDGER = Symbol('CC_SHADOW_LEDGER');

/** Résultat d'un append ledger, surfacé (no-silent-fallback). */
export interface ShadowLedgerResult {
  recorded: boolean;
  reason?: string;
}

/**
 * Abstraction du ledger : l'orchestrateur ne dépend QUE de cette interface, pas du
 * service Supabase concret (découplage + testabilité sans DB).
 */
export interface ShadowLedgerSink {
  record(entry: ExecutionLedgerEntry): Promise<ShadowLedgerResult>;
}

/** Levée quand on tente un plan alors que l'orchestration n'est pas en mode `shadow`. */
export class OrchestrationDisabledError extends Error {
  constructor(mode: OrchestrationMode) {
    super(`Orchestration désactivée (mode=${mode}) — aucun plan calculé.`);
    this.name = 'OrchestrationDisabledError';
  }
}

/** Levée quand aucun planner n'est enregistré pour le `kind` demandé. */
export class UnsupportedExecutableActionError extends Error {
  constructor(kind: ExecutableActionKind) {
    super(`Aucun planner shadow enregistré pour le kind « ${kind} ».`);
    this.name = 'UnsupportedExecutableActionError';
  }
}

/**
 * Levée si le `plan_hash` approuvé ne correspond plus au plan recalculé (Phase 2, HITL) :
 * l'état a changé entre la prévisualisation et l'approbation → on REFUSE d'exécuter
 * (garde TOCTOU — l'humain a approuvé un plan qui n'est plus à jour).
 */
export class PlanHashMismatchError extends Error {
  constructor() {
    super(
      "Le plan a changé depuis l'approbation (plan_hash ≠) — exécution refusée, re-prévisualisez.",
    );
    this.name = 'PlanHashMismatchError';
  }
}

/**
 * Levée si une exécution approuvée est demandée mais que le planner n'expose aucun
 * `apply` (Phase 2a : aucun executor branché → rien ne mute). No-silent-fallback.
 */
export class NoExecutorError extends Error {
  constructor(kind: ExecutableActionKind) {
    super(
      `Aucun executor branché pour le kind « ${kind} » — exécution réelle indisponible (Phase 2a).`,
    );
    this.name = 'NoExecutorError';
  }
}

/**
 * Un planner calcule un ExecutionPlan *would-be* (0 mutation) et, en Phase 2, peut
 * OPTIONNELLEMENT exposer `apply` pour exécuter réellement (HITL). Absence d'`apply` =
 * pas d'exécution possible pour ce kind.
 */
export interface ShadowPlanner {
  readonly kind: ExecutableActionKind;
  plan(actionId: string): Promise<ExecutionPlan>;
  /** action_id que ce planner sait traiter (catalogue exposé à l'UI). Optionnel. */
  listActionIds?(): string[];
  /** Phase 2 : exécute réellement l'action (mute). Absent = exécution indisponible. */
  apply?(actionId: string): Promise<ExecutionReceipt>;
}

/** Une action exécutable disponible (kind + action_id) — catalogue pour l'UI. */
export interface AvailableAction {
  kind: ExecutableActionKind;
  action_id: string;
}

/**
 * Command Center — orchestrateur Phase 1 « shadow » (ADR-087).
 *
 * SQUELETTE INERTE : aucun planner n'est enregistré en shadow-1 (ils arrivent en
 * shadow-2 ① regen-artifact / shadow-3 ② pr-proposition). Le service ne fait donc
 * RIEN d'observable tant que (a) le flag `COMMAND_CENTER_ORCHESTRATION=shadow` n'est
 * pas posé (défaut OFF, PROD toujours OFF) ET (b) un planner n'est pas branché.
 *
 * `planShadow` est PUR au sens effet de bord : il délègue à un planner qui calcule un
 * plan *would-be* sans appliquer aucune mutation. L'exécution réelle (HITL) = Phase 2,
 * gated séparément (mode `approved`), avec ledger `admin_audit` + réversibilité.
 */
@Injectable()
export class CommandCenterOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(CommandCenterOrchestratorService.name);
  private readonly planners = new Map<ExecutableActionKind, ShadowPlanner>();

  constructor(
    @Optional()
    @Inject(SHADOW_PLANNERS)
    private readonly injectedPlanners: ShadowPlanner[] = [],
    @Optional()
    @Inject(SHADOW_LEDGER)
    private readonly ledger?: ShadowLedgerSink,
  ) {}

  /**
   * Boot : (1) enregistre les planners injectés (DI), puis (2) log SYNC (aucune I/O
   * distante) du mode UNIQUEMENT s'il est ≠ off, pour qu'un opérateur qui pose
   * `COMMAND_CENTER_ORCHESTRATION=shadow` voie que le flag a pris effet. Silencieux par
   * défaut (off). L'enregistrement est inoffensif même en off : `planShadow` throws tant
   * que le mode ≠ shadow.
   */
  onModuleInit(): void {
    for (const planner of this.injectedPlanners) {
      this.registerPlanner(planner);
    }
    const mode = this.getMode();
    if (mode !== 'off') {
      this.logger.warn(
        `Orchestration shadow ACTIVE (mode=${mode}, planners=${this.planners.size}) — calcul would-be uniquement, 0 mutation (ADR-087).`,
      );
    }
  }

  /** Mode courant (défaut OFF ; PROD toujours OFF). */
  getMode(): OrchestrationMode {
    return resolveOrchestrationMode();
  }

  /** True seulement si le flag explicite a posé `shadow` hors-prod. */
  isShadowEnabled(): boolean {
    return this.getMode() === 'shadow';
  }

  /**
   * Enregistre un planner (appelé par shadow-2/3). Refuse un doublon de kind pour
   * éviter un planner fantôme silencieux (no-silent-fallback).
   */
  registerPlanner(planner: ShadowPlanner): void {
    if (this.planners.has(planner.kind)) {
      throw new Error(
        `Planner shadow déjà enregistré pour le kind « ${planner.kind} ».`,
      );
    }
    this.planners.set(planner.kind, planner);
    this.logger.log(`Planner shadow enregistré : ${planner.kind}`);
  }

  /** Liste des kinds actuellement supportés (vide en shadow-1). */
  supportedKinds(): ExecutableActionKind[] {
    return [...this.planners.keys()];
  }

  /**
   * Catalogue des actions disponibles (kind × action_id), agrégé depuis les planners
   * enregistrés — le backend est SoT, l'UI consomme (pas de liste dupliquée côté front).
   * Un planner sans `listActionIds` n'expose aucune action (mais reste appelable par id).
   */
  availableActions(): AvailableAction[] {
    const out: AvailableAction[] = [];
    for (const planner of this.planners.values()) {
      for (const action_id of planner.listActionIds?.() ?? []) {
        out.push({ kind: planner.kind, action_id });
      }
    }
    return out;
  }

  /**
   * Calcule un plan *would-be* (0 mutation) PUIS le trace au ledger (append-only).
   * Autorisé en `shadow` ET `approved` (la prévisualisation précède toujours l'exécution).
   * Throws si l'orchestration est `off`, ou si aucun planner n'existe pour ce kind —
   * jamais de fallback silencieux.
   *
   * L'append ledger est best-effort-MAIS-surfacé : un échec de trace (READ_ONLY PREPROD,
   * erreur DB) n'invalide PAS le plan (le calcul a réussi) → on log un warn, on ne throw
   * pas. `actor` par défaut = `system` (un appelant Phase 2 passera l'opérateur réel).
   */
  async planShadow(
    kind: ExecutableActionKind,
    actionId: string,
    opts?: { actor?: string },
  ): Promise<ExecutionPlan> {
    const mode = this.getMode();
    if (mode !== 'shadow' && mode !== 'approved') {
      throw new OrchestrationDisabledError(mode);
    }
    const planner = this.planners.get(kind);
    if (!planner) throw new UnsupportedExecutableActionError(kind);

    const plan = await planner.plan(actionId);

    if (this.ledger) {
      const result = await this.ledger.record({
        actor: opts?.actor ?? 'system',
        action_id: actionId,
        mode,
        plan_hash: computePlanHash(plan),
        would_change: plan.would_change,
      });
      if (!result.recorded) {
        this.logger.warn(
          `shadow run NON tracé (${actionId}) : ${result.reason ?? 'raison inconnue'}`,
        );
      }
    }

    return plan;
  }

  /**
   * Exécute RÉELLEMENT une action approuvée (Phase 2, HITL, mode `approved`). Suite de
   * gardes, dans l'ordre (no-silent-fallback) :
   *   1. mode === `approved` (sinon `OrchestrationDisabledError`) ;
   *   2. planner existe (sinon `UnsupportedExecutableActionError`) ;
   *   3. on RECALCULE le plan et on vérifie `plan_hash` ⇒ l'humain a approuvé CE plan
   *      exact ; s'il a changé depuis (état muté) → `PlanHashMismatchError` (garde TOCTOU) ;
   *   4. `would_change=false` ⇒ no-op : on renvoie un reçu `applied=false` SANS muter ;
   *   5. le planner doit exposer `apply` (sinon `NoExecutorError` — Phase 2a n'en branche
   *      AUCUN, donc rien ne mute tant qu'un executor n'est pas ajouté en Phase 2b).
   * L'exécution réelle + son reçu sont tracés au ledger (`executed:true`).
   */
  async executeApproved(
    kind: ExecutableActionKind,
    actionId: string,
    opts: { actor: string; plan_hash: string },
  ): Promise<ExecutionReceipt> {
    const mode = this.getMode();
    if (mode !== 'approved') throw new OrchestrationDisabledError(mode);
    const planner = this.planners.get(kind);
    if (!planner) throw new UnsupportedExecutableActionError(kind);

    // Recalcul + garde TOCTOU : l'approbation porte sur un plan figé (plan_hash).
    const plan = await planner.plan(actionId);
    if (computePlanHash(plan) !== opts.plan_hash) {
      throw new PlanHashMismatchError();
    }

    // No-op : rien à appliquer (déjà à jour) → reçu applied=false, AUCUNE mutation.
    if (!plan.would_change) {
      const receipt: ExecutionReceipt = {
        action_id: actionId,
        kind,
        applied: false,
        plan_hash: opts.plan_hash,
        reverted_by: null,
        details: { reason: 'no-op (would_change=false)' },
      };
      await this.recordExecution(opts.actor, receipt, mode);
      return receipt;
    }

    // Exécution réelle — requiert un executor (Phase 2a : aucun → throw, 0 mutation).
    if (!planner.apply) throw new NoExecutorError(kind);
    const receipt = await planner.apply(actionId);
    this.logger.warn(
      `EXÉCUTION approuvée appliquée : ${actionId} (applied=${receipt.applied}, revert=${receipt.reverted_by ?? 'n/a'})`,
    );
    await this.recordExecution(opts.actor, receipt, mode);
    return receipt;
  }

  /** Trace une exécution approuvée au ledger (executed:true), échec surfacé. */
  private async recordExecution(
    actor: string,
    receipt: ExecutionReceipt,
    mode: OrchestrationMode,
  ): Promise<void> {
    if (!this.ledger) return;
    const result = await this.ledger.record({
      actor,
      action_id: receipt.action_id,
      mode,
      plan_hash: receipt.plan_hash,
      would_change: receipt.applied,
      executed: true,
    });
    if (!result.recorded) {
      this.logger.warn(
        `exécution NON tracée (${receipt.action_id}) : ${result.reason ?? 'raison inconnue'}`,
      );
    }
  }
}
