/**
 * Tests SeoProjectionReadAdapter — validation entrée/sortie + garde-fou architectural.
 *
 * Garde-fou critique (ADR-059 §"No Direct Page SQL") :
 *   L'adapter ne doit JAMAIS appeler `.from('__seo_entity_*')` ou
 *   `.from('__seo_projection_*')` directement. Uniquement `.rpc(...)`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ProjectionPayloadSchema,
  SeoProjectionReadAdapter,
} from '../seo-projection-read.adapter';


const ADAPTER_SRC = join(__dirname, '..', 'seo-projection-read.adapter.ts');


// Test instance sans wiring DI (méthodes testées sont pures ou mockent supabase)
function makeAdapter(rpcMock: jest.Mock): SeoProjectionReadAdapter {
  const adapter = Object.create(
    SeoProjectionReadAdapter.prototype,
  ) as SeoProjectionReadAdapter & { supabase: unknown };
  (adapter as unknown as { supabase: unknown }).supabase = { rpc: rpcMock };
  // Logger stub
  (adapter as unknown as { readLogger: { warn: jest.Mock; error: jest.Mock; log: jest.Mock } }).readLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
  return adapter;
}


function validRpcPayload(overrides: Record<string, unknown> = {}): unknown {
  return {
    entity_id: 'gamme:filtre-a-huile',
    entity_type: 'gamme',
    slug: 'filtre-a-huile',
    projection_contract_version: '1.0.0',
    facts: { material: 'cellulose', oem_compat: ['BMW', 'PSA'] },
    blocks: [
      {
        role: 'R3_CONSEILS',
        section: 'S2_DIAG',
        content_md: 'Filtre à huile retient particules.',
        content_hash: 'sha256:' + 'a'.repeat(64),
      },
    ],
    sources: [
      {
        id: 'bosch_fad_2020',
        type: 'specialist',
        confidence_base: 0.85,
        url: null,
      },
    ],
    fetched_at: '2026-05-13T20:50:00+00:00',
    ...overrides,
  };
}


// ────────────────────────────────────────────────────────────────────────────
// Zod schema validation
// ────────────────────────────────────────────────────────────────────────────

describe('ProjectionPayloadSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = ProjectionPayloadSchema.safeParse(validRpcPayload());
    expect(parsed.success).toBe(true);
  });

  it('rejects support entity_type', () => {
    const parsed = ProjectionPayloadSchema.safeParse(
      validRpcPayload({ entity_id: 'support:retours', entity_type: 'support', slug: 'retours' }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects plural entity_id', () => {
    const parsed = ProjectionPayloadSchema.safeParse(
      validRpcPayload({ entity_id: 'gammes:filtre-a-huile' }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects missing fields (additionalProperties strict)', () => {
    const payload = validRpcPayload() as Record<string, unknown>;
    delete payload.facts;
    const parsed = ProjectionPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('rejects extra fields', () => {
    const parsed = ProjectionPayloadSchema.safeParse({ ...(validRpcPayload() as object), extra: 'oops' });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid content_hash', () => {
    const parsed = ProjectionPayloadSchema.safeParse(
      validRpcPayload({
        blocks: [
          {
            role: 'R3_CONSEILS',
            section: null,
            content_md: 'x',
            content_hash: 'md5:deadbeef',
          },
        ],
      }),
    );
    expect(parsed.success).toBe(false);
  });
});


// ────────────────────────────────────────────────────────────────────────────
// getActiveProjection behaviour
// ────────────────────────────────────────────────────────────────────────────

describe('SeoProjectionReadAdapter.getActiveProjection', () => {
  it('returns success for valid payload', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: validRpcPayload(), error: null });
    const adapter = makeAdapter(rpc);
    const result = await adapter.getActiveProjection('gamme:filtre-a-huile');
    expect(result.status).toBe('success');
    expect(result.payload?.entity_id).toBe('gamme:filtre-a-huile');
    expect(rpc).toHaveBeenCalledWith('get_active_seo_projection', {
      p_entity_id: 'gamme:filtre-a-huile',
      p_role: null,
    });
  });

  it('returns empty when facts and blocks are empty', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: validRpcPayload({ facts: {}, blocks: [] }),
      error: null,
    });
    const adapter = makeAdapter(rpc);
    const result = await adapter.getActiveProjection('gamme:unknown-slug');
    expect(result.status).toBe('empty');
  });

  it('returns rpc_failed when RPC errors', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
    const adapter = makeAdapter(rpc);
    const result = await adapter.getActiveProjection('gamme:filtre-a-huile');
    expect(result.status).toBe('rpc_failed');
    expect(result.error).toContain('permission denied');
  });

  it('returns validation_failed for malformed payload', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { not_a_valid: 'payload' },
      error: null,
    });
    const adapter = makeAdapter(rpc);
    const result = await adapter.getActiveProjection('gamme:filtre-a-huile');
    expect(result.status).toBe('validation_failed');
  });

  it('refuses invalid entity_id before calling RPC', async () => {
    const rpc = jest.fn();
    const adapter = makeAdapter(rpc);
    const result = await adapter.getActiveProjection('support:retours');
    expect(result.status).toBe('validation_failed');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses plural entity_id before calling RPC', async () => {
    const rpc = jest.fn();
    const adapter = makeAdapter(rpc);
    const result = await adapter.getActiveProjection('gammes:filtre-a-huile');
    expect(result.status).toBe('validation_failed');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes role filter to RPC when provided', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: validRpcPayload(), error: null });
    const adapter = makeAdapter(rpc);
    await adapter.getActiveProjection('gamme:filtre-a-huile', { role: 'R3_CONSEILS' });
    expect(rpc).toHaveBeenCalledWith('get_active_seo_projection', {
      p_entity_id: 'gamme:filtre-a-huile',
      p_role: 'R3_CONSEILS',
    });
  });

  it('refuses malformed role before calling RPC', async () => {
    const rpc = jest.fn();
    const adapter = makeAdapter(rpc);
    const result = await adapter.getActiveProjection('gamme:filtre-a-huile', {
      role: 'invalid-role',
    });
    expect(result.status).toBe('validation_failed');
    expect(rpc).not.toHaveBeenCalled();
  });
});


// ────────────────────────────────────────────────────────────────────────────
// Architectural guards — adapter must use RPC, NEVER direct table SELECT
// ────────────────────────────────────────────────────────────────────────────

describe('PR-7a architectural guards', () => {
  const src = readFileSync(ADAPTER_SRC, 'utf-8');

  function codeOnly(text: string): string {
    return text
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
  }

  it('uses .rpc() — RPC path canonique', () => {
    expect(src).toMatch(/this\.supabase\.rpc\(['"]get_active_seo_projection['"]/);
  });

  it('NEVER calls .from() on projection tables directly (ADR-059 No Direct Page SQL)', () => {
    const code = codeOnly(src);
    const forbidden = [
      ".from('__seo_entity_facts')",
      ".from('__seo_entity_fact_versions')",
      ".from('__seo_entity_sources')",
      ".from('__seo_content_blocks')",
      ".from('__seo_content_block_versions')",
      ".from('__seo_projection_runs')",
      ".from('__seo_projection_conflicts')",
      '.from("__seo_entity_facts")',
      '.from("__seo_entity_sources")',
      '.from("__seo_content_blocks")',
      '.from("__seo_projection_runs")',
      '.from("__seo_projection_conflicts")',
      ".from('mv_seo_entity_facts_current')",
      ".from('mv_seo_content_blocks_current')",
      '.from("mv_seo_entity_facts_current")',
      '.from("mv_seo_content_blocks_current")',
    ];
    for (const needle of forbidden) {
      expect(code).not.toContain(needle);
    }
  });

  it('NEVER writes (no .insert/.update/.delete/.upsert)', () => {
    const code = codeOnly(src);
    expect(code).not.toMatch(/\.insert\(/);
    expect(code).not.toMatch(/\.update\(/);
    expect(code).not.toMatch(/\.delete\(/);
    expect(code).not.toMatch(/\.upsert\(/);
  });

  it('NEVER imports LLM SDKs', () => {
    const forbiddenImports = [
      "from 'anthropic'",
      "from '@anthropic-ai",
      "from 'openai'",
      "from 'groq-sdk'",
      "from 'cohere-ai'",
      "from 'mistralai'",
      "from '@google/generative-ai'",
    ];
    for (const needle of forbiddenImports) {
      expect(src).not.toContain(needle);
    }
  });

  it('NEVER writes wiki canon (no automecanik-wiki path in code)', () => {
    const code = codeOnly(src);
    expect(code).not.toMatch(/automecanik-wiki/);
    expect(code).not.toMatch(/\bgit\s+push\b/);
  });

  it('exposes ProjectionPayloadSchema strict (additionalProperties forbidden)', () => {
    expect(src).toMatch(/\.strict\(\)/);
  });

  it('declares Logger (observability for rpc_failed cases)', () => {
    expect(src).toMatch(/private readonly readLogger = new Logger/);
  });
});
