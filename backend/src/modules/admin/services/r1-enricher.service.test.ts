/**
 * R1EnricherService — RAG-sourced slot writes are refused at the governed gate.
 *
 * The R1 enricher reads legacy RAG gamme docs; per ADR-031/046 that content must
 * not reach the served `__seo_r1_gamme_slots` table. `persistR1Slots()` routes
 * every write through ContentWriteGateService with `provenance = RAG_LEGACY`,
 * which the gate refuses (0 rows). There is NO fail-open direct-upsert fallback
 * (writeGate is a required, non-@Optional dependency).
 */
import { R1EnricherService } from './r1-enricher.service';
import { SOURCE_TIER } from '../../../config/source-provenance.constants';
import type { ConfigService } from '@nestjs/config';
import type { ContentWriteGateService } from '../../../config/content-write-gate.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

function makeR1(writeGate: unknown): R1EnricherService {
  const config = {
    get: () => 'https://example.supabase.co',
  } as unknown as ConfigService;
  return new R1EnricherService(
    config,
    {} as never, // textUtils
    {} as never, // yamlParser
    writeGate as ContentWriteGateService,
  );
}

describe('R1EnricherService — RAG write refused at the gate', () => {
  it('routes the slot write through the gate with provenance=RAG_LEGACY and surfaces the refusal', async () => {
    const writeToTarget = jest.fn().mockResolvedValue({
      written: false,
      reason: 'rag_provenance_refused',
      fieldsWritten: [],
      fieldsSkipped: [],
      fieldsStripped: [],
      mergeDetails: [],
    });
    const service = makeR1({ writeToTarget });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await (service as any).persistR1Slots(
      '123',
      'freinage',
      { r1s_micro_seo: 'from RAG' },
      80,
      [],
    );

    expect(writeToTarget).toHaveBeenCalledTimes(1);
    expect(writeToTarget.mock.calls[0][0]).toMatchObject({
      provenance: SOURCE_TIER.RAG_LEGACY,
      target: 'r1_gamme_slots',
      roleId: 'R1_ROUTER',
    });
    // Gate refused ⇒ skipped, zero slots, RAG refusal surfaced (no silent fallback).
    expect(outcome).toMatchObject({ status: 'skipped', slotsWritten: 0 });
    expect(outcome.qualityFlags).toContain('RAG_SOURCE_REFUSED');
  });

  it('has NO fail-open fallback — a gate error propagates, it is not swallowed by a direct upsert', async () => {
    const service = makeR1({
      writeToTarget: jest.fn().mockRejectedValue(new Error('gate down')),
    });

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).persistR1Slots('1', 'x', { r1s_micro_seo: 'y' }, 50, []),
    ).rejects.toThrow('gate down');
  });
});
