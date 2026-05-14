/**
 * Unit tests for CruxApiClient (ADR-063 PR-3).
 *
 * Covers : graceful degrade, 200 OK Zod parse, 404, retry, circuit breaker.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CruxApiClient } from './crux-api-client.service';

const originalFetch = global.fetch;

function mockFetch(
  impl: (url: string, init: RequestInit) => Promise<Response>,
) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
}

const buildHistoryResponse = () => ({
  record: {
    key: { origin: 'https://www.automecanik.com', formFactor: 'PHONE' },
    metrics: {
      largest_contentful_paint: {
        percentilesTimeseries: { p75s: [2300, 2350, 2310] },
      },
      interaction_to_next_paint: {
        percentilesTimeseries: { p75s: [180, 190, 175] },
      },
      cumulative_layout_shift: {
        percentilesTimeseries: { p75s: ['0.08', '0.09', '0.07'] },
      },
      experimental_time_to_first_byte: {
        percentilesTimeseries: { p75s: [600, 620, 590] },
      },
      first_contentful_paint: {
        percentilesTimeseries: { p75s: [1500, 1550, 1480] },
      },
    },
    collectionPeriods: [
      {
        firstDate: { year: 2026, month: 4, day: 1 },
        lastDate: { year: 2026, month: 4, day: 28 },
      },
      {
        firstDate: { year: 2026, month: 4, day: 8 },
        lastDate: { year: 2026, month: 5, day: 5 },
      },
      {
        firstDate: { year: 2026, month: 4, day: 15 },
        lastDate: { year: 2026, month: 5, day: 12 },
      },
    ],
  },
});

async function buildClient(
  apiKey: string | undefined = 'test-key',
): Promise<CruxApiClient> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CruxApiClient,
      {
        provide: ConfigService,
        useValue: {
          get: (k: string) => (k === 'CRUX_API_KEY' ? apiKey : undefined),
        },
      },
    ],
  }).compile();
  return moduleRef.get(CruxApiClient);
}

describe('CruxApiClient', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('isAvailable false when CRUX_API_KEY missing', async () => {
    const client = await buildClient(undefined);
    expect(client.isAvailable()).toBe(false);
  });

  it('isAvailable true when key set and circuit closed', async () => {
    const client = await buildClient('test-key');
    expect(client.isAvailable()).toBe(true);
  });

  it('returns null status 0 with no API key (graceful degrade)', async () => {
    const client = await buildClient(undefined);
    const out = await client.fetchOriginHistory('https://x', 'PHONE');
    expect(out.response).toBeNull();
    expect(out.status).toBe(0);
    expect(out.attempts).toBe(0);
  });

  it('returns parsed response on 200 OK', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify(buildHistoryResponse()), { status: 200 }),
    );
    const client = await buildClient('test-key');
    const out = await client.fetchOriginHistory(
      'https://www.automecanik.com',
      'PHONE',
    );
    expect(out.response).not.toBeNull();
    expect(out.status).toBe(200);
    expect(out.attempts).toBe(1);
    expect(out.response?.record.collectionPeriods).toHaveLength(3);
  });

  it('returns null on 404 (origin not in CrUX)', async () => {
    mockFetch(async () => new Response('not found', { status: 404 }));
    const client = await buildClient('test-key');
    const out = await client.fetchOriginHistory('https://obscure', 'PHONE');
    expect(out.response).toBeNull();
    expect(out.status).toBe(404);
  });

  it('returns null on 200 OK but malformed body fails Zod parse', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ malformed: true }), { status: 200 }),
    );
    const client = await buildClient('test-key');
    const out = await client.fetchOriginHistory('https://x', 'PHONE');
    expect(out.response).toBeNull();
    expect(out.status).toBe(200);
  });

  describe('retry', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('retries on 5xx then succeeds', async () => {
      let n = 0;
      mockFetch(async () => {
        n++;
        if (n === 1) return new Response('boom', { status: 503 });
        return new Response(JSON.stringify(buildHistoryResponse()), {
          status: 200,
        });
      });
      const client = await buildClient('test-key');
      const p = client.fetchOriginHistory('https://x', 'PHONE');
      await jest.advanceTimersByTimeAsync(5_000);
      const out = await p;
      expect(out.status).toBe(200);
      expect(out.attempts).toBe(2);
    });

    it('gives up after 4 attempts on persistent 503', async () => {
      mockFetch(async () => new Response('boom', { status: 503 }));
      const client = await buildClient('test-key');
      const p = client.fetchOriginHistory('https://x', 'PHONE');
      await jest.advanceTimersByTimeAsync(5_000 + 30_000 + 120_000 + 1_000);
      const out = await p;
      expect(out.status).toBe(503);
      expect(out.attempts).toBe(4);
      expect(out.response).toBeNull();
    });
  });

  describe('circuit breaker', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('opens after 5 consecutive failures', async () => {
      mockFetch(async () => new Response('boom', { status: 503 }));
      const client = await buildClient('test-key');
      for (let i = 0; i < 5; i++) {
        const p = client.fetchOriginHistory('https://x', 'PHONE');
        await jest.advanceTimersByTimeAsync(5_000 + 30_000 + 120_000 + 1_000);
        await p;
      }
      const out = await client.fetchOriginHistory('https://x', 'PHONE');
      expect(out.status).toBe(0);
      expect(out.attempts).toBe(0);
      expect(client.isAvailable()).toBe(false);
    });
  });
});
