/**
 * Unit tests for CruxApiClient (ADR-063 PR-3).
 *
 * Minimal sync-only coverage (PR-3 dormant service) :
 *  - Graceful degrade when CRUX_API_KEY missing
 *  - isAvailable() reflects key presence
 *  - fetchOriginHistory returns null/status=0 without API key (no network call)
 *
 * Full coverage (HTTP retry, circuit breaker, Zod parse) deferred to PR-5
 * integration suite — fake-timers + native fetch combo causes CI timeouts.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CruxApiClient } from './crux-api-client.service';

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
});
