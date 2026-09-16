import { PACK_DEFINITIONS } from '../../../config/conseil-pack.constants';
import {
  KeywordPlanGatesService,
  type ConseilSectionRow,
} from './keyword-plan-gates.service';

const gates = new KeywordPlanGatesService();
const shared =
  'Le filtre retient les impuretes presentes dans le lubrifiant avant leur circulation';
const other =
  'La reference constructeur permet de verifier la compatibilite de la piece avec le vehicule';
// Report fixtures isolate GA3; they do not certify factual quality or live execution.
const rows = (): ConseilSectionRow[] =>
  PACK_DEFINITIONS.standard.requiredSections.map((section) => ({
    section_type: section,
    quality_score: 100,
    content_len: 1000,
    content: `Texte distinct de la section ${section}`,
    sources: '["wiki/gammes/filtre.md"]',
  }));

function duplicated() {
  const sections = rows();
  sections[0].content = shared;
  sections[1].content = `<p>${shared.toUpperCase()}</p>`;
  return sections;
}

describe('GA3 duplicate finding reaches the audit correction decision', () => {
  it('does not skip a full 100-score pack containing a detected duplicate', () => {
    const report = gates.auditFromSections(duplicated());
    expect(report.gate_report?.GA3_CROSS_SECTION_DEDUP.status).toBe('warn');
    expect(gates.shouldSkipGamme(report)).toBe(false);
    expect(report.sections_to_improve.sort()).toEqual(['S1', 'S2']);
    expect(report.priority_fixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'S1',
          issue: 'duplicate_content',
          fix_type: 'improve',
          current_score: 100,
        }),
        expect.objectContaining({
          section: 'S2',
          issue: 'duplicate_content',
          fix_type: 'improve',
          current_score: 100,
        }),
      ]),
    );
    // Routing work does not invent a new audit weight or alter stored quality scores.
    expect(report.priority_score).toBe(0);
    expect(report.section_scores.S1).toBe(100);
  });

  it('retains work for repeated banane content even with legacy scores of 100', () => {
    const sections = rows();
    for (const section of sections)
      section.content = Array(60).fill('banane').join(' ');
    const report = gates.auditFromSections(sections);
    expect(report.sections_to_improve.sort()).toEqual(
      [...PACK_DEFINITIONS.standard.requiredSections].sort(),
    );
    expect(gates.shouldSkipGamme(report)).toBe(false);
    expect(sections.every((section) => section.quality_score === 100)).toBe(
      true,
    );
  });

  it('reports both affected sections independently of input order', () => {
    const forward = gates.auditFromSections(duplicated());
    const reverse = gates.auditFromSections(duplicated().reverse());
    expect(forward.sections_to_improve.sort()).toEqual(['S1', 'S2']);
    expect(reverse.sections_to_improve.sort()).toEqual(
      forward.sections_to_improve,
    );
  });

  it('emits one duplicate fix per affected section despite repeated matches', () => {
    const sections = duplicated();
    sections[0].content = `${shared}. ${other}`;
    sections[1].content = `${shared}. ${other}`;
    sections[2].content = shared;
    const report = gates.auditFromSections(sections);
    const fixes = report.priority_fixes;
    expect(fixes.map((fix) => fix.section).sort()).toEqual(['S1', 'S2', 'S3']);
    expect(report.sections_to_improve.sort()).toEqual(['S1', 'S2', 'S3']);
  });

  it('keeps GA3 scoped to cross-section matches, without rewriting content', () => {
    const sections = rows();
    sections[0].content = `${shared}. ${shared}`;
    const before = JSON.stringify(sections);
    const report = gates.auditFromSections(sections);
    expect(report.gate_report?.GA3_CROSS_SECTION_DEDUP.status).toBe('pass');
    expect(report.sections_to_improve).toEqual([]);
    expect(JSON.stringify(sections)).toBe(before);
  });

  it('preserves the existing decision for distinct section content', () => {
    const report = gates.auditFromSections(rows());
    expect(report.sections_to_improve).toEqual([]);
    expect(gates.shouldSkipGamme(report)).toBe(true);
  });
});

describe('GA3 titles and normalized text', () => {
  it.each(['symptomes', ' SYMPTÔMES ! ', 'Sympto\u0302mes'])(
    'detects Symptômes / %s across distinct sections',
    (variant) => {
      const sections = rows();
      Object.assign(sections[0], { title: 'Symptômes' });
      Object.assign(sections[1], { title: variant });
      const before = JSON.stringify(sections);
      const report = gates.auditFromSections(sections);
      expect(report.gate_report?.GA3_CROSS_SECTION_DEDUP.status).toBe('warn');
      expect(report.gate_report?.GA3_CROSS_SECTION_DEDUP.message).toContain(
        'heading',
      );
      expect(report.sections_to_improve.sort()).toEqual(['S1', 'S2']);
      expect(gates.shouldSkipGamme(report)).toBe(false);
      expect(JSON.stringify(sections)).toBe(before);
    },
  );

  it('detects accent and whitespace variants in repeated paragraphs', () => {
    const sections = rows();
    sections[0].content =
      'Le contrôle précis du véhicule nécessite une vérification documentée avant toute intervention';
    sections[1].content =
      'LE CONTROLE PRECIS DU VEHICULE   NECESSITE UNE VERIFICATION DOCUMENTEE AVANT TOUTE INTERVENTION';
    expect(
      gates.auditFromSections(sections).sections_to_improve.sort(),
    ).toEqual(['S1', 'S2']);
  });

  it('does not equate different headings or absent headings', () => {
    const sections = rows();
    Object.assign(sections[0], { title: 'Symptômes au démarrage' });
    Object.assign(sections[1], { title: 'Symptômes au freinage' });
    Object.assign(sections[2], { title: '   ' });
    Object.assign(sections[3], { title: null });
    expect(
      gates.auditFromSections(sections).gate_report?.GA3_CROSS_SECTION_DEDUP
        .status,
    ).toBe('pass');
  });
});

it('keeps S2 and the integrated S2_DIAG for review when both have the same heading', () => {
  const sections = rows();
  const symptoms = sections.find((section) => section.section_type === 'S2')!;
  symptoms.title = 'Symptômes';
  sections.push({
    ...symptoms,
    section_type: 'S2_DIAG',
    title: 'symptomes',
    content: 'Un autre texte de diagnostic',
  });
  const report = gates.auditFromSections(sections);
  expect(report.sections_to_improve.sort()).toEqual(['S2', 'S2_DIAG']);
  expect(report.sections_to_create).toEqual([]);
  expect(gates.shouldSkipGamme(report)).toBe(false);
});
