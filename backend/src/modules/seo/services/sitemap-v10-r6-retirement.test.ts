/**
 * Consolidation R6→R3 — la surface guide-achat sort des listes de découverte.
 *
 * Invariants couverts :
 *   - isR6GuideAchatSurface : hub + pages détail guide-achat, rien d'autre
 *   - excludeR6GuideAchatUrls : sitemap-blog.xml perd les URLs guide-achat, compte exact
 *   - generateEditorialHub : flag ON ⇒ aucun lien guide-achat, table __blog_guide
 *     non lue ; flag OFF ⇒ statu quo (liens guide-achat présents)
 *
 * Pas d'I/O réseau : client Supabase factice, OUTPUT_DIR temporaire.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { isR6GuideAchatSurface } from '../types/page-role.types';
import { excludeR6GuideAchatUrls } from './sitemap-v10-static.service';
import { HubsPriorityService } from './sitemap-v10-hubs-priority.service';

describe('isR6GuideAchatSurface', () => {
  it.each([
    '/blog-pieces-auto/guide-achat',
    '/blog-pieces-auto/guide-achat/',
    '/blog-pieces-auto/guide-achat/filtre-a-air',
    '/blog-pieces-auto/guide-achat/pieces-auto-comment-s-y-retrouver',
  ])('%s → surface R6', (p) => {
    expect(isR6GuideAchatSurface(p)).toBe(true);
  });

  it.each([
    '/blog-pieces-auto/conseils/filtre-a-air',
    '/blog-pieces-auto/article/filtre-a-air',
    '/blog-pieces-auto/',
    '/blog-pieces-auto',
    '/blog-pieces-auto/guide-achats',
    '/pieces/filtre-a-air-8.html',
  ])('%s → hors surface R6', (p) => {
    expect(isR6GuideAchatSurface(p)).toBe(false);
  });
});

describe('excludeR6GuideAchatUrls', () => {
  it('retire hub + détails guide-achat, garde le reste dans l’ordre', () => {
    const urls = [
      { url: '/blog-pieces-auto/conseils/filtre-a-air' },
      { url: '/blog-pieces-auto/guide-achat' },
      { url: '/blog-pieces-auto/guide-achat/filtre-a-air' },
      { url: '/blog-pieces-auto/article/embrayage' },
    ];
    const { kept, excludedCount } = excludeR6GuideAchatUrls(urls as never);
    expect(kept.map((u) => u.url)).toEqual([
      '/blog-pieces-auto/conseils/filtre-a-air',
      '/blog-pieces-auto/article/embrayage',
    ]);
    expect(excludedCount).toBe(2);
  });

  it('aucune URL guide-achat → liste inchangée, 0 exclue', () => {
    const urls = [{ url: '/blog-pieces-auto/conseils/disque-de-frein' }];
    const { kept, excludedCount } = excludeR6GuideAchatUrls(urls as never);
    expect(kept).toEqual(urls);
    expect(excludedCount).toBe(0);
  });
});

describe('HubsPriorityService.generateEditorialHub — consolidation R6', () => {
  const ROWS: Record<string, Record<string, string>[]> = {
    __blog_advice: [{ ba_alias: 'embrayage' }],
    __blog_guide: [{ bg_alias: 'filtre-a-air' }],
    __seo_gamme_conseil: [{ sgc_pg_id: '82' }],
    pieces_gamme: [{ pg_id: '82', pg_alias: 'disque-de-frein' }],
    __sitemap_blog: [
      { map_alias: 'conseils/filtre-a-air' },
      { map_alias: 'guide-achat' },
      { map_alias: 'guide-achat/bougie' },
    ],
  };

  let outDir: string;

  beforeEach(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'r6-editorial-hub-'));
  });

  afterEach(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  async function runHub(
    flagOn: boolean,
  ): Promise<{ html: string; tablesQueried: string[] }> {
    const tablesQueried: string[] = [];
    const fake = {
      from(table: string) {
        tablesQueried.push(table);
        const builder = {
          select: (columns: string) => {
            for (const column of columns
              .split(',')
              .map((value) => value.trim())) {
              if (!Object.hasOwn(ROWS[table][0], column)) {
                throw new Error(`Unknown column ${table}.${column}`);
              }
            }
            return builder;
          },
          in: async (column: string, values: string[]) => ({
            data: (ROWS[table] ?? []).filter((row) =>
              values.includes(row[column]),
            ),
            error: null,
          }),
          limit: async () => ({ data: ROWS[table] ?? [], error: null }),
        };
        return builder;
      },
    };
    const svc = Object.create(
      HubsPriorityService.prototype,
    ) as HubsPriorityService;
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: fake,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      featureFlags: { seoR6ConsolidationEnabled: flagOn },
      BASE_URL: 'https://example.test',
      OUTPUT_DIR: outDir,
    });
    const result = await svc.generateEditorialHub();
    expect(result.success).toBe(true);
    const html = await fs.readFile(
      path.join(outDir, 'content', 'editorial.html'),
      'utf8',
    );
    return { html, tablesQueried };
  }

  it('flag ON → aucun lien guide-achat, __blog_guide non lue', async () => {
    const { html, tablesQueried } = await runHub(true);
    expect(html).not.toContain('/guide-achat');
    expect(html).toContain(
      'https://example.test/blog-pieces-auto/conseils/disque-de-frein',
    );
    expect(tablesQueried).not.toContain('__blog_guide');
    expect(html).toContain(
      'https://example.test/blog-pieces-auto/conseils/filtre-a-air',
    );
    expect(html).toContain(
      'https://example.test/blog-pieces-auto/article/embrayage',
    );
  });

  it('flag OFF (défaut) → statu quo, liens guide-achat présents', async () => {
    const { html, tablesQueried } = await runHub(false);
    expect(tablesQueried).toContain('__blog_guide');
    expect(html).toContain(
      'https://example.test/blog-pieces-auto/guide-achat/filtre-a-air',
    );
    expect(html).toContain(
      'https://example.test/blog-pieces-auto/guide-achat/bougie',
    );
  });
});
