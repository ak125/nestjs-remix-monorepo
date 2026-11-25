/**
 * Mandat EW — sitemap-reference.xml retire les 62 fiches R4 `noindex, follow`
 * drapeau allumé ; drapeau éteint, fichier identique à aujourd'hui.
 * Lecture en échec : aucun fichier écrit (rien de figé dans le sitemap).
 *
 * Pas d'I/O réseau : client Supabase factice, OUTPUT_DIR temporaire.
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SitemapV10StaticService } from './sitemap-v10-static.service';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import { R4_NOINDEX_SLUGS } from './r4-noindex.config';

type Result = { data: unknown; error: { message: string } | null };

function fakeQuery(result: Result, calls: string[]) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) {
    q[m] = (...args: unknown[]) => {
      calls.push(`${m}:${JSON.stringify(args)}`);
      return q;
    };
  }
  q.then = (resolve: (r: Result) => unknown) => resolve(result);
  return q;
}

function buildService(result: Result, flag: boolean, outDir: string) {
  const calls: string[] = [];
  const tables: string[] = [];
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const xml = Object.create(SitemapV10XmlService.prototype);
  Object.assign(xml, { OUTPUT_DIR: outDir, BASE_URL: 'https://example.test' });
  const svc = Object.create(SitemapV10StaticService.prototype);
  Object.assign(svc as unknown as Record<string, unknown>, {
    supabase: {
      from: (t: string) => {
        tables.push(t);
        return fakeQuery(result, calls);
      },
    },
    logger,
    xmlService: xml,
    featureFlags: { seoR4NoindexEnabled: flag },
  });
  return { svc: svc as SitemapV10StaticService, calls, tables, logger };
}

async function locs(file: string): Promise<string[]> {
  const xml = await fs.readFile(file, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const LISTED = ['capteur-de-pluie', 'volant-moteur'];
const OTHERS = ['soupape-d-admission', 'disque-de-frein', 'plaquette-de-frein'];
const rows = [OTHERS[0], LISTED[0], OTHERS[1], LISTED[1], OTHERS[2]].map(
  (slug, i) => ({ slug, updated_at: `2026-11-2${i}T00:00:00Z` }),
);
const url = (s: string) => `https://example.test/reference-auto/${s}`;

describe('sitemap-reference.xml — R4 noindex (mandat EW)', () => {
  let outDir: string;
  beforeEach(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sitemap-r4-noindex-'));
  });
  afterEach(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it('drapeau éteint : toutes les fiches publiées, ordre conservé', async () => {
    const { svc, calls, tables, logger } = buildService(
      { data: rows, error: null },
      false,
      outDir,
    );
    const file = await svc.generateReferenceSitemap();
    expect(file).toBe(path.join(outDir, 'sitemap-reference.xml'));
    expect(await locs(file as string)).toEqual(rows.map((r) => url(r.slug)));
    expect(tables).toEqual(['__seo_reference']);
    expect(calls).toContain('eq:["is_published",true]');
    expect(
      logger.log.mock.calls.some(([m]) => String(m).includes('R4 noindex')),
    ).toBe(false);
  });

  it('drapeau allumé : les fiches de la liste sortent, les autres restent', async () => {
    const off = buildService({ data: rows, error: null }, false, outDir);
    await off.svc.generateReferenceSitemap();
    const { svc, calls, tables, logger } = buildService(
      { data: rows, error: null },
      true,
      outDir,
    );
    const file = await svc.generateReferenceSitemap();
    expect(await locs(file as string)).toEqual(OTHERS.map(url));
    // même lecture qu'éteint : une table, mêmes filtres
    expect(tables).toEqual(off.tables);
    expect(calls).toEqual(off.calls);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('R4 noindex ON: 2 URL(s)'),
    );
  });

  it('drapeau allumé : les 62 sortent toutes, aucune autre', async () => {
    const all = [...R4_NOINDEX_SLUGS, ...OTHERS].map((slug) => ({
      slug,
      updated_at: '2026-11-25T00:00:00Z',
    }));
    const { svc } = buildService({ data: all, error: null }, true, outDir);
    const file = await svc.generateReferenceSitemap();
    expect(await locs(file as string)).toEqual(OTHERS.map(url));
  });

  it('lecture en échec, drapeau allumé : null, aucun fichier écrit', async () => {
    const { svc } = buildService(
      { data: null, error: { message: 'boom' } },
      true,
      outDir,
    );
    expect(await svc.generateReferenceSitemap()).toBeNull();
    expect(await fs.readdir(outDir)).toEqual([]);
  });
});
