import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { CommandCenterReaderService } from '../../src/modules/admin/services/command-center-reader.service';
import { CommandCenterOrchestratorService } from '../../src/modules/admin/services/command-center-orchestrator/orchestrator.service';
jest.mock('../../src/cache/cache.service', () => ({ CacheService: class {} }));
jest.mock(
  '../../src/modules/admin/services/command-center-actions.service',
  () => ({ CommandCenterActionsService: class {} }),
);
jest.mock(
  '../../src/modules/admin/services/command-center-kpi.service',
  () => ({ CommandCenterKpiService: class {} }),
);
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
        .mockRejectedValue(
          new UnsupportedExecutableActionError('regen-artifact'),
        ),
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

  it('succès → renvoie le plan + plan_hash déterministe + propage actor (email)', async () => {
    const planShadow = jest.fn().mockResolvedValue(plan);
    const c = make({ orchMode: 'shadow', planShadow });
    const res = await c.previewShadowPlan(
      { kind: 'regen-artifact', action_id: 'regen:command-center-snapshot' },
      'fafa@automecanik.com',
    );
    // Le plan est renvoyé tel quel, AUGMENTÉ d'un plan_hash sha256 pour le flux HITL.
    expect(res).toMatchObject(plan);
    expect(res.plan_hash).toMatch(/^[a-f0-9]{64}$/);
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

describe('admin contract negotiation', () => {
  const payload = {
    schema_version: 'command-center.v2',
    departments: [
      {
        id: 'legal',
        business_number: 18,
        accountable_owner: null,
        operating_mode: 'human',
        repo_domains: [],
        profile_ref: 'audit/automecanik-departments-map.md#department-legal',
      },
    ],
  };
  function summary(mode = 'full') {
    const reader = {
      getMode: () => mode,
      getCommandCenter: jest.fn().mockResolvedValue(payload),
    };
    return {
      reader,
      c: new CommandCenterController(reader as never, {} as never),
    };
  }
  it.each([undefined, '1', '2'])('accepts %s', async (v) => {
    const { c, reader } = summary();
    const result = await c.getSummary(v);
    expect(result.schema_version).toBe(
      v === '2' ? 'command-center.v2' : 'command-center.v1',
    );
    expect(result.departments).toHaveLength(1);
    expect('operating_mode' in result.departments[0]).toBe(v === '2');
    expect(reader.getCommandCenter).toHaveBeenCalledTimes(1);
  });
  it.each(['', '3', ['2', '2'], {}, 1, null])(
    'rejects invalid version %j without reading',
    async (v) => {
      const { c, reader } = summary();
      await expect(c.getSummary(v)).rejects.toBeInstanceOf(BadRequestException);
      expect(reader.getCommandCenter).not.toHaveBeenCalled();
    },
  );
  it('disabled precedes negotiation', async () => {
    const { c, reader } = summary('disabled');
    await expect(c.getSummary('invalid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(reader.getCommandCenter).not.toHaveBeenCalled();
  });
});

describe('isolated HTTP version parsing and real guard order', () => {
  let app: INestApplication;
  let url: string;
  let mode = 'full';
  const read = jest
    .fn()
    .mockResolvedValue({
      schema_version: 'command-center.v2',
      departments: [],
    });
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [CommandCenterController],
      providers: [
        {
          provide: CommandCenterReaderService,
          useValue: { getMode: () => mode, getCommandCenter: read },
        },
        { provide: CommandCenterOrchestratorService, useValue: {} },
      ],
    }).compile();
    app = m.createNestApplication({ logger: false });
    app.use((req: any, _res: any, next: () => void) => {
      req.isAuthenticated = () => req.headers['x-test-role'] !== 'anonymous';
      req.user = { isAdmin: req.headers['x-test-role'] === 'admin' };
      next();
    });
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    mode = 'full';
    read.mockClear();
  });
  it.each([
    '?contract_version=',
    '?contract_version=3',
    '?contract_version=2&contract_version=2',
    '?contract_version[x]=2',
  ])('400 for %s before reader', async (query) => {
    const res = await fetch(url + '/api/admin/command-center' + query, {
      headers: { 'x-test-role': 'admin' },
    });
    expect(res.status).toBe(400);
    expect(read).not.toHaveBeenCalled();
  });
  it.each(['anonymous', 'member'])(
    'guards deny %s before version validation',
    async (role) => {
      const res = await fetch(
        url + '/api/admin/command-center?contract_version=invalid',
        { headers: { 'x-test-role': role } },
      );
      expect(res.status).toBe(403);
      expect(read).not.toHaveBeenCalled();
    },
  );
  it('disabled remains 404 ahead of version rejection', async () => {
    mode = 'disabled';
    const res = await fetch(
      url + '/api/admin/command-center?contract_version=invalid',
      { headers: { 'x-test-role': 'admin' } },
    );
    expect(res.status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });
  it.each(['', '?contract_version=1', '?contract_version=2'])(
    'wraps the selected contract for %s',
    async (query) => {
      const res = await fetch(url + '/api/admin/command-center' + query, {
        headers: { 'x-test-role': 'admin' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.schema_version).toBe(
        query.endsWith('2') ? 'command-center.v2' : 'command-center.v1',
      );
      expect(read).toHaveBeenCalledTimes(1);
    },
  );
});
