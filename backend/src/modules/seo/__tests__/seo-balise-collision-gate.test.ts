import {
  SeoFingerprintCore,
  type SeoPageFingerprint,
} from '../utils/seo-fingerprint-core';
import {
  SeoBaliseCollisionGate,
  type BaliseSibling,
} from '../utils/seo-balise-collision-gate';
import type {
  ResolvedPageSeo,
  ResolvedSeoField,
} from '../types/resolved-seo-field';

/**
 * SeoBaliseCollisionGate (D-3) — verdict PUR de collision de balises sœurs.
 *
 * Prouve l'application verbatim d'ADR-095 : HARD uniquement sur collision EXACTE title/h1
 * entre sœurs indexable_effective non-exemptes ; description / near-dup / non-indexable /
 * exempt / champ-vide = report-only (jamais bloquant) ; précédence des verdicts ; pureté.
 */

function field(value: string): ResolvedSeoField {
  return {
    value,
    sourceStage: 'runtime_db',
    truthLevel: 1,
    sourceId: null,
    evidenceIds: [],
    resolverVersion: 'test',
    degraded: false,
    degradeReason: null,
  };
}

function fp(
  title: string,
  description: string,
  h1: string,
  entityKey: string,
): SeoPageFingerprint {
  const page: ResolvedPageSeo = {
    title: field(title),
    description: field(description),
    h1: field(h1),
    surface: 'R8',
    entityKey,
  };
  return SeoFingerprintCore.compute(page);
}

function sibling(
  fingerprint: SeoPageFingerprint,
  opts: { indexable?: boolean; exempt?: boolean } = {},
): BaliseSibling {
  return {
    fingerprint,
    indexableEffective: opts.indexable ?? true,
    catalogueExempt: opts.exempt ?? false,
  };
}

// Deux motorisations sœurs distinctes (discriminant puissance) — cas SAIN.
const CAND_CLEAN = fp(
  'Disque de frein Clio III 1.5 dCi 90 ch',
  'Disque de frein avant pour Renault Clio III 1.5 dCi 90 ch.',
  'Disque de frein avant Clio III 90 ch',
  'type:34189',
);
const SIB_CLEAN = fp(
  'Disque de frein Clio III 1.5 dCi 105 ch',
  'Disque de frein avant pour Renault Clio III 1.5 dCi 105 ch.',
  'Disque de frein avant Clio III 105 ch',
  'type:34190',
);

describe('SeoBaliseCollisionGate.evaluate — HARD (ADR-095 §2)', () => {
  it('collision EXACTE title entre sœurs indexable → blocking', () => {
    const cand = fp('Même Title', 'desc A unique', 'H1 A unique', 'type:1');
    const sib = fp('Même Title', 'desc B unique', 'H1 B unique', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sib)],
    });
    expect(v.decision).toBe('COLLISION_EXACTE');
    expect(v.blocking).toBe(true);
    expect(v.field).toBe('title');
    expect(v.collidingEntityKey).toBe('type:2');
    expect(v.reasonCode).toBe('BALISE_EXACT_TITLE_COLLISION');
  });

  it('collision EXACTE h1 → blocking sur h1', () => {
    const cand = fp('Title A unique', 'desc A unique', 'Même H1', 'type:1');
    const sib = fp('Title B unique', 'desc B unique', 'Même H1', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sib)],
    });
    expect(v.decision).toBe('COLLISION_EXACTE');
    expect(v.blocking).toBe(true);
    expect(v.field).toBe('h1');
  });
});

describe('SeoBaliseCollisionGate.evaluate — report-only (jamais blocking)', () => {
  it('collision EXACTE description → report-only (description hors HARD)', () => {
    const cand = fp('Title A unique', 'Même Desc', 'H1 A unique', 'type:1');
    const sib = fp('Title B unique', 'Même Desc', 'H1 B unique', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sib)],
    });
    expect(v.blocking).toBe(false);
    expect(v.decision).toBe('COLLISION_PROCHE');
    expect(v.nearDup).toContainEqual(
      expect.objectContaining({ field: 'description', kind: 'exact' }),
    );
  });

  it('collision EXACTE title mais candidat NON indexable → report-only', () => {
    const cand = fp('Même Title', 'desc A unique', 'H1 A unique', 'type:1');
    const sib = fp('Même Title', 'desc B unique', 'H1 B unique', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: false,
      siblings: [sibling(sib, { indexable: true })],
    });
    expect(v.blocking).toBe(false);
    expect(v.decision).toBe('COLLISION_PROCHE');
  });

  it('collision EXACTE title mais sœur NON indexable → report-only', () => {
    const cand = fp('Même Title', 'desc A unique', 'H1 A unique', 'type:1');
    const sib = fp('Même Title', 'desc B unique', 'H1 B unique', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sib, { indexable: false })],
    });
    expect(v.blocking).toBe(false);
  });

  it('collision EXACTE title mais exemption catalogue → report-only', () => {
    const cand = fp('Même Title', 'desc A unique', 'H1 A unique', 'type:1');
    const sib = fp('Même Title', 'desc B unique', 'H1 B unique', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      candidateCatalogueExempt: true,
      siblings: [sibling(sib)],
    });
    expect(v.blocking).toBe(false);
  });

  it('collision NORMALISÉE seule (casse/accents) title → report-only kind normalized', () => {
    const cand = fp('Filtre à huile', 'desc A unique', 'H1 A unique', 'type:1');
    const sib = fp('FILTRE A HUILE', 'desc B unique', 'H1 B unique', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sib)],
    });
    expect(v.blocking).toBe(false);
    expect(v.decision).toBe('COLLISION_PROCHE');
    expect(v.nearDup).toContainEqual(
      expect.objectContaining({ field: 'title', kind: 'normalized' }),
    );
  });
});

describe('SeoBaliseCollisionGate.evaluate — CLEAN / COVERAGE_GAP / précédence', () => {
  it('sœurs distinctes (discriminant puissance) → CLEAN', () => {
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: CAND_CLEAN,
      candidateIndexableEffective: true,
      siblings: [sibling(SIB_CLEAN)],
    });
    expect(v.decision).toBe('CLEAN');
    expect(v.blocking).toBe(false);
    expect(v.nearDup).toEqual([]);
  });

  it('aucune sœur → CLEAN', () => {
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: CAND_CLEAN,
      candidateIndexableEffective: true,
      siblings: [],
    });
    expect(v.decision).toBe('CLEAN');
  });

  it('title vide sur candidat indexable → COVERAGE_GAP (pas un duplicate)', () => {
    const cand = fp('', 'desc unique', 'H1 unique', 'type:1');
    const sib = fp('', 'desc autre', 'H1 autre', 'type:2'); // titre vide aussi
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sib)],
    });
    // deux titres vides NE collisionnent PAS (garde champ-vide) → COVERAGE_GAP
    expect(v.decision).toBe('COVERAGE_GAP');
    expect(v.blocking).toBe(false);
    expect(v.field).toBe('title');
  });

  it('title vide mais candidat NON indexable → hors scope COVERAGE_GAP → CLEAN', () => {
    const cand = fp('', 'desc unique', 'H1 unique', 'type:1');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: false,
      siblings: [],
    });
    expect(v.decision).toBe('CLEAN');
  });

  it('précédence : collision HARD title prime, mais nearDup reste peuplé (observabilité)', () => {
    // title exact (HARD) + description exacte (report-only) sur la même sœur.
    const cand = fp('Même Title', 'Même Desc', 'H1 A unique', 'type:1');
    const sib = fp('Même Title', 'Même Desc', 'H1 B unique', 'type:2');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sib)],
    });
    expect(v.decision).toBe('COLLISION_EXACTE');
    expect(v.blocking).toBe(true);
    expect(v.field).toBe('title');
    expect(v.nearDup).toContainEqual(
      expect.objectContaining({ field: 'description', kind: 'exact' }),
    );
  });

  it('plusieurs sœurs : bloque sur celle en collision exacte title', () => {
    const cand = fp('Même Title', 'desc A', 'H1 A', 'type:1');
    const sibOk = fp('Title distinct', 'desc B', 'H1 B', 'type:2');
    const sibDup = fp('Même Title', 'desc C', 'H1 C', 'type:3');
    const v = SeoBaliseCollisionGate.evaluate({
      candidate: cand,
      candidateIndexableEffective: true,
      siblings: [sibling(sibOk), sibling(sibDup)],
    });
    expect(v.blocking).toBe(true);
    expect(v.collidingEntityKey).toBe('type:3');
  });
});

describe('SeoBaliseCollisionGate — pureté & déterminisme', () => {
  it('même entrée → même verdict (déterministe)', () => {
    const input = {
      candidate: fp('Même Title', 'd', 'h', 'type:1'),
      candidateIndexableEffective: true,
      siblings: [sibling(fp('Même Title', 'd2', 'h2', 'type:2'))],
    };
    const a = SeoBaliseCollisionGate.evaluate(input);
    const b = SeoBaliseCollisionGate.evaluate(input);
    expect(a).toEqual(b);
  });

  it('HARD_FIELDS = title + h1 (description exclue)', () => {
    expect([...SeoBaliseCollisionGate.HARD_FIELDS].sort()).toEqual([
      'h1',
      'title',
    ]);
  });
});
