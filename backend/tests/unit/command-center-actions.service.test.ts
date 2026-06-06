/**
 * CommandCenterActionsService — live engine honesty + mode gating.
 *
 * The pure rule functions are covered by command-center-action-rules.test.ts.
 * This proves the END-TO-END guarantee that the unit tests cannot: when the GSC
 * RPC and the pricing queries FAIL, the orchestrator must surface honest
 * `certification` actions (sourceUnavailable), NEVER a business/risk insight on a
 * broken source — and that non-`full` modes expose nothing. supabase-js resolves
 * `{ error }` (it does not throw), so the mock returns errors, not rejections.
 */
import { CommandCenterActionsService } from '../../src/modules/admin/services/command-center-actions.service';

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

/** A supabase whose every read resolves an error (broken source). */
function brokenSupabase() {
  const err = { data: null, count: null, error: { message: 'boom' } };
  const chain: Record<string, unknown> = {};
  for (const m of [
    'from',
    'select',
    'eq',
    'gt',
    'or',
    'limit',
    'order',
    'gte',
  ]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  // thenable → `await chain...` resolves the error result at the end of the chain
  chain.then = (resolve: (v: typeof err) => unknown) => resolve(err);
  chain.rpc = jest
    .fn()
    .mockResolvedValue({ data: null, error: { message: 'boom' } });
  return chain;
}

function makeService(supabase: ReturnType<typeof brokenSupabase>) {
  const service = new (CommandCenterActionsService as unknown as new (
    c: unknown,
  ) => CommandCenterActionsService)(mockConfigService);
  Object.defineProperty(service, 'supabase', {
    get: () => supabase,
    configurable: true,
  });
  return service;
}

describe('CommandCenterActionsService — honest by construction', () => {
  it('broken sources → ONLY certification actions, never business/risk', async () => {
    const service = makeService(brokenSupabase());
    const queue = await service.computeActionQueue([], [], 'full');

    // Every produced action is a certification (the broken-source honesty path)
    expect(queue.length).toBeGreaterThanOrEqual(2);
    expect(queue.every((a) => a.action_type === 'certification')).toBe(true);
    expect(queue.some((a) => a.action_type === 'business')).toBe(false);
    expect(queue.some((a) => a.action_type === 'risk')).toBe(false);

    const seo = queue.find((a) => a.id === 'unavailable:seo');
    const pricing = queue.find((a) => a.id === 'unavailable:pricing');
    expect(seo?.action_type).toBe('certification');
    expect(pricing?.action_type).toBe('certification');
    // honest LOW confidence (UNKNOWN), not fake-green
    expect(seo?.data_confidence).toBe(25);
    expect(pricing?.data_confidence).toBe(25);
  });

  it('certification dept + broken sources still yields zero business/risk actions', async () => {
    const service = makeService(brokenSupabase());
    const depts = [
      {
        id: 'sales',
        label: 'Ventes',
        certification: 'PARTIAL',
        kpi_primary: 'k',
      },
    ];
    const queue = await service.computeActionQueue(depts as never, [], 'full');
    expect(queue.some((a) => a.id === 'repair:sales')).toBe(true);
    expect(queue.some((a) => a.action_type === 'business')).toBe(false);
    expect(queue.some((a) => a.action_type === 'risk')).toBe(false);
  });

  it('non-full modes expose nothing (no queries, empty queue)', async () => {
    const supabase = brokenSupabase();
    const service = makeService(supabase);
    expect(await service.computeActionQueue([], [], 'light')).toEqual([]);
    expect(await service.computeActionQueue([], [], 'disabled')).toEqual([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
