/**
 * sitemap-reference.xml — consolidation R4 → R3 (mandat ER) : drapeau allumé,
 * les pages redirigées sortent du fichier ; éteint, le fichier est inchangé.
 * Pas d'I/O : client Supabase factice, écriture du fichier capturée.
 */
import { SitemapV10StaticService } from './sitemap-v10-static.service';
import { type SitemapUrl } from './sitemap-v10.types';
import {
  R4_CONSOLIDATION_OFF,
  type R4ConsolidationSnapshot,
} from './r4-consolidation-policy.service';

const ROWS = [
  { slug: 'thermostat', updated_at: '2026-01-01T00:00:00.000Z' },
  { slug: 'alternateur', updated_at: '2026-01-02T00:00:00.000Z' },
  { slug: 'vanne-egr', updated_at: '2026-01-03T00:00:00.000Z' },
];

async function generate(snap: R4ConsolidationSnapshot) {
  let written: SitemapUrl[] = [];
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const svc = Object.create(
    SitemapV10StaticService.prototype,
  ) as SitemapV10StaticService;
  Object.assign(svc as unknown as Record<string, unknown>, {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: ROWS, error: null }),
          }),
        }),
      }),
    },
    logger,
    r4Consolidation: { getSnapshot: jest.fn().mockResolvedValue(snap) },
    xmlService: {
      OUTPUT_DIR: '/sitemaps',
      writeStaticSitemapFile: async (_p: string, urls: SitemapUrl[]) => {
        written = urls;
      },
    },
  });
  const filePath = await svc.generateReferenceSitemap();
  return { filePath, written, logger };
}

describe('generateReferenceSitemap — consolidation R4 → R3', () => {
  it('drapeau éteint → toutes les pages publiées, aucune exclusion journalisée', async () => {
    const { filePath, written, logger } = await generate(R4_CONSOLIDATION_OFF);
    expect(filePath).toBe('/sitemaps/sitemap-reference.xml');
    expect(written.map((u) => u.url)).toEqual([
      '/reference-auto/thermostat',
      '/reference-auto/alternateur',
      '/reference-auto/vanne-egr',
    ]);
    expect(logger.log).not.toHaveBeenCalledWith(
      expect.stringContaining('R4 consolidation ON'),
    );
  });

  it('drapeau allumé → pages redirigées exclues, nombre journalisé', async () => {
    const { written, logger } = await generate({
      enabled: true,
      redirects: new Map([
        ['thermostat', '/blog-pieces-auto/conseils/thermostat'],
        ['vanne-egr', '/blog-pieces-auto/conseils/vanne-egr'],
      ]),
    });
    expect(written.map((u) => u.url)).toEqual(['/reference-auto/alternateur']);
    expect(logger.log).toHaveBeenCalledWith(
      '   🔀 R4 consolidation ON: 2 URL(s) référence exclue(s) du sitemap (301 → conseils)',
    );
  });

  it('drapeau allumé, garde non vérifiable (aucune redirection) → aucune exclusion', async () => {
    const { written } = await generate({ enabled: true, redirects: new Map() });
    expect(written).toHaveLength(3);
  });
});
