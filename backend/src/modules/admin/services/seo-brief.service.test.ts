/**
 * Tests du gate de substance déterministe (D1, ADR-086) — fonctions PURES, sans I/O.
 * On vérifie : extraction depuis block.content (forme PR-0), comptage propriétaire (db_owned|sourced + source_id),
 * SOURCE_MIX (pas 100% éditorial), SUBSTANCE_FLOOR par rôle, EVIDENCE_BOUND (orphelins non comptés), exclusion R2.
 */
import {
  extractSubstanceElements,
  countProprietary,
  sourceMix,
  evaluateSubstanceGate,
  SUBSTANCE_FLOOR_BY_ROLE,
  type BriefRole,
  type BlockTruthLevel,
} from './seo-brief.service';

const block = (
  truth_level: BlockTruthLevel,
  source_ids: string[],
  role = 'R3_CONSEILS',
  section = 'diagnostic',
) => ({
  role,
  block_kind: section,
  content: { content_md: 'x'.repeat(80), source_ids, truth_level, section },
});

describe('extractSubstanceElements', () => {
  it('lit truth_level/source_ids DANS block.content (forme réglée par PR-0), filtre par rôle', () => {
    const blocks = [
      block('sourced', ['oem:bosch-1'], 'R3_CONSEILS', 's1'),
      block('db_owned', ['db:pieces'], 'R8_VEHICLE', 's2'), // autre rôle → exclu
    ];
    const els = extractSubstanceElements(blocks, 'R3_CONSEILS');
    expect(els).toHaveLength(1);
    expect(els[0]).toMatchObject({
      truth_level: 'sourced',
      source_id: 'oem:bosch-1',
      field: 's1',
    });
  });

  it('ignore les blocs sans truth_level (pas de fabrication)', () => {
    const els = extractSubstanceElements(
      [{ role: 'R3_CONSEILS', content: { content_md: 'y' } }],
      'R3_CONSEILS',
    );
    expect(els).toHaveLength(0);
  });
});

describe('countProprietary', () => {
  it('compte seulement db_owned|sourced AVEC source_id', () => {
    const els = extractSubstanceElements(
      [
        block('db_owned', ['db:x']),
        block('sourced', ['web:y']),
        block('sourced', []), // pas de source_id → non compté (EVIDENCE_BOUND)
        block('editorial', ['web:z']), // editorial → non propriétaire
        block('inferred', ['raw:w']), // inferred → non propriétaire
      ],
      'R3_CONSEILS',
    );
    expect(countProprietary(els)).toBe(2);
  });
});

describe('sourceMix', () => {
  it('répartit par truth_level', () => {
    const els = extractSubstanceElements(
      [
        block('db_owned', ['db:a']),
        block('editorial', []),
        block('editorial', []),
      ],
      'R3_CONSEILS',
    );
    expect(sourceMix(els)).toEqual({
      db_owned: 1,
      sourced: 0,
      inferred: 0,
      editorial: 2,
    });
  });
});

describe('evaluateSubstanceGate', () => {
  const fiveProprietary = (role: BriefRole) =>
    extractSubstanceElements(
      Array.from({ length: 5 }, (_, i) =>
        block(
          'sourced',
          [`oem:s${i}`],
          role === 'R8_VEHICLE' ? 'R8_VEHICLE' : 'R3_CONSEILS',
          `sec${i}`,
        ),
      ),
      role === 'R8_VEHICLE' ? 'R8_VEHICLE' : 'R3_CONSEILS',
    );

  it('PASS quand le plancher du rôle est atteint avec preuves', () => {
    const r = evaluateSubstanceGate(
      fiveProprietary('R3_CONSEILS'),
      'R3_CONSEILS',
    );
    expect(r.pass).toBe(true);
    expect(r.count).toBe(5);
    expect(r.floor).toBe(SUBSTANCE_FLOOR_BY_ROLE.R3_CONSEILS);
    expect(r.reasons).toHaveLength(0);
  });

  it('R8 a un plancher plus bas (3) — 3 preuves suffisent', () => {
    const els = extractSubstanceElements(
      Array.from({ length: 3 }, (_, i) =>
        block('db_owned', [`db:${i}`], 'R8_VEHICLE', `s${i}`),
      ),
      'R8_VEHICLE',
    );
    const r = evaluateSubstanceGate(els, 'R8_VEHICLE');
    expect(r.pass).toBe(true);
    expect(r.floor).toBe(3);
  });

  it('FAIL SUBSTANCE_FLOOR : contenu trop maigre', () => {
    const els = extractSubstanceElements(
      [block('sourced', ['web:1'])],
      'R3_CONSEILS',
    );
    const r = evaluateSubstanceGate(els, 'R3_CONSEILS');
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes('SUBSTANCE_FLOOR'))).toBe(true);
  });

  it('FAIL SOURCE_MIX : 100% éditorial (générique, anti-IA)', () => {
    const els = extractSubstanceElements(
      Array.from({ length: 6 }, (_, i) =>
        block('editorial', [], 'R3_CONSEILS', `s${i}`),
      ),
      'R3_CONSEILS',
    );
    const r = evaluateSubstanceGate(els, 'R3_CONSEILS');
    expect(r.pass).toBe(false);
    expect(r.count).toBe(0);
    expect(r.reasons.some((x) => x.includes('SOURCE_MIX'))).toBe(true);
  });

  it('EVIDENCE_BOUND : un bloc propriétaire sans source_id est signalé + non compté', () => {
    const els = extractSubstanceElements(
      [
        ...Array.from({ length: 5 }, (_, i) =>
          block('sourced', [`oem:${i}`], 'R3_CONSEILS', `s${i}`),
        ),
        block('db_owned', [], 'R3_CONSEILS', 'orphan'),
      ],
      'R3_CONSEILS',
    );
    const r = evaluateSubstanceGate(els, 'R3_CONSEILS');
    expect(r.count).toBe(5); // l'orphelin db_owned sans source_id n'est pas compté
    expect(r.reasons.some((x) => x.includes('EVIDENCE_BOUND'))).toBe(true);
  });

  it('R2 est exclu au niveau type (BriefRole) — pas de plancher R2 défini', () => {
    // @ts-expect-error R2 n'est pas un BriefRole — la page transactionnelle a un chemin dédié strict.
    const floor = SUBSTANCE_FLOOR_BY_ROLE.R2_PRODUCT;
    expect(floor).toBeUndefined();
  });
});
