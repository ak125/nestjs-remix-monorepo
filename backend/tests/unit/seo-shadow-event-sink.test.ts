/**
 * SeoShadowEventSink — write `__seo_event_log` + Sentry withScope.
 *
 * @see backend/src/modules/seo-shadow-observatory/seo-shadow-event-sink.service.ts
 */
import { ConfigService } from '@nestjs/config';

jest.mock('@sentry/nestjs', () => ({
  withScope: jest.fn((fn: (s: { setTag: jest.Mock; setExtra: jest.Mock }) => void) =>
    fn({ setTag: jest.fn(), setExtra: jest.fn() }),
  ),
  captureMessage: jest.fn(),
}));

import * as Sentry from '@sentry/nestjs';

import { SeoShadowEventSink } from '../../src/modules/seo-shadow-observatory/seo-shadow-event-sink.service';
import type { DiffResult } from '../../src/modules/seo-shadow-observatory/types';

function buildSupabaseStub() {
  const insert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn(() => ({ insert }));
  return { from, insert };
}

function buildSink(supabaseStub: { from: jest.Mock }): SeoShadowEventSink {
  const cfg = {
    get: (k: string) => (k === 'SUPABASE_URL' ? 'http://x' : undefined),
  } as unknown as ConfigService;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
  const sink = new SeoShadowEventSink(cfg);
  // @ts-expect-error swap supabase
  sink['supabase'] = { from: supabaseStub.from };
  return sink;
}

const baseDiff: DiffResult = {
  diffs: [
    {
      field: 'title',
      equal: true,
      legacyHash: 'aaa',
      chainHash: 'aaa',
      legacyLen: 3,
      chainLen: 3,
    },
  ],
  divergenceTypes: [],
  policyDivergence: false,
  summary: {
    surface: 'R7_BRAND_HUB',
    divergenceCount: 0,
    divergenceTypes: [],
  },
};

describe('SeoShadowEventSink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('insère event_type=anomaly_detected + payload.subtype=seo.shadow.r7.divergence (R7)', async () => {
    const supa = buildSupabaseStub();
    const sink = buildSink(supa);
    await sink.write('R7_BRAND_HUB', '42', 'https://x.test/y', baseDiff);
    expect(supa.from).toHaveBeenCalledWith('__seo_event_log');
    expect(supa.insert).toHaveBeenCalledTimes(1);
    const row = (supa.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row.event_type).toBe('anomaly_detected');
    expect((row.payload as Record<string, unknown>).subtype).toBe(
      'seo.shadow.r7.divergence',
    );
    expect((row.payload as Record<string, unknown>).schema_version).toBe(1);
    expect(row.entity_url).toBe('https://x.test/y');
  });

  it('mappe R8_VEHICLE → seo.shadow.r8.divergence', async () => {
    const supa = buildSupabaseStub();
    const sink = buildSink(supa);
    await sink.write('R8_VEHICLE', '999', 'https://x.test/v', baseDiff);
    const row = (supa.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect((row.payload as Record<string, unknown>).subtype).toBe(
      'seo.shadow.r8.divergence',
    );
  });

  it('severity=info quand policyDivergence=false', async () => {
    const supa = buildSupabaseStub();
    const sink = buildSink(supa);
    await sink.write('R7_BRAND_HUB', '1', 'https://x.test/', baseDiff);
    const row = (supa.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row.severity).toBe('info');
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('severity=medium + Sentry.withScope+captureMessage quand policyDivergence=true', async () => {
    const supa = buildSupabaseStub();
    const sink = buildSink(supa);
    await sink.write('R7_BRAND_HUB', '7', 'https://x.test/', {
      ...baseDiff,
      policyDivergence: true,
    });
    const row = (supa.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row.severity).toBe('medium');
    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect((Sentry.captureMessage as jest.Mock).mock.calls[0][1]).toBe('warning');
  });

  it('surface non mappée → throw', async () => {
    const supa = buildSupabaseStub();
    const sink = buildSink(supa);
    // R0_HOME est un SurfaceKey valide mais pas mappé dans SURFACE_SUBTYPE
    // (PR-6 = R7+R8 only). Ajout futur quand R0 est wiré.
    await expect(sink.write('R0_HOME', '1', 'https://x.test/', baseDiff))
      .rejects.toThrow(/non mappée/);
  });

  it('Supabase error → throw', async () => {
    const supa = {
      from: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({ error: { message: 'duplicate' } }),
      })),
    };
    const sink = buildSink(supa);
    await expect(
      sink.write('R7_BRAND_HUB', '1', 'https://x.test/', baseDiff),
    ).rejects.toThrow(/event_log insert failed/);
  });
});
