/**
 * RenderAdapterService Unit Tests (P13b)
 *
 * Tests canary evaluation logic, Redis-backed quota, and stats.
 * Mocks CacheService and manipulates process.env for canary policy.
 *
 * @see backend/src/modules/media-factory/render/render-adapter.service.ts
 */
import { RenderAdapterService } from '../../src/modules/media-factory/render/render-adapter.service';
import { RenderRequest } from '../../src/modules/media-factory/render/types/render.types';

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
});
