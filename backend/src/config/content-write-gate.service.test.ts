/**
 * ContentWriteGateService — RAG-provenance refusal (fail-closed).
 *
 * Canon: ADR-031/046 — RAG = chatbot retrieval only; no RAG-sourced content may
 * reach a served __seo_* table. This mirrors the already-shipped R4/R5 refusal
 * shape (execution-router.service.ts:377-388/418-427: status:'failed', 0 rows,
 * "pas de fallback d'insert générique — échec explicite, jamais silencieux").
 *
 * The refusal is the FIRST step of writeToTarget() and returns before any
 * Supabase call, so these tests are hermetic (createClient is mocked; the
 * mock client is never queried on the refusal path).
 */
import { ContentWriteGateService } from './content-write-gate.service';
import { SOURCE_TIER } from './source-provenance.constants';
import type { ConfigService } from '@nestjs/config';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

function makeGate(): ContentWriteGateService {
  const config = {
    get: () => 'https://example.supabase.co',
  } as unknown as ConfigService;
  // The 5 collaborators are never touched on the refusal path.
  return new ContentWriteGateService(
    config,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('ContentWriteGateService — RAG provenance refusal (fail-closed)', () => {
  it('refuses a write whose provenance is legacy-RAG, writing zero fields', async () => {
    const gate = makeGate();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await gate.writeToTarget({
      roleId: 'R1_ROUTER',
      target: 'seo_gamme_main',
      pkValue: '123',
      payload: { sg_content_draft: 'from RAG' },
      correlationId: 'test-rag-refusal',
      provenance: SOURCE_TIER.RAG_LEGACY,
    } as any);

    expect(result.written).toBe(false);
    expect(result.reason).toBe('rag_provenance_refused');
    expect(result.fieldsWritten).toEqual([]);
  });

  it('refuses the bare historical "rag" tier as well, BEFORE the unknown_target check (refusal is the first step)', async () => {
    const gate = makeGate();

    // Nonexistent target: without the refusal this returns 'unknown_target'.
    // With the refusal it must return 'rag_provenance_refused' — proving order.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await gate.writeToTarget({
      roleId: 'R1_ROUTER',
      target: 'does_not_exist_group',
      pkValue: '1',
      payload: { anything: 1 },
      correlationId: 'test-order',
      provenance: 'rag',
    } as any);

    expect(result.reason).toBe('rag_provenance_refused');
  });

  it('does NOT refuse when provenance is absent — backward-compat, existing callers unaffected', async () => {
    const gate = makeGate();

    // No provenance + nonexistent target ⇒ proceeds past the rag step and
    // returns unknown_target (hermetic: returns before any Supabase call).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await gate.writeToTarget({
      roleId: 'R1_ROUTER',
      target: 'does_not_exist_group',
      pkValue: '1',
      payload: { anything: 1 },
      correlationId: 'test-compat',
    } as any);

    expect(result.reason).toBe('unknown_target');
    expect(result.reason).not.toBe('rag_provenance_refused');
  });
});
