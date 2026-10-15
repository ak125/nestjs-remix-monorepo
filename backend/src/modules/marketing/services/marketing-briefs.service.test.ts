import { createClient } from '@supabase/supabase-js';
import { MarketingBriefsService } from './marketing-briefs.service';

function setup(body: unknown, status = 200, count?: number) {
  const requests: URL[] = [];
  const client = createClient('http://127.0.0.1:54321', 'test-placeholder', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url) => {
        requests.push(new URL(String(url)));
        return new Response(JSON.stringify(body), {
          status,
          headers: {
            'Content-Type': 'application/json',
            ...(count === undefined ? {} : { 'Content-Range': `*/${count}` }),
          },
        });
      },
    },
  });
  const service: MarketingBriefsService = Object.create(
    MarketingBriefsService.prototype,
  );
  Object.defineProperties(service, {
    supabase: { value: client },
    logger: { value: { error: jest.fn(), warn: jest.fn() } },
  });
  return { service, requests };
}

describe('brief reads distinguish absence from unavailable data', () => {
  it.each(['42P01', '42501', 'PGRST205'])(
    'does not turn %s into zero statistics',
    async (code) => {
      await expect(
        setup(
          { code, message: 'private database detail' },
          400,
        ).service.getBriefStats(),
      ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
    },
  );
  it('returns genuine zero statistics for a complete empty result', async () => {
    expect(await setup([], 200, 0).service.getBriefStats()).toEqual({
      total: 0,
      by_status: {},
      by_business_unit: {},
    });
  });
  it('counts complete rows by status and business unit', async () => {
    expect(
      await setup(
        [
          { status: 'draft', business_unit: 'LOCAL' },
          { status: 'approved', business_unit: 'ECOMMERCE' },
          { status: 'draft', business_unit: 'LOCAL' },
        ],
        200,
        3,
      ).service.getBriefStats(),
    ).toEqual({
      total: 3,
      by_status: { draft: 2, approved: 1 },
      by_business_unit: { LOCAL: 2, ECOMMERCE: 1 },
    });
  });
  it.each([
    [[{ status: 'draft', business_unit: 'LOCAL' }], 1001],
    [[], undefined],
    [null, 0],
    [[{ status: '__proto__', business_unit: 'LOCAL' }], 1],
  ])('refuses incomplete or malformed statistics %#', async (rows, count) => {
    await expect(
      setup(rows, 200, count as number | undefined).service.getBriefStats(),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });
  it('returns not found only for an absent detail', async () => {
    await expect(
      setup([]).service.getBriefById('absent'),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('does not turn a detail storage error into a missing brief', async () => {
    await expect(
      setup({ code: '42P01' }, 400).service.getBriefById('brief'),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED', status: 500 });
  });
  it('keeps a successful detail', async () => {
    const row = { id: 'brief' };
    expect(await setup([row]).service.getBriefById('brief')).toEqual(row);
  });
  it('returns genuine empty pages and exact count', async () => {
    expect(await setup([], 200, 0).service.listBriefs({})).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  });
  it('does not expose database details in a list error', async () => {
    const result = setup(
      { code: '42P01', message: 'private database detail' },
      400,
    ).service.listBriefs({});
    await expect(result).rejects.toMatchObject({
      code: 'DATABASE.OPERATION_FAILED',
    });
    await expect(result).rejects.not.toThrow('private database detail');
  });
  it('does not fabricate zero when the exact list count is missing', async () => {
    await expect(setup([]).service.listBriefs({})).rejects.toMatchObject({
      code: 'DATABASE.OPERATION_FAILED',
    });
  });
});
