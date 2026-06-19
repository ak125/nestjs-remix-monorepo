/**
 * CommandCenterController — endpoints orchestration shadow (ADR-087, exposition read-only).
 * Prouve : gate COMMAND_CENTER_MODE disabled → 404 ; mapping HTTP explicite des erreurs
 * orchestrateur (off→409, kind/cible inconnu→400, dry-run KO→422, Zod→400) ; succès →
 * renvoie le plan would-be. Aucun appel réel — orchestrateur + reader mockés.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  NotImplementedException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandCenterController } from '../../src/modules/admin/controllers/command-center.controller';
import {
  NoExecutorError,
  OrchestrationDisabledError,
  PlanHashMismatchError,
  UnsupportedExecutableActionError,
} from '../../src/modules/admin/services/command-center-orchestrator/orchestrator.service';
import {
  RegenDryRunError,
  UnknownRegenTargetError,
} from '../../src/modules/admin/services/command-center-orchestrator/regen-artifact.planner';
import {
  ExecutorDisabledError,
  ExecutorUnavailableError,
} from '../../src/modules/admin/services/command-center-orchestrator/regen-artifact.executor';
import { type ExecutionPlan } from '../../src/modules/admin/services/command-center-orchestrator/executable-action.contract';

const plan: ExecutionPlan = {
  action_id: 'regen:command-center-snapshot',
  kind: 'regen-artifact',
  summary: 'ok',
  would_change: false,
  details: {},
  reversible: true,
};

function make(opts: {
  mode?: 'full' | 'light' | 'disabled';
  orchMode?: string;
  planShadow?: jest.Mock;
  executeApproved?: jest.Mock;
}) {
  const reader = { getMode: () => opts.mode ?? 'full' } as never;
  const orchestrator = {
    getMode: () => opts.orchMode ?? 'off',
    isShadowEnabled: () => (opts.orchMode ?? 'off') === 'shadow',
    supportedKinds: () => ['regen-artifact', 'pr-proposition'],
    availableActions: () => [
      { kind: 'regen-artifact', action_id: 'regen:command-center-snapshot' },
    ],
    planShadow: opts.planShadow ?? jest.fn().mockResolvedValue(plan),
    executeApproved:
      opts.executeApproved ??
      jest.fn().mockResolvedValue({
        action_id: 'regen:command-center-snapshot',
        kind: 'regen-artifact',
        applied: false,
        plan_hash: 'h',
        reverted_by: null,
        details: {},
      }),
  } as never;
  return new CommandCenterController(reader, orchestrator);
}

describe('CommandCenterController — orchestration', () => {
  it('getOrchestrationStatus reporte mode + kinds + catalogue (même en off)', () => {
    const c = make({ orchMode: 'off' });
    expect(c.getOrchestrationStatus()).toEqual({
      mode: 'off',
      shadow_enabled: false,
      supported_kinds: ['regen-artifact', 'pr-proposition'],
      available_actions: [
        { kind: 'regen-artifact', action_id: 'regen:command-center-snapshot' },
      ],
    });
  });

  it('COMMAND_CENTER_MODE disabled → 404 sur status ET preview', async () => {
    const c = make({ mode: 'disabled' });
    expect(() => c.getOrchestrationStatus()).toThrow(NotFoundException);
    await expect(
      c.previewShadowPlan({ kind: 'regen-artifact', action_id: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('body invalide (Zod) → 400', async () => {
    const c = make({});
    await expect(c.previewShadowPlan({ kind: 'nope' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(c.previewShadowPlan({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('orchestration off → OrchestrationDisabledError → 409', async () => {
    const planShadow = jest
      .fn()
      .mockRejectedValue(new OrchestrationDisabledError('off'));
    const c = make({ planShadow });
    await expect(
      c.previewShadowPlan({ kind: 'regen-artifact', action_id: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('kind/cible inconnu → 400', async () => {
    const c1 = make({
      planShadow: jest
        .fn()
        .mockRejectedValue(new UnsupportedExecutableActionError('regen-artifact')),
    });
    await expect(
      c1.previewShadowPlan({ kind: 'regen-artifact', action_id: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const c2 = make({
      planShadow: jest.fn().mockRejectedValue(new UnknownRegenTargetError('x')),
    });
    await expect(
      c2.previewShadowPlan({ kind: 'regen-artifact', action_id: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dry-run générateur KO → 422', async () => {
    const c = make({
      planShadow: jest
        .fn()
        .mockRejectedValue(new RegenDryRunError('x', 'introuvable')),
    });
    await expect(
      c.previewShadowPlan({ kind: 'regen-artifact', action_id: 'x' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('succès → renvoie le plan + propage actor (email)', async () => {
    const planShadow = jest.fn().mockResolvedValue(plan);
    const c = make({ orchMode: 'shadow', planShadow });
    const res = await c.previewShadowPlan(
      { kind: 'regen-artifact', action_id: 'regen:command-center-snapshot' },
      'fafa@automecanik.com',
    );
    expect(res).toEqual(plan);
    expect(planShadow).toHaveBeenCalledWith(
      'regen-artifact',
      'regen:command-center-snapshot',
      { actor: 'fafa@automecanik.com' },
    );
  });

  it('actor absent → défaut « admin »', async () => {
    const planShadow = jest.fn().mockResolvedValue(plan);
    const c = make({ orchMode: 'shadow', planShadow });
    await c.previewShadowPlan({
      kind: 'pr-proposition',
      action_id: 'pr:command-center-snapshot-refresh',
    });
    expect(planShadow).toHaveBeenCalledWith(
      'pr-proposition',
      'pr:command-center-snapshot-refresh',
      { actor: 'admin' },
    );
  });
});

describe('CommandCenterController — approve (Phase 2a HITL)', () => {
  const okBody = {
    kind: 'regen-artifact',
    action_id: 'regen:command-center-snapshot',
    plan_hash: 'h',
  };

  it('body invalide (plan_hash manquant) → 400', async () => {
    const c = make({});
    await expect(
      c.approveExecution({ kind: 'regen-artifact', action_id: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mode ≠ approved → 409', async () => {
    const c = make({
      executeApproved: jest
        .fn()
        .mockRejectedValue(new OrchestrationDisabledError('shadow')),
    });
    await expect(c.approveExecution(okBody)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('plan_hash périmé → 409', async () => {
    const c = make({
      executeApproved: jest.fn().mockRejectedValue(new PlanHashMismatchError()),
    });
    await expect(c.approveExecution(okBody)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('aucun executor (Phase 2a) → 501 Not Implemented', async () => {
    const c = make({
      executeApproved: jest
        .fn()
        .mockRejectedValue(new NoExecutorError('regen-artifact')),
    });
    await expect(c.approveExecution(okBody)).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('executor non activé (flag 2 off) → 409', async () => {
    const c = make({
      executeApproved: jest.fn().mockRejectedValue(new ExecutorDisabledError()),
    });
    await expect(c.approveExecution(okBody)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('git/gh indisponible → 503', async () => {
    const c = make({
      executeApproved: jest
        .fn()
        .mockRejectedValue(new ExecutorUnavailableError('git not found')),
    });
    await expect(c.approveExecution(okBody)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('succès → renvoie le reçu + propage actor + plan_hash', async () => {
    const receipt = {
      action_id: 'regen:command-center-snapshot',
      kind: 'regen-artifact',
      applied: false,
      plan_hash: 'h',
      reverted_by: null,
      details: {},
    };
    const executeApproved = jest.fn().mockResolvedValue(receipt);
    const c = make({ orchMode: 'approved', executeApproved });
    const res = await c.approveExecution(okBody, 'fafa@automecanik.com');
    expect(res).toEqual(receipt);
    expect(executeApproved).toHaveBeenCalledWith(
      'regen-artifact',
      'regen:command-center-snapshot',
      { actor: 'fafa@automecanik.com', plan_hash: 'h' },
    );
  });
});
