import { Injectable, Logger } from '@nestjs/common';
import {
  resolveOrchestrationMode,
  type ExecutableActionKind,
  type ExecutionPlan,
  type OrchestrationMode,
} from './executable-action.contract';

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

/** Un planner calcule un ExecutionPlan *would-be* pour une action (0 mutation). */
export interface ShadowPlanner {
  readonly kind: ExecutableActionKind;
  plan(actionId: string): Promise<ExecutionPlan>;
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
export class CommandCenterOrchestratorService {
  private readonly logger = new Logger(CommandCenterOrchestratorService.name);
  private readonly planners = new Map<ExecutableActionKind, ShadowPlanner>();

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
   * Calcule un plan *would-be* (0 mutation). Throws si l'orchestration n'est pas en
   * `shadow`, ou si aucun planner n'existe pour ce kind — jamais de fallback silencieux.
   */
  async planShadow(
    kind: ExecutableActionKind,
    actionId: string,
  ): Promise<ExecutionPlan> {
    const mode = this.getMode();
    if (mode !== 'shadow') throw new OrchestrationDisabledError(mode);
    const planner = this.planners.get(kind);
    if (!planner) throw new UnsupportedExecutableActionError(kind);
    return planner.plan(actionId);
  }
}
