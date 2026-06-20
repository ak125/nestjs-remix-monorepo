/**
 * VideoJobService — Stats / list / map unit tests (P18).
 *
 * Tests getExecutionStatus, listExecutions, getExecutionStats, mapLogRow.
 * Reuses chainMock pattern from video-job-retry-guard.test.ts.
 *
 * @see backend/src/modules/media-factory/services/video-job.service.ts
 */

import { NotFoundException } from '@nestjs/common';
import { VideoJobService } from '../../src/modules/media-factory/services/video-job.service';

// ─── Mock helpers ──────────────────────────────────────────

function createMocks() {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'bull-job-99' }),
  };
  const mockDataService = {
    getProduction: jest.fn().mockResolvedValue({
      briefId: 'brief-001',
      videoType: 'short',
      vertical: 'freinage',
      gammeAlias: 'disque-frein',
      pgId: 42,
    }),
  };
  const mockRenderAdapter = {
    getCanaryStats: jest.fn().mockResolvedValue({ dailyUsageCount: 0 }),
  };
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
  return { mockQueue, mockDataService, mockRenderAdapter, mockConfigService };
}

function createService(
  mocks: ReturnType<typeof createMocks>,
): VideoJobService {
  return new (VideoJobService as any)(
    mocks.mockConfigService,
    mocks.mockQueue,
    mocks.mockDataService,
    mocks.mockRenderAdapter,
  ) as VideoJobService;
}

function fullDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    brief_id: 'brief-001',
    video_type: 'short',
    vertical: 'freinage',
    status: 'completed',
    bullmq_job_id: 'bull-job-10',
    trigger_source: 'manual',
    trigger_job_id: null,
    created_at: '2026-02-24T00:00:00Z',
    started_at: '2026-02-24T00:00:01Z',
    completed_at: '2026-02-24T00:00:05Z',
    artefact_check: null,
    gate_results: null,
    can_publish: true,
    quality_score: 85,
    quality_flags: null,
    error_message: null,
    duration_ms: 5000,
    attempt_number: 1,
    feature_flags: null,
    engine_name: 'stub',
    engine_version: '1.0.0',
    render_status: 'success',
    render_output_path: null,
    render_metadata: null,
    render_duration_ms: 3000,
    render_error_code: null,
    engine_resolution: 'requested',
    retryable: false,
    gamme_alias: 'disque-frein',
    pg_id: 42,
    is_canary: false,
    canary_fallback: false,
    canary_error_message: null,
    canary_error_code: null,
    ...overrides,
  };
}

// Chain for getExecutionStatus (.single) and listExecutions (.limit)
function simpleChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockResolvedValue(result);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

// Chain for getExecutionStats (thenable — `await query`)
function statsChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, any> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.in = jest.fn().mockReturnValue(chain);
  // Make chain awaitable for `const { data, error } = await query`
  chain.then = (resolve: Function, reject?: Function) =>
    Promise.resolve(result).then(resolve as any, reject as any);
  return chain;
}

// ─── Tests ─────────────────────────────────────────────────

describe('VideoJobService — stats/list/map (P18)', () => {
  let service: VideoJobService;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    service = createService(mocks);
  });

  // ── getExecutionStatus ──

  describe('getExecutionStatus', () => {
    it('should return mapped camelCase row when found', async () => {
      const row = fullDbRow();
      const chain = simpleChain({ data: row, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const result = await service.getExecutionStatus(10);
      expect(result.id).toBe(10);
      expect(result.briefId).toBe('brief-001');
      expect(result.videoType).toBe('short');
      expect(result.engineResolution).toBe('requested');
      expect(result.isCanary).toBe(false);
    });

    it('should throw NotFoundException on DB error', async () => {
      const chain = simpleChain({
        data: null,
        error: { message: 'DB error' },
      });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      await expect(service.getExecutionStatus(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when data is null', async () => {
      const chain = simpleChain({ data: null, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      await expect(service.getExecutionStatus(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── listExecutions ──

  describe('listExecutions', () => {
    it('should return mapped rows on success', async () => {
      const rows = [fullDbRow({ id: 1 }), fullDbRow({ id: 2 })];
      const chain = simpleChain({ data: rows, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const result = await service.listExecutions('brief-001');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('should return empty array on DB error', async () => {
      const chain = simpleChain({
        data: null,
        error: { message: 'timeout' },
      });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const result = await service.listExecutions('brief-001');
      expect(result).toEqual([]);
    });

    it('should map isCanary and canaryFallback correctly', async () => {
      const rows = [
        fullDbRow({
          id: 1,
          is_canary: true,
          canary_fallback: true,
          canary_error_code: 'RENDER_ENGINE_TIMEOUT',
        }),
      ];
      const chain = simpleChain({ data: rows, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const result = await service.listExecutions('brief-001');
      expect(result[0].isCanary).toBe(true);
      expect(result[0].canaryFallback).toBe(true);
      expect(result[0].canaryErrorCode).toBe('RENDER_ENGINE_TIMEOUT');
    });
  });

  // ── getExecutionStats ──

  describe('getExecutionStats', () => {
    it('should return zero stats on DB error', async () => {
      const chain = statsChain({
        data: null,
        error: { message: 'DB unreachable' },
      });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const stats = await service.getExecutionStats('all');
      expect(stats.total).toBe(0);
      expect(stats.byStatus).toEqual({});
      expect(stats.avgDurationMs).toBeNull();
      expect(stats.timeWindow).toBe('all');
    });

    it('should return total=0 and null averages for empty data', async () => {
      const chain = statsChain({ data: [], error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const stats = await service.getExecutionStats();
      expect(stats.total).toBe(0);
      expect(stats.avgDurationMs).toBeNull();
      expect(stats.renderPerformance.p50RenderDurationMs).toBeNull();
    });

    it('should compute byStatus correctly with mixed statuses', async () => {
      const rows = [
        { status: 'completed', duration_ms: 100, engine_name: 'stub', render_duration_ms: null, is_canary: false, canary_fallback: false, canary_error_code: null },
        { status: 'completed', duration_ms: 200, engine_name: 'stub', render_duration_ms: null, is_canary: false, canary_fallback: false, canary_error_code: null },
        { status: 'failed', duration_ms: 300, engine_name: 'stub', render_duration_ms: null, is_canary: false, canary_fallback: false, canary_error_code: null },
      ];
      const chain = statsChain({ data: rows, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const stats = await service.getExecutionStats();
      expect(stats.total).toBe(3);
      expect(stats.byStatus).toEqual({ completed: 2, failed: 1 });
      expect(stats.avgDurationMs).toBe(200); // (100+200+300)/3
    });

    it('should compute canary successRate and fallbackRate when totalCanary > 0', async () => {
      const rows = [
        { status: 'completed', duration_ms: 100, engine_name: 'remotion', render_duration_ms: 80, is_canary: true, canary_fallback: false, canary_error_code: null },
        { status: 'completed', duration_ms: 200, engine_name: 'remotion', render_duration_ms: 150, is_canary: true, canary_fallback: false, canary_error_code: null },
        { status: 'completed', duration_ms: 300, engine_name: 'remotion', render_duration_ms: 250, is_canary: true, canary_fallback: false, canary_error_code: null },
        { status: 'completed', duration_ms: 400, engine_name: 'stub', render_duration_ms: 50, is_canary: true, canary_fallback: true, canary_error_code: 'RENDER_ENGINE_TIMEOUT' },
      ];
      const chain = statsChain({ data: rows, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const stats = await service.getExecutionStats();
      expect(stats.canary.totalCanary).toBe(4);
      expect(stats.canary.totalFallback).toBe(1);
      // successRate = Math.round(((4 - 1) / 4) * 100) = 75
      expect(stats.canary.successRate).toBe(75);
      // fallbackRate = Math.round((1 / 4) * 100) = 25
      expect(stats.canary.fallbackRate).toBe(25);
      expect(stats.canary.topErrorCodes).toEqual({
        RENDER_ENGINE_TIMEOUT: 1,
      });
    });

    it('should return successRate=null when totalCanary=0', async () => {
      const rows = [
        { status: 'completed', duration_ms: 100, engine_name: 'stub', render_duration_ms: 50, is_canary: false, canary_fallback: false, canary_error_code: null },
      ];
      const chain = statsChain({ data: rows, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const stats = await service.getExecutionStats();
      expect(stats.canary.totalCanary).toBe(0);
      expect(stats.canary.successRate).toBeNull();
      expect(stats.canary.fallbackRate).toBeNull();
    });

    it('should compute p50 and p95 percentiles correctly', async () => {
      // 10 rows with render_duration_ms: 100, 200, ..., 1000
      const rows = Array.from({ length: 10 }, (_, i) => ({
        status: 'completed',
        duration_ms: (i + 1) * 100,
        engine_name: 'remotion',
        render_duration_ms: (i + 1) * 100,
        is_canary: false,
        canary_fallback: false,
        canary_error_code: null,
      }));
      const chain = statsChain({ data: rows, error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      const stats = await service.getExecutionStats();
      // sorted: [100..1000], p50Index = floor(10*0.5) = 5 → 600
      expect(stats.renderPerformance.p50RenderDurationMs).toBe(600);
      // p95Index = floor(10*0.95) = 9 → 1000
      expect(stats.renderPerformance.p95RenderDurationMs).toBe(1000);
    });

    it('should call gte with ISO date when timeWindow=24h', async () => {
      const chain = statsChain({ data: [], error: null });
      Object.defineProperty(service, 'client', {
        get: () => chain,
        configurable: true,
      });

      await service.getExecutionStats('24h');
      expect(chain.gte).toHaveBeenCalledWith(
        'created_at',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });
  });

  // ── mapLogRow ──

  describe('mapLogRow', () => {
    it('should map full row to camelCase', () => {
      const row = fullDbRow();
      const mapped = (service as any).mapLogRow(row);
      expect(mapped.briefId).toBe('brief-001');
      expect(mapped.videoType).toBe('short');
      expect(mapped.bullmqJobId).toBe('bull-job-10');
      expect(mapped.triggerSource).toBe('manual');
      expect(mapped.canPublish).toBe(true);
      expect(mapped.qualityScore).toBe(85);
      expect(mapped.engineName).toBe('stub');
      expect(mapped.renderDurationMs).toBe(3000);
      expect(mapped.gammeAlias).toBe('disque-frein');
      expect(mapped.pgId).toBe(42);
      expect(mapped.isCanary).toBe(false);
      expect(mapped.canaryFallback).toBe(false);
    });

    it('should apply defaults for missing optional fields', () => {
      const minimalRow = {
        id: 1,
        brief_id: 'b-1',
        video_type: 'short',
        vertical: 'freinage',
        status: 'pending',
        bullmq_job_id: null,
        trigger_source: 'manual',
        trigger_job_id: null,
        created_at: '2026-02-24T00:00:00Z',
        started_at: null,
        completed_at: null,
        artefact_check: null,
        gate_results: null,
        can_publish: null,
        quality_score: null,
        quality_flags: null,
        error_message: null,
        duration_ms: null,
        // Missing: attempt_number, engine_name, retryable, is_canary, etc.
      };
      const mapped = (service as any).mapLogRow(minimalRow);
      expect(mapped.attemptNumber).toBe(1);
      expect(mapped.retryable).toBe(false);
      expect(mapped.isCanary).toBe(false);
      expect(mapped.canaryFallback).toBe(false);
      expect(mapped.gammeAlias).toBeNull();
      expect(mapped.engineName).toBeNull();
    });
  });
});
