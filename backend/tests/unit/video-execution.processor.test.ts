/**
 * VideoExecutionProcessor — Unit tests (P16).
 *
 * Tests ~20 critical paths through the BullMQ processor:
 * idempotency, feature flags, artefacts, render, quality score,
 * observe-only, 2-phase finalization, catch-all, @OnQueueFailed.
 *
 * Strategy: mock Supabase client chain + 4 injected services.
 */

import { VideoExecutionProcessor } from '../../src/workers/processors/video-execution.processor';
import { RenderErrorCode } from '../../src/modules/media-factory/render/types/render.types';

// ─── Mock helpers ────────────────────────────────────────────

function chainMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

/** Chain that resolves different results for sequential .single() calls */
function multiStepChain(results: Array<{ data: unknown; error: unknown }>) {
  const chain: Record<string, jest.Mock> = {};
  let callIndex = 0;
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockImplementation(() => {
    const r = results[callIndex] ?? results[results.length - 1];
    callIndex++;
    return Promise.resolve(r);
  });
  return chain;
}

function fakeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    attemptsMade: 1,
    data: {
      executionLogId: 100,
      briefId: 'brief-001',
      triggerSource: 'manual',
    },
    ...overrides,
  } as any;
}

function fakeProduction(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    briefId: 'brief-001',
    videoType: 'short',
    vertical: 'freinage',
    gammeAlias: 'disque-frein',
    pgId: 42,
    status: 'draft',
    templateId: null,
    knowledgeContract: { summary: 'test brief' },
    claimTable: [
      {
        kind: 'dimension',
        value: '280mm',
        unit: 'mm',
        rawText: 'Diamètre 280mm',
        status: 'verified',
      },
    ],
    evidencePack: [{ source: 'L1', docId: 'doc-1' }],
    disclaimerPlan: {
      disclaimers: [{ type: 'pedagogique', text: 'Contenu pédagogique' }],
    },
    approvalRecord: {
      stages: [
        { stage: 'script_text', status: 'approved', approvedBy: 'admin' },
      ],
    },
    qualityScore: null,
    qualityFlags: [],
    gateResults: null,
    createdBy: 'user-001',
    createdAt: '2026-02-24T00:00:00Z',
    updatedAt: '2026-02-24T00:00:00Z',
    ...overrides,
  };
}

function fakeGateOutput(overrides: Record<string, unknown> = {}) {
  return {
    canPublish: true,
    gates: [{ gate: 'truth', verdict: 'PASS', measured: 0, details: {} }],
    flags: [],
    ...overrides,
  };
}

function fakeRenderResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success',
    engineName: 'stub',
    engineVersion: '1.0.0',
    durationMs: 42,
    outputPath: '/tmp/output.mp4',
    metadata: null,
    retryable: false,
    ...overrides,
  };
}

// ─── Service mocks ───────────────────────────────────────────

function createMocks() {
  return {
    gatesService: {
      checkArtefacts: jest.fn().mockReturnValue({
        hasBrief: true,
        hasClaimTable: true,
        hasEvidencePack: true,
        hasDisclaimerPlan: true,
        hasApprovalRecord: true,
        canProceed: true,
        missingArtefacts: [],
      }),
      runAllGates: jest.fn().mockReturnValue(fakeGateOutput()),
    },
    dataService: {
      getProduction: jest.fn().mockResolvedValue(fakeProduction()),
      updateProduction: jest.fn().mockResolvedValue(undefined),
    },
    renderAdapter: {
      render: jest.fn().mockResolvedValue(fakeRenderResult()),
      getCanaryStats: jest.fn().mockResolvedValue({
        canaryAvailable: false,
        dailyUsageCount: 0,
        remainingQuota: 0,
      }),
    },
    jobHealth: {
      recordSuccess: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    },
    configService: {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
        };
        return map[key] ?? 'mock-value';
      }),
      getOrThrow: jest.fn().mockReturnValue('mock-value'),
    },
  };
}

function createProcessor(mocks: ReturnType<typeof createMocks>) {
  return new (VideoExecutionProcessor as any)(
    mocks.configService,
    mocks.gatesService,
    mocks.dataService,
    mocks.renderAdapter,
    mocks.jobHealth,
  ) as VideoExecutionProcessor;
}

/** Set env vars for the test, returns cleanup fn */
function withEnv(vars: Record<string, string>): () => void {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    originals[k] = process.env[k];
    process.env[k] = v;
  }
  return () => {
    for (const [k] of Object.entries(vars)) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k];
    }
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe('VideoExecutionProcessor', () => {
  let mocks: ReturnType<typeof createMocks>;
  let processor: VideoExecutionProcessor;

  beforeEach(() => {
    mocks = createMocks();
    processor = createProcessor(mocks);
  });

  // Helper to set the Supabase client mock on the processor
  function setClient(chain: Record<string, jest.Mock>) {
    Object.defineProperty(processor, 'client', {
      get: () => chain,
      configurable: true,
    });
  }

  // ── Idempotency guard ──

  describe('idempotency guard', () => {
    it('should skip if execution is already completed', async () => {
      const chain = chainMock({ data: { status: 'completed' }, error: null });
      setClient(chain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('completed');
      expect(result.durationMs).toBe(0);
      expect(mocks.gatesService.runAllGates).not.toHaveBeenCalled();
      expect(mocks.dataService.getProduction).not.toHaveBeenCalled();
      expect(mocks.renderAdapter.render).not.toHaveBeenCalled();
    });

    it('should proceed when status is pending', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      // update calls also return through the chain
      chain.update = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      // For update calls, make .eq resolve directly (no .single needed)
      // We need the chain to handle both select().single() and update().eq()
      // Re-create with multi-step: first single() = idempotency check, rest = updates
      const multiChain = multiStepChain([
        { data: { status: 'pending' }, error: null }, // idempotency check
        { data: null, error: null }, // subsequent calls
      ]);
      // update().eq() must resolve successfully (no .single)
      multiChain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(multiChain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('completed');
      expect(mocks.dataService.getProduction).toHaveBeenCalledWith('brief-001');
      cleanup();
    });
  });

  // ── Feature flag guard ──

  describe('feature flag guard', () => {
    it('should skip when VIDEO_PIPELINE_ENABLED is false', async () => {
      const cleanup = withEnv({ VIDEO_PIPELINE_ENABLED: 'false' });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('completed');
      expect(result.errorMessage).toBe('Pipeline disabled');
      expect(result.canPublish).toBeNull();
      expect(mocks.gatesService.runAllGates).not.toHaveBeenCalled();
      cleanup();
    });

    it('should proceed when VIDEO_PIPELINE_ENABLED is true', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('completed');
      expect(mocks.dataService.getProduction).toHaveBeenCalled();
      expect(mocks.gatesService.checkArtefacts).toHaveBeenCalled();
      cleanup();
    });
  });

  // ── Artefact check ──

  describe('artefact check', () => {
    it('should fail on missing artefacts', async () => {
      const cleanup = withEnv({ VIDEO_PIPELINE_ENABLED: 'true' });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      mocks.gatesService.checkArtefacts.mockReturnValue({
        hasBrief: false,
        hasClaimTable: true,
        hasEvidencePack: true,
        hasDisclaimerPlan: false,
        hasApprovalRecord: true,
        canProceed: false,
        missingArtefacts: ['video_brief', 'disclaimer_plan'],
      });

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('failed');
      expect(result.canPublish).toBe(false);
      expect(result.qualityFlags).toContain('MISSING_ARTEFACTS');
      expect(result.errorMessage).toContain('video_brief');
      expect(mocks.gatesService.runAllGates).not.toHaveBeenCalled();
      cleanup();
    });

    it('should proceed to gates when all artefacts present', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(mocks.gatesService.checkArtefacts).toHaveBeenCalled();
      expect(mocks.gatesService.runAllGates).toHaveBeenCalled();
      expect(result.status).toBe('completed');
      cleanup();
    });
  });

  // ── Render failure handling ──

  describe('render failure', () => {
    it('should handle non-retryable failure without throwing', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      mocks.renderAdapter.render.mockResolvedValue(
        fakeRenderResult({
          status: 'failed',
          retryable: false,
          errorCode: RenderErrorCode.RENDER_OUTPUT_INVALID,
          errorMessage: 'Invalid output format',
          outputPath: null,
        }),
      );

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('failed');
      expect(result.qualityFlags).toContain('NON_RETRYABLE_RENDER_FAILURE');
      expect(result.errorMessage).toContain('RENDER_OUTPUT_INVALID');
      // Should NOT throw — returns result directly
      cleanup();
    });

    it('should throw on retryable failure when DB persistence also fails', async () => {
      // Retryable render throws inside try → caught by catch-all.
      // If catch-all DB write ALSO fails → re-throws for bull retry.
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      let callCount = 0;
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation(() => {
          callCount++;
          // First call: status=processing → OK
          if (callCount === 1) return Promise.resolve({ error: null });
          // Second call: retryable partial state → OK
          if (callCount === 2) return Promise.resolve({ error: null });
          // Third call: catch-all error persist → DB fail → re-throw
          return Promise.resolve({
            error: { message: 'DB down during catch-all' },
          });
        }),
      });
      setClient(chain);

      mocks.renderAdapter.render.mockResolvedValue(
        fakeRenderResult({
          status: 'failed',
          retryable: true,
          errorCode: RenderErrorCode.RENDER_ENGINE_TIMEOUT,
          outputPath: null,
        }),
      );

      await expect(
        (processor as any).handleVideoExecution(fakeJob()),
      ).rejects.toThrow('DB down during catch-all');
      cleanup();
    });

    it('should persist retryable failure state and return failed result', async () => {
      // Retryable render throws inside try → caught by catch-all → DB persist OK → returns failed
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      mocks.renderAdapter.render.mockResolvedValue(
        fakeRenderResult({
          status: 'failed',
          retryable: true,
          errorCode: RenderErrorCode.RENDER_ENGINE_TIMEOUT,
          outputPath: null,
        }),
      );

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Retryable render failure');
      cleanup();
    });

    it('should continue to quality scoring on render success', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('completed');
      expect(result.qualityScore).toBeDefined();
      expect(typeof result.qualityScore).toBe('number');
      cleanup();
    });
  });

  // ── Quality score ──

  describe('quality score', () => {
    function setupForQualityScore(flags: string[]) {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);
      mocks.gatesService.runAllGates.mockReturnValue(
        fakeGateOutput({ flags, canPublish: true }),
      );
      return cleanup;
    }

    it('should score 100 with no flags', async () => {
      const cleanup = setupForQualityScore([]);
      const result = await (processor as any).handleVideoExecution(fakeJob());
      expect(result.qualityScore).toBe(100);
      cleanup();
    });

    it('should deduct 25 for UNSOURCED_CLAIMS flag', async () => {
      const cleanup = setupForQualityScore(['UNSOURCED_CLAIMS']);
      const result = await (processor as any).handleVideoExecution(fakeJob());
      expect(result.qualityScore).toBe(75);
      cleanup();
    });

    it('should floor score at 0 when penalties exceed 100', async () => {
      // CTA_IN_SOCLE=30 + VISUAL_AS_PROOF=30 + UNSOURCED_CLAIMS=25 + PROMO_IN_EDUCATIONAL=20 = 105
      const cleanup = setupForQualityScore([
        'CTA_IN_SOCLE',
        'VISUAL_AS_PROOF',
        'UNSOURCED_CLAIMS',
        'PROMO_IN_EDUCATIONAL',
      ]);
      const result = await (processor as any).handleVideoExecution(fakeJob());
      expect(result.qualityScore).toBe(0);
      cleanup();
    });
  });

  // ── Observe-only mode ──

  describe('observe-only mode', () => {
    it('should pass canPublish through in blocking mode', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);
      mocks.gatesService.runAllGates.mockReturnValue(
        fakeGateOutput({ canPublish: true }),
      );

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.canPublish).toBe(true);
      cleanup();
    });

    it('should set canPublish=null in observe-only mode', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'false',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);
      mocks.gatesService.runAllGates.mockReturnValue(
        fakeGateOutput({ canPublish: false }),
      );

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.canPublish).toBeNull();
      cleanup();
    });
  });

  // ── 2-phase finalization + production write-back ──

  describe('2-phase finalization', () => {
    it('should complete both phases and write back to production', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      const updateEqMock = jest.fn().mockResolvedValue({ error: null });
      chain.update = jest.fn().mockReturnValue({ eq: updateEqMock });
      setClient(chain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('completed');
      // Should have called update multiple times: processing, phase1, phase2
      expect(chain.update).toHaveBeenCalledTimes(3);
      // Production write-back
      expect(mocks.dataService.updateProduction).toHaveBeenCalledWith(
        'brief-001',
        expect.objectContaining({
          gateResults: expect.any(Array),
          qualityScore: expect.any(Number),
          qualityFlags: expect.any(Array),
        }),
      );
      cleanup();
    });

    it('should catch phase 1 DB failure in outer catch-all', async () => {
      const cleanup = withEnv({
        VIDEO_PIPELINE_ENABLED: 'true',
        VIDEO_GATES_BLOCKING: 'true',
      });
      let callCount = 0;
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation(() => {
          callCount++;
          // First update (status=processing) succeeds
          if (callCount === 1) {
            return Promise.resolve({ error: null });
          }
          // Phase 1 update fails
          if (callCount === 2) {
            return Promise.resolve({
              error: { message: 'connection reset' },
            });
          }
          // Catch-all error persist succeeds
          return Promise.resolve({ error: null });
        }),
      });
      setClient(chain);

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('connection reset');
      cleanup();
    });
  });

  // ── Outer catch-all ──

  describe('outer catch-all', () => {
    it('should persist error state when getProduction throws', async () => {
      const cleanup = withEnv({ VIDEO_PIPELINE_ENABLED: 'true' });
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      mocks.dataService.getProduction.mockRejectedValue(
        new Error('Production not found'),
      );

      const result = await (processor as any).handleVideoExecution(fakeJob());

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Production not found');
      // Should have persisted error to DB via updateExecutionLog
      expect(chain.update).toHaveBeenCalled();
      cleanup();
    });

    it('should re-throw when DB persistence also fails in catch-all', async () => {
      const cleanup = withEnv({ VIDEO_PIPELINE_ENABLED: 'true' });
      let callCount = 0;
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation(() => {
          callCount++;
          // First update (status=processing) succeeds
          if (callCount === 1) {
            return Promise.resolve({ error: null });
          }
          // Catch-all update also fails
          return Promise.resolve({
            error: { message: 'DB completely down' },
          });
        }),
      });
      setClient(chain);

      mocks.dataService.getProduction.mockRejectedValue(
        new Error('Service crash'),
      );

      await expect(
        (processor as any).handleVideoExecution(fakeJob()),
      ).rejects.toThrow('DB completely down');
      cleanup();
    });
  });

  // ── @OnQueueFailed DB sync ──

  describe('@OnQueueFailed handleFailedJob', () => {
    it('should sync DB when status is still pending', async () => {
      const chain = chainMock({ data: { status: 'pending' }, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      setClient(chain);

      await (processor as any).handleFailedJob(
        fakeJob(),
        new Error('Bull timeout'),
      );

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          retryable: true,
          render_error_code: 'RENDER_UNKNOWN_ERROR',
        }),
      );
      expect(mocks.jobHealth.recordFailure).toHaveBeenCalledWith(
        'video-render',
        'Bull timeout',
      );
    });

    it('should skip DB update when status is already completed', async () => {
      const chain = chainMock({ data: { status: 'completed' }, error: null });
      setClient(chain);

      await (processor as any).handleFailedJob(
        fakeJob(),
        new Error('Stale failure'),
      );

      // select was called (to check status), but update should NOT be called
      expect(chain.from).toHaveBeenCalled();
      expect(chain.update).not.toHaveBeenCalled();
    });
  });
});
