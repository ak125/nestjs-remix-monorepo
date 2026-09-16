import { R7BrandEnricherService } from './r7-brand-enricher.service';

// Pure composition/gates only: no constructor, DB, queue, HTTP or publication.
type Composer = {
  composeBlocks: (...args: unknown[]) => Array<{
    id: string;
    type: string;
    renderedText: string;
  }>;
  gate: (
    metrics: Record<string, number>,
    blocks: unknown[],
  ) => {
    decision: string;
    reasons: string[];
  };
};
const composer = Object.create(R7BrandEnricherService.prototype) as Composer;
const compose = (faq: Array<{ q: string; a: string }>) =>
  composer.composeBlocks(
    'Marque fixture',
    'marque-fixture',
    [],
    [],
    [],
    [],
    null,
    { faq },
  );

describe('R7 editorial source and publication boundaries', () => {
  it('does not manufacture a FAQ when the curated source is absent', () => {
    const blocks = compose([]);
    expect(blocks.find((b) => b.id === 'R7_S9_FAQ')).toBeUndefined();
  });

  it('preserves the curated FAQ without filling it with unverified commercial claims', () => {
    const blocks = compose([
      {
        q: 'Quels modèles sont documentés ?',
        a: 'Voir les modèles présents dans le catalogue vérifié.',
      },
    ]);
    expect(blocks.find((b) => b.id === 'R7_S9_FAQ')?.renderedText).toBe(
      '**Quels modèles sont documentés ?**\nVoir les modèles présents dans le catalogue vérifié.',
    );
  });

  it('a high aggregate score cannot override a missing critical source block', () => {
    const result = composer.gate(
      {
        specificContentRatio: 1,
        boilerplateRatio: 0,
        genericPhraseRatio: 0,
        diversityScore: 100,
      },
      [
        { type: 'hero' },
        { type: 'micro_seo' },
        { type: 'compatibility_guide' },
        { type: 'about' },
      ],
    );
    expect(result.reasons).toContain('MISSING_FAQ');
    expect(result.decision).toBe('REVIEW_REQUIRED');
  });

  it('a high aggregate score cannot override declared boilerplate hard gates', () => {
    const result = composer.gate(
      {
        specificContentRatio: 0.2,
        boilerplateRatio: 0.8,
        genericPhraseRatio: 0,
        diversityScore: 100,
      },
      [
        { type: 'hero' },
        { type: 'micro_seo' },
        { type: 'compatibility_guide' },
        { type: 'faq' },
      ],
    );
    expect(result.reasons).toEqual(
      expect.arrayContaining(['LOW_SPECIFIC_CONTENT', 'HIGH_BOILERPLATE']),
    );
    expect(result.decision).toBe('REVIEW_REQUIRED');
  });
});

describe('R7 existing positive and structural decisions', () => {
  const goodMetrics = {
    specificContentRatio: 1,
    boilerplateRatio: 0,
    genericPhraseRatio: 0,
    diversityScore: 100,
  };
  it('a complete candidate passing every hard gate keeps its publish decision', () => {
    expect(
      composer.gate(goodMetrics, [
        { type: 'hero' },
        { type: 'micro_seo' },
        { type: 'compatibility_guide' },
        { type: 'faq' },
      ]).decision,
    ).toBe('PUBLISH');
  });
  it('a structurally broken candidate remains rejected', () => {
    expect(composer.gate(goodMetrics, [{ type: 'hero' }]).decision).toBe(
      'REJECT',
    );
  });
});
