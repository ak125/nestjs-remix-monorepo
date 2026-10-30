/**
 * ADR-072 PR 2D-2 — R8SnapshotSeedService unit tests.
 *
 * Covers : batch loop pagination, idempotent counters, resumable cursor,
 * failure handling (one row throws → counted in totalFailed, loop continues),
 * dryRun (no writes).
 */

import {
  R8SnapshotSeedService,
  SeedRunOptions,
} from '../r8-snapshot-seed.service';
import { R8ParentEnrichmentService } from '../r8-parent-enrichment.service';

interface FakeEnrichmentCall {
  typeId: number;
  reason: string;
}

function makeEnrichment(
  behavior: (
    typeId: number,
  ) => { inserted: boolean; snapshotId: number } | null | Error,
): { svc: R8ParentEnrichmentService; calls: FakeEnrichmentCall[] } {
  const calls: FakeEnrichmentCall[] = [];
  const svc = {
    async enrichTypeId(typeId: number, reason: string) {
      calls.push({ typeId, reason });
      const outcome = behavior(typeId);
      if (outcome instanceof Error) {
        throw outcome;
      }
      if (outcome === null) {
        return null;
      }
      return {
        typeId,
        versionSha: 'a'.repeat(64),
        snapshotId: outcome.snapshotId,
        inserted: outcome.inserted,
        pagesPointerUpdated: true,
        outboxEventId: 1,
      };
    },
  } as unknown as R8ParentEnrichmentService;
  return { svc, calls };
}

function makeSupabaseWithBatches(batches: string[][]) {
  let index = 0;
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          const builder: any = {
            gte(_col: string, _value: string) {
              return this;
            },
            gt(_col: string, _value: string) {
              return this;
            },
            order(_col: string, _opts: unknown) {
              return this;
            },
            limit(_n: number) {
              return this;
            },
            then(
              resolve: (value: {
                data: { type_id: string }[];
                error: null;
              }) => unknown,
            ) {
              const data = (batches[index] ?? []).map((id) => ({
                type_id: id,
              }));
              index += 1;
              resolve({ data, error: null });
            },
          };
          return builder;
        },
      };
    },
  };
}

interface TextIdQuery {
  gte(col: string, value: string): TextIdQuery;
  gt(col: string, value: string): TextIdQuery;
  order(col: string, opts: unknown): TextIdQuery;
  limit(n: number): TextIdQuery;
  then(
    resolve: (value: { data: { type_id: string }[]; error: null }) => unknown,
  ): void;
}

/**
 * `auto_type.type_id` is TEXT : this fake applies gte/gt/order/limit with
 * text comparison, as PostgREST does on the real column.
 */
function makeSupabaseOverTextIds(ids: string[]) {
  const sorted = [...ids].sort();
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          let rows = sorted;
          let limit = Number.POSITIVE_INFINITY;
          const builder: TextIdQuery = {
            gte(_col: string, value: string) {
              rows = rows.filter((id) => id >= value);
              return this;
            },
            gt(_col: string, value: string) {
              rows = rows.filter((id) => id > value);
              return this;
            },
            order(_col: string, _opts: unknown) {
              return this;
            },
            limit(n: number) {
              limit = n;
              return this;
            },
            then(
              resolve: (value: {
                data: { type_id: string }[];
                error: null;
              }) => unknown,
            ) {
              resolve({
                data: rows.slice(0, limit).map((id) => ({ type_id: id })),
                error: null,
              });
            },
          };
          return builder;
        },
      };
    },
  };
}

function createService(
  enrichment: R8ParentEnrichmentService,
  supabase: unknown,
): R8SnapshotSeedService {
  const svc = Object.create(
    R8SnapshotSeedService.prototype,
  ) as R8SnapshotSeedService;
  (
    svc as unknown as {
      logger: { log: () => void; error: () => void; warn: () => void };
    }
  ).logger = { log: () => {}, error: () => {}, warn: () => {} };
  (svc as unknown as { supabase: unknown }).supabase = supabase;
  (svc as unknown as { enrichment: R8ParentEnrichmentService }).enrichment =
    enrichment;
  return svc;
}

describe('R8SnapshotSeedService', () => {
  it('iterates all batches and counts inserted vs already-present', async () => {
    const { svc: enrichment, calls } = makeEnrichment((typeId) => ({
      inserted: typeId % 2 === 0,
      snapshotId: typeId,
    }));
    const supabase = makeSupabaseWithBatches([
      ['10', '11', '12'],
      ['13', '14'],
      [],
    ]);
    const svc = createService(enrichment, supabase);
    const report = await svc.run({ batchSize: 3 });

    expect(report.totalScanned).toBe(5);
    expect(report.totalSeeded).toBe(3); // 10, 12, 14 inserted
    expect(report.totalAlreadyPresent).toBe(2); // 11, 13 idempotent
    expect(report.totalFailed).toBe(0);
    expect(report.lastTypeIdProcessed).toBe(14);
    expect(calls.map((c) => c.typeId)).toEqual([10, 11, 12, 13, 14]);
    expect(new Set(calls.map((c) => c.reason))).toEqual(new Set(['seed']));
  });

  it('counts a failing typeId in totalFailed and keeps going', async () => {
    const { svc: enrichment } = makeEnrichment((typeId) => {
      if (typeId === 11) {
        return new Error('rpc timeout');
      }
      return { inserted: true, snapshotId: typeId };
    });
    const supabase = makeSupabaseWithBatches([['10', '11', '12'], []]);
    const svc = createService(enrichment, supabase);
    const report = await svc.run();

    expect(report.totalScanned).toBe(3);
    expect(report.totalSeeded).toBe(2);
    expect(report.totalFailed).toBe(1);
  });

  it('respects dryRun (no enrichment calls)', async () => {
    const { svc: enrichment, calls } = makeEnrichment(() => ({
      inserted: true,
      snapshotId: 1,
    }));
    const supabase = makeSupabaseWithBatches([['10', '11'], []]);
    const svc = createService(enrichment, supabase);
    const report = await svc.run({ dryRun: true });

    expect(report.totalScanned).toBe(2);
    expect(report.totalSeeded).toBe(0);
    expect(calls).toHaveLength(0);
    expect(report.dryRun).toBe(true);
  });

  it('honors maxBatches safety cap', async () => {
    const { svc: enrichment } = makeEnrichment(() => ({
      inserted: true,
      snapshotId: 1,
    }));
    const supabase = makeSupabaseWithBatches([['10'], ['11'], ['12']]);
    const svc = createService(enrichment, supabase);
    const options: SeedRunOptions = { batchSize: 1, maxBatches: 2 };
    const report = await svc.run(options);

    expect(report.totalScanned).toBe(2);
  });

  it('counts non-numeric type_ids as skipped', async () => {
    const { svc: enrichment } = makeEnrichment(() => ({
      inserted: true,
      snapshotId: 1,
    }));
    const supabase = makeSupabaseWithBatches([['10', 'abc', '0'], []]);
    const svc = createService(enrichment, supabase);
    const report = await svc.run();

    expect(report.totalScanned).toBe(1);
    expect(report.totalSkipped).toBe(2); // 'abc' invalid, '0' invalid
  });

  describe('text type_id keyset', () => {
    // Digit-length boundaries : a numeric `n + 1` cursor skips '10990'..'10999'
    // after '1099' and restarts at '2' after '9999'.
    const IDS = ['1', '2', '10', '1099', '10995', '1100', '9999', '10000'];

    it('reads every type_id exactly once and terminates', async () => {
      const { svc: enrichment, calls } = makeEnrichment(() => ({
        inserted: true,
        snapshotId: 1,
      }));
      const svc = createService(enrichment, makeSupabaseOverTextIds(IDS));
      // maxBatches only bounds a regression ; the walk needs 4 batches of 2.
      const report = await svc.run({ batchSize: 2, maxBatches: 20 });

      const seen = calls.map((c) => String(c.typeId));
      expect(seen).toEqual([...IDS].sort());
      expect(report.totalScanned).toBe(IDS.length);
      expect(report.lastTypeIdProcessed).toBe(9999); // last in text order
    });

    it('advances past a batch made only of invalid ids', async () => {
      const { svc: enrichment, calls } = makeEnrichment(() => ({
        inserted: true,
        snapshotId: 1,
      }));
      const supabase = makeSupabaseOverTextIds(['0', '00', '5']);
      const svc = createService(enrichment, supabase);
      const report = await svc.run({ batchSize: 2, maxBatches: 20 });

      expect(calls.map((c) => c.typeId)).toEqual([5]);
      expect(report.totalSkipped).toBe(2);
    });

    it('resumes inclusively from sinceTypeId in text order', async () => {
      const { svc: enrichment, calls } = makeEnrichment(() => ({
        inserted: true,
        snapshotId: 1,
      }));
      const svc = createService(enrichment, makeSupabaseOverTextIds(IDS));
      await svc.run({ batchSize: 3, sinceTypeId: 1100, maxBatches: 20 });

      expect(calls.map((c) => String(c.typeId))).toEqual(['1100', '2', '9999']);
    });
  });
});
