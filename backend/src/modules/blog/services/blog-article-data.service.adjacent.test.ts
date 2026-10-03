import { TABLES } from '@repo/database-types';
import { BlogArticleDataService } from './blog-article-data.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { BlogArticle, BaRow } from '../interfaces/blog.interfaces';

/**
 * Régression GSC 404 (2026-10-03) — ArticleNavigation (précédent/suivant des
 * pages /blog-pieces-auto/conseils/{pg_alias}) liait vers /blog-pieces-auto/{ba_alias},
 * qui finit en 404 : getAdjacentArticles ne renseignait jamais pg_alias, et
 * enrichWithPgAlias cherchait le pg_id INTEGER de pieces_gamme avec le ba_pg_id
 * TEXTE de __blog_advice (pg_alias toujours null, related compris).
 */

const ROWS: Record<'previous' | 'next', BaRow> = {
  previous: {
    ba_id: 74,
    ba_alias: 'comment-changer-une-colonne-direction',
    ba_title: 'Colonne de direction',
    ba_pg_id: '1211',
    ba_create: '2020-01-01',
  },
  next: {
    ba_id: 11,
    ba_alias: 'comment-changer-un-thermostat',
    ba_title: 'Thermostat',
    ba_pg_id: '316',
    ba_create: '2022-01-01',
  },
};

/** pieces_gamme.pg_id est integer : supabase-js le rend en number. */
const GAMMES = [
  { pg_id: 1211, pg_alias: 'colonne-de-direction' },
  { pg_id: 316, pg_alias: 'thermostat' },
];

function makeClient() {
  const from = jest.fn((table: string) => {
    let direction: 'previous' | 'next' = 'previous';
    let pgIds: unknown[] = [];
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      lt: () => {
        direction = 'previous';
        return query;
      },
      gt: () => {
        direction = 'next';
        return query;
      },
      single: async () => ({ data: ROWS[direction] }),
      in: async (_column: string, ids: unknown[]) => {
        pgIds = ids;
        return {
          data:
            table === TABLES.pieces_gamme
              ? GAMMES.filter((g) => pgIds.includes(String(g.pg_id)))
              : [],
        };
      },
    };
    return query;
  });
  return { from };
}

function makeService() {
  const service = new BlogArticleDataService(
    { client: makeClient() } as never,
    new BlogArticleTransformService(),
    {} as never,
  );
  jest.spyOn(service, 'getArticleBySlug').mockResolvedValue({
    slug: 'comment-changer-un-demarreur',
    legacy_table: '__blog_advice',
    ba_pg_id: '2',
    publishedAt: '2021-01-01',
  } as BlogArticle);
  return service;
}

describe('BlogArticleDataService — articles adjacents portent pg_alias', () => {
  it('previous/next reçoivent le pg_alias de leur gamme (route canonique /conseils/)', async () => {
    const { previous, next } = await makeService().getAdjacentArticles(
      'comment-changer-un-demarreur',
    );

    expect(previous?.slug).toBe('comment-changer-une-colonne-direction');
    expect(previous?.pg_alias).toBe('colonne-de-direction');
    expect(next?.slug).toBe('comment-changer-un-thermostat');
    expect(next?.pg_alias).toBe('thermostat');
  });

  it('enrichWithPgAlias apparie le ba_pg_id texte au pg_id integer', async () => {
    const transform = new BlogArticleTransformService();
    const [article] = await makeService().enrichWithPgAlias([
      transform.transformAdviceToArticle(ROWS.next),
    ]);

    expect(article.pg_id).toBe(316);
    expect(article.pg_alias).toBe('thermostat');
  });

  it('gamme absente de pieces_gamme → pg_alias null (pas de slug inventé)', async () => {
    const transform = new BlogArticleTransformService();
    const [article] = await makeService().enrichWithPgAlias([
      transform.transformAdviceToArticle({ ...ROWS.next, ba_pg_id: '999999' }),
    ]);

    expect(article.pg_alias).toBeNull();
  });
});
