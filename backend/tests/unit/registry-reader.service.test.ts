import { join } from 'path';
import {
  RegistryReaderService,
  type ControlPlaneSummary,
} from '../../src/modules/admin/services/registry-reader.service';

/**
 * Unit tests for RegistryReaderService aggregation. Uses fixture directories
 * via REGISTRY_DIR (no fs mocking). CacheService is stubbed to force a fresh
 * buildSummary on every call.
 */
const FIXTURES = join(__dirname, 'fixtures', 'control-plane');

function makeService(scenario: 'full' | 'repo-only' | 'missing') {
  process.env.REGISTRY_DIR = join(FIXTURES, scenario);
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  // Field initializer reads REGISTRY_DIR at construction time.
  const service = new RegistryReaderService(cache as never);
  return { service, cache };
}

describe('RegistryReaderService', () => {
  const ORIGINAL_ENV = process.env.REGISTRY_DIR;
  afterAll(() => {
    process.env.REGISTRY_DIR = ORIGINAL_ENV;
  });

  describe('full (canonical + planning)', () => {
    let summary: ControlPlaneSummary;
    beforeAll(async () => {
      const { service } = makeService('full');
      summary = await service.getControlPlaneSummary();
    });

    it('is not degraded', () => {
      expect(summary.degraded).toBe(false);
      expect(summary.wip.degraded).toBe(false);
    });

    it('aggregates repo counts + ownership gaps + domains', () => {
      expect(summary.repo).not.toBeNull();
      expect(summary.repo!.counts).toEqual({
        files: 2,
        db: 1,
        rpc: 0,
        deps: 1,
        runtime: 1,
      });
      // 2 entries with owner __unassigned__ (b.ts + zod)
      expect(summary.repo!.ownershipGaps).toBe(2);
      // domains D1, D2, D3
      expect(summary.repo!.domainCount).toBe(3);
      expect(summary.repo!.sotFingerprint).toBe('test-fingerprint-abc');
    });

    it('aggregates WIP: counts, zombies, stacks', () => {
      expect(summary.wip.prCount).toBe(3);
      expect(summary.wip.zombies).toBe(1); // PR 110 stale 19d > 14
      expect(summary.wip.stacks).toBe(1); // PR 250 baseRef feat/a
      expect(summary.wip.byStatus).toEqual({ review: 2, 'in-progress': 1 });
      expect(summary.wip.byWorkType['seo-runtime']).toBe(1);
      expect(summary.wip.byWorkType['unlabeled']).toBe(2);
    });

    it('topStale is sorted desc by stalenessDays', () => {
      const stale = summary.wip.topStale.map((p) => p.stalenessDays);
      expect(stale).toEqual([...stale].sort((a, b) => b - a));
      expect(summary.wip.topStale[0].number).toBe(110);
    });

    it('caches with the OK ttl (60s) when not degraded', () => {
      const { service, cache } = makeService('full');
      return service.getControlPlaneSummary().then(() => {
        expect(cache.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          60,
        );
      });
    });
  });

  describe('repo-only (planning.json absent)', () => {
    let summary: ControlPlaneSummary;
    let cacheRef: { set: jest.Mock };
    beforeAll(async () => {
      const { service, cache } = makeService('repo-only');
      cacheRef = cache;
      summary = await service.getControlPlaneSummary();
    });

    it('degrades WIP gracefully but keeps repo', () => {
      expect(summary.wip.degraded).toBe(true);
      expect(summary.wip.prCount).toBe(0);
      expect(summary.wip.topStale).toEqual([]);
      expect(summary.repo).not.toBeNull();
      expect(summary.degraded).toBe(true);
    });

    it('caches degraded result with the short ttl (15s)', () => {
      expect(cacheRef.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        15,
      );
    });
  });

  describe('missing (no registry dir)', () => {
    it('fully degrades without throwing', async () => {
      const { service } = makeService('missing');
      const summary = await service.getControlPlaneSummary();
      expect(summary.degraded).toBe(true);
      expect(summary.repo).toBeNull();
      expect(summary.wip.degraded).toBe(true);
    });
  });

  describe('cache hit short-circuits', () => {
    it('returns cached summary without rebuilding', async () => {
      process.env.REGISTRY_DIR = join(FIXTURES, 'full');
      const cached = { degraded: false, cachedMarker: true } as never;
      const cache = {
        get: jest.fn().mockResolvedValue(cached),
        set: jest.fn(),
      };
      const service = new RegistryReaderService(cache as never);
      const result = await service.getControlPlaneSummary();
      expect(result).toBe(cached);
      expect(cache.set).not.toHaveBeenCalled();
    });
  });
});
