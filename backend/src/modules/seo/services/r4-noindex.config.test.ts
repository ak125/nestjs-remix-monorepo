/**
 * Mandat EW — liste fermée des 62 fiches R4 `noindex, follow`.
 * Fonctions pures : aucune I/O.
 */
import {
  excludeR4NoindexReferences,
  R4_NOINDEX_ROBOTS,
  R4_NOINDEX_SLUGS,
  r4NoindexRobots,
} from './r4-noindex.config';
import { R4_CONSOLIDATION_TARGETS } from './r4-consolidation.config';

/** Une fiche de la liste et une fiche publiée hors liste. */
const LISTED = 'capteur-de-pluie';
const UNLISTED = 'soupape-d-admission';

describe('R4 noindex — liste fermée (mandat EW)', () => {
  it('62 slugs uniques, triés, au format slug, figés', () => {
    expect(R4_NOINDEX_SLUGS).toHaveLength(62);
    expect(new Set(R4_NOINDEX_SLUGS).size).toBe(62);
    expect([...R4_NOINDEX_SLUGS].sort()).toEqual([...R4_NOINDEX_SLUGS]);
    for (const s of R4_NOINDEX_SLUGS) {
      expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
    expect(Object.isFrozen(R4_NOINDEX_SLUGS)).toBe(true);
  });

  it('disjointe des 43 pages redirigées du mandat ER', () => {
    const er = R4_CONSOLIDATION_TARGETS.map((t) => t.slug);
    expect(new Set(er).size).toBe(43);
    expect(R4_NOINDEX_SLUGS.filter((s) => er.includes(s))).toEqual([]);
  });

  it('directive = noindex, follow (liens suivis)', () => {
    expect(R4_NOINDEX_ROBOTS).toBe('noindex, follow');
  });

  it('drapeau éteint : null pour toute fiche, listée ou non', () => {
    expect(r4NoindexRobots(LISTED, false)).toBeNull();
    expect(r4NoindexRobots(UNLISTED, false)).toBeNull();
  });

  it('drapeau allumé : noindex pour une fiche listée, null hors liste', () => {
    expect(r4NoindexRobots(LISTED, true)).toBe('noindex, follow');
    expect(r4NoindexRobots(UNLISTED, true)).toBeNull();
    expect(r4NoindexRobots('', true)).toBeNull();
  });

  it('chaque slug de la liste reçoit noindex drapeau allumé', () => {
    for (const s of R4_NOINDEX_SLUGS) {
      expect(r4NoindexRobots(s, true)).toBe('noindex, follow');
    }
  });

  it("exclusion sitemap : retire les listées, garde l'ordre des autres", () => {
    const rows = [
      { slug: 'a-fiche', updated_at: '1' },
      { slug: LISTED, updated_at: '2' },
      { slug: 'b-fiche', updated_at: '3' },
      { slug: 'volant-moteur', updated_at: '4' },
    ];
    const { kept, excludedCount } = excludeR4NoindexReferences(rows);
    expect(kept.map((r) => r.slug)).toEqual(['a-fiche', 'b-fiche']);
    expect(excludedCount).toBe(2);
    expect(rows).toHaveLength(4); // entrée non mutée
  });

  it('exclusion sitemap : liste vide ⇒ 0 exclue', () => {
    expect(excludeR4NoindexReferences([])).toEqual({
      kept: [],
      excludedCount: 0,
    });
  });
});
