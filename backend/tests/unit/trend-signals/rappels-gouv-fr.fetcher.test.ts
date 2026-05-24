import { fetchRappelsGouvFr } from '../../../src/modules/trend-signals/sources/rappels-gouv-fr.fetcher';

describe('fetchRappelsGouvFr', () => {
  it('returns labelled trend rows from a sample API payload', async () => {
    const samplePayload = {
      records: [
        { fields: { modele_commercial: 'Clio IV', nature_du_defaut: 'Airbag' } },
        { fields: { modele_commercial: '208', nature_du_defaut: 'Direction' } },
      ],
    };
    const fakeFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => samplePayload });
    const rows = await fetchRappelsGouvFr({ fetch: fakeFetch as unknown as typeof globalThis.fetch });
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe('rappels_gouv_fr');
    expect(rows[0].label).toMatch(/Clio/);
  });

  it('returns [] and does NOT throw when fetch fails (graceful degradation)', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const rows = await fetchRappelsGouvFr({ fetch: fakeFetch as unknown as typeof globalThis.fetch });
    expect(rows).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    const fakeFetch = jest.fn().mockRejectedValue(new Error('network'));
    const rows = await fetchRappelsGouvFr({ fetch: fakeFetch as unknown as typeof globalThis.fetch });
    expect(rows).toEqual([]);
  });
});
