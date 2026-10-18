import { Logger } from '@nestjs/common';
import { MarketingHubDataService } from './marketing-hub-data.service';
import type { GateSummary } from '../interfaces/marketing-hub.interfaces';

// Exercise the real adapter with a local response fixture, never its constructor
// (which configures the shared Supabase client).
function setup(data: unknown, error: unknown = null) {
  const response = { data, error };
  const query = {
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockResolvedValue(response),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
    maybeSingle: jest.fn().mockResolvedValue(response),
    then: (resolve: (value: typeof response) => unknown) =>
      Promise.resolve(response).then(resolve),
  };
  const service = Object.create(
    MarketingHubDataService.prototype,
  ) as MarketingHubDataService;
  Object.assign(service, { supabase: query, logger: new Logger('fixture') });
  return { service, query };
}

const summary = {
  can_approve: true,
  blocking_issues: [],
  brand: { level: 'PASS', violations: [], warnings: [], fix_suggestions: [] },
  compliance: { level: 'PASS', checks: [] },
} satisfies GateSummary;
const attribution = {
  utm_campaign: 'fixture',
  utm_source: 'facebook',
  utm_medium: 'social',
  target_url: 'https://www.automecanik.com/',
};

describe('marketing storage truth', () => {
  it('reads a post by its stable id', async () => {
    const { service, query } = setup({ id: 17 });
    expect(await service.getPostById(17)).toEqual({ id: 17 });
    expect(query.eq).toHaveBeenCalledWith('id', 17);
  });
  it('does not hide a post lookup outage', async () => {
    await expect(
      setup(null, { message: 'outage' }).service.getPostById(17),
    ).rejects.toThrow();
  });
  it.each([
    'getPostsByWeek',
    'getApprovedPostsByChannel',
    'getActiveBrandRules',
    'getWeeklyPlan',
  ] as const)('%s distinguishes an outage from absent data', async (method) => {
    const { service } = setup(null, {
      message: 'fixture outage',
      code: '08006',
    });
    const result =
      method === 'getActiveBrandRules'
        ? service[method]('facebook')
        : method === 'getApprovedPostsByChannel'
          ? service[method]('2026-W42', 'facebook')
          : service[method]('2026-W42');
    await expect(result).rejects.toThrow();
  });
  it('preserves a genuinely absent plan', async () => {
    expect(await setup(null).service.getWeeklyPlan('2026-W42')).toBeNull();
  });
  it('preserves an empty successful read', async () => {
    expect(await setup([]).service.getPostsByWeek('2026-W42')).toEqual([]);
  });
  it.each([null, { id: 17 }])(
    'confirms the affected gate row: %j',
    async (data) => {
      expect(await setup(data).service.updatePostGates(17, summary, 100)).toBe(
        data !== null,
      );
    },
  );
  it.each([null, { id: 19 }])(
    'confirms the attribution row: %j',
    async (data) => {
      expect(await setup(data).service.registerUTM(attribution)).toBe(
        data !== null,
      );
    },
  );
  it('does not mistake a failed write for a confirmed row', async () => {
    const { service } = setup(null, { message: 'fixture outage' });
    expect(await service.registerUTM(attribution)).toBe(false);
    expect(await service.updatePostGates(17, summary, 100)).toBe(false);
  });
});

const reviewTarget = {
  channel: 'facebook' as const,
  content_revision: 2,
  review_version: 3,
};
const publication = {
  ...reviewTarget,
  approved_content_hash: 'a'.repeat(64),
  url: 'https://www.facebook.com/posts/123',
};

describe('marketing RPC governance', () => {
  it.each(['review', 'publication'] as const)(
    'blocks %s before touching storage',
    async (operation) => {
      const { service, query } = setup(null);
      const rpcGate = {
        evaluate: jest
          .fn()
          .mockReturnValue({ decision: 'BLOCK', reason: 'DENYLIST_P0' }),
        log: jest.fn(),
      };
      Object.assign(service, { rpcGate });
      await expect(
        operation === 'review'
          ? service.reviewSocialPost(17, reviewTarget, 'approve', '42')
          : service.declarePublication(17, publication, '42'),
      ).rejects.toThrow();
      expect(query.rpc).not.toHaveBeenCalled();
      expect(rpcGate.evaluate).toHaveBeenCalledWith(
        operation === 'review'
          ? 'review_marketing_social_post'
          : 'declare_marketing_social_publication',
        { source: 'admin', userId: '42', role: 'service_role' },
      );
    },
  );

  it.each([
    [{ isReadOnlyMode: true }, 'anon'],
    [{ isDevKillSwitchEnabled: true }, 'dev_readonly'],
  ])('reports restricted credentials to the gate: %j', async (flags, role) => {
    const { service, query } = setup(null);
    const rpcGate = {
      evaluate: jest
        .fn()
        .mockReturnValue({ decision: 'BLOCK', reason: 'UNKNOWN_RPC' }),
      log: jest.fn(),
    };
    Object.assign(service, flags, { rpcGate });
    await expect(
      service.declarePublication(17, publication, '42'),
    ).rejects.toThrow();
    expect(query.rpc).not.toHaveBeenCalled();
    expect(rpcGate.evaluate).toHaveBeenCalledWith(
      'declare_marketing_social_publication',
      {
        source: 'admin',
        userId: '42',
        role,
      },
    );
  });
});

describe('confirmed atomic transitions', () => {
  it.each([
    null,
    {},
    { id: 17 },
    { id: 18, content_revision: 2, review_version: 4 },
  ])('rejects absent or wrong persisted review %p', async (data) => {
    await expect(
      setup(data).service.reviewSocialPost(17, reviewTarget, 'approve', '42'),
    ).rejects.toThrow();
  });
  it.each(['40001', '23514', 'P0002', '08006'])(
    'propagates RPC error %s',
    async (code) => {
      const service = setup(null, { code }).service;
      await expect(
        service.reviewSocialPost(17, reviewTarget, 'approve', '42'),
      ).rejects.toThrow();
      await expect(
        service.declarePublication(17, publication, '42'),
      ).rejects.toThrow();
    },
  );
  it('requires current approved hash and the actual actor in the returned review', async () => {
    const good = {
      id: 17,
      content_revision: 2,
      review_version: 4,
      channel_reviews: {
        facebook: {
          content_revision: 2,
          state: 'approved',
          actor: '42',
          approved_content_hash: 'a'.repeat(64),
        },
      },
    };
    expect(
      await setup(good).service.reviewSocialPost(
        17,
        reviewTarget,
        'approve',
        '42',
      ),
    ).toEqual(good);
    await expect(
      setup(good).service.reviewSocialPost(
        17,
        reviewTarget,
        'approve',
        'forged',
      ),
    ).rejects.toThrow();
    await expect(
      setup({
        ...good,
        channel_reviews: {
          facebook: {
            ...good.channel_reviews.facebook,
            approved_content_hash: undefined,
          },
        },
      }).service.reviewSocialPost(17, reviewTarget, 'approve', '42'),
    ).rejects.toThrow();
  });
  it('verifies saved publication and preserves the original actor on idempotent retry', async () => {
    const good = {
      id: 17,
      content_revision: 2,
      review_version: 5,
      publications: {
        facebook: {
          content_revision: 2,
          content_hash: publication.approved_content_hash,
          url: publication.url,
          declared_by: 'original',
          declared_at: '2026-10-16T12:00:00Z',
        },
      },
    };
    expect(
      await setup(good).service.declarePublication(17, publication, '42'),
    ).toEqual(good);
    await expect(
      setup({ ...good, publications: {} }).service.declarePublication(
        17,
        publication,
        '42',
      ),
    ).rejects.toThrow();
  });
});

describe('weekly planning storage truth', () => {
  it.each(['getRecentGammeIds', 'getTopSeoGammes'] as const)(
    '%s rejects an outage instead of returning an empty selection',
    async (method) => {
      await expect(
        setup(null, { message: 'outage' }).service[method](),
      ).rejects.toThrow();
    },
  );
  it.each(['getRecentGammeIds', 'getTopSeoGammes'] as const)(
    '%s accepts an actually empty result',
    async (method) => {
      await expect(setup([], null).service[method]()).resolves.toEqual([]);
    },
  );
  it('distinguishes an unknown alias from a failed lookup', async () => {
    const absent = setup(null);
    await expect(
      absent.service.resolveGammeAlias('unknown'),
    ).resolves.toBeNull();
    expect(absent.query.maybeSingle).toHaveBeenCalledTimes(1);
    await expect(
      setup(null, { message: 'outage' }).service.resolveGammeAlias('known'),
    ).rejects.toThrow();
  });
  it('does not claim measured traffic from SEO content presence', async () => {
    const { service, query } = setup(null);
    query.from.mockImplementation(
      (table: string) =>
        setup(
          table === '__seo_gamme'
            ? [{ gamme_id: 1, sg_title: 'Plaquettes' }]
            : [
                {
                  pg_id: 1,
                  pg_alias: 'plaquette-de-frein',
                  pg_name: 'Plaquettes',
                },
              ],
        ).query,
    );
    await expect(service.getTopSeoGammes()).resolves.toEqual([
      {
        pg_id: 1,
        pg_alias: 'plaquette-de-frein',
        pg_name: 'Plaquettes',
        reason: 'seo_content',
      },
    ]);
  });
  it('does not hide a catalogue outage after a successful SEO lookup', async () => {
    const { service, query } = setup(null);
    query.from.mockImplementation((table: string) =>
      table === '__seo_gamme'
        ? setup([{ gamme_id: 1, sg_title: 'Plaquettes' }]).query
        : setup(null, { message: 'catalogue outage' }).query,
    );
    await expect(service.getTopSeoGammes()).rejects.toThrow();
  });
  it.each([
    [null, { message: 'write outage' }],
    [null, null],
    [{ week_iso: '2026-W43' }, null],
    [{ id: 17, week_iso: '2026-W42' }, null],
  ])('rejects an unconfirmed plan write (%j)', async (data, error) => {
    await expect(
      setup(data, error).service.upsertWeeklyPlan({ week_iso: '2026-W43' }),
    ).rejects.toThrow();
  });
  it('returns the confirmed plan for the requested week', async () => {
    const plan = { id: 17, week_iso: '2026-W43', status: 'draft' };
    await expect(
      setup(plan).service.upsertWeeklyPlan({ week_iso: plan.week_iso }),
    ).resolves.toEqual(plan);
  });
});
