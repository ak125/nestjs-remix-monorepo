/**
 * Command Center Orchestrator — Phase 1 « shadow » (ADR-087).
 * Prouve le comportement INERTE par construction : OFF par défaut, PROD toujours OFF,
 * et aucune action n'est planifiable tant qu'aucun planner n'est branché — jamais de
 * fallback silencieux (throws explicites), jamais de mutation.
 */
import {
  resolveOrchestrationMode,
  type ExecutionPlan,
} from '../../src/modules/admin/services/command-center-orchestrator/executable-action.contract';
import {
  CommandCenterOrchestratorService,
  OrchestrationDisabledError,
  UnsupportedExecutableActionError,
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

  it('approved/auto = off en Phase 1 (inerte, non implémentés)', () => {
    setEnv('approved', 'development');
    expect(resolveOrchestrationMode()).toBe('off');
    setEnv('auto', 'development');
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
