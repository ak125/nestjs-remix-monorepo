/**
 * Sitemap V10 — une URL déclarée = une URL servie indexable, dans un seul fichier.
 *
 * Invariants couverts :
 *   - STATIC_PAGES ne redéclare ni `/` (racine) ni `/diagnostic-auto` (diagnostic),
 *     ni les destinations relevées 404 / 301 / noindex le 2026-11-06
 *   - excludeUrlsOwnedElsewhere : retrait exact, ordre conservé
 *   - sitemap-categories.xml applique pg_level = '1' (règle du rendu R1)
 *   - sitemap-vehicules.xml laisse les URLs marque à sitemap-brands.xml ;
 *     source marque indisponible (≠ vide) ⇒ brands non écrit, vehicules garde
 *     les URLs marque : ni répétition ni perte dans l'index
 *
 * Pas d'I/O réseau : client Supabase factice, OUTPUT_DIR temporaire.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  excludeUrlsOwnedElsewhere,
  SitemapV10StaticService,
} from './sitemap-v10-static.service';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import { SitemapV10Service } from './sitemap-v10.service';
import { STATIC_PAGES, type SitemapUrl } from './sitemap-v10.types';

type Result = { data: unknown; error: { message: string } | null };

/** Chaîne PostgREST minimale : enregistre les filtres, résout `result`. */
function fakeQuery(result: Result, calls: string[]) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'order']) {
    q[m] = (...args: unknown[]) => {
      calls.push(`${m}:${JSON.stringify(args)}`);
      return q;
    };
  }
  q.then = (resolve: (r: Result) => unknown) => resolve(result);
  return q;
}

function buildService(
  tables: Record<string, Result>,
  outDir: string,
  calls: Record<string, string[]>,
) {
  const xml = Object.create(SitemapV10XmlService.prototype);
  Object.assign(xml, { OUTPUT_DIR: outDir, BASE_URL: 'https://example.test' });
  const svc = Object.create(SitemapV10StaticService.prototype);
  Object.assign(svc as unknown as Record<string, unknown>, {
    supabase: {
      from: (t: string) => {
        calls[t] = calls[t] ?? [];
        return fakeQuery(tables[t], calls[t]);
      },
    },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    xmlService: xml,
    dataService: {
      fetchWithPagination: async () => tables.__sitemap_vehicules_rows.data,
    },
  });
  return svc as SitemapV10StaticService;
}

async function locs(file: string): Promise<string[]> {
  const xml = await fs.readFile(file, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

describe('STATIC_PAGES', () => {
  const locsList = STATIC_PAGES.map((p) => p.loc);

  it.each(['/', '/diagnostic-auto'])(
    '%s reste porté par son fichier dédié, pas par sitemap-pages.xml',
    (loc) => {
      expect(locsList).not.toContain(loc);
    },
  );

  it.each([
    ['/constructeurs', '404'],
    ['/cgv', '404'],
    ['/faq', '404'],
    ['/blog', '301'],
    ['/mentions-legales', 'noindex'],
    ['/politique-confidentialite', 'noindex'],
  ])('%s (%s relevé) n’est plus déclaré', (loc) => {
    expect(locsList).not.toContain(loc);
  });

  it('conserve les pages sans écart relevé, sans en inventer', () => {
    expect(locsList).toEqual(['/reference-auto', '/contact', '/aide']);
    expect(new Set(locsList).size).toBe(locsList.length);
  });
});

describe('excludeUrlsOwnedElsewhere', () => {
  const u = (url: string) => ({ url }) as SitemapUrl;

  it('retire seulement les URLs possédées ailleurs, ordre conservé', () => {
    const { kept, excludedCount } = excludeUrlsOwnedElsewhere(
      [u('/a'), u('/constructeurs/renault-140.html'), u('/b')],
      new Set(['/constructeurs/renault-140.html']),
    );
    expect(kept.map((k) => k.url)).toEqual(['/a', '/b']);
    expect(excludedCount).toBe(1);
  });

  it('compare la <loc> finale : relative et absolue sont la même URL', () => {
    const toLoc = (url: string) =>
      url.startsWith('http') ? url : `https://example.test${url}`;
    const { kept, excludedCount } = excludeUrlsOwnedElsewhere(
      [u('/constructeurs/renault-140.html'), u('/b')],
      new Set(['https://example.test/constructeurs/renault-140.html']),
      toLoc,
    );
    expect(kept.map((k) => k.url)).toEqual(['/b']);
    expect(excludedCount).toBe(1);
  });

  it('ensemble vide ⇒ liste inchangée', () => {
    const { kept, excludedCount } = excludeUrlsOwnedElsewhere(
      [u('/a')],
      new Set(),
    );
    expect(kept.map((k) => k.url)).toEqual(['/a']);
    expect(excludedCount).toBe(0);
  });
});

describe('SitemapV10StaticService — génération isolée', () => {
  let outDir: string;
  beforeEach(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sitemap-v10-idx-'));
  });
  afterEach(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  const brandsOk: Record<string, Result> = {
    __seo_r7_pages: {
      data: [
        {
          canonical_url: '/constructeurs/renault-140.html',
          updated_at: '2026-03-21T10:00:00Z',
          seo_decision: 'PUBLISH',
        },
      ],
      error: null,
    },
    auto_marque: {
      data: [
        { marque_id: 140, marque_alias: 'renault' },
        { marque_id: 128, marque_alias: 'peugeot' },
      ],
      error: null,
    },
  };

  it('categories : filtre pg_level = 1 en plus des filtres existants', async () => {
    const calls: Record<string, string[]> = {};
    const svc = buildService(
      {
        pieces_gamme: {
          data: [{ pg_alias: 'filtre-a-huile', pg_id: 7 }],
          error: null,
        },
      },
      outDir,
      calls,
    );
    const file = await svc.generateCategoriesSitemap();
    expect(calls.pieces_gamme).toEqual(
      expect.arrayContaining([
        'eq:["pg_display","1"]',
        'eq:["pg_relfollow","1"]',
        'eq:["pg_level","1"]',
      ]),
    );
    expect(await locs(file as string)).toEqual([
      'https://example.test/pieces/filtre-a-huile-7.html',
    ]);
  });

  it('vehicules : les URLs marque restent à sitemap-brands.xml', async () => {
    const svc = buildService(
      {
        ...brandsOk,
        __sitemap_vehicules: { data: null, error: null },
        __sitemap_vehicules_rows: {
          data: [
            {
              niveau: 1,
              url: '/constructeurs/renault-140.html',
              priority: 0.7,
              changefreq: 'weekly',
            },
            {
              niveau: 1,
              url: '/constructeurs/peugeot-128.html',
              priority: 0.7,
              changefreq: 'weekly',
            },
            {
              niveau: 2,
              url: '/constructeurs/renault-140/clio-iii-140004.html',
              priority: 0.6,
              changefreq: 'monthly',
            },
          ],
          error: null,
        },
      },
      outDir,
      {},
    );
    // count(head) : le faux client renvoie `count` via data=null → on force 3
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: {
        from: (t: string) =>
          t === '__sitemap_vehicules'
            ? fakeQuery({ data: null, error: null, count: 3 } as never, [])
            : fakeQuery(brandsOk[t], []),
      },
    });
    const vehFile = await svc.generateVehiculesSitemap();
    const brandFile = await svc.generateBrandsSitemap();
    const veh = await locs(vehFile as string);
    const brands = await locs(brandFile as string);
    expect(veh).toEqual([
      'https://example.test/constructeurs/renault-140/clio-iii-140004.html',
    ]);
    expect(brands).toEqual([
      'https://example.test/constructeurs/renault-140.html',
      'https://example.test/constructeurs/peugeot-128.html',
    ]);
    expect(veh.filter((l) => brands.includes(l))).toEqual([]);
  });

  it('source marque indisponible ⇒ brands absent, vehicules garde les marques', async () => {
    const svc = buildService({}, outDir, {});
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: {
        from: (t: string) =>
          t === '__sitemap_vehicules'
            ? fakeQuery({ data: null, error: null, count: 1 } as never, [])
            : t === 'auto_marque'
              ? fakeQuery({ data: null, error: { message: 'timeout' } }, [])
              : fakeQuery({ data: [], error: null }, []),
      },
      dataService: {
        fetchWithPagination: async () => [
          {
            niveau: 1,
            url: '/constructeurs/renault-140.html',
            priority: 0.7,
            changefreq: 'weekly',
          },
          {
            niveau: 2,
            url: '/constructeurs/renault-140/clio-iii-140004.html',
            priority: 0.6,
            changefreq: 'monthly',
          },
        ],
      },
    });
    const brandUrls = await svc.collectBrandUrls();
    expect(brandUrls).toBeNull();
    const vehFile = await svc.generateVehiculesSitemap(brandUrls);
    expect(await svc.generateBrandsSitemap(brandUrls)).toBeNull();
    await expect(
      fs.access(path.join(outDir, 'sitemap-brands.xml')),
    ).rejects.toThrow();
    expect(await locs(vehFile as string)).toEqual([
      'https://example.test/constructeurs/renault-140.html',
      'https://example.test/constructeurs/renault-140/clio-iii-140004.html',
    ]);
  });

  it('source marque vide (≠ indisponible) ⇒ rien à retirer', async () => {
    const svc = buildService({}, outDir, {});
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: {
        from: (t: string) =>
          t === '__sitemap_vehicules'
            ? fakeQuery({ data: null, error: null, count: 1 } as never, [])
            : fakeQuery({ data: [], error: null }, []),
      },
      dataService: {
        fetchWithPagination: async () => [
          {
            niveau: 1,
            url: '/constructeurs/renault-140.html',
            priority: 0.7,
            changefreq: 'weekly',
          },
        ],
      },
    });
    const brandUrls = await svc.collectBrandUrls();
    expect(brandUrls).toEqual([]);
    expect(await svc.generateBrandsSitemap(brandUrls)).toBeNull();
    expect(
      await locs((await svc.generateVehiculesSitemap(brandUrls)) as string),
    ).toEqual(['https://example.test/constructeurs/renault-140.html']);
  });

  it('vehicules : seules des URLs marque ⇒ pas de fichier vide écrit', async () => {
    const svc = buildService({}, outDir, {});
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: {
        from: (t: string) =>
          t === '__sitemap_vehicules'
            ? fakeQuery({ data: null, error: null, count: 1 } as never, [])
            : fakeQuery(brandsOk[t], []),
      },
      dataService: {
        fetchWithPagination: async () => [
          {
            niveau: 1,
            url: '/constructeurs/renault-140.html',
            priority: 0.7,
            changefreq: 'weekly',
          },
        ],
      },
    });
    expect(await svc.generateVehiculesSitemap()).toBeNull();
  });

  it('pages : aucune répétition avec racine ni diagnostic', async () => {
    const svc = buildService({}, outDir, {});
    const pages = await locs((await svc.generatePagesSitemap()) as string);
    const racine = await locs((await svc.generateRacineSitemap()) as string);
    expect(pages.filter((l) => racine.includes(l))).toEqual([]);
    expect(pages).not.toContain('https://example.test/diagnostic-auto');
  });
});

/**
 * Orchestrateur réel (SitemapV10Service.generateAll) sur I/O privées : seules
 * les sources externes (Supabase, pièces, hubs) sont factices. L'échec
 * d'écriture est réel : un répertoire occupe le chemin sitemap-brands.xml.
 */
describe('SitemapV10Service.generateAll — publication des URLs marque', () => {
  let outDir: string;
  beforeEach(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sitemap-v10-all-'));
  });
  afterEach(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  const BRANDS = [
    '/constructeurs/renault-140.html',
    '/constructeurs/peugeot-128.html',
  ];
  const MODEL = '/constructeurs/renault-140/clio-iii-140004.html';
  const abs = (u: string) => `https://example.test${u}`;

  function buildOrchestrator(
    brandSource: Result,
    vue: { count?: number; rows?: unknown[]; r7?: Result } = {},
  ) {
    const svc = buildService({}, outDir, {});
    const ok: Result = { data: [], error: null };
    const viewRows = [
      ...BRANDS.map((url) => ({
        niveau: 1,
        url,
        priority: 0.7,
        changefreq: 'weekly',
      })),
      { niveau: 2, url: MODEL, priority: 0.6, changefreq: 'monthly' },
    ];
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: {
        from: (t: string) =>
          fakeQuery(
            t === '__sitemap_vehicules'
              ? ({ data: null, error: null, count: vue.count ?? 3 } as never)
              : t === 'auto_marque'
                ? brandSource
                : t === '__seo_r7_pages'
                  ? (vue.r7 ?? ok)
                  : ok,
            [],
          ),
      },
      dataService: {
        fetchWithPagination: async () => vue.rows ?? viewRows,
      },
    });
    const xml = (svc as unknown as { xmlService: SitemapV10XmlService })
      .xmlService;
    Object.assign(xml, { logger: { log: jest.fn(), warn: jest.fn() } });
    const orchestrator = Object.create(SitemapV10Service.prototype);
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    Object.assign(orchestrator as unknown as Record<string, unknown>, {
      logger,
      xmlService: xml,
      staticService: svc,
      dataService: {
        resetCaches: jest.fn(),
        clearCaches: jest.fn(),
        logGeneration: jest.fn(),
      },
      piecesService: {
        generatePiecesSitemapsFromV9Source: async () => ({
          filePaths: [],
          totalCount: 0,
        }),
      },
      hubsService: {
        generateAllHubsRobust: async () => ({
          summary: { totalUrls: 0, totalFiles: 0 },
        }),
      },
    });
    return { orchestrator: orchestrator as SitemapV10Service, logger };
  }

  /** Index réel : chaque entrée doit exister ; renvoie fichier → <loc>. */
  async function readIndex(indexPath: string) {
    const entries = await locs(indexPath);
    const byFile: Record<string, string[]> = {};
    for (const e of entries) {
      const name = e.replace('https://example.test/', '');
      byFile[name] = await locs(path.join(outDir, name));
    }
    return byFile;
  }

  const brandsAvailable: Result = {
    data: [
      { marque_id: 140, marque_alias: 'renault' },
      { marque_id: 128, marque_alias: 'peugeot' },
    ],
    error: null,
  };

  /** sitemap-vehicules.xml antérieur (format public, marques comprises). */
  const OLD_VEH = 'sitemap-vehicules.xml';
  async function seedOldVehicules(paths: string[]) {
    const body = paths
      .map((u) => `  <url>\n    <loc>${abs(u)}</loc>\n  </url>`)
      .join('\n');
    await fs.writeFile(
      path.join(outDir, OLD_VEH),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`,
      'utf8',
    );
  }

  /** Desserte Caddy `@sitemaps path /sitemap*.xml` : fichiers racine servis. */
  async function servedConstructeurFiles() {
    const served: string[] = [];
    for (const name of await fs.readdir(outDir)) {
      if (!/^sitemap.*\.xml$/.test(name) || name === 'sitemap.xml') continue;
      const stat = await fs.stat(path.join(outDir, name));
      if (!stat.isFile()) continue;
      const found = await locs(path.join(outDir, name));
      if (found.some((u) => u.includes('/constructeurs'))) served.push(name);
    }
    return served.sort();
  }

  it('succès : brands porte les marques, vehicules le reste, run en succès', async () => {
    await seedOldVehicules([...BRANDS, MODEL]);
    const { orchestrator } = buildOrchestrator(brandsAvailable);
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(true);
    expect(idx['sitemap-brands.xml']).toEqual(BRANDS.map(abs));
    expect(idx['sitemap-vehicules.xml']).toEqual([abs(MODEL)]);
    expect(Object.keys(idx).indexOf('sitemap-vehicules.xml')).toBeLessThan(
      Object.keys(idx).indexOf('sitemap-brands.xml'),
    );
  });

  it('écriture brands en échec après lecture saine : URLs gardées, index valide, run en échec', async () => {
    await fs.mkdir(path.join(outDir, 'sitemap-brands.xml'));
    const { orchestrator, logger } = buildOrchestrator(brandsAvailable);
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(false);
    expect(idx['sitemap-brands.xml']).toBeUndefined();
    expect(idx['sitemap-vehicules.xml']).toEqual([...BRANDS, MODEL].map(abs));
    const all = Object.values(idx).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('sitemap-brands.xml non publié'),
    );
  });

  it('écriture brands en échec : une marque collectée absente de la vue véhicules reste publiée', async () => {
    const DACIA = '/constructeurs/dacia-55.html';
    await fs.mkdir(path.join(outDir, 'sitemap-brands.xml'));
    const { orchestrator, logger } = buildOrchestrator({
      data: [
        ...(brandsAvailable.data as unknown[]),
        { marque_id: 55, marque_alias: 'dacia' },
      ],
      error: null,
    });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(false);
    expect(idx['sitemap-brands.xml']).toBeUndefined();
    expect(idx['sitemap-vehicules.xml']).toEqual(
      [...BRANDS, MODEL, DACIA].map(abs),
    );
    const all = Object.values(idx).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('sitemap-brands.xml non publié'),
    );
  });

  // Repli brands : R7 canonical_url ABSOLUE + repli auto_marque RELATIF de
  // même <loc> finale (renault-140), plus dacia-55 hors R7.
  const r7Renault: Result = {
    data: [
      {
        canonical_url: abs('/constructeurs/renault-140.html'),
        updated_at: '2026-11-01',
        seo_decision: 'PUBLISH',
      },
    ],
    error: null,
  };
  const renaultDacia: Result = {
    data: [
      { marque_id: 140, marque_alias: 'renault' },
      { marque_id: 55, marque_alias: 'dacia' },
    ],
    error: null,
  };
  const KNOWN = [
    '/constructeurs/renault-140.html',
    '/constructeurs/dacia-55.html',
  ];

  it('défaut 1 — vue véhicules saine vide (count 0) : marques connues publiées malgré l’échec brands', async () => {
    await fs.mkdir(path.join(outDir, 'sitemap-brands.xml'));
    const { orchestrator } = buildOrchestrator(renaultDacia, { count: 0 });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(false);
    expect(idx['sitemap-brands.xml']).toBeUndefined();
    expect(idx['sitemap-vehicules.xml']).toEqual(KNOWN.map(abs));
  });

  it('défaut 1 — count > 0 puis liste vide = lecture en échec : rien inventé, run en échec', async () => {
    await fs.mkdir(path.join(outDir, 'sitemap-brands.xml'));
    const { orchestrator } = buildOrchestrator(renaultDacia, {
      count: 3,
      rows: [],
    });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(false);
    expect(idx['sitemap-brands.xml']).toBeUndefined();
    expect(idx['sitemap-vehicules.xml']).toBeUndefined();
  });

  it('défaut 2 — R7 absolue + repli relatif de même <loc> : une seule entrée, R7 gardée', async () => {
    await fs.mkdir(path.join(outDir, 'sitemap-brands.xml'));
    const { orchestrator } = buildOrchestrator(renaultDacia, {
      count: 1,
      rows: [{ niveau: 2, url: MODEL, priority: 0.6, changefreq: 'monthly' }],
      r7: r7Renault,
    });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(false);
    expect(idx['sitemap-vehicules.xml']).toEqual([MODEL, ...KNOWN].map(abs));
    const xml = await fs.readFile(
      path.join(outDir, 'sitemap-vehicules.xml'),
      'utf8',
    );
    expect(xml).toMatch(/renault-140\.html<\/loc>\s*<lastmod>2026-11-01/);
  });

  it('défauts 1 + 2 — vue vide, R7 absolue + repli relatif, erreur disque brands : marques connues sans doublon', async () => {
    await fs.mkdir(path.join(outDir, 'sitemap-brands.xml'));
    const { orchestrator, logger } = buildOrchestrator(renaultDacia, {
      count: 0,
      r7: r7Renault,
    });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(false);
    expect(idx['sitemap-brands.xml']).toBeUndefined();
    expect(idx['sitemap-vehicules.xml']).toEqual(KNOWN.map(abs));
    const all = Object.values(idx).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('sitemap-brands.xml non publié'),
    );
  });

  it('source marque indisponible : URLs gardées par vehicules, run en échec', async () => {
    const { orchestrator } = buildOrchestrator({
      data: null,
      error: { message: 'timeout' },
    });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(false);
    expect(idx['sitemap-brands.xml']).toBeUndefined();
    expect(idx['sitemap-vehicules.xml']).toEqual([...BRANDS, MODEL].map(abs));
  });

  it('marques publiées + lecture véhicules en échec : ancien fichier gardé tel quel, hors index', async () => {
    await seedOldVehicules([...BRANDS, MODEL]);
    const before = await fs.readFile(path.join(outDir, OLD_VEH), 'utf8');
    const { orchestrator } = buildOrchestrator(brandsAvailable, {
      count: 3,
      rows: [],
    });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(idx['sitemap-brands.xml']).toEqual(BRANDS.map(abs));
    expect(idx[OLD_VEH]).toBeUndefined();
    expect(await fs.readFile(path.join(outDir, OLD_VEH), 'utf8')).toBe(before);
  });

  it.each([
    ['retrait', []],
    ['écriture', [MODEL]],
  ] as [string, string[]][])(
    'marques publiées + %s de sitemap-vehicules.xml en échec : run en échec',
    async (_label, extra) => {
      // Répertoire non vide à la place du fichier : vrai EISDIR/ENOTEMPTY.
      await fs.mkdir(path.join(outDir, OLD_VEH, 'x'), { recursive: true });
      const { orchestrator, logger } = buildOrchestrator(brandsAvailable, {
        count: BRANDS.length + extra.length,
        rows: [...BRANDS, ...extra].map((url) => ({
          niveau: url === MODEL ? 2 : 1,
          url,
          priority: 0.7,
          changefreq: 'weekly',
        })),
      });
      const result = await orchestrator.generateAll();
      const idx = await readIndex(result.indexPath as string);
      expect(result.success).toBe(false);
      expect(idx['sitemap-brands.xml']).toEqual(BRANDS.map(abs));
      expect(idx[OLD_VEH]).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('écriture ou retrait en échec'),
      );
    },
  );

  it('source marque vide (≠ échec) : rien retiré, run en succès', async () => {
    const { orchestrator } = buildOrchestrator({ data: [], error: null });
    const result = await orchestrator.generateAll();
    const idx = await readIndex(result.indexPath as string);
    expect(result.success).toBe(true);
    expect(idx['sitemap-brands.xml']).toBeUndefined();
    expect(idx['sitemap-vehicules.xml']).toEqual([...BRANDS, MODEL].map(abs));
  });

  describe('régression DS — 36 pages constructeur publiques', () => {
    // Chemins des 36 pages constructeur publiées (sitemap-brands.xml public,
    // relevé du 2026-11-06), recopiés tels quels. DS (ds-441) est la seule
    // absente du sitemap-vehicules.xml public : vue véhicules = les 35 autres.
    const INVENTORY = [
      'alfa-romeo-13',
      'audi-22',
      'bmw-33',
      'chevrolet-44',
      'chrysler-45',
      'citroen-46',
      'dacia-47',
      'daewoo-48',
      'ds-441',
      'fiat-58',
      'ford-60',
      'honda-74',
      'hyundai-76',
      'iveco-84',
      'jeep-86',
      'kia-88',
      'lada-90',
      'lancia-92',
      'land-rover-93',
      'mazda-105',
      'mercedes-benz-108',
      'mini-113',
      'mitsubishi-114',
      'nissan-119',
      'opel-123',
      'peugeot-128',
      'porsche-133',
      'renault-140',
      'saab-145',
      'seat-147',
      'skoda-150',
      'smart-151',
      'suzuki-158',
      'toyota-164',
      'volkswagen-173',
      'volvo-172',
    ].map((slug) => `/constructeurs/${slug}.html`);
    const DS = '/constructeurs/ds-441.html';
    const marques: Result = {
      data: INVENTORY.map((u) => {
        const [, alias, id] = u.match(/^\/constructeurs\/(.+)-(\d+)\.html$/)!;
        return { marque_id: Number(id), marque_alias: alias };
      }),
      error: null,
    };
    const view = INVENTORY.filter((u) => u !== DS).map((url) => ({
      niveau: 1,
      url,
      priority: 0.7,
      changefreq: 'weekly',
    }));
    const r7 = (canonical_url: string): Result => ({
      data: [
        { canonical_url, updated_at: '2026-11-01', seo_decision: 'PUBLISH' },
      ],
      error: null,
    });

    it.each([
      ['R7 vide', { data: [], error: null }, false, '0.5'],
      ['R7 DS relative', r7(DS), false, '0.8'],
      ['R7 DS absolue', r7(abs(DS)), false, '0.8'],
      ['R7 DS relative + EISDIR brands', r7(DS), true, '0.8'],
      ['R7 DS absolue + EISDIR brands', r7(abs(DS)), true, '0.8'],
    ] as [string, Result, boolean, string][])(
      '%s : les 36 URL exactes, DS une seule fois',
      async (_label, r7Source, brandsWriteFails, dsPriority) => {
        // Ancien sitemap-vehicules.xml public : les 35 marques de la vue.
        await seedOldVehicules(view.map((v) => v.url));
        if (brandsWriteFails) {
          await fs.mkdir(path.join(outDir, 'sitemap-brands.xml'));
        }
        const { orchestrator } = buildOrchestrator(marques, {
          count: view.length,
          rows: view,
          r7: r7Source,
        });
        const result = await orchestrator.generateAll();
        const idx = await readIndex(result.indexPath as string);
        // Toute <loc> de constructeur des fichiers indexés, sans autre filtre.
        const constructeurs = Object.values(idx)
          .flat()
          .filter((u) => u.includes('/constructeurs'));
        expect([...constructeurs].sort()).toEqual(INVENTORY.map(abs).sort());

        const owner = brandsWriteFails
          ? 'sitemap-vehicules.xml'
          : 'sitemap-brands.xml';
        // Desserte : seul le fichier propriétaire (indexé) sert des marques ;
        // l'ancien sitemap-vehicules.xml n'est plus servable s'il est vide.
        expect(await servedConstructeurFiles()).toEqual([owner]);
        expect(result.success).toBe(!brandsWriteFails);
        expect(Object.keys(idx).includes('sitemap-brands.xml')).toBe(
          !brandsWriteFails,
        );
        const xml = await fs.readFile(path.join(outDir, owner), 'utf8');
        const dsBlocks = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)]
          .map((m) => m[0])
          .filter((b) => b.includes(`<loc>${abs(DS)}</loc>`));
        expect(dsBlocks).toHaveLength(1);
        expect(dsBlocks[0]).toContain(`<priority>${dsPriority}</priority>`);
      },
    );
  });
});
