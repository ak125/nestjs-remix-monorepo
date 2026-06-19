/**
 * CommandCenterExecutionLedgerService — append au ledger `__admin_audit_log` (ADR-087
 * shadow-2b). Prouve : READ_ONLY court-circuite l'insert (recorded:false, reason:read_only)
 * SANS toucher la DB ; insert OK → recorded:true avec les colonnes aal_* attendues ;
 * erreur DB → surfacée (recorded:false), jamais avalée.
 */
import { CommandCenterExecutionLedgerService } from '../../src/modules/admin/services/command-center-orchestrator/execution-ledger.service';
import { type ExecutionLedgerEntry } from '../../src/modules/admin/services/command-center-orchestrator/executable-action.contract';

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
    };
    return map[key] ?? 'mock-value';
  }),
  getOrThrow: jest.fn().mockReturnValue('mock-value'),
};

function createService(): CommandCenterExecutionLedgerService {
  const Ctor = CommandCenterExecutionLedgerService as unknown as new (
    cfg: unknown,
  ) => CommandCenterExecutionLedgerService;
  return new Ctor(mockConfigService);
}

const entry: ExecutionLedgerEntry = {
  actor: 'system',
  action_id: 'regen:command-center-snapshot',
  mode: 'shadow',
  plan_hash: 'abc123',
  would_change: true,
};

describe('CommandCenterExecutionLedgerService', () => {
  it('READ_ONLY → court-circuit (recorded:false, reason:read_only), 0 insert tenté', async () => {
    const svc = createService();
    const insert = jest.fn();
    Object.defineProperty(svc, 'supabase', {
      get: () => ({ from: () => ({ insert }) }),
      configurable: true,
    });
    Object.defineProperty(svc, 'isReadOnlyMode', {
      get: () => true,
      configurable: true,
    });
    const res = await svc.record(entry);
    expect(res).toEqual({ recorded: false, reason: 'read_only' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('insert OK → recorded:true avec les colonnes aal_* attendues', async () => {
    const svc = createService();
    const insert = jest.fn().mockResolvedValue({ error: null });
    Object.defineProperty(svc, 'supabase', {
      get: () => ({ from: jest.fn().mockReturnValue({ insert }) }),
      configurable: true,
    });
    Object.defineProperty(svc, 'isReadOnlyMode', {
      get: () => false,
      configurable: true,
    });
    const res = await svc.record(entry);
    expect(res).toEqual({ recorded: true });
    expect(insert).toHaveBeenCalledWith({
      aal_action: 'cc_orchestration_shadow_plan',
      aal_entity_type: 'cc_executable_action',
      aal_entity_id: 'regen:command-center-snapshot',
      aal_user_id: 'system',
      aal_new_value: { mode: 'shadow', plan_hash: 'abc123', would_change: true },
      aal_metadata: null,
    });
  });

  it('erreur DB → surfacée (recorded:false, reason), jamais avalée', async () => {
    const svc = createService();
    const insert = jest
      .fn()
      .mockResolvedValue({ error: { message: 'permission denied' } });
    Object.defineProperty(svc, 'supabase', {
      get: () => ({ from: () => ({ insert }) }),
      configurable: true,
    });
    Object.defineProperty(svc, 'isReadOnlyMode', {
      get: () => false,
      configurable: true,
    });
    jest.spyOn((svc as never)['logger'], 'error').mockImplementation();
    const res = await svc.record(entry);
    expect(res).toEqual({ recorded: false, reason: 'permission denied' });
  });
});
