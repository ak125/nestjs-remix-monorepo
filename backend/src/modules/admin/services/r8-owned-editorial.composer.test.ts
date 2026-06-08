/**
 * Tests — R8 Owned-Editorial Composer (Fix B Phase A).
 *
 * Coverage : jsonb FAQ parse, anchor selection, the three builders
 * (selection guide / entretien / faq), null-fallback contract, and the
 * per-motorisation factual frame propagation (sibling distinctness signal).
 */

import {
  parseOwnedFaq,
  pickAnchorGamme,
  buildOwnedSelectionGuide,
  buildOwnedEntretien,
  buildOwnedFaq,
  type GammeEditorial,
  type MotorisationFacts,
} from './r8-owned-editorial.composer';

const facts: MotorisationFacts = {
  brand: 'Renault',
  model: 'Clio III',
  type: '1.5 dCi',
  power: '105',
  fuel: 'diesel',
  yearFrom: '2005',
  yearTo: '2014',
};

function gamme(over: Partial<GammeEditorial> = {}): GammeEditorial {
  return {
    pgId: 402,
    pgName: 'Plaquettes de frein',
    pgAlias: 'plaquette-de-frein',
    productCount: 312,
    purchaseGuide: {
      how_to_choose:
        'Privilégiez des plaquettes homologuées ECE R90 adaptées au disque monté.',
      selection_criteria: ['Indice ECE R90', { label: 'Compatibilité disque' }],
      symptoms: ['Grincement au freinage', '  ', 'Vibration pédale'],
      risk_explanation:
        'Des plaquettes usées allongent la distance de freinage et endommagent les disques.',
      risk_consequences: ['Disques rayés'],
      timing_years: '2 ans',
      timing_km: '30 000 km',
      timing_note: 'à vérifier plus tôt en usage urbain',
      anti_mistakes: ['Monter sans changer les disques usés'],
      faq: [
        { q: 'Quand changer les plaquettes ?', a: 'Dès 3 mm d’épaisseur restante.' },
        { question: 'Faut-il roder ?', answer: 'Oui, 200 km en douceur.' },
        { q: '', a: 'ignored' },
      ],
    },
    conseil: [
      {
        content: 'Conseil expert sur le freinage urbain.',
        section_type: 'maintenance',
        title: 'Freinage',
      },
    ],
    ...over,
  };
}

describe('parseOwnedFaq', () => {
  it('accepts {q,a} and {question,answer}, drops empties/non-objects', () => {
    const pairs = parseOwnedFaq([
      { q: 'A?', a: 'yes' },
      { question: 'B?', answer: 'no' },
      { q: '', a: 'x' },
      'garbage',
      null,
    ]);
    expect(pairs).toEqual([
      { q: 'A?', a: 'yes' },
      { q: 'B?', a: 'no' },
    ]);
  });

  it('returns [] for non-array', () => {
    expect(parseOwnedFaq(null)).toEqual([]);
    expect(parseOwnedFaq({})).toEqual([]);
  });
});

describe('pickAnchorGamme', () => {
  it('returns the first gamme with a usable purchase guide', () => {
    const noGuide = gamme({ pgId: 1, purchaseGuide: null });
    const usable = gamme({ pgId: 2 });
    expect(pickAnchorGamme([noGuide, usable])?.pgId).toBe(2);
  });

  it('returns null when no gamme has usable editorial', () => {
    const empty = gamme({
      purchaseGuide: {
        how_to_choose: null,
        selection_criteria: null,
        symptoms: null,
        risk_explanation: null,
        risk_consequences: null,
        timing_years: null,
        timing_km: null,
        timing_note: null,
        anti_mistakes: null,
        faq: null,
      },
      conseil: [],
    });
    expect(pickAnchorGamme([empty])).toBeNull();
  });
});

describe('buildOwnedSelectionGuide', () => {
  it('frames owned prose with real motorisation facts + criteria + anti-mistakes', () => {
    const block = buildOwnedSelectionGuide(gamme(), facts);
    expect(block).not.toBeNull();
    expect(block!.id).toBe('S_SELECTION_GUIDE');
    expect(block!.type).toBe('selection_help');
    // factual frame — only real values
    expect(block!.renderedText).toContain('Renault Clio III 1.5 dCi 105 ch (diesel)');
    // real owned prose body
    expect(block!.renderedText).toContain('homologuées ECE R90');
    // criteria (string + object label) and anti-mistakes rendered
    expect(block!.renderedText).toContain('- Indice ECE R90');
    expect(block!.renderedText).toContain('- Compatibilité disque');
    expect(block!.renderedText).toContain('Monter sans changer les disques usés');
  });

  it('falls back to conseil content when how_to_choose missing', () => {
    const g = gamme();
    g.purchaseGuide!.how_to_choose = null;
    const block = buildOwnedSelectionGuide(g, facts);
    expect(block!.renderedText).toContain('Conseil expert sur le freinage urbain.');
  });

  it('returns null when neither how_to_choose nor conseil exists', () => {
    const g = gamme({ conseil: [] });
    g.purchaseGuide!.how_to_choose = null;
    expect(buildOwnedSelectionGuide(g, facts)).toBeNull();
  });
});

describe('buildOwnedEntretien', () => {
  it('frames by age and renders timing + risk + symptoms (trimmed, no blanks)', () => {
    const block = buildOwnedEntretien(gamme(), facts);
    expect(block).not.toBeNull();
    expect(block!.id).toBe('S_ENTRETIEN_CONTEXT');
    expect(block!.type).toBe('maintenance_context');
    expect(block!.renderedText).toContain('Renault Clio III 1.5 dCi (2005–2014)');
    expect(block!.renderedText).toContain('30 000 km ou 2 ans');
    expect(block!.renderedText).toContain('allongent la distance de freinage');
    expect(block!.renderedText).toContain('- Grincement au freinage');
    // blank symptom dropped
    expect(block!.renderedText).not.toMatch(/-\s*\n/);
  });

  it('returns null when no timing / risk / symptoms', () => {
    const g = gamme();
    Object.assign(g.purchaseGuide!, {
      risk_explanation: null,
      symptoms: [],
      timing_km: null,
      timing_years: null,
    });
    expect(buildOwnedEntretien(g, facts)).toBeNull();
  });
});

describe('buildOwnedFaq', () => {
  it('merges + dedups owned FAQ across gammes, caps at 6, keeps opener', () => {
    const g1 = gamme({ pgId: 1 });
    const g2 = gamme({ pgId: 2 }); // same FAQ → dedup
    const block = buildOwnedFaq([g1, g2], facts, 'Vos questions :');
    expect(block).not.toBeNull();
    expect(block!.renderedText.startsWith('Vos questions :')).toBe(true);
    // 2 unique questions despite 2 gammes
    expect(block!.renderedText).toContain('Quand changer les plaquettes ?');
    expect(block!.renderedText).toContain('Faut-il roder ?');
    expect((block!.renderedText.match(/Quand changer les plaquettes \?/g) || []).length).toBe(1);
  });

  it('returns null when fewer than 2 unique FAQ entries', () => {
    const g = gamme();
    g.purchaseGuide!.faq = [{ q: 'only one', a: 'answer' }];
    expect(buildOwnedFaq([g], facts, 'opener')).toBeNull();
  });
});

describe('sibling distinctness signal', () => {
  it('same anchor gamme but different motorisation facts → different rendered frames', () => {
    const sibling: MotorisationFacts = { ...facts, type: '1.2 16V', power: '75', fuel: 'essence', yearFrom: '2006', yearTo: '2012' };
    const a = buildOwnedSelectionGuide(gamme(), facts)!.renderedText;
    const b = buildOwnedSelectionGuide(gamme(), sibling)!.renderedText;
    expect(a).not.toEqual(b);
    expect(a).toContain('1.5 dCi 105 ch (diesel)');
    expect(b).toContain('1.2 16V 75 ch (essence)');
  });
});
