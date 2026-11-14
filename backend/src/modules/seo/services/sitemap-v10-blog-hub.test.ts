/**
 * sitemap-blog.xml — le hub du blog est déclaré à son adresse canonique.
 *
 * `__sitemap_blog` porte le hub sous un alias vide. `/blog-pieces-auto/` est
 * servie avec un canonical vers `/blog-pieces-auto` : le sitemap ne déclare
 * que cette seconde forme.
 *
 * Pas d'I/O : client Supabase factice, écriture du fichier capturée.
 */

import { SitemapV10StaticService } from './sitemap-v10-static.service';
import { type SitemapUrl } from './sitemap-v10.types';

type BlogRow = { map_alias: string | null; map_date: string | null };

async function generate(
  rows: BlogRow[],
  r6ConsolidationOn = false,
): Promise<{ filePath: string | null; urls: string[] }> {
  let written: SitemapUrl[] = [];
  const svc = Object.create(
    SitemapV10StaticService.prototype,
  ) as SitemapV10StaticService;
  Object.assign(svc as unknown as Record<string, unknown>, {
    supabase: {
      from: () => ({
        select: () => ({
          order: async () => ({ data: rows, error: null }),
        }),
      }),
    },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    featureFlags: { seoR6ConsolidationEnabled: r6ConsolidationOn },
    xmlService: {
      OUTPUT_DIR: '/sitemaps',
      writeStaticSitemapFile: async (_path: string, urls: SitemapUrl[]) => {
        written = urls;
      },
    },
  });
  const filePath = await svc.generateBlogSitemap();
  return { filePath, urls: written.map((u) => u.url) };
}

describe('generateBlogSitemap — adresse du hub', () => {
  it('alias vide → hub sans barre finale, articles inchangés', async () => {
    const { filePath, urls } = await generate([
      { map_alias: '', map_date: '2021-07-16T00:00:00.000Z' },
      { map_alias: 'conseils/filtre-a-air', map_date: null },
      { map_alias: 'auto/alfa-romeo/brera', map_date: null },
    ]);
    expect(filePath).toBe('/sitemaps/sitemap-blog.xml');
    expect(urls).toEqual([
      '/blog-pieces-auto',
      '/blog-pieces-auto/conseils/filtre-a-air',
      '/blog-pieces-auto/auto/alfa-romeo/brera',
    ]);
  });

  it('alias absent → hub, jamais « /blog-pieces-auto/null »', async () => {
    const { urls } = await generate([{ map_alias: null, map_date: null }]);
    expect(urls).toEqual(['/blog-pieces-auto']);
  });

  it('consolidation R6 ON → le hub reste déclaré, guide-achat sort', async () => {
    const { urls } = await generate(
      [
        { map_alias: '', map_date: null },
        { map_alias: 'guide-achat', map_date: null },
        { map_alias: 'guide-achat/bougie', map_date: null },
        { map_alias: 'conseils/embrayage', map_date: null },
      ],
      true,
    );
    expect(urls).toEqual([
      '/blog-pieces-auto',
      '/blog-pieces-auto/conseils/embrayage',
    ]);
  });
});
