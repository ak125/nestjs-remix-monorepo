/**
 * VideoExecutionController — Unit tests (P19).
 *
 * Tests: execute, canary policy, render health, stats, list, status, retry, presigned URL.
 * Mock service: jobService. Uses jest.spyOn(global, 'fetch') for HTTP proxies.
 *
 * @see backend/src/modules/media-factory/controllers/video-execution.controller.ts
 */

import { VideoExecutionController } from '../../src/modules/media-factory/controllers/video-execution.controller';

function createMockJobService() {
  return {
    submitExecution: jest.fn().mockResolvedValue({ executionLogId: 1, bullmqJobId: 'bull-1' }),
    getCanaryStats: jest.fn().mockResolvedValue({ engineName: 'stub', dailyUsageCount: 0 }),
    getExecutionStats: jest.fn().mockResolvedValue({ total: 10, byStatus: { completed: 8 } }),
    listExecutions: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    getExecutionStatus: jest.fn().mockResolvedValue({
      id: 1,
      briefId: 'brief-001',
      status: 'completed',
      renderOutputPath: null,
    }),
    retryExecution: jest.fn().mockResolvedValue({ newExecutionLogId: 2, bullmqJobId: 'bull-2' }),
  };
}

describe('VideoExecutionController', () => {
  let controller: VideoExecutionController;
  let mockJobService: ReturnType<typeof createMockJobService>;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    mockJobService = createMockJobService();
    controller = new (VideoExecutionController as any)(mockJobService);
    delete process.env.VIDEO_RENDER_BASE_URL;
    delete process.env.S3_BUCKET_NAME;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    jest.restoreAllMocks();
  });

  // ── Core endpoints ──

  it('executeProduction should delegate briefId with api trigger', async () => {
    const result = await controller.executeProduction('brief-001');
    expect(mockJobService.submitExecution).toHaveBeenCalledWith('brief-001', 'api');
    expect(result.success).toBe(true);
    expect(result.message).toContain('brief-001');
    expect(result.data.executionLogId).toBe(1);
  });

  it('getCanaryPolicy should delegate to getCanaryStats', async () => {
    const result = await controller.getCanaryPolicy();
    expect(mockJobService.getCanaryStats).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data.engineName).toBe('stub');
  });

  describe('getExecutionStats', () => {
    it('should default to all when window is invalid', async () => {
      await controller.getExecutionStats('invalid');
      expect(mockJobService.getExecutionStats).toHaveBeenCalledWith('all');
    });

    it('should pass through valid window 24h', async () => {
      await controller.getExecutionStats('24h');
      expect(mockJobService.getExecutionStats).toHaveBeenCalledWith('24h');
    });
  });

  // ── List + Status + Retry ──

  it('listExecutions should delegate briefId', async () => {
    const result = await controller.listExecutions('brief-001');
    expect(mockJobService.listExecutions).toHaveBeenCalledWith('brief-001');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('getExecutionStatus should delegate executionLogId', async () => {
    const result = await controller.getExecutionStatus(1);
    expect(mockJobService.getExecutionStatus).toHaveBeenCalledWith(1);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });

  it('retryExecution should delegate executionLogId and include ID in message', async () => {
    const result = await controller.retryExecution(10);
    expect(mockJobService.retryExecution).toHaveBeenCalledWith(10);
    expect(result.success).toBe(true);
    expect(result.message).toContain('10');
    expect(result.data.newExecutionLogId).toBe(2);
  });

  // ── Render health ──

  it('getRenderServiceHealth should return not_configured when no BASE_URL', async () => {
    const result = await controller.getRenderServiceHealth();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('not_configured');
  });

  // ── Presigned URL ──

  describe('getPresignedUrl', () => {
    it('should return success=false when no renderOutputPath', async () => {
      mockJobService.getExecutionStatus.mockResolvedValue({
        id: 1,
        renderOutputPath: null,
      });
      const result = await controller.getPresignedUrl(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No render output path');
    });

    it('should return success=false when VIDEO_RENDER_BASE_URL missing', async () => {
      mockJobService.getExecutionStatus.mockResolvedValue({
        id: 1,
        renderOutputPath: 's3://automecanik-renders/renders/brief-001/1/output.mp4',
      });
      const result = await controller.getPresignedUrl(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('VIDEO_RENDER_BASE_URL missing');
    });
  });
});
