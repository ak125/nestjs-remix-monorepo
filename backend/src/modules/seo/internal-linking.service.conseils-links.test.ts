/**
 * InternalLinkingService.resolveConseilsLinks — liens « page conseil » du texte R1.
 *
 * Données de référence relevées en base le 2026-11-13 (SELECT seul) :
 * `__seo_gamme.sg_content` de 12 gammes porte un lien
 * `/blog-pieces-auto/conseils/comment-changer-un-{gamme}`.
 * - 4 cibles sont le `ba_alias` d'un conseil (répondent 301) ;
 * - 8 ne désignent aucun conseil (répondent 404), dont ressort-de-suspension,
 *   gamme sans page conseil.
 */
import { DatabaseException } from '@common/exceptions';
import { InternalLinkingService } from './internal-linking.service';

// Le stub Jest de `@repo/database-types` ne porte pas ces tables : on charge
// les vrais noms, ceux que le service passe à Supabase.
jest.mock('@repo/database-types', () =>
  jest.requireActual('../../../../packages/database-types/src/constants'),
);

type Row = Record<string, unknown>;

interface Tables {
  __blog_advice: Row[];
  pieces_gamme: Row[];
}

/** Client Supabase minimal : `from().select().in()…` puis `await`. */
function fakeClient(tables: Tables, failOn?: keyof Tables) {
  const calls: Array<{ table: string; filters: Array<[string, unknown[]]> }> =
    [];
  const client = {
    from(table: keyof Tables) {
      const call = { table, filters: [] as Array<[string, unknown[]]> };
      calls.push(call);
      const builder = {
        select: () => builder,
        in: (column: string, values: unknown[]) => {
          call.filters.push([column, values]);
          return builder;
        },
        then: (resolve: (r: unknown) => unknown) => {
          if (failOn === table) {
            return Promise.resolve({
              data: null,
              error: { message: 'boom' },
            }).then(resolve);
          }
          const data = tables[table].filter((row) =>
            call.filters.every(([c, vs]) =>
              vs.map(String).includes(String(row[c])),
            ),
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

function makeService(tables: Tables, failOn?: keyof Tables) {
  const service = new InternalLinkingService();
  const { client, calls } = fakeClient(tables, failOn);
  (service as unknown as { supabase: unknown }).supabase = client;
  return { service, calls };
}

/** Les 12 gammes : pg_id, pg_alias, ba_alias réel du conseil rattaché (ou null). */
const GAMMES: Array<[number, string, string | null]> = [
  [4, 'alternateur', 'comment-changer-votre-alternateur'],
  [854, 'amortisseur', 'quand-changer-vos-amortisseurs'],
  [273, 'bras-de-suspension', 'comment-changer-un-bras-suspension'],
  [13, 'cardan', 'comment-changer-un-cardan'],
  [2, 'demarreur', 'comment-changer-un-demarreur'],
  [82, 'disque-de-frein', 'comment-changer-un-disque-frein'],
  [78, 'etrier-de-frein', 'comment-changer-un-etrier-frein'],
  [8, 'filtre-a-air', 'comment-changer-un-filtre-a-air'],
  [7, 'filtre-a-huile', 'comment-changer-un-filtre-a-huile'],
  [479, 'kit-d-embrayage', 'changement-kit-embrayage-et-volant-moteur-use'],
  [402, 'plaquette-de-frein', 'comment-changer-vos-plaquettes-frein'],
  [188, 'ressort-de-suspension', null],
];

const TABLES_FIXTURE: Tables = {
  __blog_advice: GAMMES.filter(([, , ba]) => ba !== null).map(
    ([pgId, , ba]) => ({ ba_alias: ba, ba_pg_id: String(pgId) }),
  ),
  pieces_gamme: GAMMES.map(([pgId, alias]) => ({
    pg_id: pgId,
    pg_alias: alias,
    pg_name: alias,
    pg_level: '1',
  })),
};

/** `conseilsAliases` du snapshot : gammes ayant au moins un conseil. */
const SERVED = new Set(
  GAMMES.filter(([, , ba]) => ba !== null).map(([, alias]) => alias),
);

/** Fragment tel qu'écrit dans sg_content. */
const fragment = (alias: string) =>
  `<p>Notre <a href="/blog-pieces-auto/conseils/comment-changer-un-${alias}">guide conseils ${alias}</a> détaille la procédure.</p>`;

const CONSEILS_HREF_RE = /href="(\/blog-pieces-auto\/conseils\/[^"]*)"/g;

describe('InternalLinkingService.resolveConseilsLinks — texte R1 des 12 gammes', () => {
  const linkedAfter: Record<string, string | null> = {
    // ba_alias d'un conseil (301 avant) → page conseil servie
    cardan: '/blog-pieces-auto/conseils/cardan',
    demarreur: '/blog-pieces-auto/conseils/demarreur',
    'filtre-a-air': '/blog-pieces-auto/conseils/filtre-a-air',
    'filtre-a-huile': '/blog-pieces-auto/conseils/filtre-a-huile',
    // cible qui ne désigne aucun conseil (404 avant) → libellé sans lien
    alternateur: null,
    amortisseur: null,
    'bras-de-suspension': null,
    'disque-de-frein': null,
    'etrier-de-frein': null,
    'kit-d-embrayage': null,
    'plaquette-de-frein': null,
    // pas de page conseil du tout
    'ressort-de-suspension': null,
  };

  it.each(GAMMES.map(([, alias]) => alias))('%s', async (alias) => {
    const { service } = makeService(TABLES_FIXTURE);
    const out = await service.resolveConseilsLinks(fragment(alias), SERVED);

    const hrefs = [...out.matchAll(CONSEILS_HREF_RE)].map((m) => m[1]);
    const expected = linkedAfter[alias];
    if (expected === null) {
      expect(hrefs).toEqual([]);
      expect(out).toBe(
        `<p>Notre guide conseils ${alias} détaille la procédure.</p>`,
      );
    } else {
      expect(hrefs).toEqual([expected]);
      expect(out).toContain(`>guide conseils ${alias}</a>`);
    }
  });

  it('aucun lien du résultat ne vise une adresse hors des pages conseil servies', async () => {
    const { service, calls } = makeService(TABLES_FIXTURE);
    const html = GAMMES.map(([, alias]) => fragment(alias)).join('\n');
    const out = await service.resolveConseilsLinks(html, SERVED);
    const hrefs = [...out.matchAll(CONSEILS_HREF_RE)].map((m) => m[1]);
    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) {
      const alias = href.slice('/blog-pieces-auto/conseils/'.length);
      expect(SERVED.has(alias)).toBe(true);
    }
    // Une lecture des conseils et une des gammes, pour tout le contenu.
    expect(calls.map((c) => c.table)).toEqual([
      '__blog_advice',
      'pieces_gamme',
    ]);
  });
});

describe('InternalLinkingService.resolveConseilsLinks — règles', () => {
  it('garde tel quel un lien vers un alias servi, sans lecture en base', async () => {
    const { service, calls } = makeService(TABLES_FIXTURE);
    const html =
      '<a class="x" href="/blog-pieces-auto/conseils/cardan">conseils</a>';
    await expect(service.resolveConseilsLinks(html, SERVED)).resolves.toBe(
      html,
    );
    expect(calls).toEqual([]);
  });

  it('remet à l’adresse servie un alias servi écrit avec barre finale, attributs conservés', async () => {
    const { service } = makeService(TABLES_FIXTURE);
    const out = await service.resolveConseilsLinks(
      '<a class="x" href="/blog-pieces-auto/conseils/cardan/">conseils</a>',
      SERVED,
    );
    expect(out).toBe(
      '<a class="x" href="/blog-pieces-auto/conseils/cardan">conseils</a>',
    );
  });

  it('réécrit aussi un ba_alias dont l’attribut est écrit en majuscules', async () => {
    const { service } = makeService(TABLES_FIXTURE);
    const out = await service.resolveConseilsLinks(
      '<A HREF="/blog-pieces-auto/conseils/comment-changer-un-cardan">conseils</A>',
      SERVED,
    );
    expect(out).toBe(
      '<A href="/blog-pieces-auto/conseils/cardan">conseils</A>',
    );
  });

  it('ne touche pas un contenu sans lien conseils', async () => {
    const { service, calls } = makeService(TABLES_FIXTURE);
    const html = '<p><a href="/pieces/cardan-13.html">cardan</a></p>';
    await expect(service.resolveConseilsLinks(html, SERVED)).resolves.toBe(
      html,
    );
    expect(calls).toEqual([]);
  });

  it('dépile un ba_alias dont la gamme n’a pas de page conseil servie', async () => {
    const { service } = makeService(TABLES_FIXTURE);
    const served = new Set([...SERVED].filter((a) => a !== 'cardan'));
    const out = await service.resolveConseilsLinks(fragment('cardan'), served);
    expect(out).not.toContain('<a ');
  });

  it('écarte un ba_alias porté par des conseils de gammes différentes', async () => {
    const tables: Tables = {
      ...TABLES_FIXTURE,
      __blog_advice: [
        ...TABLES_FIXTURE.__blog_advice,
        { ba_alias: 'comment-changer-un-cardan', ba_pg_id: '2' },
      ],
    };
    const { service } = makeService(tables);
    const out = await service.resolveConseilsLinks(fragment('cardan'), SERVED);
    expect(out).not.toContain('<a ');
  });

  it('lève si la lecture des conseils échoue : rien n’est servi ni mis en cache', async () => {
    const { service } = makeService(TABLES_FIXTURE, '__blog_advice');
    await expect(
      service.resolveConseilsLinks(fragment('alternateur'), SERVED),
    ).rejects.toBeInstanceOf(DatabaseException);
  });

  it('lève si la lecture des gammes échoue', async () => {
    const { service } = makeService(TABLES_FIXTURE, 'pieces_gamme');
    await expect(
      service.resolveConseilsLinks(fragment('cardan'), SERVED),
    ).rejects.toBeInstanceOf(DatabaseException);
  });
});
