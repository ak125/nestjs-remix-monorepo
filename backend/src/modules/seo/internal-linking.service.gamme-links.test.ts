/**
 * InternalLinkingService.resolveGammeAliasLinks (cibles `indexable`) et
 * unlinkGammeAliasLinks — liens du texte R1 (`__seo_gamme.sg_content`) vers
 * une page gamme.
 *
 * Relevé du 2026-11-18 (SELECT seul, 19:27Z) : 124 liens `/pieces/{alias}`
 * sans identifiant dans 67 gammes ; servis en PROD, ils répondent 410.
 * Les états de gamme ci-dessous sont ceux relevés en base pour ces cibles.
 */
import { DatabaseException } from '@common/exceptions';
import {
  InternalLinkingService,
  UNRESOLVED_GAMME_LINK_ATTR,
  unlinkGammeAliasLinks,
} from './internal-linking.service';

jest.mock('@repo/database-types', () =>
  jest.requireActual('../../../../packages/database-types/src/constants'),
);

type Row = Record<string, unknown>;

/** Client Supabase minimal : `from().select().in()…eq()…` puis `await`. */
function fakeClient(rows: Row[], fail = false) {
  const calls: Array<Array<[string, unknown[]]>> = [];
  const client = {
    from() {
      const filters: Array<[string, unknown[]]> = [];
      calls.push(filters);
      const builder = {
        select: () => builder,
        in: (column: string, values: unknown[]) => {
          filters.push([column, values]);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters.push([column, [value]]);
          return builder;
        },
        then: (resolve: (r: unknown) => unknown) => {
          if (fail) {
            return Promise.resolve({
              data: null,
              error: { message: 'boom' },
            }).then(resolve);
          }
          const data = rows.filter((row) =>
            filters.every(([c, vs]) => vs.map(String).includes(String(row[c]))),
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

function makeService(rows: Row[], fail = false) {
  const service = new InternalLinkingService();
  const { client, calls } = fakeClient(rows, fail);
  (service as unknown as { supabase: unknown }).supabase = client;
  return { service, calls };
}

const gamme = (
  pg_id: number,
  pg_alias: string,
  state: { display: string; relfollow: string; level: string },
): Row => ({
  pg_id,
  pg_alias,
  pg_name: pg_alias.replace(/-/g, ' '),
  pg_display: state.display,
  pg_relfollow: state.relfollow,
  pg_level: state.level,
});
const INDEXABLE = { display: '1', relfollow: '1', level: '1' };

/** États relevés le 2026-11-18. */
const ROWS: Row[] = [
  gamme(8, 'filtre-a-air', INDEXABLE),
  gamme(9, 'filtre-a-carburant', INDEXABLE),
  gamme(593, 'bouchon-de-vidange', INDEXABLE),
  // relfollow 0 : page servie `noindex`
  gamme(416, 'filtre-de-boite-auto', {
    display: '1',
    relfollow: '0',
    level: '1',
  }),
  // pg_level 2 : page servie `noindex, nofollow`
  gamme(115, 'ampoule-feu-arriere', {
    display: '1',
    relfollow: '0',
    level: '2',
  }),
  // non affichée
  gamme(74, 'servo-frein', { display: '0', relfollow: '1', level: '1' }),
];

/** Lien `/pieces/{alias}` sans identifiant, qui répond 410. */
const NO_ID_LINK_RE = /href="\/pieces\/(?![^"]*-\d+\.html")[^"/]*"/;

describe('resolveGammeAliasLinks — cibles indexables (rendu R1)', () => {
  it('lien sans identifiant vers une R1 indexable → adresse canonique', async () => {
    const { service } = makeService(ROWS);
    const out = await service.resolveGammeAliasLinks(
      '<p>Changez aussi le <a href="/pieces/filtre-a-air">filtre à air</a>.</p>',
      'indexable',
    );
    expect(out).toBe(
      '<p>Changez aussi le <a href="/pieces/filtre-a-air-8.html" class="seo-internal-link" data-link-type="LinkGamme">filtre à air</a>.</p>',
    );
  });

  it.each([
    ['filtre-de-boite-auto', 'relfollow 0'],
    ['ampoule-feu-arriere', 'pg_level 2'],
    ['servo-frein', 'non affichée'],
  ])('cible %s (%s) → libellé sans lien', async (alias) => {
    const { service } = makeService(ROWS);
    const out = await service.resolveGammeAliasLinks(
      `<p>Voir <a href="/pieces/${alias}">${alias}</a>.</p>`,
      'indexable',
    );
    expect(out).toBe(
      `<p>Voir <span ${UNRESOLVED_GAMME_LINK_ATTR}>${alias}</span>.</p>`,
    );
  });

  it('cible inconnue → libellé sans lien, aucune adresse devinée', async () => {
    const { service } = makeService(ROWS);
    const out = await service.resolveGammeAliasLinks(
      '<p><a href="/pieces/freinage">Freinage</a></p>',
      'indexable',
    );
    expect(out).toBe(
      `<p><span ${UNRESOLVED_GAMME_LINK_ATTR}>Freinage</span></p>`,
    );
  });

  it('lien déjà canonique vers une R1 indexable → laissé intact', async () => {
    const { service } = makeService(ROWS);
    const html =
      '<p><a href="/pieces/filtre-a-air-8.html" title="Filtre">filtre</a></p>';
    await expect(
      service.resolveGammeAliasLinks(html, 'indexable'),
    ).resolves.toBe(html);
  });

  it('lien canonique vers une gamme non indexable → libellé sans lien', async () => {
    const { service } = makeService(ROWS);
    const out = await service.resolveGammeAliasLinks(
      '<p><a href="/pieces/filtre-de-boite-auto-416.html">filtre BVA</a></p>',
      'indexable',
    );
    expect(out).toBe(
      `<p><span ${UNRESOLVED_GAMME_LINK_ATTR}>filtre BVA</span></p>`,
    );
  });

  it('liens externes, page véhicule et autres chemins → intacts, sans lecture', async () => {
    const { service, calls } = makeService(ROWS);
    const html = [
      '<a href="https://www.example.org/pieces/filtre-a-air">ext</a>',
      '<a href="/pieces/filtre-a-air/renault/clio-iii/1-5-dci.html">véhicule</a>',
      '<a href="/blog-pieces-auto/conseils/filtre-a-air">conseil</a>',
    ].join(' ');
    await expect(
      service.resolveGammeAliasLinks(html, 'indexable'),
    ).resolves.toBe(html);
    expect(calls).toHaveLength(0);
  });

  it('page filtre-a-huile (pg 7) : plus aucun lien sans identifiant', async () => {
    const { service } = makeService(ROWS);
    const html = [
      '<a href="/pieces/bouchon-de-vidange">bouchon</a>',
      '<a href="/pieces/filtre-a-air">filtre à air</a>',
      '<a href="/pieces/filtre-a-air">le filtre à air</a>',
      '<a href="/pieces/filtre-a-carburant">filtre à carburant</a>',
      '<a href="/pieces/filtre-de-boite-auto">filtre de boîte auto</a>',
    ].join(' ');
    const out = await service.resolveGammeAliasLinks(html, 'indexable');
    expect(out).not.toMatch(NO_ID_LINK_RE);
    expect(out.match(/href="\/pieces\/[a-z0-9-]+-\d+\.html"/g)).toEqual([
      'href="/pieces/bouchon-de-vidange-593.html"',
      'href="/pieces/filtre-a-air-8.html"',
      'href="/pieces/filtre-a-air-8.html"',
      'href="/pieces/filtre-a-carburant-9.html"',
    ]);
    expect(out).toContain(
      `<span ${UNRESOLVED_GAMME_LINK_ATTR}>filtre de boîte auto</span>`,
    );
  });

  it('filtre les cibles sur la règle des R1 indexables', async () => {
    const { service, calls } = makeService(ROWS);
    await service.resolveGammeAliasLinks(
      '<a href="/pieces/filtre-a-air">x</a>',
      'indexable',
    );
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        ['pg_display', ['1']],
        ['pg_relfollow', ['1']],
        ['pg_level', ['1']],
      ]),
    );
  });

  it('lecture en échec → lève (le rendu R1 applique le repli)', async () => {
    const { service } = makeService(ROWS, true);
    await expect(
      service.resolveGammeAliasLinks(
        '<a href="/pieces/filtre-a-air">x</a>',
        'indexable',
      ),
    ).rejects.toBeInstanceOf(DatabaseException);
  });
});

describe('resolveGammeAliasLinks — cibles catalogue (défaut, guides R3)', () => {
  it('garde la règle pg_level 1 ou 2, sans filtre d’indexation', async () => {
    const { service, calls } = makeService(ROWS);
    const out = await service.resolveGammeAliasLinks(
      '<a href="/pieces/ampoule-feu-arriere">ampoule</a>',
    );
    expect(out).toContain('href="/pieces/ampoule-feu-arriere-115.html"');
    expect(calls[0].map(([c]) => c)).toEqual(['pg_level', 'pg_alias']);
  });
});

describe('unlinkGammeAliasLinks — repli sans lecture', () => {
  it('retire le lien des cibles sans identifiant, garde le libellé', () => {
    expect(
      unlinkGammeAliasLinks(
        '<p><a href="/pieces/filtre-a-air">filtre <b>à air</b></a></p>',
      ),
    ).toBe(
      `<p><span ${UNRESOLVED_GAMME_LINK_ATTR}>filtre <b>à air</b></span></p>`,
    );
  });

  it('laisse intacts liens canoniques, page véhicule et liens externes', () => {
    const html = [
      '<a href="/pieces/filtre-a-air-8.html">canonique</a>',
      '<a href="/pieces/filtre-a-air/renault/clio-iii/1-5-dci.html">véhicule</a>',
      '<a href="https://www.example.org/pieces/filtre-a-air">ext</a>',
    ].join(' ');
    expect(unlinkGammeAliasLinks(html)).toBe(html);
  });

  it('retire aussi un jeton #LinkGamme_N# non résolu', () => {
    expect(
      unlinkGammeAliasLinks('<a href="/pieces/x">Filtre #LinkGamme_8#</a>'),
    ).toBe(`<span ${UNRESOLVED_GAMME_LINK_ATTR}>Filtre</span>`);
  });
});
