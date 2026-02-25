/**
 * AdminJobHealthService — Unit tests (P17).
 *
 * Tests ~10: recordSuccess (RPC + fallback EMA), recordFailure,
 * getAll, getByQueue. All DB interactions are mocked.
 */

import { AdminJobHealthService } from '../../src/modules/admin/services/admin-job-health.service';

// ─── Mock helpers ────────────────────────────────────────────

function createSupabaseMock() {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.rpc = jest.fn().mockResolvedValue({ error: null });
  // For update().eq() that returns { error } directly (no .single)
  return chain;
}

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

function createService() {
  return new (AdminJobHealthService as any)(
    mockConfigService,
  ) as AdminJobHealthService;
}

// ─── Tests ───────────────────────────────────────────────────

describe('AdminJobHealthService', () => {
  let service: AdminJobHealthService;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    service = createService();
    supabaseMock = createSupabaseMock();
    Object.defineProperty(service, 'supabase', {
      get: () => supabaseMock,
      configurable: true,
    });
  });

  // ── recordSuccess ──

  describe('recordSuccess', () => {
    it('should call RPC on happy path without fallback', async () => {
      supabaseMock.rpc.mockResolvedValue({ error: null });

      await service.recordSuccess('video-render', 150);

      expect(supabaseMock.rpc).toHaveBeenCalledWith(
        '__admin_job_health_success',
        { p_queue: 'video-render', p_duration_ms: 150 },
      );
      // No fallback — from() should NOT be called
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('should fall through to fallback when RPC returns error', async () => {
      supabaseMock.rpc.mockResolvedValue({
        error: { message: 'function not found' },
      });
      // Fallback: select current row, then update
      supabaseMock.single.mockResolvedValue({
        data: { total_completed: 5, avg_duration_ms: 100 },
        error: null,
      });
      // update().eq() resolves to { error: null }
      supabaseMock.eq.mockResolvedValue({ error: null });

      await service.recordSuccess('video-render', 200);

      expect(supabaseMock.rpc).toHaveBeenCalled();
      // Fallback was called — from() should have been called
      expect(supabaseMock.from).toHaveBeenCalledWith('__admin_job_health');
    });

    it('should compute EMA correctly in fallback (prevAvg=100, new=200 → 120)', async () => {
      supabaseMock.rpc.mockResolvedValue({
        error: { message: 'rpc unavailable' },
      });
      supabaseMock.single.mockResolvedValue({
        data: { total_completed: 9, avg_duration_ms: 100 },
        error: null,
      });
      // Capture the update payload via a nested chain
      const updatePayloads: unknown[] = [];
      supabaseMock.update.mockImplementation((data: unknown) => {
        updatePayloads.push(data);
        return { eq: jest.fn().mockResolvedValue({ error: null }) };
      });

      await service.recordSuccess('video-render', 200);

      expect(updatePayloads.length).toBeGreaterThan(0);
      const updateData = updatePayloads[0] as Record<string, unknown>;
      // EMA: 100 * 0.8 + 200 * 0.2 = 120
      expect(updateData.avg_duration_ms).toBe(120);
      expect(updateData.total_completed).toBe(10);
      expect(updateData.consecutive_failures).toBe(0);
    });

    it('should not throw when fallback DB update fails', async () => {
      supabaseMock.rpc.mockResolvedValue({
        error: { message: 'rpc error' },
      });
      supabaseMock.single.mockResolvedValue({
        data: { total_completed: 1, avg_duration_ms: 50 },
        error: null,
      });
      supabaseMock.eq.mockResolvedValue({
        error: { message: 'connection refused' },
      });

      // Should NOT throw — silent error handling
      await expect(
        service.recordSuccess('video-render', 100),
      ).resolves.toBeUndefined();
    });
  });

  // ── recordFailure ──

  describe('recordFailure', () => {
    it('should increment consecutive and total failure counts', async () => {
      supabaseMock.single.mockResolvedValue({
        data: { consecutive_failures: 2, total_failed: 10 },
        error: null,
      });
      const updatePayloads: unknown[] = [];
      supabaseMock.update.mockImplementation((data: unknown) => {
        updatePayloads.push(data);
        return { eq: jest.fn().mockResolvedValue({ error: null }) };
      });

      await service.recordFailure('video-render', 'Job crashed');

      const updateData = updatePayloads[0] as Record<string, unknown>;
      expect(updateData.consecutive_failures).toBe(3);
      expect(updateData.total_failed).toBe(11);
      expect(updateData.last_error).toBe('Job crashed');
    });

    it('should truncate error message to 500 chars', async () => {
      supabaseMock.single.mockResolvedValue({
        data: { consecutive_failures: 0, total_failed: 0 },
        error: null,
      });
      const updatePayloads: unknown[] = [];
      supabaseMock.update.mockImplementation((data: unknown) => {
        updatePayloads.push(data);
        return { eq: jest.fn().mockResolvedValue({ error: null }) };
      });

      const longError = 'x'.repeat(600);
      await service.recordFailure('video-render', longError);

      const updateData = updatePayloads[0] as Record<string, unknown>;
      expect((updateData.last_error as string).length).toBe(500);
    });

    it('should not throw when DB update fails', async () => {
      supabaseMock.single.mockResolvedValue({
        data: { consecutive_failures: 0, total_failed: 0 },
        error: null,
      });
      supabaseMock.eq.mockResolvedValue({
        error: { message: 'DB timeout' },
      });

      await expect(
        service.recordFailure('video-render', 'err'),
      ).resolves.toBeUndefined();
    });
  });

  // ── getAll + getByQueue ──

  describe('getAll', () => {
    it('should return rows on success', async () => {
      const rows = [
        { queue_name: 'content-refresh', total_completed: 100 },
        { queue_name: 'video-render', total_completed: 50 },
      ];
      supabaseMock.order.mockResolvedValue({ data: rows, error: null });

      const result = await service.getAll();

      expect(result).toEqual(rows);
      expect(supabaseMock.from).toHaveBeenCalledWith('__admin_job_health');
    });

    it('should return empty array on DB error', async () => {
      supabaseMock.order.mockResolvedValue({
        data: null,
        error: { message: 'table missing' },
      });

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getByQueue', () => {
    it('should return null on DB error', async () => {
      supabaseMock.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      const result = await service.getByQueue('video-render');

      expect(result).toBeNull();
    });
  });
});
