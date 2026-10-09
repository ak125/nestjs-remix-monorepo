/**
 * Présentation des slots projetés R3 (ADR-106 D6 + D8) — pure, sans I/O.
 *
 * Les slots d'entrée sont produits par le VRAI mapper : la présentation est testée sur la forme
 * que la décision lui transmet réellement, jamais sur un DTO fabriqué à la main.
 */
import {
  mapR3Projection,
  R3_MAPPER_ROLE,
  R3_RENDER_CONTRACT,
} from '@modules/seo-projection/projection-r3.mapper';
import type { ProjectionEnvelope } from '@modules/seo-projection/seo-projection-reader.service';
import {
  presentR3Projection,
  R3_PROJECTED_SECTION_TITLES,
} from './projection-r3-section-presenter';

function r3(section: string, content_md: string, source_ids = ['web:ev-1']) {
  return {
    role: R3_MAPPER_ROLE,
    content: {
      content_md,
      source_ids,
      truth_level: 'sourced',
      section,
      usefulness_target: null,
    },
  };
}

function slotsOf(blocks: unknown[]) {
  const envelope: ProjectionEnvelope = {
    entity_id: 'gamme:filtre-a-huile',
    entity_type: 'gamme',
    slug: 'filtre-a-huile',
    facts: [],
    blocks: blocks as ProjectionEnvelope['blocks'],
  };
  const result = mapR3Projection(envelope);
  expect(result.ready).toBe(true);
  return result.slots;
}

const TIER_M = [
  r3('function', 'Le filtre retient les impuretés.', ['raw:web/a.md']),
  r3('maintenance_interval', 'Remplacer à chaque vidange.'),
  r3('failure_symptoms', 'Témoin de pression allumé.'),
];

const ALL_SECTIONS = [
  ...TIER_M,
  r3('removal_procedure', '1. Vidanger.\n2. Dévisser le filtre.'),
  r3('installation_procedure', '1. Huiler le joint.\n2. Visser à la main.'),
  r3('post_install_checks', '- Absence de fuite\n- Niveau correct'),
  r3('faq', 'Quand changer ? À chaque vidange.'),
  r3('safety_warnings', 'Huile **chaude** : risque de brûlure.'),
  r3('replacement_guidance', 'non projetée en v1'),
];

describe('presentR3Projection — titres fixes (D8)', () => {
  it('chaque section qu’un composant de la table peut alimenter a un titre fixe', () => {
    const componentSlots = Object.values(R3_RENDER_CONTRACT).flatMap((e) =>
      e.kind === 'component' ? [e.slot] : [],
    );
    expect(Object.keys(R3_PROJECTED_SECTION_TITLES).sort()).toEqual(
      [...new Set(componentSlots)].sort(),
    );
  });

  it('la table des titres est figée (toute modification passe par ADR-106 D8)', () => {
    expect(R3_PROJECTED_SECTION_TITLES).toEqual({
      S1: 'Rôle de la pièce',
      S2: "Entretien et signes d'usure",
      S4_DEPOSE: 'Démontage',
      S4_REPOSE: 'Remontage',
      S6: 'Vérifications après montage',
      S8: 'Questions fréquentes',
    });
  });

  it('ancre = slug du titre fixe', () => {
    const { s1Sections, bodySections } = presentR3Projection(
      slotsOf(ALL_SECTIONS),
    );
    expect([...s1Sections, ...bodySections].map((s) => s.anchor)).toEqual([
      'role-de-la-piece',
      'entretien-et-signes-d-usure',
      'demontage',
      'remontage',
      'verifications-apres-montage',
      'questions-frequentes',
    ]);
  });
});

describe('presentR3Projection — structure servie', () => {
  it('tier M seul : S1 en tête de page, S2 seule section du corps', () => {
    const { s1Sections, bodySections } = presentR3Projection(slotsOf(TIER_M));
    expect(s1Sections).toEqual([
      {
        sectionType: 'S1',
        title: 'Rôle de la pièce',
        anchor: 'role-de-la-piece',
        order: 0,
        html: '<p>Le filtre retient les impuretés.</p>',
        sources: [],
        qualityScore: null,
      },
    ]);
    expect(bodySections.map((s) => s.sectionType)).toEqual(['S2']);
  });

  it('S2 = intervalle puis symptômes, dans l’ordre de la table', () => {
    const { bodySections } = presentR3Projection(slotsOf(TIER_M));
    expect(bodySections[0].html).toBe(
      '<p>Remplacer à chaque vidange.</p><p>Témoin de pression allumé.</p>',
    );
  });

  it('toutes les sections : ordre CANONICAL_ORDER de la page, order = rang dans le groupe', () => {
    const { s1Sections, bodySections } = presentR3Projection(
      slotsOf(ALL_SECTIONS),
    );
    expect(s1Sections.map((s) => s.order)).toEqual([0]);
    expect(bodySections.map((s) => [s.sectionType, s.order])).toEqual([
      ['S2', 0],
      ['S4_DEPOSE', 1],
      ['S4_REPOSE', 2],
      ['S6', 3],
      ['S8', 4],
    ]);
  });

  it('chaque slot émis par le mapper est présenté (aucun slot sans titre)', () => {
    const slots = slotsOf(ALL_SECTIONS);
    const { s1Sections, bodySections } = presentR3Projection(slots);
    expect(s1Sections.length + bodySections.length).toBe(
      Object.keys(slots).length,
    );
  });

  it('encadré de sécurité : en <blockquote>, avant la procédure de son hôte (D4)', () => {
    const { bodySections } = presentR3Projection(slotsOf(ALL_SECTIONS));
    const depose = bodySections.find((s) => s.sectionType === 'S4_DEPOSE');
    expect(depose?.html).toBe(
      '<blockquote><p>Huile <strong>chaude</strong> : risque de brûlure.</p></blockquote>' +
        '<ol><li>Vidanger.</li><li>Dévisser le filtre.</li></ol>',
    );
    const repose = bodySections.find((s) => s.sectionType === 'S4_REPOSE');
    expect(repose?.html).not.toContain('<blockquote>');
  });

  it('provenance jamais affichée : sources vides même si le bloc cite du RAW', () => {
    const { s1Sections } = presentR3Projection(slotsOf(TIER_M));
    expect(s1Sections[0].sources).toEqual([]);
    expect(s1Sections[0].html).not.toContain('raw:');
  });

  it('une prose reste une prose : aucune liste déduite (D6)', () => {
    const { bodySections } = presentR3Projection(
      slotsOf([...TIER_M, r3('faq', 'Quand ? À la vidange. Combien ? 15 €.')]),
    );
    const faq = bodySections.find((s) => s.sectionType === 'S8');
    expect(faq?.html).toBe('<p>Quand ? À la vidange. Combien ? 15 €.</p>');
  });

  it('HTML brut du WIKI échappé, jamais servi', () => {
    const { s1Sections } = presentR3Projection(
      slotsOf([r3('function', 'Rôle <script>x</script>'), ...TIER_M.slice(1)]),
    );
    expect(s1Sections[0].html).toBe(
      '<p>Rôle &lt;script&gt;x&lt;/script&gt;</p>',
    );
  });

  it('déterministe : mêmes slots → mêmes sections', () => {
    const slots = slotsOf(ALL_SECTIONS);
    expect(presentR3Projection(slots)).toEqual(presentR3Projection(slots));
  });
});
