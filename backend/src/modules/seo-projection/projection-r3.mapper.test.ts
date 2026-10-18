/**
 * ProjectionR3Mapper (P2-R3-C, contrat de rendu ADR-106) — mapper PUR/DÉTERMINISTE
 * ProjectionEnvelope → DTO R3.
 *
 * Ne teste QUE le mapping (aucune I/O, RPC, Supabase, flag, cache). Entrée = sections SÉMANTIQUES
 * du WIKI (ADR-086 §2bis) ; sortie = sections SERVIES (`PLANNABLE_SECTIONS` = enum
 * `page-contract-r3.json` section_terms) via la table D2 d'ADR-106 — aucun vocabulaire fabriqué.
 *
 * Fixture réaliste : même disposition de blocs que l'export WIKI `gamme/filtre-a-huile` épinglé
 * (rôles, sections, truth_level — contenu synthétique), conforme à exports-seo.schema.json v1.1.0
 * post-RPC (champs sous `content`, source_ids préfixés, truth_level ∈ db_owned|sourced|inferred|editorial).
 */
import { PLANNABLE_SECTIONS } from '@config/keyword-plan.constants';
import type { ProjectionEnvelope } from './seo-projection-reader.service';
import {
  mapR3Projection,
  R3_MAPPER_ROLE,
  R3_RENDER_CONTRACT,
  R3_RENDER_CONTRACT_VERSION,
} from './projection-r3.mapper';

/** Bloc de projection conforme au contrat (post-RPC : champs sous `content`). */
function block(
  role: string,
  section: string | null,
  content_md: string,
  source_ids: string[] = ['web:ev-1'],
  truth_level = 'sourced',
  usefulness_target: string | null = null,
) {
  return {
    role,
    content: {
      content_md,
      source_ids,
      truth_level,
      section,
      usefulness_target,
    },
  };
}

const r3 = (
  section: string | null,
  content_md: string,
  source_ids?: string[],
  truth_level?: string,
  usefulness_target?: string | null,
) =>
  block(
    R3_MAPPER_ROLE,
    section,
    content_md,
    source_ids,
    truth_level,
    usefulness_target,
  );

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

/** Le minimum prêt à servir (D5) : function + maintenance_interval + failure_symptoms. */
function tierM() {
  return [
    r3('function', 'Le filtre retient les impuretés.', ['web:ev-f']),
    r3('maintenance_interval', 'Remplacer à chaque vidange.', ['oem:ev-m']),
    r3('failure_symptoms', 'Témoin de pression allumé.', ['web:ev-s']),
  ];
}

/** Disposition de l'export `gamme/filtre-a-huile` épinglé (contenu synthétique). */
function realExportLayout() {
  return [
    r3('maintenance', 'prose éditoriale hors enum', ['raw:x'], 'editorial'),
    block('R4_REFERENCE', 'related', 'liés', ['db:y'], 'db_owned'),
    block('R6_GUIDE_ACHAT', 'selection', 'sélection', ['db:z'], 'inferred'),
    block('R4_REFERENCE', 'definition', 'définition', ['db:w'], 'inferred'),
    ...tierM(),
    block('R4_REFERENCE', 'variants', 'variantes'),
    block('R6_GUIDE_ACHAT', 'selection_criteria', 'critères'),
    block('R6_GUIDE_ACHAT', 'quality_tiers', 'gammes de qualité'),
    r3('replacement_guidance', 'conseils de remplacement'),
    r3('faq', 'Q : quand changer ? R : à la vidange.', ['web:ev-q']),
  ];
}

describe('mapR3Projection — 0. table D2 d’ADR-106', () => {
  it('la table est exactement celle de l’ADR (version 1.0.0)', () => {
    expect(R3_RENDER_CONTRACT_VERSION).toBe('1.0.0');
    expect(R3_RENDER_CONTRACT).toEqual({
      function: { kind: 'component', slot: 'S1', required: true },
      maintenance_interval: { kind: 'component', slot: 'S2', required: true },
      failure_symptoms: { kind: 'component', slot: 'S2', required: true },
      removal_procedure: {
        kind: 'component',
        slot: 'S4_DEPOSE',
        required: false,
      },
      installation_procedure: {
        kind: 'component',
        slot: 'S4_REPOSE',
        required: false,
      },
      post_install_checks: { kind: 'component', slot: 'S6', required: false },
      faq: { kind: 'component', slot: 'S8', required: false },
      safety_warnings: { kind: 'callout', hosts: ['S4_DEPOSE', 'S4_REPOSE'] },
      replacement_guidance: { kind: 'not_projected' },
    });
  });

  it('chaque slot cible appartient au vocabulaire servi canonique (0 invention)', () => {
    for (const entry of Object.values(R3_RENDER_CONTRACT)) {
      const targets =
        entry.kind === 'component'
          ? [entry.slot]
          : entry.kind === 'callout'
            ? entry.hosts
            : [];
      for (const t of targets) expect(PLANNABLE_SECTIONS).toContain(t);
    }
  });

  it('D3 : aucune entrée n’alimente S2_DIAG, S3, S7 ni S_GARAGE', () => {
    const fed = Object.values(R3_RENDER_CONTRACT).flatMap((e) =>
      e.kind === 'component' ? [e.slot] : e.kind === 'callout' ? e.hosts : [],
    );
    for (const dbOnly of ['S2_DIAG', 'S3', 'S7', 'S_GARAGE']) {
      expect(fed).not.toContain(dbOnly);
    }
  });
});

describe('mapR3Projection — 1. disposition réelle de l’export → prête à servir', () => {
  it('mappe S1/S2/S8, compte les sections hors table et non projetées, ignore R4/R6', () => {
    const r = mapR3Projection(envelope(realExportLayout()));
    expect(r.role).toBe('R3_CONSEILS');
    expect(r.renderContractVersion).toBe('1.0.0');
    expect(r.entityId).toBe('gamme:filtre-a-huile');
    expect(r.mapped).toEqual(['S1', 'S2', 'S8']);
    expect(r.invalid).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.ignoredNonR3).toBe(6);
    expect(r.unmapped).toEqual([
      {
        section: 'maintenance',
        reason: 'unknown_section',
        truth_level: 'editorial',
      },
      {
        section: 'replacement_guidance',
        reason: 'not_projected',
        truth_level: 'sourced',
      },
    ]);
  });

  it('S2 = deux composants, intervalle PUIS signes, chacun verbatim', () => {
    const r = mapR3Projection(envelope(tierM()));
    expect(r.slots.S2).toEqual({
      section: 'S2',
      components: [
        {
          wiki_section: 'maintenance_interval',
          content_md: 'Remplacer à chaque vidange.',
          source_ids: ['oem:ev-m'],
          truth_level: 'sourced',
          usefulness_target: null,
        },
        {
          wiki_section: 'failure_symptoms',
          content_md: 'Témoin de pression allumé.',
          source_ids: ['web:ev-s'],
          truth_level: 'sourced',
          usefulness_target: null,
        },
      ],
      callouts: [],
    });
  });
});

describe('mapR3Projection — 2. complétude D5 = tier M d’ADR-086', () => {
  it.each(['function', 'maintenance_interval', 'failure_symptoms'])(
    'sans %s → required_slot_missing, jamais prête',
    (missing) => {
      const r = mapR3Projection(
        envelope(tierM().filter((b) => b.content.section !== missing)),
      );
      const slot = R3_RENDER_CONTRACT[missing as 'function'].slot;
      expect(r.ready).toBe(false);
      expect(r.invalid).toEqual([
        {
          kind: 'required_slot_missing',
          section: missing,
          slot,
          detail: `composant obligatoire ${missing} (tier M ADR-086) non livré : slot ${slot} incomplet`,
        },
      ]);
    },
  );

  it('un seul composant S2 présent → rendu seul, mais la page reste non prête', () => {
    const r = mapR3Projection(
      envelope(tierM().filter((b) => b.content.section !== 'failure_symptoms')),
    );
    expect(r.slots.S2?.components.map((c) => c.wiki_section)).toEqual([
      'maintenance_interval',
    ]);
    expect(r.ready).toBe(false);
  });

  it('les sections optionnelles ne sont jamais exigées (tier M seul suffit)', () => {
    const r = mapR3Projection(envelope(tierM()));
    expect(r.mapped).toEqual(['S1', 'S2']);
    expect(r.ready).toBe(true);
  });

  it('les sections servies du pack `standard` ne sont PAS lues : un bloc `S1` est hors table', () => {
    const r = mapR3Projection(
      envelope([
        r3('S1', 'section servie'),
        r3('S2', 'section servie'),
        r3('S3', 'section servie'),
      ]),
    );
    expect(r.mapped).toEqual([]);
    expect(r.unmapped.map((u) => [u.section, u.reason])).toEqual([
      ['S1', 'unknown_section'],
      ['S2', 'unknown_section'],
      ['S3', 'unknown_section'],
    ]);
    expect(r.ready).toBe(false);
  });
});

describe('mapR3Projection — 3. sections optionnelles et encadré de sécurité (D2/D4)', () => {
  it('procédures, vérifications et FAQ vont dans leur slot servi', () => {
    const r = mapR3Projection(
      envelope([
        ...tierM(),
        r3('removal_procedure', '1. Vidanger 2. Dévisser'),
        r3('installation_procedure', '1. Huiler le joint 2. Visser'),
        r3('post_install_checks', 'Contrôler l’absence de fuite.'),
        r3('faq', 'Q/R'),
      ]),
    );
    expect(r.mapped).toEqual([
      'S1',
      'S2',
      'S4_DEPOSE',
      'S4_REPOSE',
      'S6',
      'S8',
    ]);
    expect(r.ready).toBe(true);
  });

  it('safety_warnings = encadré de la première procédure présente (S4_DEPOSE)', () => {
    const r = mapR3Projection(
      envelope([
        ...tierM(),
        r3('removal_procedure', 'dépose'),
        r3('installation_procedure', 'repose'),
        r3('safety_warnings', 'Huile chaude : risque de brûlure.'),
      ]),
    );
    expect(r.slots.S4_DEPOSE?.callouts.map((c) => c.content_md)).toEqual([
      'Huile chaude : risque de brûlure.',
    ]);
    expect(r.slots.S4_REPOSE?.callouts).toEqual([]);
    expect(r.mapped).not.toContain('S5');
  });

  it('sans dépose, l’encadré va à la repose', () => {
    const r = mapR3Projection(
      envelope([
        ...tierM(),
        r3('installation_procedure', 'repose'),
        r3('safety_warnings', 'avertissement'),
      ]),
    );
    expect(r.slots.S4_REPOSE?.callouts).toHaveLength(1);
  });

  it('sans procédure, l’encadré n’est pas rendu mais compté, et ne bloque rien (D4)', () => {
    const r = mapR3Projection(
      envelope([...tierM(), r3('safety_warnings', 'avertissement')]),
    );
    expect(r.unmapped).toEqual([
      {
        section: 'safety_warnings',
        reason: 'callout_without_host',
        truth_level: 'sourced',
      },
    ]);
    expect(r.ready).toBe(true);
  });

  it('safety_warnings ne compte jamais pour la complétude', () => {
    const r = mapR3Projection(
      envelope([
        r3('function', 'f'),
        r3('removal_procedure', 'dépose'),
        r3('safety_warnings', 'avertissement'),
      ]),
    );
    expect(r.ready).toBe(false);
    expect(r.invalid.map((i) => i.section)).toEqual([
      'maintenance_interval',
      'failure_symptoms',
    ]);
  });
});

describe('mapR3Projection — 4. ordre des blocs inversé → résultat identique', () => {
  it('produit un DTO identique quel que soit l’ordre d’entrée', () => {
    const fwd = mapR3Projection(envelope(realExportLayout()));
    const rev = mapR3Projection(envelope([...realExportLayout()].reverse()));
    expect(rev).toEqual(fwd);
  });
});

describe('mapR3Projection — 5. collisions → invalid, pas de last-write-wins', () => {
  it('deux blocs function → aucun S1, collision + composant obligatoire non livré', () => {
    const r = mapR3Projection(
      envelope([...tierM(), r3('function', 'SECOND contenu', ['db:b'])]),
    );
    expect(r.slots.S1).toBeUndefined();
    expect(r.invalid).toEqual([
      {
        kind: 'required_slot_missing',
        section: 'function',
        slot: 'S1',
        detail:
          'composant obligatoire function (tier M ADR-086) non livré : slot S1 incomplet',
      },
      {
        kind: 'slot_collision',
        section: 'function',
        slot: 'S1',
        detail: '2 blocs R3 revendiquent la section function',
      },
    ]);
    expect(r.ready).toBe(false);
  });

  it('collision sur un composant de S2 → S2 entier non émis (jamais amputé)', () => {
    const r = mapR3Projection(
      envelope([...tierM(), r3('failure_symptoms', 'doublon')]),
    );
    expect(r.slots.S2).toBeUndefined();
    expect(r.mapped).toEqual(['S1']);
    expect(r.ready).toBe(false);
  });

  it('collision d’encadré → invalid avec slot null', () => {
    const r = mapR3Projection(
      envelope([
        ...tierM(),
        r3('removal_procedure', 'dépose'),
        r3('safety_warnings', 'a'),
        r3('safety_warnings', 'b'),
      ]),
    );
    expect(r.slots.S4_DEPOSE?.callouts).toEqual([]);
    expect(r.invalid).toEqual([
      {
        kind: 'slot_collision',
        section: 'safety_warnings',
        slot: null,
        detail: '2 blocs R3 revendiquent la section safety_warnings',
      },
    ]);
  });
});

describe('mapR3Projection — 6. provenance et contenu conservés byte-for-byte', () => {
  it('préserve content_md/source_ids/truth_level/usefulness_target verbatim et ne mute pas l’entrée', () => {
    const md = 'Ligne 1\r\n  espaces  \nÉÀÇ — “guillemets” 日本語';
    const sids = ['db:pieces_gamme', 'web:ev-7', 'oem:mann-9'];
    const env = envelope([...tierM(), r3('faq', md, sids, 'sourced', 'faq')]);
    const snapshotIn = JSON.stringify(env);

    const r = mapR3Projection(env);
    const faq = r.slots.S8?.components[0];
    expect(faq?.content_md).toBe(md);
    expect(faq?.source_ids).toEqual(sids);
    expect(faq?.truth_level).toBe('sourced');
    expect(faq?.usefulness_target).toBe('faq');
    expect(faq?.wiki_section).toBe('faq');
    expect(JSON.stringify(env)).toBe(snapshotIn);
  });
});

describe('mapR3Projection — 7. envelope vide ou sans R3 → résultat explicite, aucune exception', () => {
  it('blocks vide → non-prêt, chaque composant obligatoire signalé, sans throw', () => {
    const r = mapR3Projection(envelope([]));
    expect(r.mapped).toEqual([]);
    expect(r.slots).toEqual({});
    expect(r.unmapped).toEqual([]);
    expect(r.invalid.map((i) => i.kind)).toEqual([
      'required_slot_missing',
      'required_slot_missing',
      'required_slot_missing',
    ]);
    expect(r.ready).toBe(false);
  });

  it('aucun bloc R3 (que du R4) → ignoredNonR3 comptés, non-prêt', () => {
    const r = mapR3Projection(
      envelope([block('R4_REFERENCE', 'function', 'r4', ['db:y'], 'db_owned')]),
    );
    expect(r.mapped).toEqual([]);
    expect(r.ignoredNonR3).toBe(1);
    expect(r.ready).toBe(false);
  });
});

/**
 * 8. Validation STRUCTURELLE des blocs (fail-closed) — un bloc R3 qui revendique une position de
 * la table et dont les champs requis du contrat (exports-seo.schema.json v1.1.0 /
 * SeoProjectionBlock) sont absents ou mal typés ne produit AUCUN composant.
 */
describe('mapR3Projection — 8. bloc hors contrat → block_contract_invalid, aucun composant', () => {
  const contractInvalid = (content: Record<string, unknown>) => {
    const r = mapR3Projection(
      envelope([
        ...tierM().filter((b) => b.content.section !== 'function'),
        { role: R3_MAPPER_ROLE, content },
      ]),
    );
    expect(r.slots.S1).toBeUndefined();
    expect(r.ready).toBe(false);
    const entry = r.invalid.find((i) => i.kind === 'block_contract_invalid');
    expect(entry?.section).toBe('function');
    expect(entry?.slot).toBe('S1');
    return entry?.detail ?? '';
  };

  it('content_md absent', () => {
    expect(contractInvalid({ section: 'function' })).toContain('content_md');
  });

  it('content_md chaîne vide', () => {
    expect(
      contractInvalid({
        section: 'function',
        content_md: '',
        source_ids: ['db:x'],
        truth_level: 'sourced',
      }),
    ).toContain('content_md');
  });

  it('truth_level inconnu', () => {
    expect(
      contractInvalid({
        section: 'function',
        content_md: 'contenu',
        source_ids: ['db:x'],
        truth_level: 'rag_generated',
      }),
    ).toContain('truth_level');
  });

  it('source_ids non-array', () => {
    expect(
      contractInvalid({
        section: 'function',
        content_md: 'contenu',
        source_ids: 'db:x',
        truth_level: 'sourced',
      }),
    ).toContain('source_ids');
  });

  it('source_ids contenant un non-string', () => {
    expect(
      contractInvalid({
        section: 'function',
        content_md: 'contenu',
        source_ids: ['db:x', 42],
        truth_level: 'sourced',
      }),
    ).toContain('source_ids');
  });

  it('usefulness_target ni string ni null', () => {
    expect(
      contractInvalid({
        section: 'function',
        content_md: 'contenu',
        source_ids: ['db:x'],
        truth_level: 'sourced',
        usefulness_target: 7,
      }),
    ).toContain('usefulness_target');
  });

  it('content absent / non-objet → section illisible → unmapped, jamais synthétique', () => {
    const r = mapR3Projection(
      envelope([
        { role: R3_MAPPER_ROLE },
        { role: R3_MAPPER_ROLE, content: null },
        { role: R3_MAPPER_ROLE, content: 'pas-un-objet' },
      ]),
    );
    expect(r.slots).toEqual({});
    expect(r.unmapped).toHaveLength(3);
    expect(r.unmapped.every((u) => u.reason === 'missing_section')).toBe(true);
    expect(r.ready).toBe(false);
  });

  it('une section non projetée n’est pas validée : jamais invalid, toujours not_projected', () => {
    const r = mapR3Projection(
      envelope([
        ...tierM(),
        { role: R3_MAPPER_ROLE, content: { section: 'replacement_guidance' } },
      ]),
    );
    expect(r.invalid).toEqual([]);
    expect(r.unmapped[0].reason).toBe('not_projected');
    expect(r.ready).toBe(true);
  });

  it('une clé héritée d’Object.prototype n’est jamais une section de la table', () => {
    const r = mapR3Projection(
      envelope([...tierM(), r3('constructor', 'x'), r3('toString', 'y')]),
    );
    expect(r.unmapped.map((u) => u.reason)).toEqual([
      'unknown_section',
      'unknown_section',
    ]);
    expect(r.ready).toBe(true);
  });
});
