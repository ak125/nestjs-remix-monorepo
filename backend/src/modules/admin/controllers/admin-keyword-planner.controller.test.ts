/**
 * AdminKeywordPlannerController — generate-from-rag endpoints refuse the persist.
 *
 * `generate-from-rag` and `batch-generate-from-rag` produce sg_content via
 * R1ContentFromRagService, which reads the decommissioned legacy RAG corpus
 * (ADR-031/046). Persisting that to the served `__seo_gamme.sg_content` is
 * refused (never calls upsert); the `dry_run` preview stays available.
 */
const supabaseState: { fromImpl: (table: string) => unknown } = {
  fromImpl: () => ({}),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (table: string) => supabaseState.fromImpl(table),
  })),
  SupabaseClient: class {},
}));

import { AdminKeywordPlannerController } from './admin-keyword-planner.controller';
import type { ConfigService } from '@nestjs/config';

function makeController(
  r1ContentFromRag: unknown,
): AdminKeywordPlannerController {
  const config = {
    get: () => 'https://example.supabase.co',
  } as unknown as ConfigService;
  return new AdminKeywordPlannerController(
    config,
    undefined, // r1BatchService
    r1ContentFromRag as never,
    undefined, // cacheManager
  );
}

// Supabase query-builder stub: chainable + awaitable (thenable), with an upsert spy.
function makeQb(result: unknown, upsert: jest.Mock): Record<string, unknown> {
  const qb: Record<string, unknown> = {};
  const chain = (): Record<string, unknown> => qb;
  Object.assign(qb, {
    select: chain,
    eq: chain,
    in: chain,
    order: chain,
    range: chain,
    single: () => Promise.resolve(result),
    upsert,
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  });
  return qb;
}

const RAG_RESULT = {
  charCount: 1200,
  h2Count: 4,
  quality: 'rich' as const,
  ragFieldsUsed: ['a', 'b'],
  html: '<h2>Freinage</h2>',
};

describe('AdminKeywordPlannerController — generate-from-rag refuses the persist', () => {
  it('generate-from-rag: refuses the sg_content persist and never calls upsert', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    supabaseState.fromImpl = () =>
      makeQb({ data: { pg_name: 'Freinage' } }, upsert);
    const r1 = { generate: jest.fn().mockResolvedValue(RAG_RESULT) };
    const controller = makeController(r1);

    const res = (await controller.generateFromRag({
      pg_id: 42,
      pg_alias: 'freinage',
      dry_run: false,
    })) as Record<string, unknown>;

    expect(res).toMatchObject({
      status: 'refused',
      reason: 'rag_provenance_refused',
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('generate-from-rag: dry_run still returns a preview, no persist attempted', async () => {
    const upsert = jest.fn();
    supabaseState.fromImpl = () =>
      makeQb({ data: { pg_name: 'Freinage' } }, upsert);
    const r1 = { generate: jest.fn().mockResolvedValue(RAG_RESULT) };
    const controller = makeController(r1);

    const res = (await controller.generateFromRag({
      pg_id: 42,
      pg_alias: 'freinage',
      dry_run: true,
    })) as Record<string, unknown>;

    expect(res).toMatchObject({ status: 'dry_run' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('batch-generate-from-rag: refuses each item and never calls upsert', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    supabaseState.fromImpl = (table: string) => {
      if (table === 'gamme_aggregates') {
        return makeQb(
          { data: [{ ga_pg_id: 42, products_total: 100 }] },
          upsert,
        );
      }
      if (table === 'pieces_gamme') {
        return makeQb(
          { data: [{ pg_id: 42, pg_alias: 'freinage', pg_name: 'Freinage' }] },
          upsert,
        );
      }
      return makeQb({ data: null }, upsert);
    };
    const r1 = { generate: jest.fn().mockResolvedValue(RAG_RESULT) };
    const controller = makeController(r1);

    const res = (await controller.batchGenerateFromRag({
      limit: 1,
      dry_run: false,
      min_quality: 'minimal',
    })) as {
      summary: Record<string, number>;
      results: Array<Record<string, unknown>>;
    };

    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toMatchObject({
      status: 'refused',
      reason: 'rag_provenance_refused',
    });
    expect(res.summary.refused).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });
});
