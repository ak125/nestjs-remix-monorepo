/**
 * ConseilEnricherService (R3) — RAG-sourced writes are refused, never reach the served tables.
 *
 * R3 enriches conseil pages from the decommissioned legacy RAG corpus (gammes/*.md,
 * ADR-031/046). Two write paths must stop reaching served `__seo_*` tables:
 *  - `writeSeoDescripDraft()` → single-row write to `__seo_gamme`; routed through
 *    ContentWriteGateService stamped `provenance = RAG_LEGACY`, which the gate refuses.
 *  - `writeSections()` → composite-key (`sgc_pg_id, sgc_section_type`), multi-row
 *    upsert into `__seo_gamme_conseil` that the single-row gate cannot model; the same
 *    canonical `isLegacyRagTier` refusal predicate is enforced at the write boundary, so
 *    no upsert is issued.
 * writeGate is a required (non-@Optional) dependency — no fail-open direct-write fallback.
 */
import { ConseilEnricherService } from './conseil-enricher.service';
import { SOURCE_TIER } from '../../../config/source-provenance.constants';
import type { ConfigService } from '@nestjs/config';
import type { ContentWriteGateService } from '../../../config/content-write-gate.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

function makeR3(writeGate: unknown): ConseilEnricherService {
  const config = {
    get: () => 'https://example.supabase.co',
  } as unknown as ConfigService;
  return new ConseilEnricherService(
    config,
    {} as never, // ragService
    { briefAwareEnabled: false, writeGuardEnabled: true } as never, // flags
    { restoreAccents: (s: string) => s } as never, // textUtils
    {} as never, // yamlParser
    {} as never, // ragMdMerger
    writeGate as ContentWriteGateService,
  );
}

describe('ConseilEnricherService (R3) — RAG writes refused', () => {
  it('writeSeoDescripDraft routes through the gate with provenance=RAG_LEGACY (refused)', async () => {
    const writeToTarget = jest.fn().mockResolvedValue({
      written: false,
      reason: 'rag_provenance_refused',
      fieldsWritten: [],
      fieldsSkipped: [],
      fieldsStripped: [],
      mergeDetails: [],
    });
    const service = makeR3({ writeToTarget });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).writeSeoDescripDraft(
      '123',
      {
        intro: {
          role: 'Le filtre à huile protège le moteur en retenant les impuretés',
        },
      },
      'freinage',
      'Filtres à huile',
    );

    expect(writeToTarget).toHaveBeenCalledTimes(1);
    expect(writeToTarget.mock.calls[0][0]).toMatchObject({
      provenance: SOURCE_TIER.RAG_LEGACY,
      target: 'seo_gamme_main',
      roleId: 'R3_CONSEILS',
    });
  });

  it('writeSeoDescripDraft has NO fail-open fallback — a gate error propagates', async () => {
    const service = makeR3({
      writeToTarget: jest.fn().mockRejectedValue(new Error('gate down')),
    });

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).writeSeoDescripDraft(
        '1',
        {
          intro: {
            role: 'Le filtre à huile protège le moteur en retenant les impuretés',
          },
        },
        'x',
        'Filtres',
      ),
    ).rejects.toThrow('gate down');
  });

  it('writeSections refuses RAG-sourced conseil sections — no upsert to the served table', async () => {
    const service = makeR3({ writeToTarget: jest.fn() });
    const actions = [
      { action: 'create', type: 'META', content: 'x', title: 't', order: 1 },
    ];

    // If the refusal did not short-circuit, `.from()` on the mocked client (`{}`)
    // would throw — reaching {created:0,updated:0} proves the served table is untouched.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await (service as any).writeSections(
      '123',
      'freinage',
      actions,
      new Map(),
    );

    expect(outcome).toEqual({ created: 0, updated: 0 });
  });
});
