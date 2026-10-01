import { ConfigService } from '@nestjs/config';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { RoleId } from '../../../config/role-ids';
import { SOURCE_TIER } from '../../../config/source-provenance.constants';
import { BuyingGuideDbService } from './buying-guide';
import { BuyingGuideEnricherService } from './buying-guide-enricher.service';
import type { EnrichmentResult } from '../dto/buying-guide-enrich.dto';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

const faqSection = (ok: boolean) => ({
  ok,
  flags: [],
  content: [
    {
      question: 'Quand remplacer le filtre ?',
      answer: 'À chaque vidange, selon le carnet du constructeur.',
    },
  ],
  sources: ['gammes/filtre-a-huile.md'],
  confidence: 0.9,
  sourcesCitation: 'filtre-a-huile.md',
  rawAnswer: '',
});

function build(enabled: boolean, sectionOk: boolean) {
  const gate = new ContentWriteGateService(
    { get: () => 'http://127.0.0.1:9' } as unknown as ConfigService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { writeGuardEnabled: enabled } as never,
  );
  const writeToTarget = jest.spyOn(gate, 'writeToTarget');

  const writes: string[] = [];
  const from = jest.fn((table: string) => {
    if (table === 'pieces_gamme') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                pg_id: '7',
                pg_name: 'Filtre à huile',
                pg_alias: 'filtre-a-huile',
                pg_parent: '1',
                pg_level: 2,
              },
              error: null,
            }),
          }),
        }),
      };
    }
    const record = () => {
      writes.push(table);
      return { eq: async () => ({ error: null }) };
    };
    return { update: record, upsert: record, insert: record };
  });
  const db = Object.create(
    BuyingGuideDbService.prototype,
  ) as BuyingGuideDbService;
  Object.assign(db, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  Object.defineProperty(db, 'client', { value: { from } });

  const ragFetcher = {
    enrichFromRag: jest.fn(async () => ({
      sections: { faq: faqSection(sectionOk) },
      evidencePack: [],
      claims: [],
    })),
  };
  const qualityGates = {
    checkAntiWikiGate: jest.fn(() => ({ ok: true, reasons: [] })),
    computeGatekeeperScore: jest.fn(() => ({
      score: 90,
      flags: [],
      checks: {},
    })),
  };

  const svc = new BuyingGuideEnricherService(
    ragFetcher as never,
    qualityGates as never,
    db,
    gate,
  );
  return { svc, writeToTarget, writes, from };
}

describe('R6 buying-guide enrichment refuses legacy RAG at the real write gate', () => {
  it.each([true, false])(
    'content write: refusal, zero DB writes, writeGuardEnabled=%s',
    async (enabled) => {
      const { svc, writeToTarget, writes, from } = build(enabled, true);

      const [result] = (await svc.enrich(['7'], false)) as EnrichmentResult[];

      expect(result).toMatchObject({
        pgId: '7',
        updated: false,
        sectionsUpdated: 0,
        reason: 'rag_provenance_refused',
      });
      expect(result.skippedSections).toContain('RAG_SOURCE_REFUSED');
      expect(writeToTarget).toHaveBeenCalledTimes(1);
      expect(writeToTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          roleId: RoleId.R6_GUIDE_ACHAT,
          target: 'purchase_guide_main',
          pkValue: '7',
          provenance: SOURCE_TIER.RAG_LEGACY,
          payload: expect.objectContaining({
            sgpg_source_type: SOURCE_TIER.RAG_LEGACY,
            sgpg_faq: faqSection(true).content,
          }),
        }),
      );
      expect(writes).toEqual([]);
      expect(from.mock.calls.map(([table]) => table)).toEqual(['pieces_gamme']);
    },
  );

  it.each([true, false])(
    'gatekeeper-only write (all sections skipped): refusal too, writeGuardEnabled=%s',
    async (enabled) => {
      const { svc, writeToTarget, writes } = build(enabled, false);

      const [result] = (await svc.enrich(['7'], false)) as EnrichmentResult[];

      expect(result).toMatchObject({
        updated: false,
        sectionsUpdated: 0,
        reason: 'rag_provenance_refused',
        skippedSections: ['faq', 'RAG_SOURCE_REFUSED'],
      });
      expect(writeToTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          provenance: SOURCE_TIER.RAG_LEGACY,
          payload: expect.objectContaining({
            sgpg_gatekeeper_flags: ['ALL_SECTIONS_SKIPPED'],
          }),
        }),
      );
      expect(writes).toEqual([]);
    },
  );

  it('dryRun preview is unchanged and never reaches the write gate', async () => {
    const { svc, writeToTarget, writes } = build(true, true);

    const [preview] = await svc.enrich(['7'], true);

    expect(preview).toMatchObject({
      pgId: '7',
      gammeName: 'Filtre à huile',
      wouldUpdate: true,
    });
    expect(writeToTarget).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});
