/**
 * Liens de sitemap dont le modèle n'est plus celui du type.
 *
 * __sitemap_p_link garde le modèle que le type avait à sa génération. Quand le
 * type a été rattaché à un autre modèle dans auto_type, l'URL construite
 * depuis la ligne répond 301. Invariants couverts :
 *   - getTypeModelIndex : pagination, cache, déduplication, erreur levée ;
 *   - sitemapLinkState : live / orphan_type / stale_model ;
 *   - SitemapV10PiecesService : le sitemap des pièces n'émet plus ces URL ;
 *   - HubsClusterService, HubsPriorityService : les hubs non plus.
 *
 * Pas d'I/O réseau : client Supabase factice. Le hub « money » écrit dans un
 * répertoire temporaire.
 */

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HubsClusterService } from '../services/sitemap-v10-hubs-cluster.service';
import { HubsPriorityService } from '../services/sitemap-v10-hubs-priority.service';
import { SitemapV10PiecesService } from '../services/sitemap-v10-pieces.service';
import {
  getTypeModelIndex,
  invalidateValidTypeIdsCache,
  sitemapLinkState,
  type TypeModelIndex,
} from './auto-type-valid-ids.helper';

type Row = Record<string, unknown>;

interface FakeOptions {
  autoType?: Row[];
  links?: Row[];
  gammes?: Row[];
  autoTypeError?: string;
  linksError?: string;
}

function fakeSupabase(options: FakeOptions) {
  const calls: Record<string, number> = {};
  const client = {
    calls,
    from(table: string) {
      calls[table] = (calls[table] ?? 0) + 1;
      const rows =
        table === 'auto_type'
          ? (options.autoType ?? [])
          : table === '__sitemap_p_link'
            ? (options.links ?? [])
            : table === 'pieces_gamme'
              ? (options.gammes ?? [])
              : [];
      const error =
        table === 'auto_type'
          ? options.autoTypeError
          : table === '__sitemap_p_link'
            ? options.linksError
            : undefined;
      const all = () =>
        error
          ? { data: null, error: { message: error } }
          : { data: rows, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        gt: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
        range: async (from: number, to: number) =>
          error
            ? { data: null, error: { message: error } }
            : { data: rows.slice(from, to + 1), error: null },
        // Requête attendue sans .range() : toutes les lignes de la table.
        then: (resolve: (value: ReturnType<typeof all>) => unknown) =>
          resolve(all()),
      };
      return builder;
    },
  };
  return client;
}

const asClient = (fake: ReturnType<typeof fakeSupabase>) => fake as never;

beforeEach(() => {
  invalidateValidTypeIdsCache();
});

describe('getTypeModelIndex', () => {
  it('associe chaque type affiché à son modèle actuel', async () => {
    const fake = fakeSupabase({
      autoType: [
        { type_id_i: 7961, type_modele_id: '128138' },
        { type_id_i: 100, type_modele_id: '50' },
      ],
    });
    const index = await getTypeModelIndex(asClient(fake));
    expect(index.get(7961)).toBe(128138);
    expect(index.get(100)).toBe(50);
    expect(index.size).toBe(2);
  });

  it('lit toutes les pages au-delà de 1 000 lignes', async () => {
    const autoType = Array.from({ length: 2300 }, (_, i) => ({
      type_id_i: i + 1,
      type_modele_id: String(1000 + i),
    }));
    const fake = fakeSupabase({ autoType });
    const index = await getTypeModelIndex(asClient(fake));
    expect(index.size).toBe(2300);
    expect(index.get(2300)).toBe(3299);
    expect(fake.calls.auto_type).toBe(3);
  });

  it('table vide → index vide, sans erreur', async () => {
    const index = await getTypeModelIndex(asClient(fakeSupabase({})));
    expect(index.size).toBe(0);
  });

  it('modèle de rattachement illisible → null, le type reste connu', async () => {
    const fake = fakeSupabase({
      autoType: [
        { type_id_i: 1, type_modele_id: null },
        { type_id_i: 2, type_modele_id: 'abc' },
        { type_id_i: 3, type_modele_id: '' },
      ],
    });
    const index = await getTypeModelIndex(asClient(fake));
    expect([index.get(1), index.get(2), index.get(3)]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('ignore une ligne sans identifiant numérique', async () => {
    const fake = fakeSupabase({
      autoType: [
        { type_id_i: null, type_modele_id: '5' },
        { type_id_i: 9, type_modele_id: '5' },
      ],
    });
    const index = await getTypeModelIndex(asClient(fake));
    expect([...index.keys()]).toEqual([9]);
  });

  it('erreur de lecture → exception, jamais un index vide', async () => {
    const fake = fakeSupabase({ autoTypeError: 'permission denied' });
    await expect(getTypeModelIndex(asClient(fake))).rejects.toThrow(
      'permission denied',
    );
  });

  it('une erreur ne reste pas en cache : la lecture suivante repart', async () => {
    await expect(
      getTypeModelIndex(
        asClient(fakeSupabase({ autoTypeError: 'fetch failed' })),
      ),
    ).rejects.toThrow('fetch failed');
    const index = await getTypeModelIndex(
      asClient(
        fakeSupabase({ autoType: [{ type_id_i: 1, type_modele_id: '2' }] }),
      ),
    );
    expect(index.get(1)).toBe(2);
  });

  it('met en cache : une seule lecture pour deux appels', async () => {
    const fake = fakeSupabase({
      autoType: [{ type_id_i: 1, type_modele_id: '2' }],
    });
    await getTypeModelIndex(asClient(fake));
    await getTypeModelIndex(asClient(fake));
    expect(fake.calls.auto_type).toBe(1);
  });

  it('déduplique deux appels concurrents', async () => {
    const fake = fakeSupabase({
      autoType: [{ type_id_i: 1, type_modele_id: '2' }],
    });
    const [a, b] = await Promise.all([
      getTypeModelIndex(asClient(fake)),
      getTypeModelIndex(asClient(fake)),
    ]);
    expect(a).toBe(b);
    expect(fake.calls.auto_type).toBe(1);
  });

  it('relit après invalidation du cache', async () => {
    const fake = fakeSupabase({
      autoType: [{ type_id_i: 1, type_modele_id: '2' }],
    });
    await getTypeModelIndex(asClient(fake));
    invalidateValidTypeIdsCache();
    await getTypeModelIndex(asClient(fake));
    expect(fake.calls.auto_type).toBe(2);
  });
});

describe('sitemapLinkState', () => {
  const index: TypeModelIndex = new Map([
    [7961, 128138],
    [100, 50],
    [200, null],
  ]);

  it('modèle de la ligne = modèle du type → live', () => {
    expect(
      sitemapLinkState({ map_type_id: 100, map_modele_id: 50 }, index),
    ).toBe('live');
  });

  it('accepte les identifiants en chaîne', () => {
    expect(
      sitemapLinkState({ map_type_id: '100', map_modele_id: '50' }, index),
    ).toBe('live');
  });

  it('type rattaché à un autre modèle → stale_model', () => {
    expect(
      sitemapLinkState({ map_type_id: 7961, map_modele_id: 128081 }, index),
    ).toBe('stale_model');
  });

  it('type absent de auto_type → orphan_type', () => {
    expect(
      sitemapLinkState({ map_type_id: 120000, map_modele_id: 50 }, index),
    ).toBe('orphan_type');
  });

  it('identifiant de type illisible → orphan_type', () => {
    expect(
      sitemapLinkState({ map_type_id: 'abc', map_modele_id: 50 }, index),
    ).toBe('orphan_type');
    expect(
      sitemapLinkState({ map_type_id: null, map_modele_id: 50 }, index),
    ).toBe('orphan_type');
  });

  it('modèle du type inconnu → live : pas de quoi écarter la ligne', () => {
    expect(
      sitemapLinkState({ map_type_id: 200, map_modele_id: 999 }, index),
    ).toBe('live');
  });

  it('ligne sans modèle alors que le type en a un → stale_model', () => {
    expect(sitemapLinkState({ map_type_id: 100 }, index)).toBe('stale_model');
    expect(
      sitemapLinkState({ map_type_id: 100, map_modele_id: null }, index),
    ).toBe('stale_model');
  });

  it('index vide → toute ligne est orphan_type', () => {
    expect(
      sitemapLinkState({ map_type_id: 100, map_modele_id: 50 }, new Map()),
    ).toBe('orphan_type');
  });
});

const link = (modeleAlias: string, modeleId: number, typeId: number) => ({
  map_pg_alias: 'alternateur',
  map_pg_id: 4,
  map_marque_alias: 'peugeot',
  map_marque_id: 128,
  map_modele_alias: modeleAlias,
  map_modele_id: modeleId,
  map_type_alias: '1-9-d',
  map_type_id: typeId,
  map_has_item: 30,
});

// Le type 7961 a quitté le modèle 128081 ; le type 500 y est toujours.
const AUTO_TYPE = [
  { type_id_i: 7961, type_modele_id: '128138' },
  { type_id_i: 500, type_modele_id: '128081' },
];

// Une ligne à jour, une au modèle périmé, une au type disparu.
const THREE_LINKS = [
  link('boxer-i', 128081, 500),
  link('boxer-i', 128081, 7961),
  link('boxer-i', 128081, 120000),
];

const LIVE_URL =
  '/pieces/alternateur-4/peugeot-128/boxer-i-128081/1-9-d-500.html';

describe('SitemapV10PiecesService — sitemap des pièces', () => {
  async function generate(options: FakeOptions) {
    const fake = fakeSupabase(options);
    const written: string[] = [];
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = Object.create(
      SitemapV10PiecesService.prototype,
    ) as SitemapV10PiecesService;
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: fake,
      logger,
      minItemsThreshold: null,
      dataService: { getIndexGammeIds: async () => new Set([4]) },
      xmlService: {
        writeSitemapFile: async (
          _bucket: string,
          fileName: string,
          urls: Array<{ url: string }>,
        ) => {
          written.push(...urls.map((u) => u.url));
          return `/tmp/${fileName}`;
        },
      },
    });
    const result = await svc.generatePiecesSitemapsFromV9Source('stable');
    return { result, written, logger };
  }

  it('émet la ligne à jour, écarte le modèle périmé et le type orphelin', async () => {
    const { result, written, logger } = await generate({
      autoType: AUTO_TYPE,
      links: THREE_LINKS,
    });
    expect(written).toEqual([LIVE_URL]);
    expect(result.totalCount).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Filtered out 2 URLs'),
    );
  });

  it('aucune ligne périmée → rien d’écarté, aucun avertissement', async () => {
    const { result, written, logger } = await generate({
      autoType: AUTO_TYPE,
      links: [link('boxer-i', 128081, 500)],
    });
    expect(written).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('lecture de auto_type en erreur → la génération échoue', async () => {
    await expect(
      generate({
        autoTypeError: 'connection refused',
        links: [link('boxer-i', 128081, 500)],
      }),
    ).rejects.toThrow('connection refused');
  });

  it('bucket autre que stable → aucune lecture, aucune URL', async () => {
    const fake = fakeSupabase({ autoType: AUTO_TYPE });
    const svc = Object.create(
      SitemapV10PiecesService.prototype,
    ) as SitemapV10PiecesService;
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: fake,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
    const result = await svc.generatePiecesSitemapsFromV9Source('hot');
    expect(result).toEqual({ filePaths: [], totalCount: 0 });
    expect(fake.calls.auto_type).toBeUndefined();
  });
});

describe('HubsClusterService — hubs de cluster', () => {
  type Collected = {
    urls: Array<{ url: string; subcategory: string }>;
    subcategoryStats: Array<{ name: string; count: number }>;
  };

  async function collect(options: FakeOptions): Promise<Collected> {
    const svc = Object.create(
      HubsClusterService.prototype,
    ) as HubsClusterService;
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: fakeSupabase(options),
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      BASE_URL: 'https://example.test',
    });
    return (
      svc as unknown as {
        collectFamilyUrlsWithMetadata(config: unknown): Promise<Collected>;
      }
    ).collectFamilyUrlsWithMetadata({
      title: 'Électricité',
      description: '',
      subcategories: [{ name: 'Alternateur', gamme_names: ['Alternateur'] }],
    });
  }

  it('garde la ligne à jour, écarte le modèle périmé et le type orphelin', async () => {
    const { urls, subcategoryStats } = await collect({
      autoType: AUTO_TYPE,
      gammes: [{ pg_id: 4 }],
      links: THREE_LINKS,
    });
    expect(urls.map((u) => u.url)).toEqual([`https://example.test${LIVE_URL}`]);
    expect(subcategoryStats).toEqual([{ name: 'Alternateur', count: 1 }]);
  });

  it('toutes les lignes périmées → aucune URL, sous-catégorie non comptée', async () => {
    const { urls, subcategoryStats } = await collect({
      autoType: AUTO_TYPE,
      gammes: [{ pg_id: 4 }],
      links: [link('boxer-i', 128081, 7961)],
    });
    expect(urls).toEqual([]);
    expect(subcategoryStats).toEqual([]);
  });

  it('lecture de auto_type en erreur → exception, pas de hub vide', async () => {
    await expect(
      collect({
        autoTypeError: 'permission denied',
        gammes: [{ pg_id: 4 }],
        links: THREE_LINKS,
      }),
    ).rejects.toThrow('permission denied');
  });
});

describe('HubsPriorityService — hub « money »', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-money-'));
  });

  afterEach(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  async function generateMoney(options: FakeOptions) {
    const svc = Object.create(
      HubsPriorityService.prototype,
    ) as HubsPriorityService;
    Object.assign(svc as unknown as Record<string, unknown>, {
      supabase: fakeSupabase(options),
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      callRpc: async () => ({ data: [{ gamme_id: 4 }], error: null }),
      BASE_URL: 'https://example.test',
      OUTPUT_DIR: outDir,
    });
    const result = await svc.generateMoneyHub();
    const file = path.join(outDir, 'hot', 'money.html');
    const html = await fs.readFile(file, 'utf8').catch(() => null);
    return { result, html };
  }

  it('n’écrit que le lien à jour', async () => {
    const { result, html } = await generateMoney({
      autoType: AUTO_TYPE,
      links: THREE_LINKS,
    });
    expect(result.success).toBe(true);
    expect(result.urlCount).toBe(1);
    expect(html).toContain(`https://example.test${LIVE_URL}`);
    expect(html).not.toContain('1-9-d-7961.html');
    expect(html).not.toContain('1-9-d-120000.html');
  });

  it('lecture de auto_type en erreur → échec déclaré, aucun fichier écrit', async () => {
    const { result, html } = await generateMoney({
      autoTypeError: 'connection refused',
      links: THREE_LINKS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('connection refused');
    expect(html).toBeNull();
  });

  it('lecture des liens en erreur → échec déclaré, aucun fichier écrit', async () => {
    const { result, html } = await generateMoney({
      autoType: AUTO_TYPE,
      linksError: 'statement timeout',
    });
    expect(result.success).toBe(false);
    expect(html).toBeNull();
  });
});
