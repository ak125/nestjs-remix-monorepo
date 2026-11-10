// backend/src/modules/admin/services/keyword-density-gate.service.test.ts

import { KeywordDensityGateService } from './keyword-density-gate.service';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import type { PageBrief } from './page-brief.service';

/**
 * Contrat de `KeywordDensityGateService.check` : la densité est le nombre
 * d'occurrences réelles du mot-clé rapporté au nombre de mots, en pourcentage.
 *
 * Avant : chaque fenêtre glissante de 10 mots contenant le mot-clé comptait
 * pour une occurrence. Une seule occurrence était donc comptée jusqu'à 10 fois
 * (5 occurrences sur 1 000 mots : 0,5 % réel, 5 % mesuré, verdict « stuffing »).
 * Un texte de moins de 10 mots n'avait aucune fenêtre (mot-clé déclaré absent),
 * et un mot suivi d'une ponctuation (« frein. ») n'était jamais reconnu.
 */

const FILLER = 'mot';

/** Texte de `total` mots, avec `keyword` posé aux positions demandées. */
function textWith(total: number, positions: number[], keyword = 'frein') {
  const words = Array.from({ length: total }, () => FILLER);
  for (const p of positions) words[p] = keyword;
  return words.join(' ');
}

/** `count` positions régulièrement espacées dans un texte de `total` mots. */
function spread(total: number, count: number): number[] {
  const step = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => i * step + 20);
}

function brief(keyword: string | null): PageBrief {
  return { keywords_primary: keyword } as PageBrief;
}

function buildGate(enabled = true) {
  const flags = { keywordDensityGateEnabled: enabled } as FeatureFlagsService;
  return new KeywordDensityGateService(flags);
}

describe('KeywordDensityGateService.check — occurrences réelles', () => {
  it('5 occurrences sur 1 000 mots : 0,5 %, dans la cible', () => {
    const result = buildGate().check(
      textWith(1000, spread(1000, 5)),
      brief('frein'),
    );

    expect(result.measured).toBe(0.5);
    expect(result.verdict).toBe('PASS');
    expect(result.reason_code).toBe('KEYWORD_DENSITY_OK');
  });

  it('25 occurrences sur 1 000 mots : 2,5 %, borne haute encore admise', () => {
    const result = buildGate().check(
      textWith(1000, spread(1000, 25)),
      brief('frein'),
    );

    expect(result.measured).toBe(2.5);
    expect(result.verdict).toBe('PASS');
  });

  it('2 occurrences sur 1 000 mots : 0,2 %, densité faible', () => {
    const result = buildGate().check(
      textWith(1000, spread(1000, 2)),
      brief('frein'),
    );

    expect(result.measured).toBe(0.2);
    expect(result.verdict).toBe('WARN');
    expect(result.reason_code).toBe('KEYWORD_DENSITY_LOW');
  });

  it('30 occurrences sur 1 000 mots : 3 %, stuffing', () => {
    const result = buildGate().check(
      textWith(1000, spread(1000, 30)),
      brief('frein'),
    );

    expect(result.measured).toBe(3);
    expect(result.verdict).toBe('WARN');
    expect(result.reason_code).toBe('KEYWORD_DENSITY_HIGH');
  });

  it('des répétitions collées comptent chacune (le stuffing ne se cache pas dans une fenêtre)', () => {
    // 30 occurrences consécutives : 3 % réel.
    const positions = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = buildGate().check(textWith(1000, positions), brief('frein'));

    expect(result.measured).toBe(3);
    expect(result.reason_code).toBe('KEYWORD_DENSITY_HIGH');
  });

  it('un texte de moins de 10 mots est mesuré, pas déclaré sans mot-clé', () => {
    const result = buildGate().check('Changer un frein avant', brief('frein'));

    expect(result.reason_code).not.toBe('KEYWORD_ABSENT');
    expect(result.measured).toBe(25);
  });

  it('une occurrence en fin de texte est comptée', () => {
    const result = buildGate().check(textWith(200, [199]), brief('frein'));

    expect(result.measured).toBe(0.5);
  });
});

describe('KeywordDensityGateService.check — reconnaissance du mot-clé', () => {
  it('reconnaît le mot-clé malgré ponctuation, casse, accents et balises', () => {
    const content =
      '<p>Quand changer le <strong>Filtre à Huile</strong>, et pourquoi ?</p>' +
      "<p>L'usure du filtre a huile. Le filtre à huile ; rien d'autre.</p>";
    const result = buildGate().check(content, brief('filtre à huile'));

    // 3 occurrences sur 21 mots.
    expect(result.details[0]).toContain('3 occurrences');
    expect(result.reason_code).toBe('KEYWORD_DENSITY_HIGH');
  });

  it('mot-clé à deux termes : les deux doivent être proches pour compter', () => {
    const gate = buildGate();
    const near = `plaquettes de frein ${textWith(196, [])}`;
    const far = `plaquettes ${textWith(197, [])} frein`;

    expect(gate.check(near, brief('plaquettes de frein')).measured).toBe(0.5);
    expect(gate.check(far, brief('plaquettes de frein')).reason_code).toBe(
      'KEYWORD_ABSENT',
    );
  });

  it('mot-clé à trois termes : deux termes proches suffisent (ratio 0,66)', () => {
    const content = `disque de frein ${textWith(197, [])}`;
    const result = buildGate().check(content, brief('disque frein avant'));

    expect(result.measured).toBe(0.5);
  });

  it('deux occurrences complètes qui se suivent comptent pour deux', () => {
    const content = `plaquettes de frein plaquettes de frein ${textWith(194, [])}`;
    const result = buildGate().check(content, brief('plaquettes de frein'));

    expect(result.measured).toBe(1);
  });

  it('mot-clé absent : FAIL KEYWORD_ABSENT', () => {
    const result = buildGate().check(textWith(300, []), brief('frein'));

    expect(result.verdict).toBe('FAIL');
    expect(result.reason_code).toBe('KEYWORD_ABSENT');
    expect(result.measured).toBe(0);
  });
});

describe('KeywordDensityGateService.check — cas sans mesure', () => {
  it('brief sans mot-clé principal : PASS NO_KEYWORD', () => {
    const result = buildGate().check('un contenu quelconque', brief(null));

    expect(result.verdict).toBe('PASS');
    expect(result.reason_code).toBe('NO_KEYWORD');
  });

  it('mot-clé fait de termes trop courts : PASS NO_KEYWORD', () => {
    const result = buildGate().check('un contenu quelconque', brief('de la'));

    expect(result.reason_code).toBe('NO_KEYWORD');
  });

  it('contenu vide : FAIL EMPTY_CONTENT', () => {
    const result = buildGate().check('<p> </p>', brief('frein'));

    expect(result.verdict).toBe('FAIL');
    expect(result.reason_code).toBe('EMPTY_CONTENT');
  });
});

describe('KeywordDensityGateService — règles exposées', () => {
  it('les seuils publiés sont ceux que la mesure applique', () => {
    const rules = KeywordDensityGateService.getRulesMetadata();
    const result = buildGate().check(textWith(300, [10]), brief('frein'));

    expect(rules.density_target_min).toBe(result.warnThresholdLow);
    expect(rules.density_target_max).toBe(result.warnThresholdHigh);
  });

  it('isEnabled suit le flag', () => {
    expect(buildGate(true).isEnabled()).toBe(true);
    expect(buildGate(false).isEnabled()).toBe(false);
  });
});
