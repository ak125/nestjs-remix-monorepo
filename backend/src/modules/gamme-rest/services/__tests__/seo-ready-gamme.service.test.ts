import { SeoReadyGammeService } from '../seo-ready-gamme.service';

/**
 * Unit test the logic without the heavy SupabaseBaseService constructor:
 * build the instance via Object.create and inject a mocked supabase client.
 */
function makeService(rpc: jest.Mock): SeoReadyGammeService {
  const svc = Object.create(
    SeoReadyGammeService.prototype,
  ) as SeoReadyGammeService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).supabase = { rpc };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).cache = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).inflight = null;
  return svc;
}

describe('SeoReadyGammeService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('isPromoteEnabled — OFF by default, governed flag', () => {
    it('false when unset', () => {
      delete process.env.SEO_R1_KW_PROMOTE_ENABLED;
      expect(makeService(jest.fn()).isPromoteEnabled()).toBe(false);
    });
    it('true only when exactly "true"', () => {
      process.env.SEO_R1_KW_PROMOTE_ENABLED = 'true';
      expect(makeService(jest.fn()).isPromoteEnabled()).toBe(true);
      process.env.SEO_R1_KW_PROMOTE_ENABLED = '1';
      expect(makeService(jest.fn()).isPromoteEnabled()).toBe(false);
      process.env.SEO_R1_KW_PROMOTE_ENABLED = 'on';
      expect(makeService(jest.fn()).isPromoteEnabled()).toBe(false);
    });
  });

  describe('isSeoReady — cached kw-count set membership', () => {
    it('true for a gamme in the ready set, false otherwise; RPC called once (cached)', async () => {
      const rpc = jest
        .fn()
        .mockResolvedValue({ data: [{ pg_id: 7 }, { pg_id: 82 }], error: null });
      const svc = makeService(rpc);
      expect(await svc.isSeoReady(7)).toBe(true);
      expect(await svc.isSeoReady(82)).toBe(true);
      expect(await svc.isSeoReady(999)).toBe(false);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('rpc_seo_ready_gammes', { p_min_kw: 50 });
    });

    it('honours SEO_R1_KW_MIN override', async () => {
      process.env.SEO_R1_KW_MIN = '200';
      const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
      await makeService(rpc).isSeoReady(7);
      expect(rpc).toHaveBeenCalledWith('rpc_seo_ready_gammes', {
        p_min_kw: 200,
      });
    });

    it('falls back to the default threshold for an invalid override', async () => {
      process.env.SEO_R1_KW_MIN = 'abc';
      const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
      await makeService(rpc).isSeoReady(7);
      expect(rpc).toHaveBeenCalledWith('rpc_seo_ready_gammes', { p_min_kw: 50 });
    });

    it('fail-safe: returns false on RPC error (legacy robots preserved, no throw)', async () => {
      const rpc = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(makeService(rpc).isSeoReady(7)).resolves.toBe(false);
    });

    it('returns false for an invalid pgId without hitting the RPC', async () => {
      const rpc = jest.fn();
      const svc = makeService(rpc);
      expect(await svc.isSeoReady(0)).toBe(false);
      expect(await svc.isSeoReady(-5)).toBe(false);
      expect(await svc.isSeoReady(NaN)).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    });
  });
});
