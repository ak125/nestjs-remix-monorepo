/**
 * SeoShadowPurgeCron — purge `__seo_event_log` 30j + READ_ONLY gate au processor.
 *
 * @see backend/src/modules/seo-shadow-observatory/seo-shadow-purge.cron.ts
 */
import { ConfigService } from '@nestjs/config';

import { SeoShadowPurgeCron } from '../../src/modules/seo-shadow-observatory/seo-shadow-purge.cron';

interface SupabaseSpy {
  from: jest.Mock;
  delete: jest.Mock;
  like: jest.Mock;
  lt: jest.Mock;
  select: jest.Mock;
  __lastFilter?: { table?: string; deleteCalled?: boolean; like?: [string, string]; lt?: [string, string] };
}

function buildSupabaseStub(returns: { data?: unknown; error?: unknown; count?: number }) {
  const builder: SupabaseSpy = {
    from: jest.fn(),
    delete: jest.fn(),
    like: jest.fn(),
    lt: jest.fn(),
    select: jest.fn(),
    __lastFilter: {},
  };
  builder.from.mockImplementation((table: string) => {
    builder.__lastFilter!.table = table;
    return builder;
  });
  builder.delete.mockImplementation(() => {
    builder.__lastFilter!.deleteCalled = true;
    return builder;
  });
  builder.like.mockImplementation((col: string, pattern: string) => {
    builder.__lastFilter!.like = [col, pattern];
    return builder;
  });
  builder.lt.mockImplementation((col: string, value: string) => {
    builder.__lastFilter!.lt = [col, value];
    return builder;
  });
  builder.select.mockResolvedValue(returns);
  return builder;
}

function buildCron(env: Record<string, string | undefined>, supabaseStub: SupabaseSpy): SeoShadowPurgeCron {
  process.env = { ...process.env, ...env };
  const cfg = {
    get: <T = string>(key: string): T | undefined => env[key] as T | undefined,
  } as unknown as ConfigService;
  const cron = new SeoShadowPurgeCron(cfg);
  // @ts-expect-error swap supabase client par notre stub
  cron['supabase'] = { from: supabaseStub.from };
  return cron;
}

describe('SeoShadowPurgeCron', () => {
  it('READ_ONLY=true → no-op (pas de query DELETE émise)', async () => {
    const supa = buildSupabaseStub({ data: [], error: null, count: 0 });
    const cron = buildCron({ READ_ONLY: 'true', SUPABASE_URL: 'http://x' }, supa);
    const result = await cron.purgeOldEvents();
    expect(result).toEqual({ deleted: 0, skipped: 'read_only' });
    expect(supa.from).not.toHaveBeenCalled();
    expect(supa.delete).not.toHaveBeenCalled();
  });

  it('WHERE clause cible strictement seo.shadow.%.divergence', async () => {
    const supa = buildSupabaseStub({ data: [{ id: '1' }, { id: '2' }], error: null, count: 2 });
    const cron = buildCron({ SUPABASE_URL: 'http://x' }, supa);
    await cron.purgeOldEvents();
    expect(supa.__lastFilter?.like?.[0]).toBe('payload->>subtype');
    expect(supa.__lastFilter?.like?.[1]).toBe('seo.shadow.%.divergence');
  });

  it('cible la table __seo_event_log', async () => {
    const supa = buildSupabaseStub({ data: [], error: null, count: 0 });
    const cron = buildCron({ SUPABASE_URL: 'http://x' }, supa);
    await cron.purgeOldEvents();
    expect(supa.__lastFilter?.table).toBe('__seo_event_log');
  });

  it('cutoff = now - 30 jours', async () => {
    const FIXED_NOW = new Date('2026-06-01T12:00:00Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const supa = buildSupabaseStub({ data: [], error: null, count: 0 });
    const cron = buildCron({ SUPABASE_URL: 'http://x' }, supa);
    await cron.purgeOldEvents();
    const expectedCutoff = new Date(FIXED_NOW - 30 * 24 * 3600 * 1000).toISOString();
    expect(supa.__lastFilter?.lt?.[0]).toBe('created_at');
    expect(supa.__lastFilter?.lt?.[1]).toBe(expectedCutoff);
    jest.restoreAllMocks();
  });

  it('Supabase error → log + return deleted=0 (pas d’exception)', async () => {
    const supa = buildSupabaseStub({ data: null, error: { message: 'boom' }, count: null });
    const cron = buildCron({ SUPABASE_URL: 'http://x' }, supa);
    const result = await cron.purgeOldEvents();
    expect(result).toEqual({ deleted: 0 });
  });
});
