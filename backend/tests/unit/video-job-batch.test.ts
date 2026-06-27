/**
 * VideoJobService.submitBatchExecution (P15) — feature-flag gate + batch-size cap.
 *
 * Covers the loop-bound-injection hardening (CodeQL js/loop-bound-injection, alert #64):
 * `briefIds` comes from the admin request body (user-controlled), so the per-item loop
 * must be bounded by VIDEO_MAX_BATCH_SIZE *before* iterating, rejecting an oversized batch
 * explicitly — never truncating silently (canon: no silent fallback).
 *
 * Strategy: construct VideoJobService bypassing DI (same pattern as
 * video-job-retry-guard.test.ts), mock VideoDataService + BullMQ Queue + ConfigService.
 * The flag/cap guards short-circuit before any DB access, so no Supabase chain is needed
 * for the rejection paths.
 */

import { BadRequestException } from '@nestjs/common';
import { VideoJobService } from '../../src/modules/media-factory/services/video-job.service';

function createMocks() {
  return {
    mockQueue: { add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }) },
    mockDataService: { getProduction: jest.fn() },
    mockRenderAdapter: { getCanaryStats: jest.fn() },
    mockConfigService: {
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

function buildService(mocks: ReturnType<typeof createMocks>): VideoJobService {
  // Construct via constructor (bypass DI) — identical pattern to
  // video-job-retry-guard.test.ts. The base SupabaseBaseService ctor reads the
  // mocked ConfigService, so `this.logger` is a real Logger (no need to stub it).
  return new (VideoJobService as any)(
    mocks.mockConfigService,
    mocks.mockQueue,
    mocks.mockDataService,
    mocks.mockRenderAdapter,
  );
}

describe('VideoJobService.submitBatchExecution (P15) — flag gate + batch cap', () => {
  const savedEnv = { ...process.env };
  let mocks: ReturnType<typeof createMocks>;
  let service: VideoJobService;

  beforeEach(() => {
    mocks = createMocks();
    service = buildService(mocks);
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    jest.restoreAllMocks();
  });

  it('throws BadRequestException when VIDEO_PIPELINE_ENABLED is not "true"', async () => {
    delete process.env.VIDEO_PIPELINE_ENABLED;
    await expect(service.submitBatchExecution(['b1'])).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.submitBatchExecution(['b1'])).rejects.toThrow(
      /disabled/,
    );
    expect(mocks.mockDataService.getProduction).not.toHaveBeenCalled();
  });

  it('rejects a batch larger than the default cap (100) before iterating', async () => {
    process.env.VIDEO_PIPELINE_ENABLED = 'true';
    delete process.env.VIDEO_MAX_BATCH_SIZE;
    const oversized = Array.from({ length: 101 }, (_, i) => `b${i}`);

    await expect(service.submitBatchExecution(oversized)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.submitBatchExecution(oversized)).rejects.toThrow(
      /exceeds maximum \(100\)/,
    );
    // The loop never ran: no per-item production lookups happened.
    expect(mocks.mockDataService.getProduction).not.toHaveBeenCalled();
  });

  it('honours a custom VIDEO_MAX_BATCH_SIZE cap', async () => {
    process.env.VIDEO_PIPELINE_ENABLED = 'true';
    process.env.VIDEO_MAX_BATCH_SIZE = '2';

    await expect(
      service.submitBatchExecution(['b1', 'b2', 'b3']),
    ).rejects.toThrow(/exceeds maximum \(2\)/);
    expect(mocks.mockDataService.getProduction).not.toHaveBeenCalled();
  });

  it('accepts a batch at the cap limit and processes every item (no silent truncation)', async () => {
    process.env.VIDEO_PIPELINE_ENABLED = 'true';
    process.env.VIDEO_MAX_BATCH_SIZE = '3';
    // getProduction rejects → each item is caught and recorded as `skipped`.
    // Asserting all 3 were processed proves the loop ran the full length, i.e.
    // the cap allowed the at-limit batch through without dropping any item.
    mocks.mockDataService.getProduction.mockRejectedValue(
      new Error('no production'),
    );

    const result = await service.submitBatchExecution(['b1', 'b2', 'b3']);

    expect(result.batchId).toMatch(/^batch-/);
    expect(result.submitted).toHaveLength(0);
    expect(result.skipped).toHaveLength(3);
    expect(mocks.mockDataService.getProduction).toHaveBeenCalledTimes(3);
  });
});
