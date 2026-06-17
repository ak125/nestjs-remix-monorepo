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
   * Calcule un plan *would-be* (0 mutation) PUIS le trace au ledger (append-only).
   * Throws si l'orchestration n'est pas en `shadow`, ou si aucun planner n'existe pour
   * ce kind — jamais de fallback silencieux.
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
    if (mode !== 'shadow') throw new OrchestrationDisabledError(mode);
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
}
