/**
 * Tests SeoProjectionRolloutService — advisory-only, circuit breaker, fallback.
 *
 * Garde-fous critiques (ADR-059) :
 *  - Runtime ne bloque JAMAIS sur lookup feature flag
 *  - Default deterministic = false (legacy path)
 *  - Circuit breaker : 3 failures → open 60s
 *  - Cache 5min advisory
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FALLBACK_DEFAULT_FLAG_VALUE,
  SeoProjectionRolloutService,
} from '../seo-projection-rollout.service';

const SERVICE_SRC = join(__dirname, '..', 'seo-projection-rollout.service.ts');

function makeService(): SeoProjectionRolloutService {
  const svc = new SeoProjectionRolloutService();
  // Logger stub (avoid Nest DI for unit tests)
  (
    svc as unknown as {
      rolloutLogger: { warn: jest.Mock; error: jest.Mock; log: jest.Mock };
    }
  ).rolloutLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
  return svc;
}

describe('SeoProjectionRolloutService — advisory-only contract', () => {
  it('FALLBACK_DEFAULT_FLAG_VALUE is false (legacy path)', () => {
    expect(FALLBACK_DEFAULT_FLAG_VALUE).toBe(false);
  });

  it('returns default=false when no lookup configured', async () => {
    const svc = makeService();
    const decision = await svc.getRolloutDecision();
    expect(decision.enabled).toBe(false);
    expect(decision.source).toBe('default');
  });

  it('returns live value when lookup succeeds', async () => {
    const svc = makeService();
    svc.setLookup(async () => true);
    const decision = await svc.getRolloutDecision();
    expect(decision.enabled).toBe(true);
    expect(decision.source).toBe('live');
  });

  it('uses cache when lookup fails but cache fresh', async () => {
    const svc = makeService();
    let succeed = true;
    svc.setLookup(async () => {
      if (succeed) return true;
      throw new Error('GrowthBook down');
    });
    // First call : cache populated with true
    await svc.getRolloutDecision();
    succeed = false;
    const decision = await svc.getRolloutDecision();
    expect(decision.enabled).toBe(true);
    expect(decision.source).toBe('cache');
    expect(decision.last_error).toMatch(/GrowthBook down/);
  });

  it('falls back to default=false when lookup fails and no cache', async () => {
    const svc = makeService();
    svc.setLookup(async () => {
      throw new Error('GrowthBook unavailable');
    });
    const decision = await svc.getRolloutDecision();
    expect(decision.enabled).toBe(false);
    expect(decision.source).toBe('default');
    expect(decision.last_error).toMatch(/GrowthBook unavailable/);
  });

  it('opens circuit breaker after 3 consecutive failures', async () => {
    const svc = makeService();
    svc.setLookup(async () => {
      throw new Error('persistent failure');
    });
    for (let i = 0; i < 3; i++) {
      await svc.getRolloutDecision();
    }
    // 4th call : circuit OPEN, should not call lookup
    const lookupSpy = jest.fn(async () => true);
    svc.setLookup(lookupSpy);
    const decision = await svc.getRolloutDecision();
    expect(lookupSpy).not.toHaveBeenCalled();
    expect(decision.source).toBe('circuit_open');
    expect(decision.enabled).toBe(false); // no fresh cache → default
  });

  it('NEVER throws even if lookup throws synchronously', async () => {
    const svc = makeService();
    svc.setLookup((() => {
      throw new Error('sync throw');
    }) as never);
    await expect(svc.getRolloutDecision()).resolves.toBeDefined();
  });
});

describe('PR-7b architectural guards (rollout service)', () => {
  const src = readFileSync(SERVICE_SRC, 'utf-8');

  it('declares deterministic fallback default false', () => {
    expect(src).toMatch(/FALLBACK_DEFAULT_FLAG_VALUE\s*=\s*false/);
  });

  it('has circuit breaker constants (anti runtime-critical dependency)', () => {
    expect(src).toMatch(/CIRCUIT_FAIL_THRESHOLD/);
    expect(src).toMatch(/CIRCUIT_OPEN_DURATION_MS/);
  });

  it('has 5min cache TTL per ADR-059', () => {
    expect(src).toMatch(/CACHE_TTL_MS\s*=\s*5\s*\*\s*60_000/);
  });

  it('NEVER imports LLM SDKs', () => {
    const forbidden = [
      "from 'anthropic'",
      "from '@anthropic-ai",
      "from 'openai'",
      "from 'groq-sdk'",
    ];
    for (const needle of forbidden) {
      expect(src).not.toContain(needle);
    }
  });

  it('NEVER imports Supabase JS (advisory service must not touch DB)', () => {
    expect(src).not.toMatch(/from '@supabase\/supabase-js'/);
    expect(src).not.toMatch(/SupabaseClient/);
  });
});
