import type { DiagnosticProjectionReference } from '../diagnostic-engine.data-service';
import { resolveDiagnosticProjection } from './diagnostic-projection-resolver';
import {
  CONFLICT_REASONS,
  type GammeExportEnvelope,
  type LoadedGammeExport,
} from './diagnostic-projection.types';

// Référentiel calqué sur la DB réelle (ids et slugs des liens 113 / 114 / 117),
// avec les leurres 152 (→ filtre_huile_colmate) et 153 (perte_puissance →
// filtre_habitacle_sature), et les causes homonymes d'autres systèmes.
const system = (id: number, slug: string) => ({
  id,
  slug,
  label: slug,
  description: null,
  display_order: id,
  active: true,
});
const symptom = (id: number, slug: string, systemId: number) => ({
  id,
  slug,
  system_id: systemId,
  label: slug,
  description: null,
  signal_mode: 'symptom_slugs',
  urgency: 'moyenne',
  active: true,
});
const cause = (id: number, slug: string, systemId: number) => ({
  id,
  slug,
  system_id: systemId,
  label: slug,
  cause_type: 'maintenance_related',
  description: null,
  verification_method: null,
  urgency: 'moyenne',
  active: true,
});
const link = (id: number, symptomId: number, causeId: number) => ({
  id,
  symptom_id: symptomId,
  cause_id: causeId,
  relative_score: 50,
  evidence_for: [],
  evidence_against: [],
  requires_verification: true,
  active: true,
});

const reference: DiagnosticProjectionReference = {
  systems: [system(1, 'filtration'), system(2, 'injection'), system(3, 'clim')],
  symptoms: [
    symptom(10, 'perte_puissance_filtration', 1),
    symptom(11, 'odeur_habitacle', 1),
  ],
  causes: [
    cause(20, 'filtre_air_colmate', 1),
    cause(21, 'filtre_carburant_colmate', 1),
    cause(22, 'filtre_habitacle_sature', 1),
    cause(23, 'filtre_carburant_injection', 2),
    cause(24, 'filtre_habitacle_clim', 3),
    cause(25, 'filtre_huile_colmate', 1),
  ],
  links: [
    link(113, 10, 20),
    link(114, 10, 21),
    link(117, 11, 22),
    link(152, 10, 25),
    link(153, 10, 22),
  ],
};

const COMMIT = 'a'.repeat(40);
const HASH = `sha256:${'b'.repeat(64)}`;

function relation(overrides: Record<string, unknown> = {}) {
  return {
    relation_index: 0,
    relation_sha256: HASH,
    symptom_slug: 'perte_puissance_filtration',
    system_slug: 'filtration',
    relation_to_part: 'possible_cause',
    part_role: 'Un filtre colmaté réduit le débit disponible.',
    evidence: {
      confidence: 'medium',
      source_policy: '2_medium_concordant',
      reviewed: true,
      diagnostic_safe: false,
    },
    confidence_score_computed: 0.6,
    sources: [
      {
        slug: 'oem_doc',
        catalog_slug: 'oem_doc',
        type: 'oem',
        status: 'active',
        raw_ref: null,
        raw_proven: true,
      },
    ],
    ...overrides,
  };
}

function gammeFile(slug: string, relations: unknown[]): LoadedGammeExport {
  const envelope: GammeExportEnvelope = {
    schema_version: '1.0.0',
    builder_version: '1.0.0',
    export_kind: 'diagnostic_gamme',
    gamme_slug: slug,
    wiki_path: `wiki/gamme/${slug}.md`,
    source_wiki_commit: COMMIT,
    source_catalog_commit: COMMIT,
    content_hash: HASH,
    relations,
  };
  return { path: `gamme/${slug}.json`, envelope };
}

const unproven = { ...relation().sources[0], raw_proven: false };

describe('resolveDiagnosticProjection', () => {
  it('resolves the three real relations to links 113 / 114 / 117, never to a decoy', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [relation()]),
        gammeFile('filtre-a-carburant', [relation()]),
        gammeFile('filtre-d-habitacle', [
          relation({ symptom_slug: 'odeur_habitacle' }),
        ]),
      ],
      reference,
    );

    expect(result.conflicts).toEqual([]);
    expect(result.exportedCount).toBe(3);
    expect(
      result.projections.map((row) => [row.gamme_slug, row.link_id]),
    ).toEqual([
      ['filtre-a-air', 113],
      ['filtre-a-carburant', 114],
      ['filtre-d-habitacle', 117],
    ]);
    // filtre_carburant_injection et filtre_habitacle_clim mappent les mêmes
    // gammes mais vivent dans un autre système : jamais candidats.
    expect(result.projections[0]).toEqual({
      link_id: 113,
      wiki_path: 'wiki/gamme/filtre-a-air.md',
      gamme_slug: 'filtre-a-air',
      wiki_commit: COMMIT,
      content_hash: HASH,
      relation_to_part: 'possible_cause',
      part_role: 'Un filtre colmaté réduit le débit disponible.',
      confidence: 'medium',
      source_policy: '2_medium_concordant',
      confidence_score_computed: 0.6,
      reviewed: true,
      diagnostic_safe: false,
      sources: relation().sources,
    });
  });

  it('launch state: every source unproven → 0 projection, 3 source_not_raw_proven conflicts', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [relation({ sources: [unproven] })]),
        gammeFile('filtre-a-carburant', [relation({ sources: [unproven] })]),
        gammeFile('filtre-d-habitacle', [
          relation({ symptom_slug: 'odeur_habitacle', sources: [unproven] }),
        ]),
      ],
      reference,
    );

    expect(result.projections).toEqual([]);
    expect(result.conflicts.map((row) => [row.reason, row.detail])).toEqual([
      [
        'source_not_raw_proven',
        { link_id: 113, unproven_sources: ['oem_doc'] },
      ],
      [
        'source_not_raw_proven',
        { link_id: 114, unproven_sources: ['oem_doc'] },
      ],
      [
        'source_not_raw_proven',
        { link_id: 117, unproven_sources: ['oem_doc'] },
      ],
    ]);
  });

  it('one proven and one unproven source → still a conflict naming only the unproven one', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({
            sources: [
              relation().sources[0],
              { ...unproven, slug: 'forum_thread' },
            ],
          }),
        ]),
      ],
      reference,
    );
    expect(result.conflicts[0].detail).toEqual({
      link_id: 113,
      unproven_sources: ['forum_thread'],
    });
  });

  it('schema_invalid keeps the slugs null and lists the failing paths', () => {
    const invalid = relation({ part_role: undefined, sources: [] });
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [invalid])],
      reference,
    );
    expect(result.conflicts).toEqual([
      {
        wiki_path: 'wiki/gamme/filtre-a-air.md',
        gamme_slug: 'filtre-a-air',
        relation_index: 0,
        symptom_slug: null,
        system_slug: null,
        reason: 'schema_invalid',
        detail: {
          issues: [
            { path: 'part_role', code: 'invalid_type' },
            { path: 'sources', code: 'too_small' },
          ],
        },
      },
    ]);
  });

  it.each([
    [
      'not_a_cause_relation',
      relation({ relation_to_part: 'symptom_amplifier' }),
      { relation_to_part: 'symptom_amplifier' },
    ],
    ['unknown_symptom', relation({ symptom_slug: 'bruit_inconnu' }), {}],
    [
      'system_mismatch',
      relation({ system_slug: 'injection' }),
      { symptom_system_slug: 'filtration' },
    ],
    // odeur_habitacle : la cause mappée sur filtre-a-air (20) n'a aucun lien actif avec lui.
    [
      'no_matching_link',
      relation({ symptom_slug: 'odeur_habitacle' }),
      { leg: 'no_active_link', mapped_cause_slugs: ['filtre_air_colmate'] },
    ],
  ])('%s', (reason, input, detail) => {
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [input])],
      reference,
    );
    expect(result.projections).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].detail).toEqual(detail);
    expect(result.conflicts[0]).toMatchObject({
      reason,
      detail,
      relation_index: 0,
      symptom_slug: (input as { symptom_slug: string }).symptom_slug,
      system_slug: (input as { system_slug: string }).system_slug,
    });
  });

  it('ambiguous_cause when two causes of the system map to the gamme with a live link', () => {
    const gammeMap = {
      filtre_air_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
      ],
      filtre_huile_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
      ],
    };
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [relation()])],
      reference,
      gammeMap,
    );
    expect(result.conflicts[0]).toMatchObject({
      reason: 'ambiguous_cause',
      detail: {
        cause_slugs: ['filtre_air_colmate', 'filtre_huile_colmate'],
        link_ids: [113, 152],
      },
    });
  });

  it('a cause of another system is never a candidate, even with a live link to the symptom', () => {
    // filtre_carburant_injection (système injection) mappe aussi filtre-a-carburant.
    // En DB elle n'a aucun lien avec ce symptôme : on lui en donne un (999) pour
    // que seul le filtre par système l'écarte.
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-carburant', [relation()])],
      { ...reference, links: [...reference.links, link(999, 10, 23)] },
    );
    expect(result.conflicts).toEqual([]);
    expect(result.projections.map((row) => row.link_id)).toEqual([114]);
  });

  it('duplicate_relation is reserved before the proof check', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({ sources: [unproven] }),
          relation({ relation_index: 1 }),
        ]),
      ],
      reference,
    );
    expect(result.projections).toEqual([]);
    expect(result.conflicts.map((row) => [row.reason, row.detail])).toEqual([
      [
        'source_not_raw_proven',
        { link_id: 113, unproven_sources: ['oem_doc'] },
      ],
      ['duplicate_relation', { link_id: 113, first_relation_index: 0 }],
    ]);
  });

  it('the same link documented by two fiches gives two projections', () => {
    const gammeMap = {
      filtre_air_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
        { slug: 'filtre-a-air-sport', label: 'Filtre à air sport', pg_id: 8 },
      ],
    };
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [relation()]),
        gammeFile('filtre-a-air-sport', [relation()]),
      ],
      reference,
      gammeMap,
    );
    expect(
      result.projections.map((row) => [row.link_id, row.wiki_path]),
    ).toEqual([
      [113, 'wiki/gamme/filtre-a-air.md'],
      [113, 'wiki/gamme/filtre-a-air-sport.md'],
    ]);
  });

  it('the first failing check wins, in CONFLICT_REASONS order', () => {
    // Non-cause ET symptôme inconnu : la raison est la première dans l'ordre.
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({
            relation_to_part: 'secondary_effect',
            symptom_slug: 'bruit_inconnu',
          }),
        ]),
      ],
      reference,
    );
    expect(result.conflicts[0].reason).toBe('not_a_cause_relation');
    expect(CONFLICT_REASONS.indexOf('not_a_cause_relation')).toBeLessThan(
      CONFLICT_REASONS.indexOf('unknown_symptom'),
    );
  });

  it('every exported relation ends as exactly one projection or conflict', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation(),
          relation({ symptom_slug: 'bruit_inconnu', relation_index: 1 }),
          { not: 'a relation' },
        ]),
        gammeFile('filtre-d-habitacle', [
          relation({ symptom_slug: 'odeur_habitacle' }),
        ]),
      ],
      reference,
    );
    expect(result.exportedCount).toBe(4);
    expect(result.projections).toHaveLength(2);
    expect(result.conflicts.map((row) => row.reason)).toEqual([
      'unknown_symptom',
      'schema_invalid',
    ]);
    expect(result.conflicts.map((row) => row.relation_index)).toEqual([1, 2]);
  });

  it('a conflict before the reservation step does not consume the link', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({ relation_to_part: 'symptom_amplifier' }),
          relation({ relation_index: 1 }),
        ]),
      ],
      reference,
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      reason: 'not_a_cause_relation',
      relation_index: 0,
      detail: { relation_to_part: 'symptom_amplifier' },
    });
    expect(
      result.projections.map((row) => [row.link_id, row.wiki_path]),
    ).toEqual([[113, 'wiki/gamme/filtre-a-air.md']]);
  });

  it('throws on two links sharing the same (symptom_id, cause_id) pair', () => {
    expect(() =>
      resolveDiagnosticProjection([gammeFile('filtre-a-air', [relation()])], {
        ...reference,
        links: [...reference.links, link(900, 10, 20)],
      }),
    ).toThrow(/10:20.*113.*900/);
  });

  it('a cause slug such as "constructor" is never a gamme mapping (no TypeError)', () => {
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [relation()])],
      {
        ...reference,
        causes: [cause(26, 'constructor', 1)],
        links: [link(300, 10, 26)],
      },
      {},
    );
    expect(result.projections).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe('no_matching_link');
    expect(result.conflicts[0].detail).toEqual({
      leg: 'no_gamme_mapping',
      mapped_cause_slugs: [],
    });
  });

  it('no_matching_link: a mapped cause whose link is absent reports no_active_link with sorted mapped slugs', () => {
    const gammeMap = {
      filtre_huile_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
      ],
      filtre_air_colmate: [
        { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
      ],
    };
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation({ symptom_slug: 'odeur_habitacle' }),
        ]),
      ],
      reference,
      gammeMap,
    );
    expect(result.conflicts[0]).toMatchObject({
      reason: 'no_matching_link',
      detail: {
        leg: 'no_active_link',
        mapped_cause_slugs: ['filtre_air_colmate', 'filtre_huile_colmate'],
      },
    });
  });

  it('relation_index exported different from the array position is schema_invalid', () => {
    const result = resolveDiagnosticProjection(
      [
        gammeFile('filtre-a-air', [
          relation(),
          relation({ symptom_slug: 'odeur_habitacle', relation_index: 7 }),
        ]),
      ],
      reference,
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      reason: 'schema_invalid',
      relation_index: 1,
      symptom_slug: null,
      detail: { field: 'relation_index', exported: 7, position: 1 },
    });
  });

  it('a relation without relation_index is schema_invalid', () => {
    const { relation_index: _omit, ...withoutIndex } = relation();
    const result = resolveDiagnosticProjection(
      [gammeFile('filtre-a-air', [withoutIndex])],
      reference,
    );
    expect(result.conflicts[0]).toMatchObject({
      reason: 'schema_invalid',
      detail: { issues: [{ path: 'relation_index', code: 'invalid_type' }] },
    });
  });

  it('throws naming the duplicated (link_id, wiki_path) when a fiche is listed twice', () => {
    const file = gammeFile('filtre-a-air', [relation()]);
    expect(() => resolveDiagnosticProjection([file, file], reference)).toThrow(
      /113.*wiki\/gamme\/filtre-a-air\.md/,
    );
  });
});
