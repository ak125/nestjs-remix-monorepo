jest.mock('@repo/database-types', () => ({
  ...jest.requireActual('@repo/database-types'),
  TABLES: {
    blog_advice: '__blog_advice',
    blog_advice_h2: '__blog_advice_h2',
    blog_advice_h3: '__blog_advice_h3',
  },
}));

import { AdviceTransformService } from './advice-transform.service';
import { BlogArticleDataService } from './blog-article-data.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { BlogStatisticsService } from './blog-statistics.service';
import { BaRow } from '../interfaces/blog.interfaces';

type Row = Record<string, string>;
const advice = {
  ba_id: '15',
  ba_title: 'Article',
  ba_preview: 'filtre',
  ba_content: '',
  ba_update: '2026-11-01',
  ba_create: '2026-10-01',
  ba_visit: '5',
};
const rows: Record<string, Row[]> = {
  __blog_advice: [advice],
  __blog_advice_h2: [
    { ba2_id: '214', ba2_ba_id: '15', ba2_h2: 'H2 A' },
    { ba2_id: '27', ba2_ba_id: '46', ba2_h2: 'H2 B' },
  ],
  __blog_advice_h3: [
    { ba3_id: '85', ba3_ba2_id: '214', ba3_h3: 'H3 A' },
    { ba3_id: '3', ba3_ba2_id: '27', ba3_h3: 'H3 B' },
  ],
};
const silent = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Faithful column names and text IDs from the observed PostgreSQL schema.
// A query on a nonexistent column fails instead of a permissive fluent mock.
function database(failureTable?: string, data = rows) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      let selected = [...(data[table] || [])];
      let error: { code: string; message: string } | null =
        table === failureTable ? { code: '503', message: 'unavailable' } : null;
      const check = (column: string) => {
        if (!(column in (rows[table]?.[0] || {}))) {
          error = { code: '42703', message: column };
        }
      };
      const result = () => ({
        data: error ? null : selected,
        count: selected.length,
        error,
      });
      const builder = {
        select: () => builder,
        in(column: string, values: unknown[]) {
          check(column);
          selected = selected.filter((row) =>
            values.map(String).includes(row[column]),
          );
          return builder;
        },
        eq(column: string, value: unknown) {
          return builder.in(column, [value]);
        },
        order(column: string) {
          check(column);
          return builder;
        },
        or(filter: string) {
          filter.split(',').forEach((term) => check(term.split('.')[0]));
          return builder;
        },
        limit: () => Promise.resolve(result()),
        range: () => Promise.resolve(result()),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return builder;
    },
  };
  return { client, calls };
}

describe('blog database contracts', () => {
  const articles = [advice, { ...advice, ba_id: '46' }] as unknown as BaRow[];
  const makeAdvice = (db: ReturnType<typeof database>) => {
    const service = new AdviceTransformService(db as never);
    Object.assign(service, { logger: silent });
    return service;
  };

  it('loads H3 through H2 and keeps two articles separate (text IDs)', async () => {
    const db = database();
    const result = await makeAdvice(db).transformAdvicesToArticles(articles);
    expect(
      result.map((article) => article.sections.map((section) => section.title)),
    ).toEqual([
      ['H2 A', 'H3 A'],
      ['H2 B', 'H3 B'],
    ]);
    expect(db.calls).toEqual(['__blog_advice_h2', '__blog_advice_h3']);
  });

  it('loads the same H3 for a single article', async () => {
    const result = await makeAdvice(database()).transformAdviceToArticle(
      articles[0],
    );
    expect(result.sections.map((section) => section.title)).toEqual([
      'H2 A',
      'H3 A',
    ]);
  });

  it('does not query H3 when the article has no H2', async () => {
    const db = database(undefined, { ...rows, __blog_advice_h2: [] });
    const result = await makeAdvice(db).transformAdviceToArticle(articles[0]);
    expect(result.sections).toEqual([]);
    expect(db.calls).toEqual(['__blog_advice_h2']);
  });

  it('does not query an empty article batch', async () => {
    const db = database();
    expect(await makeAdvice(db).transformAdvicesToArticles([])).toEqual([]);
    expect(db.calls).toEqual([]);
  });

  it.each(['__blog_advice_h2', '__blog_advice_h3'])(
    'propagates %s failure instead of returning successful incomplete articles',
    async (table) => {
      await expect(
        makeAdvice(database(table)).transformAdvicesToArticles(articles),
      ).rejects.toMatchObject({ code: '503' });
      await expect(
        makeAdvice(database(table)).transformAdviceToArticle(articles[0]),
      ).rejects.toMatchObject({ code: '503' });
    },
  );

  it('searches the preview column and returns matching articles', async () => {
    const service = new BlogArticleDataService(
      database() as never,
      new BlogArticleTransformService(),
      {} as never,
    );
    Object.assign(service, { logger: silent });
    const result = await service.searchBlog('filtre');
    expect(result.total).toBe(1);
    expect(result.articles[0].excerpt).toBe('filtre');
  });

  it('returns recent articles and caches the successful result', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    };
    const service = new BlogStatisticsService(
      database() as never,
      {} as never,
      cache as never,
      new BlogArticleTransformService(),
    );
    Object.assign(service, { logger: silent });
    expect(await service.getRecentArticles(6)).toHaveLength(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed recent-article query', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    };
    const service = new BlogStatisticsService(
      database('__blog_advice') as never,
      {} as never,
      cache as never,
      new BlogArticleTransformService(),
    );
    Object.assign(service, { logger: silent });
    expect(await service.getRecentArticles(6)).toEqual([]);
    expect(cache.set).not.toHaveBeenCalled();
  });
});
