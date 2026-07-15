/**
 * ProjectionR3Mapper (P2-R3-C) — mapper PUR/DÉTERMINISTE ProjectionEnvelope → DTO R3.
 *
 * Ne teste QUE le mapping (aucune I/O, RPC, Supabase, flag, cache). Le vocabulaire de
 * sections est le vocabulaire CANONIQUE existant (`PLANNABLE_SECTIONS` = enum
 * `page-contract-r3.json` section_terms) — aucun vocabulaire fabriqué.
 *
 * Fixture réaliste : blocs conformes au contrat d'export/projection actuel
 * (exports-seo.schema.json v1.1.0, ADR-086 — post-RPC : champs sous `content`,
 * source_ids préfixés db:|web:|oem:, truth_level ∈ db_owned|sourced|inferred|editorial).
 */
import { PLANNABLE_SECTIONS } from '@config/keyword-plan.constants';
import type { ProjectionEnvelope } from './seo-projection-reader.service';
import { mapR3Projection, R3_MAPPER_ROLE } from './projection-r3.mapper';

// Le vocabulaire canonique existant EST le référentiel de slots reconnus.
const CANON = PLANNABLE_SECTIONS as readonly string[];

/** Bloc de projection R3 conforme au contrat (post-RPC : champs sous `content`). */
function r3Block(
  section: string | null,
  content_md: string,
  source_ids: string[],
  truth_level: string,
  usefulness_target: string | null = null,
) {
  return {
    role: 'R3_CONSEILS',
    content: {
      content_md,
      source_ids,
      truth_level,
      section,
      usefulness_target,
    },
  };
}

function envelope(
  blocks: unknown[],
  entity_id = 'gamme:filtre-a-huile',
): ProjectionEnvelope {
  return {
    entity_id,
    entity_type: 'gamme',
    slug: 'filtre-a-huile',
    facts: [],
    blocks: blocks as ProjectionEnvelope['blocks'],
  };
}

/** 3 blocs R3 canoniques réalistes (S1, S2_DIAG, S4_DEPOSE). */
function threeValidR3() {
  return [
    r3Block(
      'S1',
      '## Checklist\n- vérifier le filtre',
      ['db:pieces_gamme'],
      'db_owned',
    ),
    r3Block(
      'S2_DIAG',
      '| symptôme | cause |\n|---|---|\n| perte puissance | filtre colmaté |',
      ['web:evidence-42', 'oem:bosch-1'],
      'sourced',
      'diagnostic',
    ),
    r3Block(
      'S4_DEPOSE',
      '1. Débrancher\n2. Déposer',
      ['specialist:garage-durand'],
      'sourced',
    ),
  ];
}

describe('mapR3Projection — sanity du référentiel canonique', () => {
  it('les section_id de test appartiennent au vocabulaire canonique (0 invention)', () => {
    expect(CANON).toContain('S1');
    expect(CANON).toContain('S2_DIAG');
    expect(CANON).toContain('S4_DEPOSE');
    expect(R3_MAPPER_ROLE).toBe('R3_CONSEILS');
  });
});

describe('mapR3Projection — 1. projection R3 valide → DTO exact attendu', () => {
  it('mappe chaque section canonique dans son slot, verbatim, ready=true', () => {
    const r = mapR3Projection(envelope(threeValidR3()));
    expect(r.role).toBe('R3_CONSEILS');
    expect(r.entityId).toBe('gamme:filtre-a-huile');
    expect(r.mapped).toEqual(['S1', 'S2_DIAG', 'S4_DEPOSE']);
    expect(r.unmapped).toEqual([]);
    expect(r.invalid).toEqual([]);
    expect(r.ignoredNonR3).toBe(0);
    expect(r.ready).toBe(true);
    expect(r.slots.S1).toEqual({
      section: 'S1',
      content_md: '## Checklist\n- vérifier le filtre',
      source_ids: ['db:pieces_gamme'],
      truth_level: 'db_owned',
      usefulness_target: null,
    });
    expect(r.slots.S2_DIAG).toEqual({
      section: 'S2_DIAG',
      content_md:
        '| symptôme | cause |\n|---|---|\n| perte puissance | filtre colmaté |',
      source_ids: ['web:evidence-42', 'oem:bosch-1'],
      truth_level: 'sourced',
      usefulness_target: 'diagnostic',
    });
  });
});

describe('mapR3Projection — 2. mélange R3/R4/R6 → seuls les blocs R3 mappés', () => {
  it('ignore les rôles non-R3 (comptés) et ne mappe que R3', () => {
    const blocks = [
      r3Block('S1', 'conseil R3', ['db:x'], 'db_owned'),
      {
        role: 'R4_REFERENCE',
        content: {
          content_md: 'ref R4',
          source_ids: ['db:y'],
          truth_level: 'db_owned',
          section: 'S1',
          usefulness_target: null,
        },
      },
      {
        role: 'R6_GUIDE_ACHAT',
        content: {
          content_md: 'guide R6',
          source_ids: ['db:z'],
          truth_level: 'db_owned',
          section: 'S3',
          usefulness_target: null,
        },
      },
    ];
    const r = mapR3Projection(envelope(blocks));
    expect(r.mapped).toEqual(['S1']);
    expect(Object.keys(r.slots)).toEqual(['S1']);
    expect(r.ignoredNonR3).toBe(2);
    expect(r.slots.S1.content_md).toBe('conseil R3');
  });
});

describe('mapR3Projection — 3. ordre des blocs inversé → résultat identique', () => {
  it('produit un DTO identique quel que soit l’ordre d’entrée', () => {
    const fwd = mapR3Projection(envelope(threeValidR3()));
    const rev = mapR3Projection(envelope([...threeValidR3()].reverse()));
    expect(rev).toEqual(fwd);
  });
});

describe('mapR3Projection — 4. section inconnue → exclue + diagnostic observable', () => {
  it('exclut les sections non canoniques / manquantes sans les interpréter', () => {
    const blocks = [
      r3Block('S1', 'ok', ['db:x'], 'db_owned'),
      r3Block('S99_INVENTED', 'section hors canon', ['web:e1'], 'sourced'),
      r3Block(null, 'section absente', ['web:e2'], 'sourced'),
    ];
    const r = mapR3Projection(envelope(blocks));
    expect(r.mapped).toEqual(['S1']);
    expect(Object.keys(r.slots)).toEqual(['S1']);
    expect(r.unmapped).toEqual([
      { section: null, reason: 'missing_section', truth_level: 'sourced' },
      {
        section: 'S99_INVENTED',
        reason: 'unknown_section',
        truth_level: 'sourced',
      },
    ]);
    // Section inconnue = exclue + observable, PAS invalid.
    expect(r.invalid).toEqual([]);
  });
});

describe('mapR3Projection — 5. deux blocs → même slot → invalid, pas de last-write-wins', () => {
  it('refuse la collision : aucun slot émis, résultat invalid', () => {
    const blocks = [
      r3Block('S1', 'PREMIER contenu', ['db:a'], 'db_owned'),
      r3Block('S1', 'SECOND contenu', ['db:b'], 'sourced'),
    ];
    const r = mapR3Projection(envelope(blocks));
    expect(r.slots.S1).toBeUndefined(); // pas de last-write-wins
    expect(r.mapped).not.toContain('S1');
    expect(r.invalid).toEqual([
      {
        kind: 'slot_collision',
        section: 'S1',
        detail: '2 blocs R3 revendiquent le slot S1',
      },
    ]);
    expect(r.ready).toBe(false);
  });
});

describe('mapR3Projection — 6. slot requis absent → invalid/incomplet, jamais prêt', () => {
  it('marque required_slot_missing et ready=false quand un requis manque', () => {
    const r = mapR3Projection(
      envelope([r3Block('S1', 'seul S1', ['db:x'], 'db_owned')]),
      { requiredSections: ['S1', 'S2_DIAG'] },
    );
    expect(r.mapped).toEqual(['S1']);
    expect(r.invalid).toEqual([
      {
        kind: 'required_slot_missing',
        section: 'S2_DIAG',
        detail: 'slot requis S2_DIAG absent de la projection',
      },
    ]);
    expect(r.ready).toBe(false);
  });
});

describe('mapR3Projection — 7. provenance et contenu conservés byte-for-byte', () => {
  it('préserve content_md/source_ids/truth_level/usefulness_target verbatim et ne mute pas l’entrée', () => {
    const md = 'Ligne 1\r\n  espaces  \nÉÀÇ — “guillemets” 日本語';
    const sids = ['db:pieces_gamme', 'web:ev-7', 'oem:mann-9'];
    const block = r3Block('S3', md, sids, 'sourced', 'compatibility');
    const env = envelope([block]);
    const snapshotIn = JSON.stringify(env);

    const r = mapR3Projection(env);
    expect(r.slots.S3.content_md).toBe(md);
    expect(r.slots.S3.source_ids).toEqual(sids);
    expect(r.slots.S3.truth_level).toBe('sourced');
    expect(r.slots.S3.usefulness_target).toBe('compatibility');
    // Aucune reformulation / complétion.
    expect(r.slots.S3.content_md.length).toBe(md.length);
    // Entrée non mutée.
    expect(JSON.stringify(env)).toBe(snapshotIn);
  });
});

describe('mapR3Projection — 8. envelope vide ou sans R3 → résultat explicite, aucune exception', () => {
  it('blocks vide → résultat explicite non-prêt sans throw', () => {
    const r = mapR3Projection(envelope([]));
    expect(r.mapped).toEqual([]);
    expect(r.slots).toEqual({});
    expect(r.unmapped).toEqual([]);
    expect(r.invalid).toEqual([]);
    expect(r.ready).toBe(false);
  });

  it('aucun bloc R3 (que du R4) → explicite, ignoredNonR3 comptés, non-prêt', () => {
    const blocks = [
      {
        role: 'R4_REFERENCE',
        content: {
          content_md: 'r4',
          source_ids: ['db:y'],
          truth_level: 'db_owned',
          section: 'S1',
          usefulness_target: null,
        },
      },
    ];
    const r = mapR3Projection(envelope(blocks));
    expect(r.mapped).toEqual([]);
    expect(r.ignoredNonR3).toBe(1);
    expect(r.ready).toBe(false);
  });
});
