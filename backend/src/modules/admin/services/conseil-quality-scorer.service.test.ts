import { ConseilQualityScorerService } from './conseil-quality-scorer.service';
import { PACK_DEFINITIONS } from '../../../config/conseil-pack.constants';

type SectionRow = {
  sgc_section_type: string;
  sgc_quality_score: number | null;
};

const standardRows = (score: number | null = 80): SectionRow[] =>
  PACK_DEFINITIONS.standard.requiredSections.map((section) => ({
    sgc_section_type: section,
    sgc_quality_score: score,
  }));

// Exercise the public coverage path with an in-memory read adapter. No service
// constructor, database, network, backfill or publication is invoked.
async function coverage(rows: SectionRow[]) {
  const read = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockResolvedValue({ data: rows, error: null }),
    single: jest.fn().mockResolvedValue({ data: { pg_alias: 'fixture' } }),
  };
  const service = Object.create(
    ConseilQualityScorerService.prototype,
  ) as ConseilQualityScorerService;
  Object.defineProperty(service, 'client', {
    value: { from: jest.fn().mockReturnValue(read) },
  });
  return service.computeGammeCoverage('1');
}

describe('Conseil pack coverage: presence is distinct from score qualification', () => {
  it('keeps structural completeness but exposes missing scores, without a misleading average', async () => {
    const rows = standardRows();
    rows[0].sgc_quality_score = null;
    expect((await coverage(rows)).standard).toEqual(
      expect.objectContaining({
        packComplete: true,
        coverage: 1,
        avgQuality: null,
        qualityStatus: 'not_evaluable',
        unscoredSections: ['S1'],
      }),
    );
  });

  it('does not hide a section below its floor behind a high pack average', async () => {
    const rows = standardRows(100);
    rows[0].sgc_quality_score = 59;
    expect((await coverage(rows)).standard).toEqual(
      expect.objectContaining({
        packComplete: true,
        qualityStatus: 'below_threshold',
        lowQualitySections: ['S1'],
      }),
    );
  });

  it('applies the pack threshold even when every section reaches its floor', async () => {
    expect((await coverage(standardRows(60))).standard).toEqual(
      expect.objectContaining({
        qualityStatus: 'below_threshold',
        lowQualitySections: [],
      }),
    );
  });

  it('does not round a score up into acceptance', async () => {
    const rows = standardRows(70);
    rows[0].sgc_quality_score = 69;
    expect((await coverage(rows)).standard).toEqual(
      expect.objectContaining({
        avgQuality: 70,
        qualityStatus: 'below_threshold',
      }),
    );
  });

  it('accepts the configured pack threshold exactly, without certifying factual excellence', async () => {
    expect((await coverage(standardRows(70))).standard).toEqual(
      expect.objectContaining({
        avgQuality: 70,
        qualityStatus: 'meets_thresholds',
      }),
    );
  });

  it('does not weight a duplicated section more heavily or silently select one copy', async () => {
    const rows = standardRows(70);
    rows.push({ sgc_section_type: 'S1', sgc_quality_score: 100 });
    expect((await coverage(rows)).standard).toEqual(
      expect.objectContaining({
        coverage: 1,
        packComplete: true,
        avgQuality: null,
        qualityStatus: 'not_evaluable',
        duplicateSections: ['S1'],
      }),
    );
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid stored score %s without clamping it into a valid score',
    async (score) => {
      const rows = standardRows();
      rows[0].sgc_quality_score = score;
      expect((await coverage(rows)).standard).toEqual(
        expect.objectContaining({
          avgQuality: null,
          qualityStatus: 'not_evaluable',
          invalidScoreSections: ['S1'],
        }),
      );
    },
  );

  it('does not give an incomplete pack the average of its only scored section', async () => {
    expect((await coverage(standardRows(100).slice(0, 1))).standard).toEqual(
      expect.objectContaining({
        packComplete: false,
        avgQuality: null,
        qualityStatus: 'not_evaluable',
      }),
    );
  });

  it('does not count optional or unknown sections towards the required-pack average', async () => {
    const rows = standardRows(70);
    rows.push({ sgc_section_type: 'S7', sgc_quality_score: null });
    rows.push({ sgc_section_type: 'UNKNOWN', sgc_quality_score: 100 });
    expect((await coverage(rows)).standard).toEqual(
      expect.objectContaining({
        avgQuality: 70,
        qualityStatus: 'meets_thresholds',
      }),
    );
  });

  it('uses each pack own thresholds', async () => {
    const rows = PACK_DEFINITIONS.eeat.requiredSections.map((section) => ({
      sgc_section_type: section,
      sgc_quality_score: 80,
    }));
    const result = await coverage(rows);
    expect(result.standard).toEqual(
      expect.objectContaining({ qualityStatus: 'meets_thresholds' }),
    );
    expect(result.pro).toEqual(
      expect.objectContaining({ qualityStatus: 'meets_thresholds' }),
    );
    expect(result.eeat).toEqual(
      expect.objectContaining({ qualityStatus: 'below_threshold' }),
    );
  });
});

describe('Conseil section measurement and declared references', () => {
  const scorer = Object.create(
    ConseilQualityScorerService.prototype,
  ) as ConseilQualityScorerService;
  const text =
    'Le filtre retient les impuretés transportées par le lubrifiant. Son élément filtrant doit correspondre au montage prévu pour le véhicule. Un modèle vissé comprend un boîtier complet alors qu’une cartouche remplaçable se loge dans un support conservé. Le choix nécessite de vérifier la compatibilité dans le catalogue et les prescriptions applicables au véhicule concerné.';

  it.each([
    null,
    '',
    '   ',
    'not-a-source',
    'null',
    '{}',
    '[]',
    '[null]',
    '[42]',
    '[{}]',
    '[""]',
    '["   "]',
    '[{"ref":42}]',
  ])(
    'does not credit missing or malformed source references: %s',
    (sources) => {
      expect(scorer.scoreSection('S1', text, sources).penalties).toContainEqual(
        { flag: 'NO_SOURCES', points: 15 },
      );
    },
  );

  it.each([
    '["wiki/gammes/filtre.md"]',
    '[{"type":"wiki","ref":"wiki/gammes/filtre.md"}]',
  ])(
    'preserves supported declared reference formats without certifying their truth: %s',
    (sources) => {
      expect(
        scorer.scoreSection('S1', text, sources).penalties,
      ).not.toContainEqual({ flag: 'NO_SOURCES', points: 15 });
    },
  );

  it('does not let long HTML attributes satisfy the content-length criterion', () => {
    const result = scorer.scoreSection(
      'S1',
      `<p class="${'padding '.repeat(60)}">Filtre.</p>`,
      null,
    );
    expect(result.penalties).toContainEqual({
      flag: 'CONTENT_TOO_SHORT',
      points: 20,
    });
  });

  it('does not reward a run of the same word as additional substance', () => {
    const once = scorer.scoreSection('S1', '<p>banane</p>', 'not-a-source');
    const repeated = scorer.scoreSection(
      'S1',
      `<p>${'banane '.repeat(60)}</p>`,
      'not-a-source',
    );
    expect(repeated).toEqual(once);
    expect(repeated.score).toBe(50);
  });

  it('keeps the score of ordinary prose with repeated technical terms unchanged', () => {
    expect(
      scorer.scoreSection('S1', text, '["wiki/gammes/filtre.md"]').score,
    ).toBe(100);
  });
});
