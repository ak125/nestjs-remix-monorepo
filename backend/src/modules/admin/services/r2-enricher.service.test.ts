/**
 * R2EnricherService — RAG-sourced keyword-plan writes are refused at the gate.
 *
 * R2 reads legacy RAG gamme docs; per ADR-031/046 that content must not reach the
 * served `__seo_r2_keyword_plan` table. `persistR2KeywordPlan()` routes every write
 * through ContentWriteGateService with `provenance = RAG_LEGACY`, which the gate
 * rejects (0 rows). No fail-open direct-upsert fallback (writeGate is required).
 */
import { R2EnricherService } from './r2-enricher.service';
import { SOURCE_TIER } from '../../../config/source-provenance.constants';
import type { ConfigService } from '@nestjs/config';
import type { ContentWriteGateService } from '../../../config/content-write-gate.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

function makeR2(writeGate: unknown): R2EnricherService {
  const config = {
    get: () => 'https://example.supabase.co',
  } as unknown as ConfigService;
  return new R2EnricherService(config, writeGate as ContentWriteGateService);
}

describe('R2EnricherService — RAG write refused at the gate', () => {
  it('routes the keyword-plan write through the gate with provenance=RAG_LEGACY and surfaces the refusal', async () => {
    const writeToTarget = jest.fn().mockResolvedValue({
      written: false,
      reason: 'rag_provenance_refused',
      fieldsWritten: [],
      fieldsSkipped: [],
      fieldsStripped: [],
      mergeDetails: [],
    });
    const service = makeR2({ writeToTarget });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await (service as any).persistR2KeywordPlan(
      '123',
      'veh-1',
      { r2kp_pg_id: '123' },
      72,
      3,
      [],
    );

    expect(writeToTarget).toHaveBeenCalledTimes(1);
    expect(writeToTarget.mock.calls[0][0]).toMatchObject({
      provenance: SOURCE_TIER.RAG_LEGACY,
      target: 'r2_product_main',
      roleId: 'R2_PRODUCT',
    });
    expect(outcome).toMatchObject({ status: 'skipped', sectionsGenerated: 3 });
    expect(outcome.qualityFlags).toContain('RAG_SOURCE_REFUSED');
  });

  it('has NO fail-open fallback — a gate error propagates, not swallowed by a direct upsert', async () => {
    const service = makeR2({
      writeToTarget: jest.fn().mockRejectedValue(new Error('gate down')),
    });

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).persistR2KeywordPlan(
        '1',
        undefined,
        { r2kp_pg_id: '1' },
        0,
        0,
        [],
      ),
    ).rejects.toThrow('gate down');
  });
});
