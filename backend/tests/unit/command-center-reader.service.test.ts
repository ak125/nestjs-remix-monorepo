import { join } from 'path';
import {
  CommandCenterReaderService,
  type CommandCenterResponse,
} from '../../src/modules/admin/services/command-center-reader.service';

/**
 * Unit tests for CommandCenterReaderService. Fixture directories via REGISTRY_DIR
 * (no fs mocking), CacheService stubbed. Mirrors registry-reader.service.test.ts.
 *
 * The `full` fixture uses last_verified=2020-01-01 → always STALE, and a
 * data(UNKNOWN)→sales chain so both LIVE caps are exercised deterministically.
 */
const FIXTURES = join(__dirname, 'fixtures', 'command-center');

function makeService(scenario: 'full' | 'missing') {
  process.env.REGISTRY_DIR = join(FIXTURES, scenario);
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new CommandCenterReaderService(cache as never), cache };
}

describe('CommandCenterReaderService', () => {
  const ORIGINAL_ENV = process.env.REGISTRY_DIR;
  afterAll(() => {
    process.env.REGISTRY_DIR = ORIGINAL_ENV;
  });

  describe('full snapshot', () => {
    let res: CommandCenterResponse;
    beforeAll(async () => {
      const { service } = makeService('full');
      res = await service.getCommandCenter();
    });

    it('is not degraded and passes the snapshot through', () => {
      expect(res.degraded).toBe(false);
      expect(res.departments).toHaveLength(3);
      expect(res.schema_version).toBe('command-center.v1');
    });

    it('computes a live stale_status from last_verified (2020 → STALE)', () => {
      expect(res.stale_status).toBe('STALE');
    });

    it('applies the stale LIVE cap (≤79) to an otherwise-90 department', () => {
      const ops = res.departments.find((d) => d.id === 'ops')!;
      expect(ops.health_score_current).toBe(79);
      expect(ops.live_caps_applied).toContain('source_stale_max_79');
    });

    it('applies the cross-module cap (≤69) to sales (downstream of UNKNOWN data)', () => {
      const sales = res.departments.find((d) => d.id === 'sales')!;
      expect(sales.health_score_current).toBe(69);
      expect(sales.live_caps_applied).toContain('upstream_unreliable_max_69');
    });

    it('global_status is WARNING / PARTIAL_READY (stale + incomplete handoff + no-evidence)', () => {
      expect(res.global_status.level).toBe('WARNING');
      expect(res.global_status.verdict).toBe('PARTIAL_READY');
      expect(res.global_status.reasons.length).toBeGreaterThan(0);
    });

    it('caches with the OK ttl (60s)', () => {
      const { service, cache } = makeService('full');
      return service.getCommandCenter().then(() => {
        expect(cache.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          60,
        );
      });
    });
  });

  describe('missing snapshot', () => {
    let res: CommandCenterResponse;
    let cacheRef: { set: jest.Mock };
    beforeAll(async () => {
      const { service, cache } = makeService('missing');
      cacheRef = cache;
      res = await service.getCommandCenter();
    });

    it('fully degrades WITHOUT throwing', () => {
      expect(res.degraded).toBe(true);
      expect(res.departments).toEqual([]);
      expect(res.global_status.verdict).toBe('BLOCKED');
      expect(res.global_status.reasons[0]).toMatch(/snapshot_unavailable/);
    });

    it('caches the degraded result with the short ttl (15s)', () => {
      expect(cacheRef.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        15,
      );
    });
  });

  describe('cache hit short-circuits', () => {
    it('returns the cached response without rebuilding', async () => {
      process.env.REGISTRY_DIR = join(FIXTURES, 'full');
      const cached = { degraded: false, cachedMarker: true } as never;
      const cache = {
        get: jest.fn().mockResolvedValue(cached),
        set: jest.fn(),
      };
      const service = new CommandCenterReaderService(cache as never);
      const result = await service.getCommandCenter();
      expect(result).toBe(cached);
      expect(cache.set).not.toHaveBeenCalled();
    });
  });
});
