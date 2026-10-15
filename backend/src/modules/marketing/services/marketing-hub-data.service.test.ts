import { Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { MarketingHubDataService } from './marketing-hub-data.service';

/** Real installed PostgREST query builder, with an in-memory HTTP boundary. */
function setup(body: unknown, status = 200) {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const client = createClient(
    'http://127.0.0.1:54321',
    'unit-test-placeholder',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, init) => {
          requests.push({ url: new URL(String(input)), init });
          return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    },
  );
  // Avoid the base constructor, which reads production connection configuration.
  const service: MarketingHubDataService = Object.create(
    MarketingHubDataService.prototype,
  );
  Object.defineProperties(service, {
    supabase: { value: client },
    logger: { value: new Logger('MarketingContractTest') },
  });
  return { service, requests };
}

describe('marketing persistence results', () => {
  it.each([
    ['40001', 'RESOURCE.CONFLICT'],
    ['P0002', 'RESOURCE.NOT_FOUND'],
    ['23514', 'VALIDATION.FAILED'],
    ['42501', 'DATABASE.OPERATION_FAILED'],
  ])('propagates review error %s honestly', async (code, expected) => {
    const { service } = setup({ code, message: 'rejected' }, 400);
    await expect(
      service.reviewSocialPost(
        7,
        { channel: 'facebook', content_revision: 2, review_version: 3 },
        'approve',
        '42',
      ),
    ).rejects.toMatchObject({ code: expected });
  });

  it('sends an atomic RPC with both counters and checks the persisted decision', async () => {
    const { service, requests } = setup({
      id: 7,
      content_revision: 2,
      review_version: 4,
      channel_reviews: {
        facebook: { content_revision: 2, state: 'approved', actor: '42' },
      },
    });
    await service.reviewSocialPost(
      7,
      { channel: 'facebook', content_revision: 2, review_version: 3 },
      'approve',
      '42',
    );
    expect(requests[0].url.pathname).toBe(
      '/rest/v1/rpc/review_marketing_social_post',
    );
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      p_post_id: 7,
      p_channel: 'facebook',
      p_content_revision: 2,
      p_review_version: 3,
      p_action: 'approve',
      p_actor: '42',
      p_gate: null,
    });
  });

  it('does not treat an invalid RPC response as an approval', async () => {
    const { service } = setup({
      id: 7,
      content_revision: 2,
      review_version: 3,
      channel_reviews: {},
    });
    await expect(
      service.reviewSocialPost(
        7,
        { channel: 'facebook', content_revision: 2, review_version: 3 },
        'approve',
        '42',
      ),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });

  it('queries secondary networks instead of requiring the primary channel', async () => {
    const { service, requests } = setup([]);
    await service.getApprovedPostsByChannel('2026-W42', 'facebook');
    expect(requests[0].url.searchParams.has('primary_channel')).toBe(false);
    expect(requests[0].url.searchParams.get('channels_list')).toBe(
      'cs.{facebook}',
    );
    expect(
      requests[0].url.searchParams.get('channel_reviews->facebook->>state'),
    ).toBe('eq.approved');
  });
  it.each(['resolveGammeAlias', 'getTopSeoGammes'] as const)(
    'propagates source failures from %s',
    async (operation) => {
      const { service } = setup({ code: '42501', message: 'forbidden' }, 403);
      await expect(
        operation === 'resolveGammeAlias'
          ? service.resolveGammeAlias('frein')
          : service.getTopSeoGammes(),
      ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
    },
  );

  it('preserves a genuinely absent gamme', async () => {
    const { service } = setup([]);
    expect(await service.resolveGammeAlias('missing')).toBeNull();
  });

  it('preserves a genuinely empty week', async () => {
    const { service } = setup([]);
    expect(await service.getPostsByWeek('2026-W42')).toEqual([]);
  });

  it.each(['42501', '42P01', 'PGRST205'])(
    'does not disguise source error %s as an empty week',
    async (code) => {
      const { service } = setup(
        { code, message: 'test source unavailable' },
        403,
      );
      await expect(service.getPostsByWeek('2026-W42')).rejects.toMatchObject({
        code: 'DATABASE.OPERATION_FAILED',
      });
    },
  );

  it('does not report an update when no row was affected', async () => {
    const { service } = setup([]);
    expect(await service.updatePostStatus(999, 'draft')).toBe(false);
  });

  it('preserves a positive update and requests its affected row', async () => {
    const { service, requests } = setup([{ id: 7 }]);
    expect(await service.updatePostStatus(7, 'draft')).toBe(true);
    expect(requests[0].url.searchParams.get('id')).toBe('eq.7');
    expect(requests[0].url.searchParams.get('select')).toBe('id');
  });

  it('never lets an empty rules result hide a permission error', async () => {
    const { service } = setup({ code: '42501', message: 'forbidden' }, 403);
    await expect(service.getActiveBrandRules('facebook')).rejects.toMatchObject(
      { code: 'DATABASE.OPERATION_FAILED' },
    );
  });

  it('does not claim gate persistence for an absent post', async () => {
    const { service } = setup([]);
    const summary = {
      can_approve: false,
      brand: {
        level: 'FAIL' as const,
        violations: [],
        warnings: [],
        fix_suggestions: [],
      },
      compliance: { level: 'FAIL' as const, checks: [] },
      blocking_issues: ['blocked'],
    };
    await expect(
      service.reviewSocialPost(
        999,
        { channel: 'facebook', content_revision: 1, review_version: 0 },
        'gate',
        '42',
        summary,
      ),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });
});
