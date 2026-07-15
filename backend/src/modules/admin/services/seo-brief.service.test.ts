/**
 * Tests du gate de substance déterministe (D1, ADR-086) — fonctions PURES, sans I/O.
 * On vérifie : extraction depuis block.content (forme PR-0), comptage propriétaire (db_owned|sourced + source_id),
 * SOURCE_MIX (pas 100% éditorial), SUBSTANCE_FLOOR par rôle, EVIDENCE_BOUND (orphelins non comptés), exclusion R2.
 */
import {
  SeoBriefService,
  extractSubstanceElements,
  countProprietary,
  sourceMix,
  evaluateSubstanceGate,
  SUBSTANCE_FLOOR_BY_ROLE,
  type BriefRole,
  type BlockTruthLevel,
  type BriefEvidenceBundle,
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

// ── Caractérisation de composeBrief (GARDE behavior-identical pour C0) ──────────
// Fige le contrat OBSERVABLE de composeBrief AVANT l'extraction du reader : dérivation
// entity_id, mapping projectionRole, et les 4 dégradations observables (flag OFF, RPC error,
// RPC exception, projection absente) + le happy-path wiki_evidence. Après extraction du
// SeoProjectionReaderService, ces mêmes assertions doivent rester vertes (seul le stub de
// lecture change : callRpc → reader.readActiveProjection ; les bundles retournés sont identiques).
type ReaderResult = {
  envelope: unknown | null;
  degradeReason: string | null;
};
interface BriefHarness {
  composeBrief: (p: {
    pgId?: number;
    pgAlias?: string;
    vehicleSlug?: string;
    pageRole: BriefRole;
  }) => Promise<BriefEvidenceBundle>;
  lastRead?: { entityId: string; role: string };
}

function makeBrief(opts: {
  wikiEnabled?: boolean;
  read?: () => Promise<ReaderResult>;
}): BriefHarness {
  const svc = Object.create(SeoBriefService.prototype) as Record<
    string,
    unknown
  > & { lastRead?: { entityId: string; role: string } };
  svc.logger = { warn() {}, log() {}, error() {} };
  svc.featureFlags = { seoBriefWikiEnabled: opts.wikiEnabled ?? true };
  // Stub du reader unique (C0 : composeBrief délègue à projectionReader.readActiveProjection).
  // Enregistre (entityId, role) pour prouver la dérivation ; le mapping p_entity_id/p_role est
  // désormais testé dans l'unité du reader.
  svc.projectionReader = {
    readActiveProjection: (entityId: string, role: string) => {
      svc.lastRead = { entityId, role };
      return (
        opts.read ??
        (() =>
          Promise.resolve({
            envelope: null,
            degradeReason: 'projection absente',
          }))
      )();
    },
  };
  return svc as unknown as BriefHarness;
}

const sourcedBlocks = (n: number, role = 'R3_CONSEILS') =>
  Array.from({ length: n }, (_, i) => ({
    role,
    block_kind: `sec${i}`,
    content: {
      content_md: 'x'.repeat(80),
      source_ids: [`oem:s${i}`],
      truth_level: 'sourced' as const,
      section: `sec${i}`,
    },
  }));

describe('composeBrief — caractérisation (behavior-identical guard C0)', () => {
  it('flag OFF → dégradé observable (SEO_BRIEF_WIKI_ENABLED=false), aucune lecture RPC', async () => {
    const h = makeBrief({ wikiEnabled: false });
    const b = await h.composeBrief({
      pgAlias: 'filtre-a-huile',
      pageRole: 'R3_CONSEILS',
    });
    expect(b.wiki_available).toBe(false);
    expect(b.brief_source).toBe('keyword');
    expect(b.entity_id).toBe('gamme:filtre-a-huile');
    expect(b.substance_gate.reasons).toEqual(['SEO_BRIEF_WIKI_ENABLED=false']);
    expect(b.substance_gate.floor).toBe(SUBSTANCE_FLOOR_BY_ROLE.R3_CONSEILS);
    expect(h.lastRead).toBeUndefined(); // pas de lecture quand le flag est OFF
  });

  it('RPC error → dégradé observable "RPC error: <msg>"', async () => {
    const h = makeBrief({
      read: () =>
        Promise.resolve({ envelope: null, degradeReason: 'RPC error: boom' }),
    });
    const b = await h.composeBrief({
      pgAlias: 'filtre-a-huile',
      pageRole: 'R3_CONSEILS',
    });
    expect(b.wiki_available).toBe(false);
    expect(b.brief_source).toBe('keyword');
    expect(b.substance_gate.reasons).toEqual(['RPC error: boom']);
  });

  it('RPC exception → dégradé observable "RPC exception"', async () => {
    // Le reader capture l'exception et renvoie degradeReason (SeoBriefService ne catch plus).
    const h = makeBrief({
      read: () =>
        Promise.resolve({ envelope: null, degradeReason: 'RPC exception' }),
    });
    const b = await h.composeBrief({
      pgAlias: 'filtre-a-huile',
      pageRole: 'R3_CONSEILS',
    });
    expect(b.wiki_available).toBe(false);
    expect(b.substance_gate.reasons).toEqual(['RPC exception']);
  });

  it('projection absente (envelope null) → dégradé "projection absente"', async () => {
    const h = makeBrief({
      read: () =>
        Promise.resolve({
          envelope: null,
          degradeReason: 'projection absente',
        }),
    });
    const b = await h.composeBrief({
      pgAlias: 'filtre-a-huile',
      pageRole: 'R3_CONSEILS',
    });
    expect(b.wiki_available).toBe(false);
    expect(b.substance_gate.reasons).toEqual(['projection absente']);
  });

  it('vehicleSlug → entity_id vehicle: + role R8_VEHICLE (dérivation passée au reader)', async () => {
    const h = makeBrief({
      read: () =>
        Promise.resolve({
          envelope: null,
          degradeReason: 'projection absente',
        }),
    });
    await h.composeBrief({
      vehicleSlug: 'golf-5-1-9-tdi',
      pageRole: 'R8_VEHICLE',
    });
    expect(h.lastRead).toEqual({
      entityId: 'vehicle:golf-5-1-9-tdi',
      role: 'R8_VEHICLE',
    });
  });

  it('projection valide (5 blocs sourced R3) → wiki_evidence, gate PASS', async () => {
    const env = {
      entity_id: 'gamme:filtre-a-huile',
      entity_type: 'gamme',
      slug: 'filtre-a-huile',
      facts: [],
      blocks: sourcedBlocks(5, 'R3_CONSEILS'),
    };
    const h = makeBrief({
      read: () => Promise.resolve({ envelope: env, degradeReason: null }),
    });
    const b = await h.composeBrief({
      pgAlias: 'filtre-a-huile',
      pageRole: 'R3_CONSEILS',
    });
    expect(b.wiki_available).toBe(true);
    expect(b.brief_source).toBe('wiki_evidence');
    expect(b.proprietary_count).toBe(5);
    expect(b.substance_gate.pass).toBe(true);
    expect(b.substance_elements).toHaveLength(5);
    // role mappé vers R3_CONSEILS (R3_CONSEILS/R3_GUIDE partagent les blocs R3).
    expect(h.lastRead?.role).toBe('R3_CONSEILS');
  });
});
