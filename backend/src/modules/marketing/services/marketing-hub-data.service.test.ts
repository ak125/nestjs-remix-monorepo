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
    expect(await service.updatePostGates(999, summary, 0)).toBe(false);
  });
});
