/**
 * ADR-072 §3 — R8SnapshotReaderService tests
 *
 * Coverage : cache hit/miss, SQL JOIN parsing, enrichment_status='failed' →
 * r8_enrichment_failed, absent → r8_snapshot_unavailable, Zod parse robustness.
 *
 * Pattern Object.create(prototype) pour bypass SupabaseBaseService ctor env check,
 * mirror canon r2-composition-input-snapshot.spec.ts.
 */

import {
  R8SnapshotReaderService,
  R8SnapshotCacheClient,
} from '../r8-snapshot-reader.service';

const validSnapshotRow = {
  id: 42,
  type_id: 12345,
  version_sha: 'a'.repeat(64),
  disambiguation_signature: {
    typeId: 12345,
    brandSlug: 'renault',
    modelSlug: 'clio-iii',
    powerHp: 88,
    yearsFrom: 2010,
    yearsTo: 2014,
    bodyType: '3/5 portes',
    fuelType: 'diesel',
    engineCode: 'K9K 770',
    euroNorm: 'Euro5',
    literage: '1.5',
    siblings: [],
  },
  enrichment_status: 'enriched',
  source_lineage: { autoTypeUpdatedAt: '2026-05-01T00:00:00Z' },
  created_at: '2026-05-15T10:00:00Z',
};

function makeFakeSupabaseFound(snapshotRow: typeof validSnapshotRow | null) {
  return {
    from(_table: string) {
      return {
        select: (_cols: string) => ({
          eq: (_col: string, _val: number) => ({
            maybeSingle: () =>
              Promise.resolve({
                data: snapshotRow
                  ? {
                      type_id: snapshotRow.type_id,
                      current_snapshot_id: snapshotRow.id,
                      snapshot: snapshotRow,
                    }
                  : null,
                error: null,
              }),
          }),
        }),
      };
    },
  };
}

function makeFakeSupabaseNoPointer() {
  return {
    from(_table: string) {
      return {
        select: (_cols: string) => ({
          eq: (_col: string, _val: number) => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  type_id: 12345,
                  current_snapshot_id: null,
                  snapshot: null,
                },
                error: null,
              }),
          }),
        }),
      };
    },
  };
}

function makeFakeSupabaseSqlError() {
  return {
    from(_table: string) {
      return {
        select: (_cols: string) => ({
          eq: (_col: string, _val: number) => ({
            maybeSingle: () =>
              Promise.resolve({
                data: null,
                error: { message: 'connection refused' },
              }),
          }),
        }),
      };
    },
  };
}

function createService(
  supabase: unknown,
  cache?: R8SnapshotCacheClient,
): R8SnapshotReaderService {
  const svc = Object.create(
    R8SnapshotReaderService.prototype,
  ) as R8SnapshotReaderService;
  (
    svc as unknown as {
      logger: { log: () => void; error: () => void; warn: () => void };
    }
  ).logger = {
    log: () => {},
    error: () => {},
    warn: () => {},
  };
  (svc as unknown as { supabase: unknown }).supabase = supabase;
  (svc as unknown as { cache: R8SnapshotCacheClient | undefined }).cache =
    cache;
  return svc;
}

describe('R8SnapshotReaderService', () => {
  describe('getLatestSnapshot', () => {
    it('returns found=true with enriched snapshot when DB row exists', async () => {
      const svc = createService(makeFakeSupabaseFound(validSnapshotRow));
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.snapshot.versionSha).toBe('a'.repeat(64));
        expect(result.snapshot.enrichmentStatus).toBe('enriched');
        expect(result.snapshot.disambiguationSignature.powerHp).toBe(88);
      }
    });

    it('returns found=true for status=minimal', async () => {
      const svc = createService(
        makeFakeSupabaseFound({
          ...validSnapshotRow,
          enrichment_status: 'minimal',
        }),
      );
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(true);
    });

    it('returns found=true for status=stale (R2 compose continues with stale)', async () => {
      const svc = createService(
        makeFakeSupabaseFound({
          ...validSnapshotRow,
          enrichment_status: 'stale',
        }),
      );
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(true);
    });

    it('returns found=false reason=r8_enrichment_failed when status=failed', async () => {
      const svc = createService(
        makeFakeSupabaseFound({
          ...validSnapshotRow,
          enrichment_status: 'failed',
        }),
      );
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(false);
      if (result.found === false) {
        expect(result.reason).toBe('r8_enrichment_failed');
      }
    });

    it('returns found=false reason=r8_snapshot_unavailable when no row exists', async () => {
      const svc = createService(makeFakeSupabaseFound(null));
      const result = await svc.getLatestSnapshot(99999);
      expect(result.found).toBe(false);
      if (result.found === false) {
        expect(result.reason).toBe('r8_snapshot_unavailable');
      }
    });

    it('returns found=false reason=r8_snapshot_unavailable when current_snapshot_id is null', async () => {
      const svc = createService(makeFakeSupabaseNoPointer());
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(false);
      if (result.found === false) {
        expect(result.reason).toBe('r8_snapshot_unavailable');
      }
    });

    it('returns found=false on SQL error (graceful degradation)', async () => {
      const svc = createService(makeFakeSupabaseSqlError());
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(false);
      if (result.found === false) {
        expect(result.reason).toBe('r8_snapshot_unavailable');
      }
    });

    it('throws on invalid typeId (0, negative, non-integer)', async () => {
      const svc = createService(makeFakeSupabaseFound(validSnapshotRow));
      await expect(svc.getLatestSnapshot(0)).rejects.toThrow(/Invalid typeId/);
      await expect(svc.getLatestSnapshot(-1)).rejects.toThrow(/Invalid typeId/);
      await expect(svc.getLatestSnapshot(1.5)).rejects.toThrow(
        /Invalid typeId/,
      );
    });
  });

  describe('cache integration', () => {
    it('returns cached value without hitting DB on cache hit', async () => {
      const fakeCache: R8SnapshotCacheClient = {
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            found: true,
            snapshot: {
              id: 42,
              typeId: 12345,
              versionSha: 'b'.repeat(64),
              disambiguationSignature:
                validSnapshotRow.disambiguation_signature,
              enrichmentStatus: 'enriched',
              sourceLineage: null,
              createdAt: '2026-05-15T10:00:00Z',
            },
          }),
        ),
        setEx: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      };
      // Supabase should NOT be called when cache hits
      const supabaseSpy = {
        from: jest.fn(() => {
          throw new Error('should not be called');
        }),
      };
      const svc = createService(supabaseSpy, fakeCache);
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(true);
      expect(fakeCache.get).toHaveBeenCalledWith('r8:snapshot:12345');
      expect(supabaseSpy.from).not.toHaveBeenCalled();
    });

    it('writes to cache after DB miss → DB fetch', async () => {
      const fakeCache: R8SnapshotCacheClient = {
        get: jest.fn().mockResolvedValue(null),
        setEx: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      };
      const svc = createService(
        makeFakeSupabaseFound(validSnapshotRow),
        fakeCache,
      );
      await svc.getLatestSnapshot(12345);
      expect(fakeCache.setEx).toHaveBeenCalledWith(
        'r8:snapshot:12345',
        3600,
        expect.stringContaining('"found":true'),
      );
    });

    it('handles cache.get errors gracefully (fallback DB)', async () => {
      const fakeCache: R8SnapshotCacheClient = {
        get: jest.fn().mockRejectedValue(new Error('redis down')),
        setEx: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      };
      const svc = createService(
        makeFakeSupabaseFound(validSnapshotRow),
        fakeCache,
      );
      const result = await svc.getLatestSnapshot(12345);
      expect(result.found).toBe(true); // DB succeeded despite cache error
    });

    it('invalidateCache deletes the cache entry', async () => {
      const fakeCache: R8SnapshotCacheClient = {
        get: jest.fn().mockResolvedValue(null),
        setEx: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      };
      const svc = createService(
        makeFakeSupabaseFound(validSnapshotRow),
        fakeCache,
      );
      await svc.invalidateCache(12345);
      expect(fakeCache.del).toHaveBeenCalledWith('r8:snapshot:12345');
    });
  });
});
