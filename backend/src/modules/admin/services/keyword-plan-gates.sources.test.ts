import { KeywordPlanGatesService } from './keyword-plan-gates.service';

// Pure audit path; no database, network or publication.
const gates = new KeywordPlanGatesService();
const audit = (sources: string | null) =>
  gates.runAuditGates([
    {
      section_type: 'S1',
      quality_score: 100,
      content_len: 1000,
      content: 'Le filtre retient les impuretés présentes dans le lubrifiant.',
      sources,
    },
  ]);

describe('GA5 declared sources and correction routing', () => {
  it('routes a missing source to sectionsToImprove even with a score of 100', () => {
    const result = audit(null);
    expect(result.gateReport.GA5_EEAT_SOURCES.status).toBe('warn');
    expect(result.sectionsToImprove).toContain('S1');
    expect(result.priorityFixes).toContainEqual(
      expect.objectContaining({
        section: 'S1',
        issue: 'no_sources',
        fix_type: 'improve',
      }),
    );
  });

  it.each(['[null]', '[{}]', '[42]', '[" "]', '[{"ref":false}]'])(
    'does not accept an array containing no usable reference: %s',
    (raw) => {
      expect(audit(raw).gateReport.GA5_EEAT_SOURCES.status).toBe('warn');
    },
  );

  it.each([
    '["wiki/gammes/filtre.md"]',
    '[{"type":"wiki","ref":"wiki/gammes/filtre.md"}]',
  ])('retains supported reference shape: %s', (raw) => {
    expect(audit(raw).gateReport.GA5_EEAT_SOURCES.status).toBe('pass');
    expect(audit(raw).sectionsToImprove).not.toContain('S1');
  });
});

// Regression through the audit/skip chain, not only the individual GA5 report.
describe('Conseil audit skip decision', () => {
  const rows = () =>
    ['S1', 'S2', 'S3', 'S4_DEPOSE', 'S5', 'S6', 'S8'].map((section) => ({
      section_type: section,
      quality_score: 100,
      content_len: 1000,
      content: '',
      sources: '["wiki/gammes/filtre.md"]' as string | null,
    }));

  it('does not skip an otherwise healthy pack whose source needs correction', () => {
    const sections = rows();
    sections[0].sources = null;
    const result = gates.auditFromSections(sections);
    expect(result.sections_to_improve).toContain('S1');
    expect(gates.shouldSkipGamme(result)).toBe(false);
  });

  it('preserves the existing skip decision when all configured checks pass', () => {
    const result = gates.auditFromSections(rows());
    expect(result.sections_to_improve).toEqual([]);
    expect(gates.shouldSkipGamme(result)).toBe(true);
  });
});
