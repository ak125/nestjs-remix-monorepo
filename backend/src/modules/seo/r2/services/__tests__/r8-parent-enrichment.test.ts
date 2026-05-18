/**
 * ADR-072 PR 2D-2 — R8ParentEnrichmentService unit tests.
 *
 * Coverage :
 *   1. Pure builder : disambiguation signature shape + deterministic sibling
 *      ordering.
 *   2. computeVersionSha is deterministic (same input → same sha) and changes
 *      when any field changes.
 *   3. enrichTypeId routes to RPC __seo_r8_publish_snapshot and surfaces the
 *      idempotent outcome (`inserted=false` when RPC reports a reuse).
 *   4. enrichTypeId throws on RPC error so the BullMQ processor surfaces the
 *      failure to its retry policy.
 *   5. Cache best-effort : invalidate failure does not bubble up.
 *
 * Pattern Object.create(prototype) pour bypass SupabaseBaseService ctor env
 * check (canon r8-snapshot-reader.test.ts).
 */

import {
  R8EnrichmentOutcome,
  R8ParentEnrichmentService,
} from '../r8-parent-enrichment.service';
import { R8SnapshotCacheClient } from '../r8-snapshot-reader.service';

const sampleAutoTypeRow = {
  type_id: '12345',
  type_marque_id: '40',
  type_modele_id: '512',
  type_power_ps: '88',
  type_power_kw: '65',
  type_year_from: '2010',
  type_year_to: '2014',
  type_month_from: '1',
  type_month_to: '12',
  type_body: '3/5 portes',
  type_fuel: 'diesel',
  type_engine: 'K9K 770',
  type_liter: '1.5',
  type_alias: 'clio-iii-1.5-dci',
};

const sampleSibling = {
  ...sampleAutoTypeRow,
  type_id: '99999',
  type_power_ps: '90',
};

interface RpcInvocation {
  name: string;
  args: Record<string, unknown>;
}

interface UpdateRecord {
  table: string;
  values: Record<string, unknown>;
  where: Record<string, unknown>;
}

function makeFakeSupabase(opts: {
  parent?: typeof sampleAutoTypeRow | null;
  siblings?: (typeof sampleAutoTypeRow)[];
  brandSlug?: string | null;
  modelSlug?: string | null;
  rpcResponse?: { data: unknown; error: { message: string } | null };
}) {
  const invocations: RpcInvocation[] = [];
  const updates: UpdateRecord[] = [];

  const supabase = {
    from(table: string) {
      return {
        select(_cols: string) {
          const builder: any = {
            _eqFilters: {} as Record<string, unknown>,
            _neqFilters: {} as Record<string, unknown>,
            eq(col: string, value: unknown) {
              this._eqFilters[col] = value;
              return this;
            },
            neq(col: string, value: unknown) {
              this._neqFilters[col] = value;
              return this;
            },
            limit(_n: number) {
              return this;
            },
            maybeSingle: async () => {
              if (table === 'auto_type') {
                return { data: opts.parent ?? null, error: null };
              }
              if (table === 'auto_marque') {
                return opts.brandSlug !== undefined
                  ? { data: { marque_alias: opts.brandSlug }, error: null }
                  : { data: null, error: null };
              }
              if (table === 'auto_modele') {
                return opts.modelSlug !== undefined
                  ? { data: { modele_alias: opts.modelSlug }, error: null }
                  : { data: null, error: null };
              }
              return { data: null, error: null };
            },
            then(
              resolve: (value: { data: unknown; error: null }) => unknown,
              reject?: (reason: unknown) => unknown,
            ) {
              if (table === 'auto_type') {
                resolve({ data: opts.siblings ?? [], error: null });
                return;
              }
              resolve({ data: [], error: null });
              return reject; // unused, satisfy TS
            },
          };
          return builder;
        },
        update(values: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              updates.push({ table, values, where: { [col]: val } });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
    rpc(name: string, args: Record<string, unknown>) {
      invocations.push({ name, args });
      return Promise.resolve(
        opts.rpcResponse ?? {
          data: [
            {
              snapshot_id: 7,
              inserted: true,
              pages_pointer_updated: true,
              outbox_event_id: 11,
            },
          ],
          error: null,
        },
      );
    },
  };

  return { supabase, invocations, updates };
}

function createService(
  supabase: unknown,
  cache?: R8SnapshotCacheClient,
): R8ParentEnrichmentService {
  const svc = Object.create(
    R8ParentEnrichmentService.prototype,
  ) as R8ParentEnrichmentService;
  (
    svc as unknown as {
      logger: { log: () => void; error: () => void; warn: () => void };
    }
  ).logger = { log: () => {}, error: () => {}, warn: () => {} };
  (svc as unknown as { supabase: unknown }).supabase = supabase;
  (svc as unknown as { cache: R8SnapshotCacheClient | undefined }).cache =
    cache;
  return svc;
}

describe('R8ParentEnrichmentService', () => {
  describe('buildDisambiguationSignature', () => {
    it('sorts siblings by typeId for deterministic hashing', () => {
      const svc = createService({});
      const parent = { ...sampleAutoTypeRow, type_id: '12345' };
      const s1 = { ...sampleAutoTypeRow, type_id: '99' };
      const s2 = { ...sampleAutoTypeRow, type_id: '42' };
      const s3 = { ...sampleAutoTypeRow, type_id: '12345' }; // self, must be filtered

      const signature = svc.buildDisambiguationSignature(
        parent,
        'renault',
        'clio-iii',
        [s1, s2, s3],
      );

      expect(signature.siblings.map((s) => s.typeId)).toEqual([42, 99]);
    });

    it('returns null for blank string columns', () => {
      const svc = createService({});
      const parent = {
        ...sampleAutoTypeRow,
        type_body: '   ',
        type_engine: '',
        type_fuel: null,
      };
      const signature = svc.buildDisambiguationSignature(
        parent,
        'renault',
        'clio-iii',
        [],
      );
      expect(signature.bodyType).toBeNull();
      expect(signature.engineCode).toBeNull();
      expect(signature.fuelType).toBeNull();
    });

    it('throws on non-numeric type_id', () => {
      const svc = createService({});
      const parent = { ...sampleAutoTypeRow, type_id: 'abc' };
      expect(() =>
        svc.buildDisambiguationSignature(parent, 'renault', 'clio', []),
      ).toThrow(/Non-numeric type_id/);
    });
  });

  describe('computeVersionSha', () => {
    it('is deterministic for identical input', () => {
      const svc = createService({});
      const signature = svc.buildDisambiguationSignature(
        sampleAutoTypeRow,
        'renault',
        'clio-iii',
        [sampleSibling],
      );
      const a = svc.computeVersionSha(signature);
      const b = svc.computeVersionSha(signature);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes when any payload field changes', () => {
      const svc = createService({});
      const base = svc.buildDisambiguationSignature(
        sampleAutoTypeRow,
        'renault',
        'clio-iii',
        [],
      );
      const tweaked = svc.buildDisambiguationSignature(
        { ...sampleAutoTypeRow, type_power_ps: '120' },
        'renault',
        'clio-iii',
        [],
      );
      expect(svc.computeVersionSha(base)).not.toBe(
        svc.computeVersionSha(tweaked),
      );
    });
  });

  describe('enrichTypeId', () => {
    it('calls __seo_r8_publish_snapshot and returns outcome', async () => {
      const { supabase, invocations } = makeFakeSupabase({
        parent: sampleAutoTypeRow,
        siblings: [sampleSibling],
        brandSlug: 'renault',
        modelSlug: 'clio-iii',
      });
      const svc = createService(supabase);
      const outcome = (await svc.enrichTypeId(
        12345,
        'unit-test',
      )) as R8EnrichmentOutcome;

      expect(outcome.typeId).toBe(12345);
      expect(outcome.snapshotId).toBe(7);
      expect(outcome.inserted).toBe(true);
      expect(outcome.pagesPointerUpdated).toBe(true);
      expect(outcome.outboxEventId).toBe(11);
      expect(outcome.versionSha).toMatch(/^[0-9a-f]{64}$/);
      expect(invocations).toHaveLength(1);
      expect(invocations[0].name).toBe('__seo_r8_publish_snapshot');
      expect(invocations[0].args.p_type_id).toBe(12345);
      expect(invocations[0].args.p_enrichment_status).toBe('minimal');
      expect(invocations[0].args.p_event_reason).toBe('unit-test');
    });

    it('surfaces inserted=false when RPC reports an idempotent reuse', async () => {
      const { supabase } = makeFakeSupabase({
        parent: sampleAutoTypeRow,
        rpcResponse: {
          data: [
            {
              snapshot_id: 9,
              inserted: false,
              pages_pointer_updated: false,
              outbox_event_id: 21,
            },
          ],
          error: null,
        },
      });
      const svc = createService(supabase);
      const outcome = await svc.enrichTypeId(12345);
      expect(outcome?.inserted).toBe(false);
      expect(outcome?.pagesPointerUpdated).toBe(false);
    });

    it('returns null when auto_type row missing (no RPC call)', async () => {
      const { supabase, invocations } = makeFakeSupabase({ parent: null });
      const svc = createService(supabase);
      const outcome = await svc.enrichTypeId(12345);
      expect(outcome).toBeNull();
      expect(invocations).toHaveLength(0);
    });

    it('throws when RPC reports an error so BullMQ retries kick in', async () => {
      const { supabase } = makeFakeSupabase({
        parent: sampleAutoTypeRow,
        rpcResponse: { data: null, error: { message: 'unique violation' } },
      });
      const svc = createService(supabase);
      await expect(svc.enrichTypeId(12345)).rejects.toThrow(
        /r8_publish_snapshot_failed/,
      );
    });

    it('rejects invalid typeId', async () => {
      const svc = createService({});
      await expect(svc.enrichTypeId(0)).rejects.toThrow(/Invalid typeId/);
      await expect(svc.enrichTypeId(-1)).rejects.toThrow(/Invalid typeId/);
    });

    it('best-effort cache invalidation never bubbles', async () => {
      const { supabase } = makeFakeSupabase({ parent: sampleAutoTypeRow });
      const cache: R8SnapshotCacheClient = {
        get: async () => null,
        setEx: async () => {},
        del: async () => {
          throw new Error('redis down');
        },
      };
      const svc = createService(supabase, cache);
      await expect(svc.enrichTypeId(12345)).resolves.toBeTruthy();
    });
  });
});
