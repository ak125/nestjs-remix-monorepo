/**
 * InternalLinkingService.resolveGammeAliasLinks — editorial gamme links.
 *
 * A gamme page is only served at `/pieces/{alias}-{id}.html`, and only for a
 * catalogue gamme (`pg_level` 1 or 2 — `pg_display` does not decide it).
 * Editorial content (the "pièces complémentaires" lists of the advice pages)
 * holds links written without the identifier, which answer 410, and links
 * written with an identifier whose alias has changed since (301) or whose
 * gamme has no page (410). The service resolves them by exact alias, by the
 * `#LinkGamme_N#` token they carry, or by their identifier, and never guesses
 * an address.
 *
 * Link shapes below are the ones read in `__seo_gamme_conseil` on 2026-11-11.
 */
import { DatabaseException } from '@common/exceptions';
import { InternalLinkingService } from '../../src/modules/seo/internal-linking.service';

interface GammeRow {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_display: string;
  pg_level: string;
}

const gamme = (
  pg_id: number,
  pg_alias: string,
  pg_name: string,
  pg_level: string,
  pg_display = '1',
): GammeRow => ({ pg_id, pg_alias, pg_name, pg_display, pg_level });

const GAMMES: GammeRow[] = [
  // Served although not displayed: the level decides, not `pg_display`.
  gamme(1, 'batterie', 'Batterie', '1', '0'),
  gamme(2, 'demarreur', 'Démarreur', '1'),
  gamme(10, 'courroie-d-accessoire', "Courroie d'accessoire", '1'),
  gamme(308, 'galet-tendeur-de-courroie-de-distribution', 'Galet tendeur', '2'),
  gamme(3902, 'injecteur', 'Injecteur', '1'),
  // Accessory gammes: displayed or not, their page answers 410.
  gamme(262, 'disque-d-embrayage', "Disque d'embrayage", '5'),
  gamme(1914, 'glace-de-retroviseur', 'Glace de rétroviseur', '5', '0'),
  // Outside the catalogue.
  gamme(1475, 'gamme-tecdoc-1475', 'Gamme TecDoc 1475', '0'),
];

interface Query {
  table: string;
  in: Array<[string, unknown[]]>;
}

/** Read-only fake of the Supabase client: `from().select().in().in()`. */
function fakeClient(
  rows: GammeRow[],
  failure: { message: string } | null = null,
) {
  const queries: Query[] = [];
  const client = {
    from: (table: string) => {
      const query: Query = { table, in: [] };
      queries.push(query);
      const builder = {
        select: () => builder,
        in: (column: string, values: unknown[]) => {
          query.in.push([column, values]);
          return builder;
        },
        then: (
          resolve: (value: { data: unknown; error: unknown }) => unknown,
        ) => {
          if (failure) return resolve({ data: null, error: failure });
          const data = rows.filter((row) =>
            query.in.every(([column, values]) =>
              values
                .map(String)
                .includes(String(row[column as keyof GammeRow])),
            ),
          );
          return resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
  return { client, queries };
}

function buildService(
  rows: GammeRow[] = GAMMES,
  failure: { message: string } | null = null,
) {
  const service = new InternalLinkingService();
  const { client, queries } = fakeClient(rows, failure);
  Object.defineProperty(service, 'supabase', {
    value: client,
    configurable: true,
    writable: true,
  });
  const warn = jest
    .spyOn((service as any).logger, 'warn')
    .mockImplementation(() => undefined);
  return { service, queries, warn };
}

const LINK = (href: string, label: string) =>
  `<a href="${href}" class="seo-internal-link" data-link-type="LinkGamme">${label}</a>`;
const NO_LINK = (label: string) =>
  `<span data-gamme-link="unresolved">${label}</span>`;

describe('InternalLinkingService.resolveGammeAliasLinks', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rewrites a link written without identifier to the canonical gamme URL', async () => {
    const { service, queries, warn } = buildService();

    const html = await service.resolveGammeAliasLinks(
      '- <b><a href="/pieces/courroie-d-accessoire">courroie d accessoire</a></b><br>' +
        '- <b><a href="/pieces/batterie">batterie</a></b><br>',
    );

    expect(html).toBe(
      `- <b>${LINK('/pieces/courroie-d-accessoire-10.html', 'courroie d accessoire')}</b><br>` +
        `- <b>${LINK('/pieces/batterie-1.html', 'batterie')}</b><br>`,
    );
    // One grouped read, restricted to the gammes that have a page.
    expect(queries).toHaveLength(1);
    expect(queries[0].in).toEqual([
      ['pg_level', ['1', '2']],
      ['pg_alias', ['courroie-d-accessoire', 'batterie']],
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts a trailing slash and a `.html` suffix without identifier', async () => {
    const { service } = buildService();

    const html = await service.resolveGammeAliasLinks(
      '<a href="/pieces/demarreur/">démarreur</a> <a href="/pieces/demarreur.html">démarreur</a>',
    );

    expect(html).toBe(
      `${LINK('/pieces/demarreur-2.html', 'démarreur')} ${LINK('/pieces/demarreur-2.html', 'démarreur')}`,
    );
  });

  it('resolves by the #LinkGamme_N# token carried by the link', async () => {
    const { service, queries } = buildService();

    const html = await service.resolveGammeAliasLinks(
      '<a href="/pieces/injecteur #LinkGamme_3902#">injecteur</a> ' +
        '<a href="/pieces/alternateur">batterie #LinkGamme_1#</a>',
    );

    expect(html).toBe(
      `${LINK('/pieces/injecteur-3902.html', 'injecteur')} ${LINK('/pieces/batterie-1.html', 'batterie')}`,
    );
    expect(html).not.toContain('#LinkGamme_');
    expect(queries).toHaveLength(1);
    expect(queries[0].in[1]).toEqual(['pg_id', [3902, 1]]);
  });

  it('keeps the label and drops the link when no gamme matches', async () => {
    const { service, warn } = buildService();

    const html = await service.resolveGammeAliasLinks(
      '<b><a href="/pieces/calculateur-moteur">calculateur moteur</a></b>',
    );

    expect(html).toBe(`<b>${NO_LINK('calculateur moteur')}</b>`);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('drops the link to a gamme without page, by alias or by token', async () => {
    const { service } = buildService();

    const html = await service.resolveGammeAliasLinks(
      '<a href="/pieces/disque-d-embrayage">disque d embrayage</a> ' +
        '<a href="/pieces/glace #LinkGamme_1914#">glace de rétroviseur</a> ' +
        '<a href="/pieces/gamme-tecdoc-1475">gamme hors catalogue</a>',
    );

    expect(html).toBe(
      `${NO_LINK('disque d embrayage')} ${NO_LINK('glace de rétroviseur')} ${NO_LINK('gamme hors catalogue')}`,
    );
  });

  it('link written with an identifier: alias brought back to the one served', async () => {
    const { service, queries, warn } = buildService();

    const html = await service.resolveGammeAliasLinks(
      '<a href="/pieces/poulie-tendeur-de-courroie-de-distribution-308.html" title="Galet">galet <b>tendeur</b></a>',
    );

    // Only the address changes: attributes and label are kept.
    expect(html).toBe(
      '<a href="/pieces/galet-tendeur-de-courroie-de-distribution-308.html" title="Galet">galet <b>tendeur</b></a>',
    );
    expect(queries).toHaveLength(1);
    expect(queries[0].in[1]).toEqual(['pg_id', [308]]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('link written with an identifier: dropped when the gamme has no page', async () => {
    const { service, warn } = buildService();

    const html = await service.resolveGammeAliasLinks(
      '<a href="/pieces/disque-d-embrayage-262.html">disque</a> ' +
        '<a href="/pieces/piece-inconnue-999999.html">pièce inconnue</a>',
    );

    expect(html).toBe(`${NO_LINK('disque')} ${NO_LINK('pièce inconnue')}`);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('never guesses: free text, accents and nested paths stay without link', async () => {
    const { service, queries } = buildService();

    const html = await service.resolveGammeAliasLinks(
      `<a href="/pieces/assurer l'etancheite">joint</a> ` +
        '<a href="/pieces/démarreur">démarreur</a> ' +
        '<a href="/pieces/batterie/renault">batterie renault</a>',
    );

    expect(html).toBe(
      `${NO_LINK('joint')} ${NO_LINK('démarreur')} ${NO_LINK('batterie renault')}`,
    );
    expect(queries).toHaveLength(0);
  });

  it('drops the link when several catalogue gammes share the alias', async () => {
    const { service } = buildService([
      ...GAMMES,
      gamme(900, 'batterie', 'Autre', '2'),
    ]);

    const html = await service.resolveGammeAliasLinks(
      '<a href="/pieces/batterie">batterie</a>',
    );

    expect(html).toBe(NO_LINK('batterie'));
  });

  it('leaves a verified gamme link exactly as written', async () => {
    const { service, queries } = buildService();
    const content =
      '<a href="/pieces/demarreur-2.html" rel="related">démarreur</a>';

    expect(await service.resolveGammeAliasLinks(content)).toBe(content);
    expect(queries).toHaveLength(1);
  });

  it('leaves vehicle pages and links outside `/pieces/` untouched, without reading', async () => {
    const { service, queries } = buildService();
    const content =
      '<a href="/pieces/demarreur-2/renault-140/clio-iii-140004/1-5-dci-19052.html">démarreur Clio</a> ' +
      '<a href="/reference-auto/demarreur">définition</a> ' +
      '<a href="/blog-pieces-auto/conseils/demarreur">conseils</a>';

    expect(await service.resolveGammeAliasLinks(content)).toBe(content);
    expect(queries).toHaveLength(0);
  });

  it('returns content without any gamme link as is', async () => {
    const { service, queries } = buildService();
    const prose =
      '<ul><li><strong>Batterie</strong> : à contrôler avant le démarreur.</li></ul>';

    expect(await service.resolveGammeAliasLinks(prose)).toBe(prose);
    expect(await service.resolveGammeAliasLinks('')).toBe('');
    expect(queries).toHaveLength(0);
  });

  it('throws when the read fails, instead of serving unverified links', async () => {
    const { service } = buildService(GAMMES, { message: 'timeout' });

    await expect(
      service.resolveGammeAliasLinks('<a href="/pieces/batterie">batterie</a>'),
    ).rejects.toBeInstanceOf(DatabaseException);
  });

  it('throws when no client is configured and a link needs resolving', async () => {
    const service = new InternalLinkingService();
    Object.defineProperty(service, 'supabase', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    await expect(
      service.resolveGammeAliasLinks('<a href="/pieces/batterie">batterie</a>'),
    ).rejects.toBeInstanceOf(DatabaseException);
    // Nothing to resolve: no client needed.
    expect(await service.resolveGammeAliasLinks('<p>texte</p>')).toBe(
      '<p>texte</p>',
    );
  });

  it('leaves the token replacement of processLinkGamme with nothing to break', async () => {
    const { service } = buildService();

    const resolved = await service.resolveGammeAliasLinks(
      '<a href="/pieces/injecteur #LinkGamme_3902#">injecteur</a> et #LinkGamme_2#',
    );

    // The token outside a link is left for processLinkGamme.
    expect(resolved).toBe(
      `${LINK('/pieces/injecteur-3902.html', 'injecteur')} et #LinkGamme_2#`,
    );
  });
});
