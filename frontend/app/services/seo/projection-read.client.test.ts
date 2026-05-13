/**
 * Tests Remix client projection-read.
 *
 * Verifie le contract critique : JAMAIS de throw, JAMAIS de blocage,
 * fallback null sur toute erreur (network / timeout / 4xx / 5xx / payload invalide).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fetchActiveProjection,
  logShadowDrift,
  ProjectionPayloadSchema,
} from './projection-read.client';


const CLIENT_SRC = join(__dirname, 'projection-read.client.ts');


function validPayload(overrides: Record<string, unknown> = {}): unknown {
  return {
    entity_id: 'gamme:filtre-a-huile',
    entity_type: 'gamme',
    slug: 'filtre-a-huile',
    projection_contract_version: '1.0.0',
    facts: { material: 'cellulose' },
    blocks: [
      {
        role: 'R3_CONSEILS',
        section: null,
        content_md: 'body',
        content_hash: 'sha256:' + 'a'.repeat(64),
      },
    ],
    sources: [],
    fetched_at: '2026-05-13T20:00:00Z',
    ...overrides,
  };
}


function mockFetch(response: { ok: boolean; status?: number; body: unknown }): typeof fetch {
  return (async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body,
  })) as unknown as typeof fetch;
}


describe('fetchActiveProjection — contract', () => {
  it('returns payload on success', async () => {
    const f = mockFetch({
      ok: true,
      body: { status: 'success', payload: validPayload(), error: null },
    });
    const result = await fetchActiveProjection('gamme:filtre-a-huile', { fetchImpl: f });
    expect(result?.entity_id).toBe('gamme:filtre-a-huile');
  });

  it('returns null on status=empty', async () => {
    const f = mockFetch({
      ok: true,
      body: { status: 'empty', payload: null, error: null },
    });
    expect(await fetchActiveProjection('gamme:unknown', { fetchImpl: f })).toBeNull();
  });

  it('returns null on status=rpc_failed (backend GrowthBook down equivalent)', async () => {
    const f = mockFetch({
      ok: true,
      body: { status: 'rpc_failed', payload: null, error: 'down' },
    });
    expect(await fetchActiveProjection('gamme:filtre-a-huile', { fetchImpl: f })).toBeNull();
  });

  it('returns null on 4xx', async () => {
    const f = mockFetch({ ok: false, status: 400, body: {} });
    expect(await fetchActiveProjection('gamme:filtre-a-huile', { fetchImpl: f })).toBeNull();
  });

  it('returns null on 5xx', async () => {
    const f = mockFetch({ ok: false, status: 503, body: {} });
    expect(await fetchActiveProjection('gamme:filtre-a-huile', { fetchImpl: f })).toBeNull();
  });

  it('returns null on malformed payload (Zod validation fails)', async () => {
    const f = mockFetch({
      ok: true,
      body: { status: 'success', payload: { invalid: 'shape' }, error: null },
    });
    expect(await fetchActiveProjection('gamme:filtre-a-huile', { fetchImpl: f })).toBeNull();
  });

  it('returns null on network error (fetch throws)', async () => {
    const f = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await fetchActiveProjection('gamme:filtre-a-huile', { fetchImpl: f })).toBeNull();
  });

  it('returns null on invalid entity_id (defense en profondeur)', async () => {
    const f = mockFetch({
      ok: true,
      body: { status: 'success', payload: validPayload(), error: null },
    });
    expect(await fetchActiveProjection('support:retours', { fetchImpl: f })).toBeNull();
    expect(await fetchActiveProjection('gammes:filtre-a-huile', { fetchImpl: f })).toBeNull();
  });

  it('NEVER throws (contract architectural)', async () => {
    const f = (async () => {
      throw new Error('catastrophic');
    }) as unknown as typeof fetch;
    await expect(fetchActiveProjection('gamme:x', { fetchImpl: f })).resolves.toBeNull();
  });

  it('passes role query param when provided', async () => {
    let capturedUrl = '';
    const f = (async (input: string) => {
      capturedUrl = input;
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', payload: validPayload(), error: null }),
      };
    }) as unknown as typeof fetch;
    await fetchActiveProjection('gamme:filtre-a-huile', {
      fetchImpl: f,
      role: 'R3_CONSEILS',
      apiBaseUrl: 'http://backend',
    });
    expect(capturedUrl).toContain('role=R3_CONSEILS');
    expect(capturedUrl).toContain('/api/seo-projection/');
  });
});


describe('ProjectionPayloadSchema Zod (frontend mirror)', () => {
  it('accepts valid payload', () => {
    expect(ProjectionPayloadSchema.safeParse(validPayload()).success).toBe(true);
  });

  it('rejects support entity_type', () => {
    expect(
      ProjectionPayloadSchema.safeParse(
        validPayload({
          entity_id: 'support:retours',
          entity_type: 'support',
          slug: 'retours',
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects extra fields', () => {
    expect(
      ProjectionPayloadSchema.safeParse({ ...(validPayload() as object), extra: 'oops' }).success,
    ).toBe(false);
  });
});


describe('logShadowDrift', () => {
  it('emits JSON line with seo_projection_shadow_drift event', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logShadowDrift('gamme:x', { content_hash: 'sha256:abc' }, { content_hash: 'sha256:def' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('seo_projection_shadow_drift'));
    const arg = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.entity_id).toBe('gamme:x');
    expect(parsed.has_projection).toBe(true);
    expect(parsed.has_legacy).toBe(true);
    spy.mockRestore();
  });
});


describe('PR-7b architectural guards (frontend client)', () => {
  const src = readFileSync(CLIENT_SRC, 'utf-8');

  it('NEVER imports Supabase JS (frontend client must HTTP only)', () => {
    expect(src).not.toMatch(/from '@supabase\/supabase-js'/);
    expect(src).not.toMatch(/createClient\(/);
  });

  it('NEVER imports LLM SDKs', () => {
    const forbidden = ["from 'anthropic'", "from 'openai'", "from 'groq-sdk'"];
    for (const needle of forbidden) {
      expect(src).not.toContain(needle);
    }
  });

  it('NEVER references __seo_entity_ or mv_seo_ table names', () => {
    // Strip comments+docstrings : keep code only
    const code = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/__seo_entity_/);
    expect(code).not.toMatch(/__seo_projection_/);
    expect(code).not.toMatch(/mv_seo_/);
  });

  it('uses fetch HTTP (not Supabase rpc)', () => {
    expect(src).toMatch(/fetchImpl\s*\(/);
    expect(src).not.toMatch(/\.rpc\(/);
  });
});


// Vitest globals fallback
declare const vi: typeof import('vitest').vi;
