/**
 * Command Center Orchestrator — Phase 1 « shadow » (ADR-087).
 * Prouve le comportement INERTE par construction : OFF par défaut, PROD toujours OFF,
 * et aucune action n'est planifiable tant qu'aucun planner n'est branché — jamais de
 * fallback silencieux (throws explicites), jamais de mutation.
 */
import {
  computePlanHash,
  resolveOrchestrationMode,
  type ExecutionPlan,
  type ExecutionReceipt,
} from '../../src/modules/admin/services/command-center-orchestrator/executable-action.contract';
import {
  CommandCenterOrchestratorService,
  NoExecutorError,
  OrchestrationDisabledError,
  PlanHashMismatchError,
  UnsupportedExecutableActionError,
  type ShadowLedgerSink,
  type ShadowPlanner,
} from '../../src/modules/admin/services/command-center-orchestrator/orchestrator.service';

// process.env.NODE_ENV est typé étroitement ; on écrit via un cast large pour
// pouvoir tester des valeurs runtime ('preprod') sans relâcher le typage du code.
const env = process.env as Record<string, string | undefined>;
const ENV = env.COMMAND_CENTER_ORCHESTRATION;
const NODE = env.NODE_ENV;
function setEnv(mode: string | undefined, nodeEnv: string | undefined) {
  if (mode === undefined) delete env.COMMAND_CENTER_ORCHESTRATION;
  else env.COMMAND_CENTER_ORCHESTRATION = mode;
  if (nodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = nodeEnv;
}
afterEach(() => {
  env.COMMAND_CENTER_ORCHESTRATION = ENV;
  env.NODE_ENV = NODE;
});

describe('resolveOrchestrationMode — défaut OFF, PROD toujours OFF', () => {
  it('défaut = off (flag absent)', () => {
    setEnv(undefined, 'development');
    expect(resolveOrchestrationMode()).toBe('off');
  });

  it('shadow explicite hors-prod = shadow', () => {
    setEnv('shadow', 'development');
    expect(resolveOrchestrationMode()).toBe('shadow');
    setEnv('SHADOW', 'preprod'); // case-insensitive + preprod
    expect(resolveOrchestrationMode()).toBe('shadow');
  });

  it('PROD = off même si le flag dit shadow (Phase 1 DEV/PREPROD only)', () => {
    setEnv('shadow', 'production');
    expect(resolveOrchestrationMode()).toBe('off');
  });

  it('approved résolu (Phase 2a, HITL) ; auto reste inerte → off', () => {
    setEnv('approved', 'development');
    expect(resolveOrchestrationMode()).toBe('approved');
    setEnv('AUTO', 'preprod'); // auto non implémenté → off
    expect(resolveOrchestrationMode()).toBe('off');
  });

  it('PROD = off même si le flag dit approved', () => {
    setEnv('approved', 'production');
    expect(resolveOrchestrationMode()).toBe('off');
  });

  it('valeur invalide = off (no silent fallback vers un mode actif)', () => {
    setEnv('yolo', 'development');
    expect(resolveOrchestrationMode()).toBe('off');
  });
});

describe('CommandCenterOrchestratorService — squelette inerte', () => {
  const fakePlan: ExecutionPlan = {
    action_id: 'a1',
    kind: 'regen-artifact',
    summary: 'fake',
    would_change: false,
    details: {},
    reversible: true,
  };
  const fakePlanner: ShadowPlanner = {
    kind: 'regen-artifact',
    plan: async () => fakePlan,
  };

  it('getMode/isShadowEnabled reflètent le flag (off par défaut)', () => {
    setEnv(undefined, 'development');
    const s = new CommandCenterOrchestratorService();
    expect(s.getMode()).toBe('off');
    expect(s.isShadowEnabled()).toBe(false);
    expect(s.supportedKinds()).toEqual([]); // aucun planner en shadow-1
  });

  it('planShadow throws OrchestrationDisabledError quand mode != shadow', async () => {
    setEnv('off', 'development');
    const s = new CommandCenterOrchestratorService();
    s.registerPlanner(fakePlanner);
    await expect(s.planShadow('regen-artifact', 'a1')).rejects.toBeInstanceOf(
      OrchestrationDisabledError,
    );
  });

  it('planShadow throws UnsupportedExecutableActionError si aucun planner (cas shadow-1)', async () => {
    setEnv('shadow', 'development');
    const s = new CommandCenterOrchestratorService();
    await expect(s.planShadow('pr-proposition', 'a1')).rejects.toBeInstanceOf(
      UnsupportedExecutableActionError,
    );
  });

  it('planShadow délègue au planner enregistré (mode shadow) — 0 mutation', async () => {
    setEnv('shadow', 'development');
    const s = new CommandCenterOrchestratorService();
    s.registerPlanner(fakePlanner);
    expect(s.supportedKinds()).toEqual(['regen-artifact']);
    await expect(s.planShadow('regen-artifact', 'a1')).resolves.toEqual(fakePlan);
  });

  it('registerPlanner refuse un doublon de kind (no planner fantôme)', () => {
    const s = new CommandCenterOrchestratorService();
    s.registerPlanner(fakePlanner);
    expect(() => s.registerPlanner(fakePlanner)).toThrow(/déjà enregistré/);
  });

  it('availableActions agrège listActionIds des planners (vide si non implémenté)', () => {
    // fakePlanner n'a PAS listActionIds → aucune action exposée
    const s0 = new CommandCenterOrchestratorService();
    s0.registerPlanner(fakePlanner);
    expect(s0.availableActions()).toEqual([]);
    // planner avec catalogue → agrégé
    const s1 = new CommandCenterOrchestratorService();
    s1.registerPlanner({
      kind: 'regen-artifact',
      plan: async () => fakePlan,
      listActionIds: () => ['regen:a', 'regen:b'],
    });
    expect(s1.availableActions()).toEqual([
      { kind: 'regen-artifact', action_id: 'regen:a' },
      { kind: 'regen-artifact', action_id: 'regen:b' },
    ]);
  });

  it('onModuleInit : sync, ne throw jamais ; silencieux en off, log en shadow', () => {
    // off (défaut) → aucun log de confirmation
    setEnv(undefined, 'development');
    const off = new CommandCenterOrchestratorService();
    const warnOff = jest
      .spyOn((off as never)['logger'], 'warn')
      .mockImplementation();
    expect(() => off.onModuleInit()).not.toThrow();
    expect(warnOff).not.toHaveBeenCalled();
    // shadow → exactement 1 log de confirmation
    setEnv('shadow', 'development');
    const on = new CommandCenterOrchestratorService();
    const warnOn = jest
      .spyOn((on as never)['logger'], 'warn')
      .mockImplementation();
    expect(() => on.onModuleInit()).not.toThrow();
    expect(warnOn).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit enregistre les planners injectés par DI (shadow-2 wiring)', () => {
    setEnv(undefined, 'development');
    // sans injection (défaut) → toujours vide (rétro-compat shadow-1)
    expect(new CommandCenterOrchestratorService().supportedKinds()).toEqual([]);
    // avec injection → enregistrés au boot
    const s = new CommandCenterOrchestratorService([fakePlanner]);
    expect(s.supportedKinds()).toEqual([]); // pas encore : onModuleInit non appelé
    s.onModuleInit();
    expect(s.supportedKinds()).toEqual(['regen-artifact']);
  });
});

describe('planShadow — trace ledger (shadow-2b)', () => {
  const fakePlan: ExecutionPlan = {
    action_id: 'regen:x',
    kind: 'regen-artifact',
    summary: 'fake',
    would_change: true,
    details: { a: 1 },
    reversible: true,
  };
  const fakePlanner: ShadowPlanner = {
    kind: 'regen-artifact',
    plan: async () => fakePlan,
  };

  it('trace au ledger l’entrée attendue (actor défaut=system, plan_hash, would_change)', async () => {
    setEnv('shadow', 'development');
    const record = jest.fn().mockResolvedValue({ recorded: true });
    const ledger: ShadowLedgerSink = { record };
    const s = new CommandCenterOrchestratorService([fakePlanner], ledger);
    s.onModuleInit();
    await s.planShadow('regen-artifact', 'regen:x');
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      actor: 'system',
      action_id: 'regen:x',
      mode: 'shadow',
      plan_hash: computePlanHash(fakePlan),
      would_change: true,
    });
  });

  it('actor explicite propagé', async () => {
    setEnv('shadow', 'development');
    const record = jest.fn().mockResolvedValue({ recorded: true });
    const s = new CommandCenterOrchestratorService([fakePlanner], { record });
    s.onModuleInit();
    await s.planShadow('regen-artifact', 'regen:x', { actor: 'fafa' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'fafa' }),
    );
  });

  it('échec ledger (recorded:false) → warn, mais le plan est renvoyé (pas de throw)', async () => {
    setEnv('shadow', 'development');
    const record = jest
      .fn()
      .mockResolvedValue({ recorded: false, reason: 'read_only' });
    const s = new CommandCenterOrchestratorService([fakePlanner], { record });
    s.onModuleInit();
    const warn = jest.spyOn((s as never)['logger'], 'warn').mockImplementation();
    const plan = await s.planShadow('regen-artifact', 'regen:x');
    expect(plan).toEqual(fakePlan);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('read_only'));
  });

  it('sans ledger injecté → planShadow marche quand même (0 trace)', async () => {
    setEnv('shadow', 'development');
    const s = new CommandCenterOrchestratorService([fakePlanner]);
    s.onModuleInit();
    await expect(s.planShadow('regen-artifact', 'regen:x')).resolves.toEqual(
      fakePlan,
    );
  });
});

describe('computePlanHash — déterministe & sensible', () => {
  const base: ExecutionPlan = {
    action_id: 'regen:x',
    kind: 'regen-artifact',
    summary: 's',
    would_change: false,
    details: { a: 1 },
    reversible: true,
  };

  it('même plan signifiant → même hash (idempotence)', () => {
    expect(computePlanHash(base)).toBe(computePlanHash({ ...base }));
  });

  it('summary/reversible n’altèrent PAS le hash (champs dérivés)', () => {
    expect(computePlanHash({ ...base, summary: 'autre', reversible: false })).toBe(
      computePlanHash(base),
    );
  });

  it('would_change ou details différents → hash différent', () => {
    expect(computePlanHash({ ...base, would_change: true })).not.toBe(
      computePlanHash(base),
    );
    expect(computePlanHash({ ...base, details: { a: 2 } })).not.toBe(
      computePlanHash(base),
    );
  });
});

describe('executeApproved — HITL Phase 2a (inerte : 0 executor branché)', () => {
  const changingPlan: ExecutionPlan = {
    action_id: 'regen:x',
    kind: 'regen-artifact',
    summary: 's',
    would_change: true,
    details: { a: 1 },
    reversible: true,
  };
  const noopPlan: ExecutionPlan = { ...changingPlan, would_change: false };
  const HASH = computePlanHash(changingPlan);

  function plannerFor(
    plan: ExecutionPlan,
    apply?: ShadowPlanner['apply'],
  ): ShadowPlanner {
    return { kind: 'regen-artifact', plan: async () => plan, apply };
  }
  function svc(planner: ShadowPlanner, ledger?: ShadowLedgerSink) {
    const s = new CommandCenterOrchestratorService([planner], ledger);
    s.onModuleInit();
    return s;
  }

  it('mode ≠ approved → OrchestrationDisabledError', async () => {
    setEnv('shadow', 'development');
    const s = svc(plannerFor(changingPlan));
    await expect(
      s.executeApproved('regen-artifact', 'regen:x', {
        actor: 'a',
        plan_hash: HASH,
      }),
    ).rejects.toBeInstanceOf(OrchestrationDisabledError);
  });

  it('plan_hash périmé → PlanHashMismatchError (garde TOCTOU)', async () => {
    setEnv('approved', 'development');
    const s = svc(plannerFor(changingPlan));
    await expect(
      s.executeApproved('regen-artifact', 'regen:x', {
        actor: 'a',
        plan_hash: 'stale-hash',
      }),
    ).rejects.toBeInstanceOf(PlanHashMismatchError);
  });

  it('would_change=false → no-op (applied:false), 0 executor appelé', async () => {
    setEnv('approved', 'development');
    const apply = jest.fn();
    const s = svc(plannerFor(noopPlan, apply));
    const receipt = await s.executeApproved('regen-artifact', 'regen:x', {
      actor: 'a',
      plan_hash: computePlanHash(noopPlan),
    });
    expect(receipt.applied).toBe(false);
    expect(receipt.reverted_by).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it('would_change=true SANS apply → NoExecutorError (Phase 2a inerte)', async () => {
    setEnv('approved', 'development');
    const s = svc(plannerFor(changingPlan)); // pas d'apply
    await expect(
      s.executeApproved('regen-artifact', 'regen:x', {
        actor: 'a',
        plan_hash: HASH,
      }),
    ).rejects.toBeInstanceOf(NoExecutorError);
  });

  it('would_change=true AVEC apply → exécute + trace executed:true', async () => {
    setEnv('approved', 'development');
    const receiptOut: ExecutionReceipt = {
      action_id: 'regen:x',
      kind: 'regen-artifact',
      applied: true,
      plan_hash: HASH,
      reverted_by: 'git checkout file',
      details: {},
    };
    const apply = jest.fn().mockResolvedValue(receiptOut);
    const record = jest.fn().mockResolvedValue({ recorded: true });
    const s = svc(plannerFor(changingPlan, apply), { record });
    const out = await s.executeApproved('regen-artifact', 'regen:x', {
      actor: 'fafa',
      plan_hash: HASH,
    });
    expect(out).toEqual(receiptOut);
    expect(apply).toHaveBeenCalledWith('regen:x');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'fafa',
        mode: 'approved',
        executed: true,
        plan_hash: HASH,
      }),
    );
  });
});
