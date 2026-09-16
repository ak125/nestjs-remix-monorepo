import { createClient } from '@supabase/supabase-js';
import { InternalSeoAuditController } from './internal-seo-audit.controller';

const fixture = () => ({
  pieces_gamme: [
    { pg_id: 1, pg_alias: 'fixture-a', pg_name: 'A' },
    { pg_id: 2, pg_alias: 'fixture-b', pg_name: 'B' },
    { pg_id: 3, pg_alias: 'cable-de-boite-vitesse', pg_name: 'C' },
    { pg_id: 4, pg_alias: 'fixture-d', pg_name: 'D' },
  ],
  __seo_r3_keyword_plan: [
    { skp_id: 1, skp_pg_alias: 'fixture-a' },
    { skp_id: 2, skp_pg_alias: 'fixture-b' },
    { skp_id: 3, skp_pg_alias: 'fixture-d' },
  ],
  __seo_r6_keyword_plan: [{ r6kp_id: 1, r6kp_pg_alias: 'fixture-a' }],
  __seo_gamme_conseil: [
    {
      sgc_id: '1',
      sgc_pg_id: '1',
      sgc_content: '<p>Contenu existant.</p>',
      sgc_enriched_by: null,
    },
    {
      sgc_id: '2',
      sgc_pg_id: '2',
      sgc_content: '  ',
      sgc_enriched_by: 'legacy',
    },
    {
      sgc_id: '3',
      sgc_pg_id: '4',
      sgc_content: '<p>Autre contenu existant.</p>',
      sgc_enriched_by: 'legacy',
    },
  ],
  __seo_keywords: [
    { id: 1, pg_id: 1 },
    { id: 2, pg_id: 2 },
    { id: 3, pg_id: 4 },
  ],
});
type Table = keyof ReturnType<typeof fixture>;

function harness(
  options: {
    failTable?: Table;
    omitCount?: boolean;
    changeCount?: boolean;
  } = {},
) {
  const data = fixture();
  const calls: URL[] = [];
  const transport = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(url);
      expect(init?.method ?? 'GET').toBe('GET');
      const table = url.pathname.split('/').pop() as Table;
      if (table === options.failTable)
        return new Response(
          JSON.stringify({ message: 'fixture unavailable' }),
          { status: 503 },
        );
      let rows: unknown[] = data[table];
      if (url.searchParams.get('sgc_enriched_by') === 'not.is.null') {
        rows = data.__seo_gamme_conseil.filter(
          (row) => row.sgc_enriched_by !== null,
        );
      }
      if (
        table === 'pieces_gamme' &&
        url.searchParams
          .getAll('pg_alias')
          .some((v) => v.includes('cable-de-boite-vitesse'))
      ) {
        rows = data.pieces_gamme.filter((row) => row.pg_id !== 3);
      }
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Math.min(2, Number(url.searchParams.get('limit') ?? 500));
      const page = rows.slice(offset, offset + limit);
      const count = rows.length + (options.changeCount && offset > 0 ? 1 : 0);
      return new Response(JSON.stringify(page), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(!options.omitCount
            ? {
                'Content-Range': `${offset}-${offset + page.length - 1}/${count}`,
              }
            : {}),
        },
      });
    },
  );
  const client = createClient('https://example.invalid', 'fixture-only-key', {
    global: { fetch: transport },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const controller = Object.create(
    InternalSeoAuditController.prototype,
  ) as InternalSeoAuditController;
  Object.defineProperties(controller, {
    supabase: { value: client },
    logger: { value: { log: jest.fn(), error: jest.fn() } },
  });
  return { controller, calls };
}

describe('SEO heartbeat coverage contract — evidence is not inferred from plans', () => {
  it('includes already planned/content-bearing gammes and formerly RAG-excluded gammes in R3 candidates', async () => {
    const { controller, calls } = harness();
    const result = await controller.coverage();
    expect(result.gammes_total).toBe(4);
    expect(result).toMatchObject({ wiki_evidence_status: 'not_evaluated' });
    expect(result).toHaveProperty('r3_audit_candidates', [
      { pg_id: '1', pg_alias: 'fixture-a', pg_name: 'A' },
      { pg_id: '2', pg_alias: 'fixture-b', pg_name: 'B' },
      { pg_id: '3', pg_alias: 'cable-de-boite-vitesse', pg_name: 'C' },
      { pg_id: '4', pg_alias: 'fixture-d', pg_name: 'D' },
    ]);
    expect(result).not.toHaveProperty('wiki_missing');
    expect(calls.every((url) => url.searchParams.has('order'))).toBe(true);
  });
  it('reads all returned pages despite a server cap and detects content instead of an enrichment marker', async () => {
    const { controller } = harness();
    const result = await controller.coverage();
    expect(result.kp_r3_missing.map((g) => g.pg_alias)).toEqual([
      'cable-de-boite-vitesse',
    ]);
    expect(result.content_r3_missing.map((g) => g.pg_alias)).toEqual([
      'fixture-b',
      'cable-de-boite-vitesse',
    ]);
    expect(result.kw_missing.map((g) => g.pg_alias)).toEqual([
      'cable-de-boite-vitesse',
    ]);
  });
  it.each<Table>([
    'pieces_gamme',
    '__seo_r3_keyword_plan',
    '__seo_r6_keyword_plan',
    '__seo_gamme_conseil',
    '__seo_keywords',
  ])(
    'fails on %s read error instead of issuing false gap counts',
    async (failTable) => {
      await expect(
        harness({ failTable }).controller.coverage(),
      ).rejects.toMatchObject({ status: 503 });
    },
  );
  it('refuses incomplete coverage when total count is missing', async () => {
    await expect(
      harness({ omitCount: true }).controller.coverage(),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('refuses a changing total instead of mixing pages into a complete inventory', async () => {
    await expect(
      harness({ changeCount: true }).controller.coverage(),
    ).rejects.toMatchObject({ status: 503 });
  });
});
