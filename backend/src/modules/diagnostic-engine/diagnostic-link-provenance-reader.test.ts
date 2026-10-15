import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

type Reply = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

const row = (linkId: number, wikiPath: string, diagnosticSafe = false) => ({
  link_id: linkId,
  wiki_path: wikiPath,
  gamme_slug: 'plaquette-de-frein',
  relation_to_part: 'direct_cause',
  diagnostic_safe: diagnosticSafe,
});

function makeService(reply: Reply) {
  const calls: Array<{ table: string; chain: unknown[][] }> = [];
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  Object.assign(service, {
    logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
    supabase: {
      from: (table: string) => {
        const trace = { table, chain: [] as unknown[][] };
        calls.push(trace);
        const step =
          (name: string) =>
          (...args: unknown[]) => {
            trace.chain.push([name, ...args]);
            return query;
          };
        const query = {
          select: step('select'),
          in: step('in'),
          is: step('is'),
          order: step('order'),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({
              data: reply.data,
              error: reply.error,
              count:
                reply.count !== undefined
                  ? reply.count
                  : Array.isArray(reply.data)
                    ? reply.data.length
                    : null,
            }).then(resolve),
        };
        return query;
      },
    },
  });
  return { service, calls };
}

describe('DiagnosticEngineDataService.getLiveLinkProvenance', () => {
  it('reads live rows only, for the unique requested links, with an exact count', async () => {
    const rows = [
      row(1, 'gammes/a.md', true),
      row(1, 'gammes/b.md'),
      row(3, 'gammes/a.md'),
    ];
    const { service, calls } = makeService({ data: rows, error: null });

    await expect(service.getLiveLinkProvenance([3, 1, 3])).resolves.toEqual(
      rows,
    );
    expect(calls).toEqual([
      {
        table: '__diag_link_provenance',
        chain: [
          [
            'select',
            'link_id, wiki_path, gamme_slug, relation_to_part, diagnostic_safe',
            { count: 'exact' },
          ],
          ['in', 'link_id', [1, 3]],
          ['is', 'retired_at', null],
          ['order', 'link_id', { ascending: true }],
          ['order', 'wiki_path', { ascending: true }],
        ],
      },
    ]);
  });

  it('does not query for an empty request', async () => {
    const { service, calls } = makeService({ data: [], error: null });
    await expect(service.getLiveLinkProvenance([])).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it('returns no row for links nobody documented (absence is not an error)', async () => {
    const { service } = makeService({ data: [], error: null });
    await expect(service.getLiveLinkProvenance([7])).resolves.toEqual([]);
  });

  const failures: Array<[string, Reply]> = [
    ['a query error', { data: null, error: { message: 'permission denied' } }],
    // An error beside an empty array must not read as "nobody documented these links".
    [
      'a query error beside an empty array',
      { data: [], error: { message: 'permission denied' } },
    ],
    ['no data array', { data: null, error: null }],
    // A capped reply must never read as "these links are undocumented".
    [
      'fewer rows than the exact count',
      { data: [row(1, 'gammes/a.md')], error: null, count: 2 },
    ],
    [
      'an unknown count',
      { data: [row(1, 'gammes/a.md')], error: null, count: null },
    ],
    [
      'a malformed row',
      {
        data: [{ ...row(1, 'gammes/a.md'), diagnostic_safe: 'true' }],
        error: null,
      },
    ],
    ['an empty wiki path', { data: [row(1, ' ')], error: null }],
    [
      'two live rows for one (link, fiche) pair',
      { data: [row(1, 'gammes/a.md'), row(1, 'gammes/a.md')], error: null },
    ],
    [
      'a row for a link that was not requested',
      { data: [row(2, 'gammes/a.md')], error: null },
    ],
  ];
  it.each(failures)('throws on %s', async (_name, reply) => {
    const { service } = makeService(reply);
    await expect(service.getLiveLinkProvenance([1])).rejects.toThrow(
      /__diag_link_provenance/,
    );
  });
});
