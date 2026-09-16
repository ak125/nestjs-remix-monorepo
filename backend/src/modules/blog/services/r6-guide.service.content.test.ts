import { createClient } from '@supabase/supabase-js';
import { R6GuideService } from './r6-guide.service';
import { BuyingGuideDbService } from '../../admin/services/buying-guide/buying-guide-db.service';
import { humanizeProvenance } from '../utils/source-provenance.util';

const tier = {
  tier_id: 'oe',
  label: 'Origine',
  description: 'Référence documentée pour cette application.',
  available: true,
};
const criterion = {
  key: 'marque',
  label: 'Marque du véhicule',
  guidance: 'Vérifier le catalogue.',
  priority: 'required',
};

function reader(fields: Record<string, unknown> = {}) {
  const row = {
    sgpg_role_version: 'v2',
    sgpg_selection_criteria: [tier],
    sgpg_faq: [],
    sgpg_updated_at: '2026-09-13T12:00:00Z',
    ...fields,
  };
  const client = {
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        count: 0,
        single: async () => ({
          data:
            table === 'pieces_gamme'
              ? { pg_id: 7, pg_name: 'Filtre à huile', pg_pic: null }
              : row,
          error: null,
        }),
      };
      return builder;
    },
  };
  return {
    row,
    service: new R6GuideService(
      { client } as never,
      { buildImageUrl: () => null } as never,
      { processLinkGamme: async (html: string) => html } as never,
      {} as never,
    ),
  };
}

describe('R6 quality tier contract and declared source verification', () => {
  it.each(
    [[tier], { tiers: [tier], intro_text: 'Comparaison' }].map((value) => [
      value,
    ]),
  )('preserves both documented V2 containers: %j', async (value) => {
    const { service } = reader({ sgpg_selection_criteria: value });
    expect(await service.getR6GuidePayload('filtre-a-huile')).toMatchObject({
      roleVersion: 'v2',
      qualityTiers: [tier],
      qualityTiersReviewRequired: false,
    });
  });
  it.each(
    [
      [criterion],
      { tiers: [criterion] },
      [tier, criterion],
      [null],
      { tiers: 'invalid' },
      [{ ...tier, available: 'false' }],
      [{ ...tier, description: '   ' }],
      null,
      [],
      [tier, { ...tier, tier_id: 'oe-2', label: 'ORIGÍNE.' }],
      [tier, { ...tier, label: 'Autre catégorie' }],
    ].map((value) => [value]),
  )(
    'reports incomplete/invalid V2 tiers without converting compatibility data: %j',
    async (value) => {
      const { service, row } = reader({ sgpg_selection_criteria: value });
      const before = JSON.stringify(row);
      expect(await service.getR6GuidePayload('filtre-a-huile')).toMatchObject({
        qualityTiers: [],
        qualityTiersReviewRequired: true,
        canonicalRoleUrl: '/blog-pieces-auto/guide-achat/filtre-a-huile',
      });
      expect(JSON.stringify(row)).toBe(before);
    },
  );
  it('keeps legitimate V1 criteria in their V1 field', async () => {
    const { service } = reader({
      sgpg_role_version: 'v1',
      sgpg_selection_criteria: [criterion],
    });
    const payload = await service.getR6GuidePayload('filtre-a-huile');
    expect(payload).toMatchObject({
      roleVersion: 'v1',
      selectionCriteria: [criterion],
    });
    expect(payload?.qualityTiers).toBeUndefined();
  });
  it.each(['v1', 'v2'])(
    'refuses the historical RAG verification stamp in %s',
    async (version) => {
      for (const source of ['rag', 'rag-legacy']) {
        const { service } = reader({
          sgpg_role_version: version,
          sgpg_source_type: source,
          sgpg_source_verified: true,
        });
        expect(await service.getR6GuidePayload('filtre-a-huile')).toMatchObject(
          { sourceVerified: false },
        );
      }
    },
  );
  it('preserves an explicit non-legacy verification declaration without inventing one', async () => {
    const { service } = reader({
      sgpg_source_type: 'wiki',
      sgpg_source_verified: true,
    });
    expect(await service.getR6GuidePayload('filtre-a-huile')).toMatchObject({
      sourceVerified: true,
    });
    const missing = reader({ sgpg_source_type: 'wiki' }).service;
    expect(await missing.getR6GuidePayload('filtre-a-huile')).toMatchObject({
      sourceVerified: false,
    });
  });
  it('does not convert the string false into a truthy verified badge', async () => {
    const { service } = reader({
      sgpg_source_type: 'wiki',
      sgpg_source_verified: 'false',
    });
    expect(await service.getR6GuidePayload('filtre-a-huile')).toMatchObject({
      sourceVerified: false,
    });
  });
  it('does not manufacture verification from perfect legacy scores', () => {
    // Exercise the pure payload builder without creating a DB client.
    const writer = Object.create(
      BuyingGuideDbService.prototype,
    ) as BuyingGuideDbService;
    expect(
      writer.buildUpdatePayload({}, 'rag://fixture', 'fixture', 1, 100),
    ).toMatchObject({
      sgpg_source_type: 'rag-legacy',
      sgpg_source_verified: false,
      sgpg_source_verified_by: null,
      sgpg_source_verified_at: null,
    });
  });
  it('uses a neutral provenance label when there is no verification evidence', () => {
    expect(humanizeProvenance({ type: 'web', ref: 'fixture' })).toBe(
      'Référence documentaire',
    );
  });
});

describe('Legacy R6 writer uses a version predicate in the UPDATE itself', () => {
  it.each(['v1', null, 'v2', 'v3'])(
    'checks the write request and affected rows for version %s',
    async (version) => {
      const requests: URL[] = [];
      const client = createClient('https://fixture.invalid', 'fixture-key', {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: async (input, init) => {
            const url = new URL(String(input));
            expect(init?.method).toBe('PATCH');
            requests.push(url);
            const eligible = version === 'v1' || version === null;
            return new Response(
              JSON.stringify(eligible ? [{ sgpg_pg_id: '7' }] : []),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          },
        },
      });
      const writer = Object.create(
        BuyingGuideDbService.prototype,
      ) as BuyingGuideDbService;
      Object.defineProperty(writer, 'client', { value: client });
      Object.defineProperty(writer, 'logger', {
        value: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      });
      const result = writer.upsertBuyingGuide('7', {
        sgpg_source_type: 'rag-legacy',
        sgpg_gatekeeper_score: 100,
      });
      if (version === 'v1' || version === null)
        await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toThrow('R6_WRITE_NOT_APPLIED');
      expect(requests).toHaveLength(1);
      expect(requests[0].searchParams.get('sgpg_pg_id')).toBe('eq.7');
      expect(requests[0].searchParams.get('or')).toBe(
        '(sgpg_role_version.is.null,sgpg_role_version.eq.v1)',
      );
      expect(requests[0].searchParams.get('select')).toBe('sgpg_pg_id');
    },
  );
});

describe('R6 metadata-only diagnostics', () => {
  it('keeps diagnostics writable without a legacy content-version restriction', async () => {
    let query: URL | undefined;
    const client = createClient('https://fixture.invalid', 'fixture-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input) => {
          query = new URL(String(input));
          return new Response(JSON.stringify([{ sgpg_pg_id: '7' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    });
    const writer = Object.create(
      BuyingGuideDbService.prototype,
    ) as BuyingGuideDbService;
    Object.defineProperty(writer, 'client', { value: client });
    Object.defineProperty(writer, 'logger', {
      value: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
    await expect(
      writer.upsertBuyingGuide('7', {
        sgpg_gatekeeper_score: 0,
        sgpg_source_verified: false,
      }),
    ).resolves.toBeUndefined();
    expect(query?.searchParams.get('or')).toBeNull();
    expect(query?.searchParams.get('sgpg_pg_id')).toBe('eq.7');
  });
});
