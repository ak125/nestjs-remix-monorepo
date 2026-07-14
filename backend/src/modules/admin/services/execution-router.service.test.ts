/**
 * ExecutionRouterService — R7_BRAND dispatch coverage.
 *
 * Strategy: mock SupabaseBaseService at module level (chainable client),
 * mock ModuleRef to return our enricher stub, drive everything through the
 * public `execute(req)` method so we cover the full flow:
 *   normalizeRoleId → EXECUTION_REGISTRY lookup → resolveEnricher
 *   → executeWithRetryBackoff → executeWithTimeout → dispatchSingle
 *   → inferStatus → logExecution.
 *
 * Pattern inspired by tests/unit/rag-pipeline-hardening.test.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock SupabaseBaseService before imports ──
//
// Per-table chain so we can assert `auto_marque` was NOT queried for invalid
// targetIds, even though `pieces_gamme` is always queried by `resolvePgAlias`
// (pre-existing tech debt documented in the plan, out of scope for this PR).

interface TableHandlers {
  single?: () => Promise<any>;
  maybeSingle?: () => Promise<any>;
  insert?: (payload?: any) => Promise<any>;
}

const tableHandlers: Record<string, TableHandlers> = {};
const calls: Record<
  string,
  { single: number; maybeSingle: number; insert: number }
> = {};

function setTable(name: string, handlers: TableHandlers): void {
  tableHandlers[name] = handlers;
}

function callsFor(name: string) {
  return calls[name] ?? { single: 0, maybeSingle: 0, insert: 0 };
}

function makeChainFor(table: string) {
  const handlers = tableHandlers[table] ?? {};
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockImplementation((payload?: any) => {
    calls[table] = calls[table] ?? { single: 0, maybeSingle: 0, insert: 0 };
    calls[table].insert += 1;
    return (handlers.insert ?? (() => Promise.resolve({ error: null })))(
      payload,
    );
  });
  chain.maybeSingle = jest.fn().mockImplementation(() => {
    calls[table] = calls[table] ?? { single: 0, maybeSingle: 0, insert: 0 };
    calls[table].maybeSingle += 1;
    return (handlers.maybeSingle ?? (() => Promise.resolve({ data: null })))();
  });
  chain.single = jest.fn().mockImplementation(() => {
    calls[table] = calls[table] ?? { single: 0, maybeSingle: 0, insert: 0 };
    calls[table].single += 1;
    return (handlers.single ?? (() => Promise.resolve({ data: null })))();
  });
  return chain;
}

const mockClient = {
  from: jest.fn().mockImplementation((table: string) => makeChainFor(table)),
};

jest.mock('@database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {
    protected client: any = mockClient;
    protected logger: any = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    constructor(..._args: any[]) {}
  },
}));

// Stub heavy enricher modules so importing ExecutionRouterService doesn't
// trigger their constructors (irrelevant for routing tests).
jest.mock('./buying-guide-enricher.service', () => ({
  BuyingGuideEnricherService: class {},
}));
jest.mock('./r2-enricher.service', () => ({
  R2EnricherService: class {},
}));
jest.mock('./r8-vehicle-enricher.service', () => ({
  R8VehicleEnricherService: class {},
}));
jest.mock('./r7-brand-enricher.service', () => ({
  R7BrandEnricherService: class {},
}));
jest.mock('./r1-enricher.service', () => ({
  R1EnricherService: class {},
}));
jest.mock('./r4-content-enricher.service', () => ({
  R4ContentEnricherService: class {},
}));
jest.mock('../../seo/services/reference.service', () => ({
  ReferenceService: class {},
}));
jest.mock('../../seo/validation/diagnostic.service', () => ({
  DiagnosticService: class {},
}));

import { ExecutionRouterService } from './execution-router.service';
import { EXECUTION_REGISTRY } from '../../../config/execution-registry.constants';
import { RoleId } from '../../../config/role-ids';

// ── Helpers ──

function makeService(
  enricherForRole: Record<string, any>,
): ExecutionRouterService {
  const moduleRef = {
    get: jest.fn((cls: any) => {
      // Match by class name string, since serviceClassMap stored class refs
      const name = cls?.name ?? '';
      return enricherForRole[name] ?? null;
    }),
  };
  const config = {
    get: jest.fn().mockReturnValue(''),
    getOrThrow: jest.fn().mockReturnValue(''),
  };
  const flags = {} as any;
  return new ExecutionRouterService(config as any, moduleRef as any, flags);
}

// ── Tests ──

function resetMocks() {
  for (const k of Object.keys(tableHandlers)) delete tableHandlers[k];
  for (const k of Object.keys(calls)) delete calls[k];
  mockClient.from.mockClear();
  mockClient.from.mockImplementation((table: string) => makeChainFor(table));
}

const auto_marque_30 = {
  marque_id: 30,
  marque_alias: 'audi',
  marque_name: 'Audi',
};

describe('ExecutionRouterService — R7_BRAND dispatch', () => {
  beforeEach(resetMocks);

  it('1. R7 success → status=success when enricher returns draft', async () => {
    setTable('auto_marque', {
      single: () => Promise.resolve({ data: auto_marque_30, error: null }),
    });
    const enrichSingle = jest.fn().mockResolvedValue({
      status: 'draft',
      seoDecision: 'PUBLISH',
      diversityScore: 78,
      warnings: [],
      reasons: [],
      pageKey: 'r7_brand_30',
    });
    const service = makeService({
      R7BrandEnricherService: { enrichSingle },
    });

    const result = await service.execute({
      roleId: 'R7_BRAND',
      targetIds: ['30'],
      dryRun: false,
    });

    expect(result.results[0].status).toBe('success');
    expect(enrichSingle).toHaveBeenCalledWith(30); // number, not string
    // mode reads from registry — never duplicate the magic value
    expect(result.mode).toBe(
      EXECUTION_REGISTRY[RoleId.R7_BRAND].defaultWriteMode,
    );
    expect(result.dryRun).toBe(false);
    // auto_marque was queried (resolveMarqueId path)
    expect(callsFor('auto_marque').single).toBeGreaterThanOrEqual(1);
  });

  it('2. R7 dryRun → preview returns existing page metadata', async () => {
    setTable('auto_marque', {
      single: () => Promise.resolve({ data: auto_marque_30, error: null }),
    });
    setTable('__seo_r7_pages', {
      maybeSingle: () =>
        Promise.resolve({
          data: {
            id: 1,
            seo_decision: 'PUBLISH',
            diversity_score: 82,
            updated_at: '2026-04-01T00:00:00Z',
          },
          error: null,
        }),
    });
    const enrichSingle = jest.fn();
    const service = makeService({
      R7BrandEnricherService: { enrichSingle },
    });

    const result = await service.execute({
      roleId: 'R7_BRAND',
      targetIds: ['30'],
      dryRun: true,
    });

    expect(result.results[0].status).toBe('success');
    const data = result.results[0].data as any;
    expect(data.exists).toBe(true);
    expect(data.status).toBe('ready');
    expect(data.action).toContain('regenerate');
    expect(data.currentDecision).toBe('PUBLISH');
    expect(enrichSingle).not.toHaveBeenCalled();
    expect(callsFor('__seo_r7_pages').maybeSingle).toBe(1);
  });

  it('3. R7 dryRun → preview returns "would create" when no page exists', async () => {
    setTable('auto_marque', {
      single: () =>
        Promise.resolve({
          data: { marque_id: 30, marque_alias: 'bmw', marque_name: 'BMW' },
          error: null,
        }),
    });
    setTable('__seo_r7_pages', {
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    });
    const enrichSingle = jest.fn();
    const service = makeService({
      R7BrandEnricherService: { enrichSingle },
    });

    const result = await service.execute({
      roleId: 'R7_BRAND',
      targetIds: ['30'],
      dryRun: true,
    });

    const data = result.results[0].data as any;
    expect(data.exists).toBe(false);
    expect(data.status).toBe('ready');
    expect(data.action).toBe('would create R7 brand page');
    expect(enrichSingle).not.toHaveBeenCalled();
  });

  it.each([
    'abc',
    '30abc',
    ' 30',
    '-1',
    '+30',
    '0x1E',
    '',
    '0', // passes regex but fails `marqueId <= 0`
  ])(
    '4. R7 invalid targetId %p → failed without auto_marque or enricher call',
    async (targetId) => {
      // No setTable for auto_marque — any call would fall back to `data:null`,
      // but our assertion is that auto_marque is never queried at all.
      const enrichSingle = jest.fn();
      const service = makeService({
        R7BrandEnricherService: { enrichSingle },
      });

      const result = await service.execute({
        roleId: 'R7_BRAND',
        targetIds: [targetId],
        dryRun: false,
      });

      expect(result.results[0].status).toBe('failed');
      const data = result.results[0].data as any;
      expect(data.reason).toMatch(/Invalid or unknown/);
      // The strict regex `/^\d+$/` and `<=0` guard short-circuit BEFORE
      // any auto_marque SELECT — pieces_gamme is still hit by the
      // pre-existing `resolvePgAlias` call (documented tech debt).
      expect(callsFor('auto_marque').single).toBe(0);
      expect(enrichSingle).not.toHaveBeenCalled();
    },
  );

  it('5. R7 marque not found in auto_marque → failed', async () => {
    setTable('auto_marque', {
      single: () => Promise.resolve({ data: null, error: null }),
    });
    const enrichSingle = jest.fn();
    const service = makeService({
      R7BrandEnricherService: { enrichSingle },
    });

    const result = await service.execute({
      roleId: 'R7_BRAND',
      targetIds: ['999999'],
      dryRun: false,
    });

    expect(result.results[0].status).toBe('failed');
    const data = result.results[0].data as any;
    expect(data.reason).toContain('999999');
    expect(enrichSingle).not.toHaveBeenCalled();
    expect(callsFor('auto_marque').single).toBe(1);
  });

  it('6. R7 enricher returns failed → propagate failed with reasons', async () => {
    setTable('auto_marque', {
      single: () => Promise.resolve({ data: auto_marque_30, error: null }),
    });
    const enrichSingle = jest.fn().mockResolvedValue({
      status: 'failed',
      seoDecision: 'REJECT',
      diversityScore: 0,
      warnings: ['boom'],
      reasons: ['ENRICHMENT_FAILED'],
      pageKey: 'r7_brand_30',
    });
    const service = makeService({
      R7BrandEnricherService: { enrichSingle },
    });

    const result = await service.execute({
      roleId: 'R7_BRAND',
      targetIds: ['30'],
      dryRun: false,
    });

    expect(result.results[0].status).toBe('failed');
    const data = result.results[0].data as any;
    expect(data.status).toBe('failed');
    expect(data.reasons[0]).toBe('ENRICHMENT_FAILED');
  });
});

describe('ExecutionRouterService — regression smoke', () => {
  beforeEach(resetMocks);

  it('7. R8_VEHICLE dispatch still works with numeric typeId after R7 wiring', async () => {
    // pieces_gamme.single → null (resolvePgAlias returns null for typeId)
    setTable('pieces_gamme', {
      single: () => Promise.resolve({ data: null, error: null }),
    });
    const enrichSingle = jest.fn().mockResolvedValue({ ok: true });
    const service = makeService({
      R8VehicleEnricherService: { enrichSingle },
    });

    const result = await service.execute({
      roleId: 'R8_VEHICLE',
      targetIds: ['12345'],
      dryRun: false,
    });

    expect(result.results[0].status).toBe('success');
    expect(enrichSingle).toHaveBeenCalledWith(12345);
  });
});

describe('ExecutionRouterService — R3_CONSEILS executable path removed (B2/B6, ADR-027 §Correction)', () => {
  beforeEach(resetMocks);

  it('8. R3_CONSEILS non-dry dispatch → explicit failed, enricher never called', async () => {
    setTable('pieces_gamme', {
      single: () => Promise.resolve({ data: null, error: null }),
    });
    const enrichSingle = jest.fn();
    const service = makeService({
      ConseilEnricherService: { enrichSingle },
    });

    const result = await service.execute({
      roleId: 'R3_CONSEILS',
      targetIds: ['402'],
      dryRun: false,
    });

    // Same explicit-fail surface as a deleted-registry role (R3_GUIDE precedent):
    // errorResult → blocked_no_write + per-target failed, never a silent skip.
    expect(result.mode).toBe('blocked_no_write');
    expect(result.results[0].status).toBe('failed');
    expect(String((result.results[0] as { error?: string }).error)).toMatch(
      /No registry entry for role: R3_CONSEILS/,
    );
    expect(enrichSingle).not.toHaveBeenCalled();
  });

  it('9. registry has no executable R3_CONSEILS entry (RAG producer removed)', () => {
    expect(EXECUTION_REGISTRY[RoleId.R3_CONSEILS]).toBeUndefined();
  });
});
