/**
 * excludeConsolidatedGuideUrls — exclusion sitemap de la consolidation R6→R3.
 *
 * Invariants couverts :
 *   - set vide (flag ON mais aucune gamme avec R3) ⇒ aucune exclusion
 *   - seules les URLs guide-achat des gammes redirigeantes sont retirées
 *   - les URLs conseils / autres ne sont JAMAIS touchées
 *   - excludedCount = exactement le nombre retiré (observabilité du log)
 *
 * Fonction pure — aucun mock Supabase nécessaire.
 */

import {
  excludeConsolidatedGuideUrls,
  excludeConsolidatedReferenceRows,
} from './sitemap-v10-static.service';
import type { SitemapUrl } from './sitemap-v10.types';

const u = (url: string): SitemapUrl => ({
  url,
  page_type: 'blog',
  changefreq: 'monthly',
  priority: '0.6',
  last_modified_at: null,
});

const URLS: SitemapUrl[] = [
  u('/blog-pieces-auto/guide-achat/filtre-a-air'),
  u('/blog-pieces-auto/guide-achat/batterie'),
  u('/blog-pieces-auto/conseils/filtre-a-air'),
  u('/blog-pieces-auto/un-article-blog'),
];

describe('excludeConsolidatedGuideUrls — consolidation R6→R3', () => {
  it('set vide → aucune exclusion', () => {
    const { kept, excludedCount } = excludeConsolidatedGuideUrls(
      URLS,
      new Set(),
    );
    expect(kept).toHaveLength(4);
    expect(excludedCount).toBe(0);
  });

  it('retire uniquement les guide-achat des gammes redirigeantes, jamais les conseils', () => {
    const { kept, excludedCount } = excludeConsolidatedGuideUrls(
      URLS,
      new Set(['filtre-a-air']),
    );
    expect(excludedCount).toBe(1);
    expect(kept.map((x) => x.url)).toEqual([
      '/blog-pieces-auto/guide-achat/batterie',
      '/blog-pieces-auto/conseils/filtre-a-air',
      '/blog-pieces-auto/un-article-blog',
    ]);
  });

  it('toutes les gammes redirigeantes → seuls conseils et articles restent', () => {
    const { kept, excludedCount } = excludeConsolidatedGuideUrls(
      URLS,
      new Set(['filtre-a-air', 'batterie']),
    );
    expect(excludedCount).toBe(2);
    expect(kept.map((x) => x.url)).toEqual([
      '/blog-pieces-auto/conseils/filtre-a-air',
      '/blog-pieces-auto/un-article-blog',
    ]);
  });
});

describe('excludeConsolidatedReferenceRows — consolidation R4→R3', () => {
  const ROWS = [
    { slug: 'filtre-a-air', pg_id: 8 },
    { slug: 'batterie', pg_id: 1 },
    { slug: 'notion-isolee', pg_id: null },
  ];

  it('set vide → aucune exclusion', () => {
    const { kept, excludedCount } = excludeConsolidatedReferenceRows(
      ROWS,
      new Set(),
    );
    expect(kept).toHaveLength(3);
    expect(excludedCount).toBe(0);
  });

  it('retire les fiches des gammes avec R3 ; pg_id null jamais exclu', () => {
    const { kept, excludedCount } = excludeConsolidatedReferenceRows(
      ROWS,
      new Set([8]),
    );
    expect(excludedCount).toBe(1);
    expect(kept.map((r) => r.slug)).toEqual(['batterie', 'notion-isolee']);
  });
});
