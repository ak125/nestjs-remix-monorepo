/**
 * ADR-072 PR 2D-3 — R2R8GateStatusService unit tests.
 *
 * Covers : count aggregation, pass/lag logic, sample join, cache hit/expiry,
 * forceFresh bypass, invalidate hook.
 */

import { R2R8GateStatusService } from '../r2-r8-gate-status.service';

function makeFakeSupabase(opts: {
  snapshotsCount?: number;
  autoTypesCount?: number;
  countError?: {
    table: '__seo_r8_snapshot_store' | 'auto_type';
    message: string;
  };
  autoTypeIds?: string[];
  pages?: { type_id: number; current_snapshot_id: number | null }[];
  snapshotStatuses?: { type_id: number; enrichment_status: string }[];
}) {
  return {
    from(table: string) {
      return {
        select(_cols: string, options?: { count?: string; head?: boolean }) {
          // Branch 1 : head count query
          if (options?.head === true && options?.count === 'exact') {
            if (opts.countError && opts.countError.table === table) {
              return Promise.resolve({
                count: null,
                error: { message: opts.countError.message },
              });
            }
            if (table === '__seo_r8_snapshot_store') {
              return Promise.resolve({
                count: opts.snapshotsCount ?? 0,
                error: null,
              });
            }
            if (table === 'auto_type') {
              return Promise.resolve({
                count: opts.autoTypesCount ?? 0,
                error: null,
              });
            }
            return Promise.resolve({ count: 0, error: null });
          }

          // Branch 2 : list-style queries (sample fetch + joins)
          const builder: any = {
            _filters: {} as Record<string, unknown>,
            order(_col: string, _o: unknown) {
              return this;
            },
            limit(_n: number) {
              return this;
            },
            in(_col: string, _values: unknown[]) {
              this._inValues = _values;
              return this;
            },
            then(
              resolve: (value: { data: unknown[]; error: null }) => unknown,
            ) {
              if (table === 'auto_type') {
                resolve({
                  data: (opts.autoTypeIds ?? []).map((id) => ({ type_id: id })),
                  error: null,
                });
                return;
              }
              if (table === '__seo_r8_pages') {
                resolve({ data: opts.pages ?? [], error: null });
                return;
              }
              if (table === '__seo_r8_snapshot_store') {
                resolve({
                  data: opts.snapshotStatuses ?? [],
                  error: null,
                });
                return;
              }
              resolve({ data: [], error: null });
            },
          };
          return builder;
        },
      };
    },
  };
}

function createService(supabase: unknown): R2R8GateStatusService {
  const svc = Object.create(
    R2R8GateStatusService.prototype,
  ) as R2R8GateStatusService;
  (
    svc as unknown as {
      logger: { log: () => void; error: () => void; warn: () => void };
    }
  ).logger = { log: () => {}, error: () => {}, warn: () => {} };
  (svc as unknown as { supabase: unknown }).supabase = supabase;
  (svc as unknown as { cache: Map<string, unknown> }).cache = new Map();
  return svc;
}

describe('R2R8GateStatusService', () => {
  describe('getStatus', () => {
    it('returns pass=true when snapshots >= autoTypes (positive surplus)', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 10,
        autoTypesCount: 5,
      });
      const svc = createService(supabase);
      const status = await svc.getStatus();
      expect(status.snapshots).toBe(10);
      expect(status.autoTypes).toBe(5);
      expect(status.pass).toBe(true);
      expect(status.lag).toBe(5);
      expect(status.fromCache).toBe(false);
    });

    it('returns pass=true on exact parity', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 100,
        autoTypesCount: 100,
      });
      const svc = createService(supabase);
      const status = await svc.getStatus();
      expect(status.pass).toBe(true);
      expect(status.lag).toBe(0);
      expect(status.lagPercent).toBe(0);
    });

    it('returns pass=false when snapshots < autoTypes', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 80,
        autoTypesCount: 100,
      });
      const svc = createService(supabase);
      const status = await svc.getStatus();
      expect(status.pass).toBe(false);
      expect(status.lag).toBe(-20);
      expect(status.lagPercent).toBe(20);
    });

    it('returns pass=false when autoTypes=0 (edge guard)', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 0,
        autoTypesCount: 0,
      });
      const svc = createService(supabase);
      const status = await svc.getStatus();
      expect(status.pass).toBe(false);
    });

    it('caches between calls (fromCache=true on second)', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 50,
        autoTypesCount: 50,
      });
      const svc = createService(supabase);
      const first = await svc.getStatus();
      const second = await svc.getStatus();
      expect(first.fromCache).toBe(false);
      expect(second.fromCache).toBe(true);
    });

    it('forceFresh=true bypasses cache', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 50,
        autoTypesCount: 50,
      });
      const svc = createService(supabase);
      await svc.getStatus();
      const second = await svc.getStatus(true);
      expect(second.fromCache).toBe(false);
    });

    it('invalidate() clears the cache', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 10,
        autoTypesCount: 10,
      });
      const svc = createService(supabase);
      await svc.getStatus();
      svc.invalidate();
      const next = await svc.getStatus();
      expect(next.fromCache).toBe(false);
    });

    it('throws when snapshot count query fails', async () => {
      const supabase = makeFakeSupabase({
        countError: {
          table: '__seo_r8_snapshot_store',
          message: 'tx aborted',
        },
        autoTypesCount: 5,
      });
      const svc = createService(supabase);
      await expect(svc.getStatus()).rejects.toThrow(
        /r8_gate_count_snapshots_failed/,
      );
    });

    it('joins sample auto_type → __seo_r8_pages → snapshot status', async () => {
      const supabase = makeFakeSupabase({
        snapshotsCount: 3,
        autoTypesCount: 3,
        autoTypeIds: ['1', '2', '3'],
        pages: [
          { type_id: 1, current_snapshot_id: 11 },
          { type_id: 2, current_snapshot_id: null },
          { type_id: 3, current_snapshot_id: 13 },
        ],
        snapshotStatuses: [
          { type_id: 1, enrichment_status: 'minimal' },
          { type_id: 3, enrichment_status: 'enriched' },
        ],
      });
      const svc = createService(supabase);
      const status = await svc.getStatus();
      expect(status.sample).toHaveLength(3);
      expect(status.sample.find((s) => s.typeId === 1)?.hasSnapshot).toBe(true);
      expect(status.sample.find((s) => s.typeId === 1)?.enrichmentStatus).toBe(
        'minimal',
      );
      expect(status.sample.find((s) => s.typeId === 2)?.hasSnapshot).toBe(
        false,
      );
      expect(status.sample.find((s) => s.typeId === 3)?.enrichmentStatus).toBe(
        'enriched',
      );
    });
  });
});
