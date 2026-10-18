import { MarketingDataService } from './marketing-data.service';

const tables = [
  'pieces_gamme',
  '__seo_gamme_conseil',
  '__seo_gamme_purchase_guide',
  '__blog_advice',
  '__seo_reference',
  '__seo_observable',
  '__marketing_content_roadmap',
];
function setup(failedTable?: string, populated = false) {
  const rows: Record<string, unknown[]> = populated
    ? {
        pieces_gamme: [
          { pg_id: 1, pg_name: 'Plaquettes', pg_alias: 'plaquette-de-frein' },
        ],
        __seo_gamme_conseil: [{ sgc_pg_id: '1' }],
        __seo_gamme_purchase_guide: [{ sgpg_pg_id: '1' }],
        __blog_advice: [{ ba_pg_id: '1' }],
        __seo_reference: [{ pg_id: '1' }],
        __seo_observable: [{ related_gammes: ['1'] }],
        __marketing_content_roadmap: [{ pg_id: '1' }],
      }
    : {};
  const service = Object.create(
    MarketingDataService.prototype,
  ) as MarketingDataService;
  Object.assign(service, {
    supabase: {
      from: jest.fn((table: string) => {
        const response =
          table === failedTable
            ? {
                data: null,
                error: { message: 'fixture outage', code: '08006' },
              }
            : { data: rows[table] ?? [], error: null };
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: (resolve: (value: typeof response) => unknown) =>
            Promise.resolve(response).then(resolve),
        };
      }),
    },
  });
  return service;
}

describe('marketing coverage truth', () => {
  it.each(tables)(
    'does not invent missing content when %s fails',
    async (table) => {
      await expect(setup(table, true).getContentCoverage()).rejects.toThrow();
    },
  );
  it('accepts a genuinely empty catalogue', async () => {
    await expect(setup().getContentCoverage()).resolves.toMatchObject({
      total_gammes: 0,
      coverage_pct: 0,
      gaps: [],
    });
  });
  it('retains coverage for mixed text and numeric gamme identifiers', async () => {
    await expect(
      setup(undefined, true).getContentCoverage(),
    ).resolves.toMatchObject({
      total_gammes: 1,
      coverage_pct: 100,
      gaps: [],
      gammes_with_advice: 1,
      gammes_with_conseil_seo: 1,
      gammes_with_purchase_guide: 1,
      gammes_with_reference: 1,
      gammes_with_diagnostic: 1,
      gammes_with_roadmap: 1,
    });
  });
});
