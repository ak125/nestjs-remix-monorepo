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
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandCenterController } from '../../src/modules/admin/controllers/command-center.controller';
import {
  OrchestrationDisabledError,
  UnsupportedExecutableActionError,
} from '../../src/modules/admin/services/command-center-orchestrator/orchestrator.service';
import {
  RegenDryRunError,
  UnknownRegenTargetError,
} from '../../src/modules/admin/services/command-center-orchestrator/regen-artifact.planner';
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
