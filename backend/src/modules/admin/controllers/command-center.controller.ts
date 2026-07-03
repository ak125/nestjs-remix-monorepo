import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  NotImplementedException,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z, ZodError } from 'zod';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { User } from '../../../common/decorators/user.decorator';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import {
  CommandCenterReaderService,
  CommandCenterResponse,
} from '../services/command-center-reader.service';
import {
  CommandCenterOrchestratorService,
  NoExecutorError,
  OrchestrationDisabledError,
  PlanHashMismatchError,
  UnsupportedExecutableActionError,
} from '../services/command-center-orchestrator/orchestrator.service';
import {
  RegenDryRunError,
  UnknownRegenTargetError,
} from '../services/command-center-orchestrator/regen-artifact.planner';
import {
  ExecutorDisabledError,
  ExecutorUnavailableError,
} from '../services/command-center-orchestrator/regen-artifact.executor';
import { UnknownPrPropositionError } from '../services/command-center-orchestrator/pr-proposition.planner';
import {
  computePlanHash,
  type ExecutionPlan,
  type ExecutionReceipt,
  type OrchestrationMode,
} from '../services/command-center-orchestrator/executable-action.contract';

/**
 * Preview shadow renvoyé à l'UI : le plan *would-be* + son `plan_hash` déterministe.
 * Le hash voyage AVEC le plan pour que l'étape approve (HITL) porte exactement le plan
 * prévisualisé (garde TOCTOU) — l'UI ne recalcule jamais le hash (pas de logique dupliquée).
 */
type ShadowPlanPreview = ExecutionPlan & { plan_hash: string };

/** Corps validé du preview shadow (kind aligné sur ExecutableActionKind). */
const ShadowPlanRequestSchema = z
  .object({
    kind: z.enum(['regen-artifact', 'pr-proposition']),
    action_id: z.string().min(1),
  })
  .strict();

/** Corps validé d'une exécution approuvée (HITL) : preview → approve avec le plan_hash. */
const ApproveRequestSchema = z
  .object({
    kind: z.enum(['regen-artifact', 'pr-proposition']),
    action_id: z.string().min(1),
    /** hash du plan prévisualisé que l'humain approuve (garde TOCTOU). */
    plan_hash: z.string().min(1),
  })
  .strict();

interface OrchestrationStatus {
  mode: OrchestrationMode;
  shadow_enabled: boolean;
  supported_kinds: string[];
  /** Catalogue (kind × action_id) prévisualisable — backend SoT, l'UI consomme. */
  available_actions: { kind: string; action_id: string }[];
}

/**
 * Read-only admin endpoint backing the `/admin/command-center` cockpit.
 * Surfaces the deterministic AI Operating Map projection
 * (audit/registry/command-center-snapshot.json) + live envelope (stale/validation/
 * global_status/health_score_current). Read-only — no mutation, no DB write.
 *
 * Exposure gated by COMMAND_CENTER_MODE (full/light/disabled; prod-safe default
 * = disabled in PROD). `disabled` → 404 (reduces surface, does not reveal data);
 * `light` → top-line health only (the reader strips internal detail).
 *
 * Orchestration (ADR-087) : deux endpoints additionnels exposent le mode `shadow`
 * (introspection + preview du plan would-be). PROD = double-gardé : COMMAND_CENTER_MODE
 * `disabled` → 404, ET orchestration `off` (forcée en PROD) → 409. Aucune mutation
 * d'artefact ; le preview shadow trace au ledger admin_audit (comportement gouverné).
 */
@Controller('api/admin/command-center')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class CommandCenterController {
  constructor(
    private readonly reader: CommandCenterReaderService,
    private readonly orchestrator: CommandCenterOrchestratorService,
  ) {}

  private assertExposed(): void {
    if (this.reader.getMode() === 'disabled') {
      throw new NotFoundException(
        'Command Center is disabled in this environment',
      );
    }
  }

  @Get()
  async getSummary(): Promise<CommandCenterResponse> {
    this.assertExposed();
    return this.reader.getCommandCenter();
  }

  /**
   * Statut orchestration (introspection read-only) : mode courant + kinds supportés.
   * Utile même en `off` (reporte « off »). Gardé sur COMMAND_CENTER_MODE disabled → 404.
   */
  @Get('orchestration')
  getOrchestrationStatus(): OrchestrationStatus {
    this.assertExposed();
    return {
      mode: this.orchestrator.getMode(),
      shadow_enabled: this.orchestrator.isShadowEnabled(),
      supported_kinds: this.orchestrator.supportedKinds(),
      available_actions: this.orchestrator.availableActions(),
    };
  }

  /**
   * Preview d'un plan shadow *would-be* (ADR-087) : calcule l'effet sans muter l'artefact.
   * Mode-gated : `planShadow` throw `OrchestrationDisabledError` hors `shadow` → 409.
   * Validation Zod → 400 ; cible/kind inconnu → 400 ; dry-run générateur KO → 422.
   */
  @Post('orchestration/shadow')
  async previewShadowPlan(
    @Body() body: unknown,
    @User('email') actorEmail?: string,
  ): Promise<ShadowPlanPreview> {
    this.assertExposed();

    let parsed: z.infer<typeof ShadowPlanRequestSchema>;
    try {
      parsed = ShadowPlanRequestSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(
          `Requête invalide : ${e.issues.map((i) => i.message).join(', ')}`,
        );
      }
      throw e;
    }

    try {
      const plan = await this.orchestrator.planShadow(
        parsed.kind,
        parsed.action_id,
        { actor: actorEmail ?? 'admin' },
      );
      // Le hash déterministe accompagne le plan → l'UI le renvoie tel quel à approve.
      return { ...plan, plan_hash: computePlanHash(plan) };
    } catch (e) {
      // Mapping HTTP explicite — jamais de 500 opaque sur un cas attendu.
      if (e instanceof OrchestrationDisabledError) {
        throw new ConflictException(e.message); // 409 : orchestration ≠ shadow
      }
      if (
        e instanceof UnsupportedExecutableActionError ||
        e instanceof UnknownRegenTargetError ||
        e instanceof UnknownPrPropositionError
      ) {
        throw new BadRequestException(e.message); // 400 : kind/cible inconnu
      }
      if (e instanceof RegenDryRunError) {
        throw new UnprocessableEntityException(e.message); // 422 : dry-run impossible
      }
      throw e;
    }
  }

  /**
   * Exécute une action APPROUVÉE (Phase 2, HITL). Étape 2 du flux preview→approve :
   * l'opérateur renvoie le `plan_hash` du plan qu'il a prévisualisé. Mapping HTTP :
   * mode ≠ approved → 409 ; plan_hash périmé → 409 ; kind/cible inconnu → 400 ;
   * dry-run KO → 422 ; aucun executor branché (Phase 2a) → 501 Not Implemented.
   */
  @Post('orchestration/approve')
  async approveExecution(
    @Body() body: unknown,
    @User('email') actorEmail?: string,
  ): Promise<ExecutionReceipt> {
    this.assertExposed();

    let parsed: z.infer<typeof ApproveRequestSchema>;
    try {
      parsed = ApproveRequestSchema.parse(body);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(
          `Requête invalide : ${e.issues.map((i) => i.message).join(', ')}`,
        );
      }
      throw e;
    }

    try {
      return await this.orchestrator.executeApproved(
        parsed.kind,
        parsed.action_id,
        { actor: actorEmail ?? 'admin', plan_hash: parsed.plan_hash },
      );
    } catch (e) {
      if (
        e instanceof OrchestrationDisabledError ||
        e instanceof PlanHashMismatchError
      ) {
        throw new ConflictException(e.message); // 409 : mode≠approved ou plan périmé
      }
      if (
        e instanceof UnsupportedExecutableActionError ||
        e instanceof UnknownRegenTargetError ||
        e instanceof UnknownPrPropositionError
      ) {
        throw new BadRequestException(e.message); // 400 : kind/cible inconnu
      }
      if (e instanceof RegenDryRunError) {
        throw new UnprocessableEntityException(e.message); // 422 : recalcul impossible
      }
      if (e instanceof NoExecutorError) {
        throw new NotImplementedException(e.message); // 501 : aucun executor (Phase 2a)
      }
      if (e instanceof ExecutorDisabledError) {
        throw new ConflictException(e.message); // 409 : executor non activé (flag 2 off)
      }
      if (e instanceof ExecutorUnavailableError) {
        throw new ServiceUnavailableException(e.message); // 503 : git/gh indispo/échec
      }
      throw e;
    }
  }
}
