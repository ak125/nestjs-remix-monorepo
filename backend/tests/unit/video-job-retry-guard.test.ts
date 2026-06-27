/**
 * VideoJobService — Retry guard + active-job dedup + error paths tests (P14c + P20).
 *
 * Tests:
 *  - retryExecution: active-job guard (ConflictException)
 *  - retryExecution: status guard (BadRequestException)
 *  - retryExecution: retryable guard (BadRequestException)
 *  - retryExecution: happy path (inserts + queues)
 *  - submitExecution: active-job guard (existing behavior)
 *  - P20: getCanaryStats delegation
 *  - P20: feature flag disabled (submitExecution + retryExecution)
 *  - P20: DB insert failure (submitExecution + retryExecution)
 *  - P20: queue.add failure (submitExecution + retryExecution)
 *
 * Strategy: mock SupabaseBaseService.client (Supabase chain), BullMQ Queue, VideoDataService.
 */

import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { VideoJobService } from '../../src/modules/media-factory/services/video-job.service';

// ─── Mock chain builder ──────────────────────────────────────

type ChainResult = { data: unknown; error: unknown };

function chainMock(result: ChainResult) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockResolvedValue(result);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.order = jest.fn().mockReturnValue(chain);
  return chain;
}

// ─── Create service with mocks ───────────────────────────────

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

// ─── Build a fake execution row from DB ──────────────────────

function fakeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    brief_id: 'brief-001',
    video_type: 'short',
    vertical: 'freinage',
    status: 'failed',
    bullmq_job_id: 'bull-job-10',
    trigger_source: 'manual',
    trigger_job_id: null,
    created_at: '2026-02-24T00:00:00Z',
    started_at: '2026-02-24T00:00:01Z',
    completed_at: '2026-02-24T00:00:05Z',
    artefact_check: null,
    gate_results: null,
    can_publish: null,
    quality_score: null,
    quality_flags: null,
    error_message: 'test error',
    duration_ms: 5000,
    attempt_number: 1,
    feature_flags: null,
    engine_name: 'stub',
    engine_version: '1.0.0',
    render_status: 'failed',
    render_output_path: null,
    render_metadata: null,
    render_duration_ms: 3000,
    render_error_code: 'RENDER_PROCESS_FAILED',
    engine_resolution: 'requested',
    retryable: true,
    gamme_alias: 'disque-frein',
    pg_id: 42,
    is_canary: false,
    canary_fallback: false,
    canary_error_message: null,
    canary_error_code: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe('VideoJobService — retry guard (P14)', () => {
  let service: VideoJobService;
  let supabaseChain: ReturnType<typeof chainMock>;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();

    // Create service via constructor (bypass DI)
    service = new (VideoJobService as any)(
      mocks.mockConfigService,
      mocks.mockQueue,
      mocks.mockDataService,
      mocks.mockRenderAdapter,
    );
  });

  // ── retryExecution: status guard ──

  it('should throw BadRequestException when status is not failed', async () => {
    const row = fakeDbRow({ status: 'completed' });
    supabaseChain = chainMock({ data: row, error: null });
    Object.defineProperty(service, 'client', { get: () => supabaseChain });

    await expect(service.retryExecution(10)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.retryExecution(10)).rejects.toThrow(
      /status is 'completed'/,
    );
  });

  it('should throw BadRequestException when retryable is false', async () => {
    const row = fakeDbRow({ status: 'failed', retryable: false });
    supabaseChain = chainMock({ data: row, error: null });
    Object.defineProperty(service, 'client', { get: () => supabaseChain });

    await expect(service.retryExecution(10)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.retryExecution(10)).rejects.toThrow(/not retryable/);
  });

  // ── retryExecution: active-job guard (P14a) ──

  it('should throw ConflictException when a pending job exists for same briefId', async () => {
    // Step 1: getExecutionStatus → returns failed row
    // Step 2: active-job check → returns a pending row
    const failedRow = fakeDbRow({ status: 'failed', retryable: true });

    // Build a multi-step mock chain
    let callCount = 0;
    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockImplementation(() => {
      callCount++;
      // First .single() → getExecutionStatus
      return Promise.resolve({ data: failedRow, error: null });
    });
    chain.limit = jest.fn().mockImplementation(() => {
      // .limit() → active-job check → found 1 active
      return Promise.resolve({ data: [{ id: 99 }], error: null });
    });

    Object.defineProperty(service, 'client', { get: () => chain });

    process.env.VIDEO_PIPELINE_ENABLED = 'true';

    await expect(service.retryExecution(10)).rejects.toThrow(
      ConflictException,
    );
    await expect(service.retryExecution(10)).rejects.toThrow(
      /Active execution already exists/,
    );
  });

  it('should throw ConflictException when a processing job exists for same briefId', async () => {
    const failedRow = fakeDbRow({ status: 'failed', retryable: true });

    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({
      data: failedRow,
      error: null,
    });
    chain.limit = jest.fn().mockResolvedValue({
      data: [{ id: 77 }],
      error: null,
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';

    await expect(service.retryExecution(10)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should proceed when no active jobs exist for same briefId', async () => {
    const failedRow = fakeDbRow({ status: 'failed', retryable: true });

    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    // getExecutionStatus → single
    chain.single = jest.fn().mockResolvedValue({
      data: failedRow,
      error: null,
    });
    // active-job check → empty list
    chain.limit = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';

    // insert new log entry: .insert().select().single()
    // We need insert to return a new row
    let insertCalled = false;
    const origInsert = chain.insert;
    chain.insert = jest.fn().mockImplementation(() => {
      insertCalled = true;
      // After insert, .select().single() returns new row
      const insertChain: Record<string, jest.Mock> = {};
      insertChain.select = jest.fn().mockReturnValue(insertChain);
      insertChain.single = jest.fn().mockResolvedValue({
        data: { id: 20 },
        error: null,
      });
      return insertChain;
    });

    const result = await service.retryExecution(10);

    expect(insertCalled).toBe(true);
    expect(result.newExecutionLogId).toBe(20);
    expect(mocks.mockQueue.add).toHaveBeenCalledWith(
      'video-execute',
      expect.objectContaining({
        executionLogId: 20,
        briefId: 'brief-001',
        triggerSource: 'retry',
      }),
      expect.any(Object),
    );
  });

  // ── retryExecution: NotFoundException ──

  it('should throw NotFoundException when execution does not exist', async () => {
    supabaseChain = chainMock({ data: null, error: { message: 'not found' } });
    Object.defineProperty(service, 'client', { get: () => supabaseChain });

    await expect(service.retryExecution(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── submitExecution: active-job guard (existing behavior) ──

  it('submitExecution should throw ConflictException when active job exists', async () => {
    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
    // active-job check returns an active job
    chain.limit = jest.fn().mockResolvedValue({
      data: [{ id: 55 }],
      error: null,
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';

    await expect(
      service.submitExecution('brief-001', 'manual'),
    ).rejects.toThrow(ConflictException);
  });

  it('submitExecution should proceed when no active jobs exist', async () => {
    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
    chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });

    // After no active jobs → insert new execution
    let insertCalled = false;
    chain.insert = jest.fn().mockImplementation(() => {
      insertCalled = true;
      const insertChain: Record<string, jest.Mock> = {};
      insertChain.select = jest.fn().mockReturnValue(insertChain);
      insertChain.single = jest.fn().mockResolvedValue({
        data: { id: 30 },
        error: null,
      });
      return insertChain;
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';

    const result = await service.submitExecution('brief-001', 'manual');

    expect(insertCalled).toBe(true);
    expect(result.executionLogId).toBe(30);
    expect(mocks.mockQueue.add).toHaveBeenCalled();
  });

  // ── P20: getCanaryStats delegation ──

  it('getCanaryStats should delegate to renderAdapter', async () => {
    mocks.mockRenderAdapter.getCanaryStats.mockResolvedValue({
      dailyUsageCount: 42,
      remainingQuota: 8,
    });

    const result = await service.getCanaryStats();

    expect(mocks.mockRenderAdapter.getCanaryStats).toHaveBeenCalled();
    expect(result).toEqual({ dailyUsageCount: 42, remainingQuota: 8 });
  });

  // ── P20: feature flag disabled ──

  it('submitExecution should throw BadRequestException when pipeline disabled', async () => {
    process.env.VIDEO_PIPELINE_ENABLED = 'false';

    await expect(
      service.submitExecution('brief-001', 'manual'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.submitExecution('brief-001', 'manual'),
    ).rejects.toThrow(/VIDEO_PIPELINE_ENABLED/);
  });

  it('retryExecution should throw BadRequestException when pipeline disabled', async () => {
    const failedRow = fakeDbRow({ status: 'failed', retryable: true });

    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: failedRow, error: null });
    chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });

    Object.defineProperty(service, 'client', { get: () => chain });
    // Feature flag NOT set → undefined !== 'true'

    await expect(service.retryExecution(10)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.retryExecution(10)).rejects.toThrow(
      /VIDEO_PIPELINE_ENABLED/,
    );
  });

  // ── P20: DB insert failure ──

  it('submitExecution should throw when DB insert fails', async () => {
    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
    chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });

    // insert chain returns error
    chain.insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'unique constraint violation' },
        }),
      }),
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';

    await expect(
      service.submitExecution('brief-001', 'api'),
    ).rejects.toEqual({ message: 'unique constraint violation' });
  });

  it('retryExecution should throw when DB insert fails', async () => {
    const failedRow = fakeDbRow({ status: 'failed', retryable: true });

    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: failedRow, error: null });
    chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });

    // insert chain returns error
    chain.insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB write error' },
        }),
      }),
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';

    await expect(service.retryExecution(10)).rejects.toEqual({
      message: 'DB write error',
    });
  });

  // ── P20: queue.add failure ──

  it('submitExecution should throw when queue.add fails', async () => {
    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
    chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });

    // insert succeeds
    chain.insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 50 },
          error: null,
        }),
      }),
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';
    mocks.mockQueue.add.mockRejectedValueOnce(new Error('Queue connection lost'));

    await expect(
      service.submitExecution('brief-001', 'api'),
    ).rejects.toThrow('Queue connection lost');
  });

  it('retryExecution should throw when queue.add fails', async () => {
    const failedRow = fakeDbRow({ status: 'failed', retryable: true });

    const chain: Record<string, jest.Mock> = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: failedRow, error: null });
    chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });

    // insert succeeds
    chain.insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 60 },
          error: null,
        }),
      }),
    });

    Object.defineProperty(service, 'client', { get: () => chain });
    process.env.VIDEO_PIPELINE_ENABLED = 'true';
    mocks.mockQueue.add.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(service.retryExecution(10)).rejects.toThrow(
      'Redis unavailable',
    );
  });

  afterEach(() => {
    delete process.env.VIDEO_PIPELINE_ENABLED;
  });
});
