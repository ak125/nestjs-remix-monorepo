import { BuyingGuideEnricherService } from './buying-guide-enricher.service';
import { BuyingGuideQualityGatesService } from './buying-guide/buying-guide-quality-gates.service';
import type { SectionValidationResult } from './buying-guide/buying-guide.types';

function section(content: unknown): SectionValidationResult {
  return {
    ok: true,
    flags: [],
    content,
    sources: ['fixture'],
    confidence: 0.9,
    sourcesCitation: 'Fixture only',
    rawAnswer: '',
  };
}
function fixture() {
  return {
    selection_criteria: section([
      {
        key: 'marque',
        label: 'Marque du véhicule',
        guidance: 'Vérifier la marque dans le catalogue constructeur.',
        priority: 'required',
      },
      {
        key: 'modele',
        label: 'Modèle du véhicule',
        guidance: 'Comparer le modèle exact avant de commander.',
        priority: 'required',
      },
      {
        key: 'moteur',
        label: 'Motorisation',
        guidance: 'Relever le code moteur pour vérifier la référence.',
        priority: 'required',
      },
      {
        key: 'reference',
        label: 'Référence OEM',
        guidance: 'Comparer la référence au catalogue de pièces.',
        priority: 'recommended',
      },
      {
        key: 'montage',
        label: 'Montage',
        guidance: 'Vérifier le montage documenté pour cette application.',
        priority: 'recommended',
      },
    ]),
    anti_mistakes: section([
      'Ne pas choisir au seul prix.',
      'Ne pas ignorer le code moteur.',
      'Ne pas mélanger deux références.',
      'Ne pas confondre les montages.',
    ]),
    decision_tree: section([
      { id: 'compatibilite', question: 'Référence compatible ?', options: [] },
    ]),
  };
}
function criteria(sections: ReturnType<typeof fixture>) {
  return sections.selection_criteria.content as Array<{
    key: string;
    label: string;
    guidance: string;
    priority: string;
  }>;
}
function harness(sections: Record<string, SectionValidationResult>) {
  const db = {
    fetchGammeMetadata: jest.fn().mockResolvedValue({
      gammeName: 'Filtre à huile',
      family: 'filtration',
      pgAlias: 'filtre-a-huile',
    }),
    buildUpdatePayload: jest.fn().mockReturnValue({
      sgpg_selection_criteria: sections.selection_criteria?.content,
    }),
    upsertBuyingGuide: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BuyingGuideEnricherService(
    {
      enrichFromRag: jest
        .fn()
        .mockResolvedValue({ sections, evidencePack: [], claims: [] }),
    } as never,
    new BuyingGuideQualityGatesService(),
    db as never,
    { writeGuardEnabled: false } as never,
  );
  return { db, service };
}

describe('Buying guide criteria quality at the write boundary', () => {
  const gates = new BuyingGuideQualityGatesService();

  it('accepts distinct criteria with useful guidance', () => {
    expect(gates.checkAntiWikiGate(fixture())).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it('blocks one copied label even among otherwise valid criteria, ignoring accents and punctuation', () => {
    const sections = fixture();
    criteria(sections)[0].guidance = '  MARQUE DU VEHICULE.  ';
    expect(gates.checkAntiWikiGate(sections)).toEqual({
      ok: false,
      reasons: [expect.stringContaining('GUIDANCE_COPIES_LABEL')],
    });
  });

  it('flags accent variants without deleting or merging their different guidance', () => {
    const sections = fixture();
    criteria(sections)[1].label = 'Marque du vehicule';
    const before = JSON.stringify(sections);
    expect(gates.checkAntiWikiGate(sections)).toEqual({
      ok: false,
      reasons: [expect.stringContaining('DUPLICATE_SELECTION_CRITERIA')],
    });
    expect(JSON.stringify(sections)).toBe(before);
  });

  it.each([
    null,
    { label: 42 },
    { key: 'empty', label: '  ', guidance: '  ', priority: 'required' },
    {
      tier_id: 'oe',
      label: 'Origine',
      description: 'Pièce d’origine',
      available: true,
    },
  ])(
    'reports malformed criteria instead of crashing or counting them as valid: %j',
    (item) => {
      const sections = fixture();
      (sections.selection_criteria.content as unknown[])[0] = item;
      expect(gates.checkAntiWikiGate(sections)).toEqual({
        ok: false,
        reasons: [expect.stringContaining('INVALID_SELECTION_CRITERIA')],
      });
    },
  );

  it('cannot write a preview-rejected guide even with a score of 100', async () => {
    const sections = fixture();
    for (const criterion of criteria(sections))
      criterion.guidance = criterion.label;
    const { service, db } = harness(sections);
    const [preview] = await service.enrich(['7'], true);
    expect(preview).toMatchObject({
      qualityScore: 100,
      wouldUpdate: false,
      antiWikiGate: { ok: false },
    });
    const [execution] = await service.enrich(['7'], false);
    expect(execution).toMatchObject({ updated: false, sectionsUpdated: 0 });
    expect(db.buildUpdatePayload).not.toHaveBeenCalled();
    expect(db.upsertBuyingGuide).not.toHaveBeenCalled();
  });

  it('blocks low-score content even when the anti-wiki checks pass', async () => {
    const sections = fixture();
    sections.selection_criteria.flags = [
      'GENERIC_PHRASES',
      'MISSING_REQUIRED_TERMS',
      'TOO_SHORT',
      'CONTENT_OVERLAP',
    ];
    const { service, db } = harness(sections);
    const [preview] = await service.enrich(['7'], true);
    expect(preview).toMatchObject({
      wouldUpdate: false,
      antiWikiGate: { ok: true },
    });
    const [execution] = await service.enrich(['7'], false);
    expect(execution).toMatchObject({ updated: false });
    expect(db.upsertBuyingGuide).not.toHaveBeenCalled();
  });

  it('returns the same blocking diagnostics in preview and execution for an accented duplicate', async () => {
    const sections = fixture();
    criteria(sections)[1].label = 'Marque du vehicule';
    const { service, db } = harness(sections);
    const [preview] = await service.enrich(['7'], true);
    const [execution] = await service.enrich(['7'], false);
    expect(preview).toMatchObject({ wouldUpdate: false });
    expect(execution).toMatchObject({
      updated: false,
      qualityScore: preview.qualityScore,
      antiWikiGate: preview.antiWikiGate,
      skippedSections: Object.keys(sections),
    });
    expect(db.upsertBuyingGuide).not.toHaveBeenCalled();
  });

  it('retains the metadata-only diagnostic path when all sections were rejected', async () => {
    const sections = fixture();
    for (const value of Object.values(sections)) value.ok = false;
    const { service, db } = harness(sections);
    expect((await service.enrich(['7'], true))[0]).toMatchObject({
      wouldUpdate: false,
    });
    expect(db.upsertBuyingGuide).not.toHaveBeenCalled();
    expect((await service.enrich(['7'], false))[0]).toMatchObject({
      updated: false,
      sectionsUpdated: 0,
    });
    expect(db.buildUpdatePayload).not.toHaveBeenCalled();
    expect(db.upsertBuyingGuide).toHaveBeenCalledTimes(1);
    const payload = db.upsertBuyingGuide.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual([
      'sgpg_gatekeeper_checks',
      'sgpg_gatekeeper_flags',
      'sgpg_gatekeeper_score',
      'sgpg_source_verified',
      'sgpg_source_verified_at',
      'sgpg_source_verified_by',
    ]);
    expect(payload.sgpg_source_verified).toBe(false);
    expect(payload.sgpg_gatekeeper_checks).toMatchObject({
      passed: false,
      all_sections_skipped: true,
    });
  });

  it('preserves the authorized path for structurally valid content', async () => {
    const { service, db } = harness(fixture());
    expect((await service.enrich(['7'], true))[0]).toMatchObject({
      wouldUpdate: true,
    });
    expect(db.upsertBuyingGuide).not.toHaveBeenCalled();
    expect((await service.enrich(['7'], false))[0]).toMatchObject({
      updated: true,
      sectionsUpdated: 3,
    });
    expect(db.upsertBuyingGuide).toHaveBeenCalledTimes(1);
    expect(
      db.upsertBuyingGuide.mock.calls[0][1].sgpg_gatekeeper_checks.passed,
    ).toBe(true);
  });
});
