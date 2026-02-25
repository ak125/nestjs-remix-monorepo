/**
 * RenderAdapterService Unit Tests (P13b)
 *
 * Tests canary evaluation logic, Redis-backed quota, and stats.
 * Mocks CacheService and manipulates process.env for canary policy.
 *
 * @see backend/src/modules/media-factory/render/render-adapter.service.ts
 */
import { RenderAdapterService } from '../../src/modules/media-factory/render/render-adapter.service';
import {
  RenderRequest,
  RenderResult,
  RenderErrorCode,
} from '../../src/modules/media-factory/render/types/render.types';
import { CanaryDecision } from '../../src/modules/media-factory/render/types/canary.types';

describe('RenderAdapterService', () => {
  let mockCacheService: {
    get: jest.Mock;
    set: jest.Mock;
  };

  const savedEnv = { ...process.env };

  function setEnv(overrides: Record<string, string>): void {
    Object.assign(process.env, overrides);
  }

  function createService(
    envOverrides: Record<string, string> = {},
  ): RenderAdapterService {
    // Reset env to saved state + overrides
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('VIDEO_')) delete process.env[key];
    }
    setEnv(envOverrides);
    return new RenderAdapterService(mockCacheService as any);
  }

  function makeRequest(
    overrides?: Partial<RenderRequest>,
  ): RenderRequest {
    return {
      briefId: 'test-brief',
      executionLogId: 1,
      videoType: 'short',
      vertical: 'freinage',
      gateResults: null,
      qualityScore: 0,
      canPublish: true,
      governanceSnapshot: {
        pipelineEnabled: true,
        gatesBlocking: false,
        renderEngine: 'remotion',
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('VIDEO_')) delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  // ── evaluateCanary ──

  describe('evaluateCanary', () => {
    it('should return useCanary=false when VIDEO_RENDER_ENABLED is not true', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'false',
      });
      const decision = await service.evaluateCanary(makeRequest());
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toContain('VIDEO_RENDER_ENABLED');
    });

    it('should return useCanary=false when VIDEO_CANARY_ENABLED is not true', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'false',
      });
      const decision = await service.evaluateCanary(makeRequest());
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toContain('VIDEO_CANARY_ENABLED');
    });

    it('should return useCanary=false when engine is stub', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'stub',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
      });
      const decision = await service.evaluateCanary(makeRequest());
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toContain('engine=stub');
    });

    it('should return useCanary=true when eligible and quota available', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      const decision = await service.evaluateCanary(makeRequest());
      expect(decision.useCanary).toBe(true);
      expect(decision.remainingQuota).toBe(10);
    });

    it('should return useCanary=false when videoType is not eligible', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'film_gamme',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      const decision = await service.evaluateCanary(
        makeRequest({ videoType: 'short' }),
      );
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toContain('not eligible');
    });

    it('should return useCanary=false when daily quota is exhausted', async () => {
      mockCacheService.get.mockResolvedValue(10); // quota = 10, used = 10
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      const decision = await service.evaluateCanary(makeRequest());
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toContain('quota exhausted');
    });

    it('should return useCanary=false when templateId is not eligible', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_ELIGIBLE_TEMPLATE_IDS: 'template-A',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      const decision = await service.evaluateCanary(
        makeRequest({ templateId: 'template-B' }),
      );
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toContain('not eligible');
    });
  });

  // ── Redis counter ──

  describe('Redis counter', () => {
    it('should return dailyUsageCount=0 when cache is empty', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      const decision = await service.evaluateCanary(makeRequest());
      expect(decision.dailyUsageCount).toBe(0);
      expect(decision.remainingQuota).toBe(10);
    });

    it('should use Redis key with UTC date pattern', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      await service.evaluateCanary(makeRequest());
      // getDailyCount calls cacheService.get with date key
      const calledKey = mockCacheService.get.mock.calls[0]?.[0] as string;
      expect(calledKey).toMatch(/^video:canary:count:\d{4}-\d{2}-\d{2}$/);
    });

    it('should reflect Redis value in dailyUsageCount', async () => {
      mockCacheService.get.mockResolvedValue(5);
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      const decision = await service.evaluateCanary(makeRequest());
      expect(decision.dailyUsageCount).toBe(5);
      expect(decision.remainingQuota).toBe(5);
    });
  });

  // ── getCanaryStats ──

  describe('getCanaryStats', () => {
    it('should return complete stats object', async () => {
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short,film_gamme',
        VIDEO_CANARY_QUOTA_PER_DAY: '20',
      });
      const stats = await service.getCanaryStats();
      expect(stats).toEqual(
        expect.objectContaining({
          engineName: 'remotion',
          canaryAvailable: true,
          renderEnabled: true,
          dailyUsageCount: 0,
          remainingQuota: 20,
          quotaPerDay: 20,
          eligibleVideoTypes: ['short', 'film_gamme'],
        }),
      );
    });

    it('should reflect Redis daily count in stats', async () => {
      mockCacheService.get.mockResolvedValue(7);
      const service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      const stats = await service.getCanaryStats();
      expect(stats.dailyUsageCount).toBe(7);
      expect(stats.remainingQuota).toBe(3);
    });
  });

  // ── render() dispatch ──

  describe('render() dispatch', () => {
    let service: RenderAdapterService;
    let mockStubEngine: { name: string; version: string; render: jest.Mock };
    let mockCanaryEngine: { name: string; version: string; render: jest.Mock };

    function fakeResult(overrides: Partial<RenderResult> = {}): RenderResult {
      return {
        status: 'success',
        engineName: 'stub',
        engineVersion: '1.0.0',
        durationMs: 50,
        outputPath: null,
        metadata: { stub: true },
        engineResolution: 'requested' as const,
        retryable: false,
        ...overrides,
      };
    }

    beforeEach(() => {
      service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
      });
      mockStubEngine = {
        name: 'stub',
        version: '1.0.0',
        render: jest.fn().mockResolvedValue(fakeResult()),
      };
      mockCanaryEngine = {
        name: 'remotion',
        version: '1.0.0',
        render: jest.fn().mockResolvedValue(
          fakeResult({ engineName: 'remotion', outputPath: '/tmp/out.mp4' }),
        ),
      };
      (service as any).stubEngine = mockStubEngine;
      (service as any).canaryEngine = mockCanaryEngine;
    });

    it('should route to canary when useCanary=true and canaryEngine present', async () => {
      jest.spyOn(service, 'evaluateCanary').mockResolvedValue({
        useCanary: true,
        reason: 'eligible',
        dailyUsageCount: 0,
        remainingQuota: 10,
      });
      const result = await service.render(makeRequest());
      expect(mockCanaryEngine.render).toHaveBeenCalled();
      expect(result.metadata).toEqual(
        expect.objectContaining({ canary: true }),
      );
    });

    it('should route to stub when useCanary=false', async () => {
      jest.spyOn(service, 'evaluateCanary').mockResolvedValue({
        useCanary: false,
        reason: 'disabled',
        dailyUsageCount: 0,
        remainingQuota: 0,
      });
      const result = await service.render(makeRequest());
      expect(mockCanaryEngine.render).not.toHaveBeenCalled();
      expect(mockStubEngine.render).toHaveBeenCalled();
    });

    it('should route to stub when useCanary=true but canaryEngine=null', async () => {
      (service as any).canaryEngine = null;
      jest.spyOn(service, 'evaluateCanary').mockResolvedValue({
        useCanary: true,
        reason: 'eligible',
        dailyUsageCount: 0,
        remainingQuota: 10,
      });
      const result = await service.render(makeRequest());
      expect(mockStubEngine.render).toHaveBeenCalled();
    });
  });

  // ── renderWithCanary ──

  describe('renderWithCanary', () => {
    let service: RenderAdapterService;
    let mockStubEngine: { name: string; version: string; render: jest.Mock };
    let mockCanaryEngine: { name: string; version: string; render: jest.Mock };
    const decision: CanaryDecision = {
      useCanary: true,
      reason: 'eligible + quota',
      dailyUsageCount: 0,
      remainingQuota: 10,
    };

    function fakeResult(overrides: Partial<RenderResult> = {}): RenderResult {
      return {
        status: 'success',
        engineName: 'remotion',
        engineVersion: '1.0.0',
        durationMs: 500,
        outputPath: '/tmp/out.mp4',
        metadata: {},
        retryable: false,
        ...overrides,
      };
    }

    beforeEach(() => {
      service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_CANARY_ENABLED: 'true',
        VIDEO_CANARY_ELIGIBLE_VIDEO_TYPES: 'short',
        VIDEO_CANARY_QUOTA_PER_DAY: '10',
        VIDEO_REMOTION_TIMEOUT_MS: '120000',
      });
      mockStubEngine = {
        name: 'stub',
        version: '1.0.0',
        render: jest.fn().mockResolvedValue(
          fakeResult({ engineName: 'stub', outputPath: null }),
        ),
      };
      mockCanaryEngine = {
        name: 'remotion',
        version: '1.0.0',
        render: jest.fn().mockResolvedValue(fakeResult()),
      };
      (service as any).stubEngine = mockStubEngine;
      (service as any).canaryEngine = mockCanaryEngine;
    });

    it('should return success with canary metadata on happy path', async () => {
      const result = await (service as any).renderWithCanary(
        makeRequest(),
        decision,
      );
      expect(result.status).toBe('success');
      expect(result.engineResolution).toBe('requested');
      expect(result.metadata.canary).toBe(true);
      expect(result.metadata.fallback).toBe(false);
    });

    it('Rule 3: should return failed when canary reports success but no outputPath', async () => {
      mockCanaryEngine.render.mockResolvedValue(
        fakeResult({ outputPath: null }),
      );
      const result = await (service as any).renderWithCanary(
        makeRequest(),
        decision,
      );
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_OUTPUT_INVALID);
      expect(result.engineResolution).toBe('requested');
      expect(result.retryable).toBe(true);
    });

    it('should set default RENDER_PROCESS_FAILED when canary returns failed without errorCode', async () => {
      mockCanaryEngine.render.mockResolvedValue(
        fakeResult({
          status: 'failed',
          outputPath: null,
          errorCode: undefined,
        }),
      );
      const result = await (service as any).renderWithCanary(
        makeRequest(),
        decision,
      );
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_PROCESS_FAILED);
    });

    it('should fallback to stub on canary timeout with RENDER_ENGINE_TIMEOUT', async () => {
      mockCanaryEngine.render.mockRejectedValue(
        new Error('RENDER_TIMEOUT: engine did not respond within 120000ms'),
      );
      const result = await (service as any).renderWithCanary(
        makeRequest(),
        decision,
      );
      expect(result.engineResolution).toBe('fallback_to_stub');
      expect(result.metadata.fallback).toBe(true);
      expect(result.metadata.canaryErrorCode).toBe(
        RenderErrorCode.RENDER_ENGINE_TIMEOUT,
      );
      expect(mockStubEngine.render).toHaveBeenCalled();
    });

    it('should fallback to stub on canary non-timeout error', async () => {
      mockCanaryEngine.render.mockRejectedValue(
        new Error('HTTP 502: Bad Gateway'),
      );
      const result = await (service as any).renderWithCanary(
        makeRequest(),
        decision,
      );
      expect(result.engineResolution).toBe('fallback_to_stub');
      expect(result.metadata.canary).toBe(true);
      expect(result.metadata.fallback).toBe(true);
      expect(result.metadata.canaryError).toBe('HTTP 502: Bad Gateway');
      expect(result.metadata.canaryErrorCode).toBe(
        RenderErrorCode.RENDER_PROCESS_FAILED,
      );
    });

    it('should call incrementDailyCount and set Redis with TTL 90000', async () => {
      await (service as any).renderWithCanary(makeRequest(), decision);
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^video:canary:count:\d{4}-\d{2}-\d{2}$/),
        1,
        90000,
      );
    });
  });

  // ── renderWithStub ──

  describe('renderWithStub', () => {
    let service: RenderAdapterService;
    let mockStubEngine: { name: string; version: string; render: jest.Mock };

    function fakeStubResult(
      overrides: Partial<RenderResult> = {},
    ): RenderResult {
      return {
        status: 'success',
        engineName: 'stub',
        engineVersion: '1.0.0',
        durationMs: 50,
        outputPath: null,
        metadata: { stub: true },
        retryable: false,
        ...overrides,
      };
    }

    beforeEach(() => {
      mockStubEngine = {
        name: 'stub',
        version: '1.0.0',
        render: jest.fn().mockResolvedValue(fakeStubResult()),
      };
    });

    it('should return engineResolution=requested when VIDEO_RENDER_ENGINE=stub', async () => {
      service = createService({ VIDEO_RENDER_ENGINE: 'stub' });
      (service as any).stubEngine = mockStubEngine;
      const result = await (service as any).renderWithStub(makeRequest());
      expect(result.engineResolution).toBe('requested');
    });

    it('should return engineResolution=fallback_to_stub when VIDEO_RENDER_ENGINE=remotion', async () => {
      service = createService({
        VIDEO_RENDER_ENGINE: 'remotion',
        VIDEO_RENDER_ENABLED: 'true',
      });
      (service as any).stubEngine = mockStubEngine;
      const result = await (service as any).renderWithStub(makeRequest());
      expect(result.engineResolution).toBe('fallback_to_stub');
    });

    it('should set default RENDER_PROCESS_FAILED when stub returns failed without errorCode', async () => {
      service = createService({ VIDEO_RENDER_ENGINE: 'stub' });
      mockStubEngine.render.mockResolvedValue(
        fakeStubResult({ status: 'failed', errorCode: undefined }),
      );
      (service as any).stubEngine = mockStubEngine;
      const result = await (service as any).renderWithStub(makeRequest());
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_PROCESS_FAILED);
    });

    it('should return RENDER_ENGINE_TIMEOUT and retryable=true on timeout throw', async () => {
      service = createService({ VIDEO_RENDER_ENGINE: 'stub' });
      mockStubEngine.render.mockRejectedValue(
        new Error('RENDER_TIMEOUT: engine did not respond within 120000ms'),
      );
      (service as any).stubEngine = mockStubEngine;
      const result = await (service as any).renderWithStub(makeRequest());
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_ENGINE_TIMEOUT);
      expect(result.retryable).toBe(true);
    });

    it('should return RENDER_UNKNOWN_ERROR and retryable=false on non-timeout throw', async () => {
      service = createService({ VIDEO_RENDER_ENGINE: 'stub' });
      mockStubEngine.render.mockRejectedValue(new Error('Unexpected crash'));
      (service as any).stubEngine = mockStubEngine;
      const result = await (service as any).renderWithStub(makeRequest());
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_UNKNOWN_ERROR);
      expect(result.retryable).toBe(false);
    });
  });

  // ── withTimeout ──

  describe('withTimeout', () => {
    let service: RenderAdapterService;

    beforeEach(() => {
      jest.useFakeTimers();
      service = createService({ VIDEO_RENDER_ENGINE: 'stub' });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve when promise resolves before timeout', async () => {
      const result = await (service as any).withTimeout(
        Promise.resolve('ok'),
        5000,
      );
      expect(result).toBe('ok');
    });

    it('should reject when promise rejects before timeout', async () => {
      await expect(
        (service as any).withTimeout(
          Promise.reject(new Error('boom')),
          5000,
        ),
      ).rejects.toThrow('boom');
    });

    it('should reject with RENDER_TIMEOUT when timer fires before promise', async () => {
      const neverResolve = new Promise(() => {});
      const promise = (service as any).withTimeout(neverResolve, 5000);
      jest.advanceTimersByTime(5001);
      await expect(promise).rejects.toThrow('RENDER_TIMEOUT');
    });
  });
});
