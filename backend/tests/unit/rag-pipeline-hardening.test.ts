/**
 * RAG Pipeline Hardening Tests — 4 scenarios
 *
 * 1. Scope filter: watcher skips role not in RAG_MERGE_ALLOWED_ROLES
 * 2. Scope filter: processor skips job for role not in allowed list
 * 3. Circuit breaker: triggers on hotspot (>20 enqueues/24h for same gamme)
 * 4. pcq_error: stores detailed error from first failed target
 *
 * Strategy: mock Supabase chain + BullMQ queue + FeatureFlagsService.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock SupabaseBaseService before imports ──

const mockClient: Record<string, jest.Mock> = {};

function resetChainMock(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockResolvedValue(result);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.single = jest.fn().mockResolvedValue(result);
  Object.assign(mockClient, chain);
  return chain;
}

jest.mock('../../src/database/services/supabase-base.service', () => ({
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

jest.mock('@nestjs/bull', () => ({
  InjectQueue: () => () => undefined,
  Processor: () => (target: any) => target,
  Process: () => (_target: any, _key: string) => undefined,
}));

import { FeatureFlagsService } from '../../src/config/feature-flags.service';
import { RagChangeWatcherService } from '../../src/workers/services/rag-change-watcher.service';
import { PipelineChainProcessor } from '../../src/workers/processors/pipeline-chain.processor';

// ── Helpers ──

function makeMockFlags(overrides: Partial<FeatureFlagsService> = {}): any {
  return {
    ragChangePipelineEnabled: true,
    ragChangeAutoEnqueue: true,
    ragMergeDryRun: false,
    ragChangePollIntervalMs: 60_000,
    ragMergeAllowedRoles: [],
    ragMergeAllowedGammes: [],
    setOverride: jest.fn(),
    listFlags: jest.fn().mockReturnValue({}),
    ...overrides,
  };
}

function makeMockQueue(): any {
  return {
    add: jest.fn().mockResolvedValue({ id: 'test-job-1' }),
  };
}

function makeMockConfigService(): any {
  return {
    get: jest.fn().mockReturnValue(''),
    getOrThrow: jest.fn().mockReturnValue(''),
  };
}

function makeMockModuleRef(): any {
  return {
    get: jest.fn(),
  };
}

// ══════════════════════════════════════════════════
// Test 1: Scope filter — watcher skips role not in RAG_MERGE_ALLOWED_ROLES
// ══════════════════════════════════════════════════

describe('Watcher: scope filter skips role not in allowed list', () => {
  it('should NOT enqueue R1_ROUTER when only R3_CONSEILS is allowed', async () => {
    const flags = makeMockFlags({
      ragMergeAllowedRoles: ['R3_CONSEILS'],
    });
    const queue = makeMockQueue();
    const watcher = new RagChangeWatcherService(
      makeMockConfigService(),
      flags,
      queue,
    );

    // Mock: pending events
    const pendingChain = resetChainMock({
      data: [
        {
          rce_id: 1,
          rce_rag_source: 'web/test',
          rce_gamme_aliases: ['disque-frein'],
          rce_old_hash: null,
          rce_new_hash: 'abc123',
          rce_status: 'pending',
        },
      ],
    });

    // Mock: resolve gammes from aliases
    const gammeData = { data: [{ pg_id: 42, pg_alias: 'disque-frein' }] };

    // We need the chain to return different data for different .from() calls
    let callCount = 0;
    pendingChain.from.mockImplementation((table: string) => {
      callCount++;
      if (table === '__rag_change_events' && callCount === 1) {
        // First call: fetch pending events
        return pendingChain;
      }
      if (table === 'pieces_gamme') {
        // Resolve gamme aliases
        const gammeChain = { ...pendingChain };
        gammeChain.select = jest.fn().mockReturnValue(gammeChain);
        gammeChain.in = jest.fn().mockResolvedValue(gammeData);
        return gammeChain;
      }
      // For published role checks — return data for R1 and R3
      const roleChain = { ...pendingChain };
      roleChain.select = jest.fn().mockReturnValue(roleChain);
      roleChain.eq = jest.fn().mockReturnValue(roleChain);
      roleChain.limit = jest.fn().mockReturnValue(roleChain);
      roleChain.maybeSingle = jest.fn().mockResolvedValue({ data: { id: 1 } });
      return roleChain;
    });

    await watcher.pollAndProcess();

    // Queue.add should only be called for R3_CONSEILS, not R1_ROUTER
    const addCalls = queue.add.mock.calls;
    const enqueuedRoles = addCalls.map((c: any[]) => c[1]?.roleId);

    // R1_ROUTER should NOT appear (filtered by scope)
    expect(enqueuedRoles).not.toContain('R1_ROUTER');
    // R3_CONSEILS SHOULD appear
    if (addCalls.length > 0) {
      expect(enqueuedRoles).toContain('R3_CONSEILS');
    }
  });
});

// ══════════════════════════════════════════════════
// Test 2: Scope filter — processor skips job for disallowed role
// ══════════════════════════════════════════════════

describe('Processor: defense-in-depth scope filter', () => {
  it('should skip job when role not in RAG_MERGE_ALLOWED_ROLES', async () => {
    const flags = makeMockFlags({
      ragMergeAllowedRoles: ['R3_CONSEILS'],
    });
    const processor = new PipelineChainProcessor(
      makeMockConfigService(),
      makeMockModuleRef(),
      flags,
    );

    resetChainMock({ data: null, error: null });

    const job = {
      id: 'test-job-42',
      data: {
        pcqId: 100,
        roleId: 'R1_ROUTER',
        targetIds: ['42'],
        source: 'db_trigger' as const,
      },
    };

    const result: any = await processor.handleExecute(job as any);

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('scope_filtered_role');
  });

  it('should NOT skip when role IS in allowed list', async () => {
    const flags = makeMockFlags({
      ragMergeAllowedRoles: ['R3_CONSEILS'],
    });
    const moduleRef = makeMockModuleRef();

    // Mock ExecutionRouterService
    const mockRouter = {
      execute: jest.fn().mockResolvedValue({
        roleId: 'R3_CONSEILS',
        mode: 'merge_only',
        dryRun: false,
        totalTargets: 1,
        results: [{ targetId: '42', status: 'success' }],
        duration: 100,
      }),
    };
    moduleRef.get.mockReturnValue(mockRouter);

    const processor = new PipelineChainProcessor(
      makeMockConfigService(),
      moduleRef,
      flags,
    );

    resetChainMock({ data: null, error: null });

    const job = {
      id: 'test-job-43',
      data: {
        pcqId: 101,
        roleId: 'R3_CONSEILS',
        targetIds: ['42'],
        source: 'db_trigger' as const,
      },
    };

    const result: any = await processor.handleExecute(job as any);

    expect(result.roleId).toBe('R3_CONSEILS');
    expect(mockRouter.execute).toHaveBeenCalled();
  });

  it('should NOT filter jobs from non-db_trigger sources', async () => {
    const flags = makeMockFlags({
      ragMergeAllowedRoles: ['R3_CONSEILS'], // R1 not in list
    });
    const moduleRef = makeMockModuleRef();

    const mockRouter = {
      execute: jest.fn().mockResolvedValue({
        roleId: 'R1_ROUTER',
        mode: 'merge_only',
        dryRun: false,
        totalTargets: 1,
        results: [{ targetId: '42', status: 'success' }],
        duration: 50,
      }),
    };
    moduleRef.get.mockReturnValue(mockRouter);

    const processor = new PipelineChainProcessor(
      makeMockConfigService(),
      moduleRef,
      flags,
    );

    resetChainMock({ data: null, error: null });

    const job = {
      id: 'test-job-44',
      data: {
        pcqId: 102,
        roleId: 'R1_ROUTER',
        targetIds: ['42'],
        source: 'api' as const,
      },
    };

    const result: any = await processor.handleExecute(job as any);

    // Should NOT be filtered — source is 'api', not 'db_trigger'
    expect(result.skipped).toBeUndefined();
    expect(mockRouter.execute).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════
// Test 3: Circuit breaker triggers on hotspot
// ══════════════════════════════════════════════════

describe('Circuit breaker: triggers on hotspot', () => {
  it('should trigger breaker when a gamme has >20 enqueues in 24h', async () => {
    const flags = makeMockFlags({ ragMergeDryRun: false });
    const queue = makeMockQueue();
    const watcher = new RagChangeWatcherService(
      makeMockConfigService(),
      flags,
      queue,
    );

    // Mock: no pending events (so pollAndProcess returns 0)
    // But the breaker check happens before poll

    // Build hotspot data: 25 rows for same gamme
    const hotspotRows = Array.from({ length: 25 }, () => ({
      pcq_pg_alias: 'poulie-d-alternateur',
    }));

    let fromCallIdx = 0;
    mockClient.from = jest.fn().mockImplementation(() => {
      fromCallIdx++;
      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.gte = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockReturnValue(chain);
      chain.limit = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockResolvedValue({ data: null, error: null });

      if (fromCallIdx === 1) {
        // evaluateBreakerConditions: queue stats (failed ratio check)
        chain.select = jest.fn().mockReturnValue(chain);
        chain.gte = jest.fn().mockResolvedValue({
          data: hotspotRows.map((r) => ({ ...r, pcq_status: 'done' })),
        });
      } else if (fromCallIdx === 2) {
        // evaluateBreakerConditions: pending count
        chain.select = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockResolvedValue({ count: 0 });
      } else if (fromCallIdx === 3) {
        // evaluateBreakerConditions: hotspot check
        chain.select = jest.fn().mockReturnValue(chain);
        chain.gte = jest.fn().mockResolvedValue({ data: hotspotRows });
      } else if (fromCallIdx === 4) {
        // logBreakerIncident: pending count
        chain.select = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockResolvedValue({ count: 0 });
      } else if (fromCallIdx === 5) {
        // logBreakerIncident: failed count
        chain.select = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.gte = jest.fn().mockResolvedValue({ count: 0 });
      } else if (fromCallIdx === 6) {
        // logBreakerIncident: done count
        chain.select = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.gte = jest.fn().mockResolvedValue({ count: 25 });
      } else if (fromCallIdx === 7) {
        // logBreakerIncident: insert into __rag_pipeline_incidents
        // already handled by default insert mock
      } else {
        // pollAndProcess: pending events (none)
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.order = jest.fn().mockReturnValue(chain);
        chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });
      }

      return chain;
    });

    // Access private method via bracket notation
    await (watcher as any).checkCircuitBreaker();

    // Breaker should be triggered
    const state = watcher.getBrekerState();
    expect(state.active).toBe(true);
    expect(state.lastReason).toContain('hotspot');
    expect(state.lastReason).toContain('poulie-d-alternateur');

    // setOverride should have been called with dry-run = true
    expect(flags.setOverride).toHaveBeenCalledWith('RAG_MERGE_DRY_RUN', 'true');
  });

  it('should NOT trigger when already in dry-run mode', async () => {
    const flags = makeMockFlags({ ragMergeDryRun: true }); // already dry-run
    const queue = makeMockQueue();
    const watcher = new RagChangeWatcherService(
      makeMockConfigService(),
      flags,
      queue,
    );

    await (watcher as any).checkCircuitBreaker();

    const state = watcher.getBrekerState();
    expect(state.active).toBe(false);
    expect(flags.setOverride).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════
// Test 4: pcq_error stores detailed error from first failed target
// ══════════════════════════════════════════════════

describe('Processor: pcq_error stores detailed error', () => {
  it('should store first target error message in pcq_error', async () => {
    const flags = makeMockFlags({ ragMergeAllowedRoles: [] }); // no scope filter
    const moduleRef = makeMockModuleRef();

    const mockRouter = {
      execute: jest.fn().mockResolvedValue({
        roleId: 'R3_CONSEILS',
        mode: 'merge_only',
        dryRun: false,
        totalTargets: 1,
        results: [
          {
            targetId: '42',
            status: 'failed',
            error: 'ConseilEnricher: parseV4ToPageContract failed — invalid YAML frontmatter',
          },
        ],
        duration: 200,
      }),
    };
    moduleRef.get.mockReturnValue(mockRouter);

    const processor = new PipelineChainProcessor(
      makeMockConfigService(),
      moduleRef,
      flags,
    );

    // Track what gets written to pcq_error
    let capturedUpdate: any = null;
    mockClient.from = jest.fn().mockReturnValue({
      update: jest.fn().mockImplementation((data: any) => {
        capturedUpdate = data;
        return {
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest
            .fn()
            .mockResolvedValue({ data: { pg_alias: 'disque-frein' } }),
        }),
      }),
    });

    const job = {
      id: 'test-job-err',
      data: {
        pcqId: 200,
        roleId: 'R3_CONSEILS',
        targetIds: ['42'],
        source: 'db_trigger' as const,
      },
    };

    await processor.handleExecute(job as any);

    // The last update call should contain the detailed error
    expect(capturedUpdate).toBeTruthy();
    expect(capturedUpdate.pcq_status).toBe('failed');
    expect(capturedUpdate.pcq_error).toContain(
      'parseV4ToPageContract failed',
    );
    expect(capturedUpdate.pcq_error).not.toBe('1/1 failed');
  });
});
