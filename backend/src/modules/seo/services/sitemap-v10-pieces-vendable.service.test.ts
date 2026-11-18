/**
 * Sitemap gamme × véhicule, source « vendable » (mandat CT §6.4 et §6.5).
 *
 * Le service réel tourne sur un dossier jetable, avec une base factice qui
 * pagine comme PostgREST (1 000 lignes par page) et une fonction SQL factice
 * rendant, par gamme, les types de la fenêtre demandée. Ce qui est vérifié :
 * ordre et tranches, tables lues, garde-fou des URL cliquées, arrêt sans
 * publication, bascule par SITEMAP_R2_SOURCE dans l'orchestrateur.
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  DOSSIER_ATTENTE_PIECES,
  SEUIL_RETRAIT_URL_CLIQUEES,
  SitemapR2NonPublieError,
  SitemapV10PiecesVendableService,
  cheminR2,
  evaluerRetraitUrlCliquees,
  fenetres,
} from './sitemap-v10-pieces-vendable.service';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import { SitemapV10Service } from './sitemap-v10.service';
import { MAX_URLS_PER_FILE } from './sitemap-v10.types';

type Ligne = Record<string, unknown>;
type Tables = Record<string, Ligne[] | Error>;

const ORIGINE = 'https://example.test';

/** Base factice : filtres, tri et pagination, comme une lecture PostgREST. */
function fauxSupabase(tables: Tables, lues: string[]) {
  return {
    from(table: string) {
      lues.push(table);
      const source = tables[table];
      const filtres: Array<(l: Ligne) => boolean> = [];
      const tri: Array<{ colonne: string; ascending: boolean }> = [];
      let debut = 0;
      let fin = Number.POSITIVE_INFINITY;
      const compare = (a: unknown, b: unknown) =>
        a === b ? 0 : (a as number | string) < (b as number | string) ? -1 : 1;
      const executer = () => {
        if (source instanceof Error) {
          return { data: null, error: { message: source.message } };
        }
        if (!source) {
          return { data: null, error: { message: `table ${table} inconnue` } };
        }
        const lignes = source
          .filter((l) => filtres.every((f) => f(l)))
          .sort((a, b) => {
            for (const { colonne, ascending } of tri) {
              const c = compare(a[colonne], b[colonne]);
              if (c !== 0) return ascending ? c : -c;
            }
            return 0;
          });
        return { data: lignes.slice(debut, fin + 1), error: null };
      };
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => {
          filtres.push((l) => l[c] === v);
          return q;
        },
        in: (c: string, vs: unknown[]) => {
          filtres.push((l) => vs.includes(l[c]));
          return q;
        },
        gte: (c: string, v: string | number) => {
          filtres.push((l) => (l[c] as string | number) >= v);
          return q;
        },
        lte: (c: string, v: string | number) => {
          filtres.push((l) => (l[c] as string | number) <= v);
          return q;
        },
        gt: (c: string, v: string | number) => {
          filtres.push((l) => (l[c] as string | number) > v);
          return q;
        },
        like: (c: string, motif: string) => {
          const coeur = motif.replace(/%/g, '');
          filtres.push((l) => String(l[c]).includes(coeur));
          return q;
        },
        order: (colonne: string, o: { ascending: boolean }) => {
          tri.push({ colonne, ascending: o.ascending });
          return q;
        },
        range: (a: number, b: number) => {
          debut = a;
          fin = b;
          return q;
        },
        limit: (n: number) => {
          debut = 0;
          fin = n - 1;
          return q;
        },
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(executer()).then(ok, ko),
      };
      return q;
    },
  };
}

/** Véhicules : `n` types affichés, 50 modèles, 5 marques. */
function vehicules(n: number): Tables {
  const types: Ligne[] = [];
  for (let id = 1; id <= n; id++) {
    types.push({
      type_id_i: id,
      type_alias: `moteur-${id}-dci`,
      type_modele_id_i: 1000 + (id % 50),
      type_display: '1',
    });
  }
  const modeles: Ligne[] = [];
  for (let m = 0; m < 50; m++) {
    modeles.push({
      modele_id: 1000 + m,
      modele_alias: `modele-${m}`,
      modele_marque_id: 10 + (m % 5),
    });
  }
  const marques: Ligne[] = [];
  for (let k = 0; k < 5; k++) {
    marques.push({ marque_id: 10 + k, marque_alias: `marque-${k}` });
  }
  return { auto_type: types, auto_modele: modeles, auto_marque: marques };
}

/** URL attendue pour (gamme, type) dans le monde de `vehicules`. */
function url(pgId: number, typeId: number): string {
  const m = typeId % 50;
  return `/pieces/gamme-${pgId}-${pgId}/marque-${m % 5}-${10 + (m % 5)}/modele-${m}-${1000 + m}/moteur-${typeId}-dci-${typeId}.html`;
}

function clic(chemin: string, clicks: number, date = '2026-11-15'): Ligne {
  return { date, page: `https://www.automecanik.com${chemin}`, clicks };
}

function suite(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

interface Monde {
  /** Gammes indexables rendues par la règle actuelle. */
  gammes: number[];
  /** Types vendables par gamme (réponse de la fonction SQL). */
  couples: Map<number, number[]>;
  tables: Tables;
  rpc?: jest.Mock;
}

async function monter(monde: Monde) {
  const dossier = await fs.mkdtemp(path.join(os.tmpdir(), 'sitemap-r2-'));
  const lues: string[] = [];
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const xml = Object.create(
    SitemapV10XmlService.prototype,
  ) as SitemapV10XmlService;
  Object.assign(xml as unknown as Record<string, unknown>, {
    OUTPUT_DIR: dossier,
    BASE_URL: ORIGINE,
    logger,
  });
  const rpc =
    monde.rpc ??
    jest.fn(
      async (
        _nom: string,
        p: { p_pg_id: number; p_type_min: number; p_type_max: number },
      ) => ({
        data: (monde.couples.get(p.p_pg_id) ?? []).filter(
          (t) => t >= p.p_type_min && t <= p.p_type_max,
        ),
        error: null,
      }),
    );
  const svc = Object.create(
    SitemapV10PiecesVendableService.prototype,
  ) as SitemapV10PiecesVendableService;
  Object.assign(svc as unknown as Record<string, unknown>, {
    logger,
    supabase: fauxSupabase(
      {
        pieces_gamme: monde.gammes.map((pg) => ({
          pg_id: pg,
          pg_alias: `gamme-${pg}`,
        })),
        ...monde.tables,
      },
      lues,
    ),
    dataService: {
      getIndexGammeIds: async () => new Set(monde.gammes.map(String)),
    },
    xmlService: xml,
    callRpc: rpc,
  });
  return { svc, xml, dossier, lues, logger, rpc };
}

async function locs(fichier: string): Promise<string[]> {
  const xml = await fs.readFile(fichier, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(ORIGINE, ''),
  );
}

async function fichiersPieces(dossier: string): Promise<string[]> {
  return (await fs.readdir(dossier))
    .filter((f) => f.startsWith('sitemap-pieces'))
    .sort();
}

async function echec(
  svc: SitemapV10PiecesVendableService,
): Promise<SitemapR2NonPublieError> {
  try {
    await svc.generatePiecesSitemapsFromVendable('stable');
  } catch (e) {
    expect(e).toBeInstanceOf(SitemapR2NonPublieError);
    return e as SitemapR2NonPublieError;
  }
  throw new Error('la génération aurait dû s’arrêter sans publier');
}

const dossiers: string[] = [];
async function monde(m: Monde) {
  const monte = await monter(m);
  dossiers.push(monte.dossier);
  return monte;
}
afterAll(async () => {
  for (const d of dossiers) await fs.rm(d, { recursive: true, force: true });
});

describe('cheminR2', () => {
  it('rend le chemin d’une URL complète ou d’un chemin, sans paramètres', () => {
    const chemin = '/pieces/a-1/b-2/c-3/d-4.html';
    expect(cheminR2(`https://www.automecanik.com${chemin}`)).toBe(chemin);
    expect(cheminR2(`${chemin}?utm=x#y`)).toBe(chemin);
  });

  it.each([
    'https://www.automecanik.com/pieces/a-1.html',
    'https://www.automecanik.com/pieces/a-1/b-2/c-3.html',
    'https://www.automecanik.com/pieces/a-1/b-2/c-3/d-4',
    'https://www.automecanik.com/constructeurs/b-2/c-3/d-4.html',
    'http://[',
  ])('écarte %p', (u) => {
    expect(cheminR2(u)).toBeNull();
  });
});

describe('fenetres', () => {
  it('découpe sans perte ni recouvrement, dans l’ordre', () => {
    expect(fenetres([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(fenetres([], 2)).toEqual([]);
  });
});

describe('evaluerRetraitUrlCliquees', () => {
  const fenetre = { du: '2026-10-19', au: '2026-11-15' };
  const avant = new Map(suite(1, 100).map((i) => [`/u${i}`, i]));
  const sauf = (n: number) =>
    new Set([...avant.keys()].filter((_, i) => i >= n));

  it('le seuil du mandat est 5 %', () => {
    expect(SEUIL_RETRAIT_URL_CLIQUEES).toBe(0.05);
  });

  it('5 % retirées : pas d’arrêt (le seuil est « plus de 5 % »)', () => {
    const bilan = evaluerRetraitUrlCliquees(avant, sauf(5), fenetre);
    expect(bilan).toMatchObject({
      sortantes: 5,
      vendablesAvant: 100,
      arret: false,
      clicsRetires: 1 + 2 + 3 + 4 + 5,
      ...fenetre,
    });
    // Des plus cliquées aux moins cliquées.
    expect(bilan.retirees).toEqual(['/u5', '/u4', '/u3', '/u2', '/u1']);
  });

  it('6 % retirées : arrêt', () => {
    expect(evaluerRetraitUrlCliquees(avant, sauf(6), fenetre).arret).toBe(true);
  });

  it('aucune URL cliquée avant : rien à protéger, pas d’arrêt', () => {
    const bilan = evaluerRetraitUrlCliquees(new Map(), new Set(), fenetre);
    expect(bilan).toMatchObject({ sortantes: 0, part: 0, arret: false });
  });
});

describe('SitemapV10PiecesVendableService', () => {
  it('ne produit rien pour hot et cold, sans rien lire', async () => {
    const { svc, lues, rpc } = await monde({
      gammes: [402],
      couples: new Map(),
      tables: {},
    });
    for (const bucket of ['hot', 'cold'] as const) {
      expect(await svc.generatePiecesSitemapsFromVendable(bucket)).toEqual({
        filePaths: [],
        totalCount: 0,
      });
    }
    expect(lues).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('déclare gamme indexable × véhicule affiché × type vendable, gamme puis type croissants', async () => {
    const { svc, dossier, lues, rpc } = await monde({
      // Rendues dans le désordre par la règle des gammes : l'ordre ne doit pas en dépendre.
      gammes: [402, 7],
      couples: new Map([
        [7, [3, 12]],
        [402, [1, 3]],
      ]),
      tables: {
        ...vehicules(20),
        __seo_gsc_daily_page_totals: [clic(url(7, 3), 2)],
      },
    });

    const { filePaths, totalCount } =
      await svc.generatePiecesSitemapsFromVendable('stable');

    expect(totalCount).toBe(4);
    expect(filePaths).toEqual([path.join(dossier, 'sitemap-pieces.xml')]);
    expect(await locs(filePaths[0])).toEqual([
      url(7, 3),
      url(7, 12),
      url(402, 1),
      url(402, 3),
    ]);
    expect(url(402, 3)).toBe(
      '/pieces/gamme-402-402/marque-3-13/modele-3-1003/moteur-3-dci-3.html',
    );
    // Ni la table figée ni le seuil map_has_item ne sont lus.
    expect([...new Set(lues)].sort()).toEqual([
      '__seo_gsc_daily_page_totals',
      'auto_marque',
      'auto_modele',
      'auto_type',
      'pieces_gamme',
    ]);
    expect(rpc.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [
        'get_sitemap_r2_types_vendables',
        { p_pg_id: 7, p_type_min: 1, p_type_max: 20 },
      ],
      [
        'get_sitemap_r2_types_vendables',
        { p_pg_id: 402, p_type_min: 1, p_type_max: 20 },
      ],
    ]);
    expect(rpc.mock.calls[0][2]).toEqual({
      source: 'cron',
      role: 'service_role',
    });
    // Dossier d'attente retiré après publication.
    expect(await fs.readdir(dossier)).toEqual(['sitemap-pieces.xml']);
  });

  it('découpe en tranches de 50 000, sans doublon, identiques d’une génération à l’autre', async () => {
    const types = suite(1, 20000);
    const m: Monde = {
      gammes: [402, 7, 82],
      couples: new Map([
        [7, types],
        [82, types],
        [402, types],
      ]),
      tables: {
        ...vehicules(20000),
        __seo_gsc_daily_page_totals: [clic(url(7, 1), 1)],
      },
    };
    const a = await monde(m);
    const ra = await a.svc.generatePiecesSitemapsFromVendable('stable');

    expect(ra.totalCount).toBe(60000);
    expect(ra.filePaths.map((f) => path.basename(f))).toEqual([
      'sitemap-pieces-1.xml',
      'sitemap-pieces-2.xml',
    ]);
    const t1 = await locs(ra.filePaths[0]);
    const t2 = await locs(ra.filePaths[1]);
    expect(t1).toHaveLength(MAX_URLS_PER_FILE);
    expect(t2).toHaveLength(10000);
    expect(new Set([...t1, ...t2]).size).toBe(60000);
    expect(t1[0]).toBe(url(7, 1));
    expect(t1[20000]).toBe(url(82, 1));
    expect(t2[0]).toBe(url(402, 10001));
    expect(t2[9999]).toBe(url(402, 20000));
    // 20 000 types = 4 fenêtres de 5 000 par gamme.
    expect(a.rpc).toHaveBeenCalledTimes(12);

    const b = await monde(m);
    const rb = await b.svc.generatePiecesSitemapsFromVendable('stable');
    expect(await locs(rb.filePaths[0])).toEqual(t1);
    expect(await locs(rb.filePaths[1])).toEqual(t2);
  }, 60000);

  it('une tranche exactement pleine porte un numéro, comme la source figée', async () => {
    const { svc } = await monde({
      gammes: [7],
      couples: new Map([[7, suite(1, MAX_URLS_PER_FILE)]]),
      tables: {
        ...vehicules(MAX_URLS_PER_FILE),
        __seo_gsc_daily_page_totals: [clic(url(7, 1), 1)],
      },
    });
    const r = await svc.generatePiecesSitemapsFromVendable('stable');
    expect(r.totalCount).toBe(MAX_URLS_PER_FILE);
    expect(r.filePaths.map((f) => path.basename(f))).toEqual([
      'sitemap-pieces-1.xml',
    ]);
  }, 60000);

  it('écarte et compte un type hors relevé et une URL mal formée', async () => {
    const tables = vehicules(10);
    (tables.auto_type as Ligne[])[4].type_alias = ''; // type 5 : alias vide
    (tables.auto_type as Ligne[])[5].type_modele_id_i = 9999; // type 6 : modèle inconnu
    const { svc, logger } = await monde({
      gammes: [7],
      couples: new Map([[7, [4, 5, 6, 7]]]),
      tables: { ...tables, __seo_gsc_daily_page_totals: [clic(url(7, 4), 1)] },
    });
    const r = await svc.generatePiecesSitemapsFromVendable('stable');
    expect(await locs(r.filePaths[0])).toEqual([url(7, 4), url(7, 7)]);
    const avertissements = logger.warn.mock.calls.map((c) => String(c[0]));
    expect(
      avertissements.some((a) => a.includes('1 couple(s) écarté(s)')),
    ).toBe(true);
    expect(
      avertissements.some((a) => a.includes('1 URL mal formée(s) écartée(s)')),
    ).toBe(true);
  });

  describe('garde-fou des URL cliquées', () => {
    // Sitemap précédent : gamme 7, types 1 à 200, en trois fichiers comme en PROD.
    // Search Console : un clic ou plus sur les types 1 à 100, dans la fenêtre.
    async function avecPrecedent(retires: number, extra: Ligne[] = []) {
      const m = await monde({
        gammes: [7],
        couples: new Map([[7, suite(retires + 1, 200)]]),
        tables: {
          ...vehicules(200),
          __seo_gsc_daily_page_totals: [
            ...suite(1, 100).map((t) => clic(url(7, t), 2)),
            // Second jour de clics sur le type 1 : les clics s'additionnent.
            clic(url(7, 1), 5, '2026-11-01'),
            ...extra,
          ],
        },
      });
      const lot = (a: number, b: number) =>
        suite(a, b).map((t) => ({
          url: url(7, t),
          page_type: 'piece',
          changefreq: 'weekly',
          priority: '0.6',
          last_modified_at: null,
        }));
      const avant: Record<string, [number, number]> = {
        'sitemap-pieces-1.xml': [1, 80],
        'sitemap-pieces-2.xml': [81, 160],
        'sitemap-pieces-3.xml': [161, 200],
      };
      for (const [nom, [a, b]] of Object.entries(avant)) {
        await m.xml.writeStaticSitemapFile(
          path.join(m.dossier, nom),
          lot(a, b) as never,
        );
      }
      const octets = async () =>
        Promise.all(
          Object.keys(avant).map((nom) =>
            fs.readFile(path.join(m.dossier, nom), 'utf8'),
          ),
        );
      return { ...m, octets, avant: Object.keys(avant) };
    }

    it('5 URL cliquées sur 100 retirées : publie et remplace les fichiers précédents', async () => {
      const m = await avecPrecedent(5);
      const r = await m.svc.generatePiecesSitemapsFromVendable('stable');
      expect(r.totalCount).toBe(195);
      // Les trois fichiers précédents laissent place au seul fichier du lot.
      expect(await fs.readdir(m.dossier)).toEqual(['sitemap-pieces.xml']);
      expect(await locs(r.filePaths[0])).toEqual(
        suite(6, 200).map((t) => url(7, t)),
      );
      const sorties = m.logger.warn.mock.calls
        .map((c) => String(c[0]))
        .filter((a) => a.includes('URL cliquée sortie du sitemap'));
      expect(sorties).toHaveLength(5);
      // La plus cliquée d'abord : le type 1, 2 + 5 clics.
      expect(sorties[0]).toContain(url(7, 1));
    });

    it('6 URL cliquées sur 100 retirées : ne publie rien, garde les fichiers précédents, le signale', async () => {
      const m = await avecPrecedent(6);
      const avant = await m.octets();
      const e = await echec(m.svc);

      expect(e.message).toContain(
        'garde-fou : 6 URL cliquées sur 100 (6.00 %) sortiraient du sitemap, seuil 5 %',
      );
      // 6 URL × 2 clics + 5 clics du second jour du type 1.
      expect(e.message).toContain('17 clics du 2026-10-19 au 2026-11-15');
      expect(e.message).toContain(url(7, 1));
      expect(e.keptFilePaths).toEqual(
        m.avant.map((nom) => path.join(m.dossier, nom)),
      );
      expect(await m.octets()).toEqual(avant);
      // Ni fichier nouveau, ni dossier d'attente laissé derrière.
      expect((await fs.readdir(m.dossier)).sort()).toEqual(m.avant);
      expect(String(m.logger.error.mock.calls[0][0])).toContain('NON publié');
    });

    it('ne compte que les 28 jours finissant au dernier jour connu de la base', async () => {
      // Les types 101 à 110 ont été cliqués, mais la veille de la fenêtre.
      const m = await avecPrecedent(0, [
        ...suite(101, 110).map((t) => clic(url(7, t), 9, '2026-10-18')),
      ]);
      await m.svc.generatePiecesSitemapsFromVendable('stable');
      const lignes = m.logger.log.mock.calls.map((c) => String(c[0]));
      expect(
        lignes.some((l) =>
          l.includes('dont 100 cliquées du 2026-10-19 au 2026-11-15'),
        ),
      ).toBe(true);
    });

    it('Search Console vide : arrêt sans publication', async () => {
      const m = await avecPrecedent(0);
      const vide = await monde({
        gammes: [7],
        couples: new Map([[7, suite(1, 200)]]),
        tables: { ...vehicules(200), __seo_gsc_daily_page_totals: [] },
      });
      expect((await echec(vide.svc)).message).toContain(
        'Search Console vide en base',
      );
      expect(await fichiersPieces(vide.dossier)).toEqual([]);
      expect(vide.rpc).not.toHaveBeenCalled();
      // Le monde témoin, lui, publie.
      expect(
        (await m.svc.generatePiecesSitemapsFromVendable('stable')).totalCount,
      ).toBe(200);
    });

    it('Search Console illisible : arrêt sans publication', async () => {
      const m = await monde({
        gammes: [7],
        couples: new Map([[7, [1]]]),
        tables: {
          ...vehicules(5),
          __seo_gsc_daily_page_totals: new Error('délai dépassé'),
        },
      });
      expect((await echec(m.svc)).message).toContain(
        'lecture Search Console : délai dépassé',
      );
      expect(await fichiersPieces(m.dossier)).toEqual([]);
    });

    it('aucun sitemap précédent : publie, et dit que le garde-fou est sans objet', async () => {
      const m = await monde({
        gammes: [7],
        couples: new Map([[7, [1, 2]]]),
        tables: {
          ...vehicules(5),
          __seo_gsc_daily_page_totals: [clic(url(7, 5), 3)],
        },
      });
      const r = await m.svc.generatePiecesSitemapsFromVendable('stable');
      expect(r.totalCount).toBe(2);
      expect(
        m.logger.warn.mock.calls.some((c) =>
          String(c[0]).includes('le garde-fou est sans objet'),
        ),
      ).toBe(true);
    });
  });

  describe('arrêts sans publication', () => {
    const base = (): Monde => ({
      gammes: [7],
      couples: new Map([[7, suite(1, 600)]]),
      tables: {
        ...vehicules(600),
        __seo_gsc_daily_page_totals: [clic(url(7, 1), 1)],
      },
    });
    const delai = {
      data: null,
      error: {
        code: '57014',
        message: 'canceling statement due to statement timeout',
      },
    };
    const reponse = (
      couples: Map<number, number[]>,
      p: { p_pg_id: number; p_type_min: number; p_type_max: number },
    ) => ({
      data: (couples.get(p.p_pg_id) ?? []).filter(
        (t) => t >= p.p_type_min && t <= p.p_type_max,
      ),
      error: null,
    });

    it('délai dépassé : la fenêtre est rejouée en deux moitiés, le lot est complet', async () => {
      const m = base();
      const rpc = jest.fn(
        async (
          _n: string,
          p: { p_pg_id: number; p_type_min: number; p_type_max: number },
        ) =>
          p.p_type_max - p.p_type_min + 1 > 300 ? delai : reponse(m.couples, p),
      );
      const { svc } = await monde({ ...m, rpc });
      const r = await svc.generatePiecesSitemapsFromVendable('stable');
      expect(r.totalCount).toBe(600);
      expect(await locs(r.filePaths[0])).toEqual(
        suite(1, 600).map((t) => url(7, t)),
      );
      expect(
        rpc.mock.calls.map((c) => [c[1].p_type_min, c[1].p_type_max]),
      ).toEqual([
        [1, 600],
        [1, 300],
        [301, 600],
      ]);
    });

    it('délai dépassé jusqu’au plancher : arrêt', async () => {
      const rpc = jest.fn(async () => delai);
      const { svc, dossier } = await monde({ ...base(), rpc });
      const e = await echec(svc);
      expect(e.message).toContain(
        'get_sitemap_r2_types_vendables(gamme 7, types 1–150)',
      );
      expect(e.message).toContain('statement timeout');
      // 600 → 300 → 150 : sous le plancher de 250, plus de découpe.
      expect(rpc).toHaveBeenCalledTimes(3);
      expect(await fichiersPieces(dossier)).toEqual([]);
    });

    it('fonction absente (migration non appliquée) : arrêt, fichiers précédents gardés', async () => {
      const rpc = jest.fn(async () => ({
        data: null,
        error: {
          code: 'PGRST202',
          message:
            'Could not find the function public.get_sitemap_r2_types_vendables',
        },
      }));
      const m = await monde({ ...base(), rpc });
      const precedent = path.join(m.dossier, 'sitemap-pieces-1.xml');
      await m.xml.writeStaticSitemapFile(precedent, [
        {
          url: url(7, 1),
          page_type: 'piece',
          changefreq: 'weekly',
          priority: '0.6',
          last_modified_at: null,
        },
      ] as never);
      const e = await echec(m.svc);
      expect(e.message).toContain('Could not find the function');
      expect(e.keptFilePaths).toEqual([precedent]);
      expect(await fs.readdir(m.dossier)).toEqual(['sitemap-pieces-1.xml']);
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['pas un tableau', { nope: true }, "réponse qui n'est pas un tableau"],
      ['hors fenêtre', [1, 601], 'type 601 hors fenêtre ou hors ordre'],
      ['hors ordre', [2, 1], 'type 1 hors fenêtre ou hors ordre'],
      ['en double', [2, 2], 'type 2 hors fenêtre ou hors ordre'],
      ['non entier', [1, '2'], 'type 2 hors fenêtre ou hors ordre'],
    ])('réponse inattendue (%s) : arrêt', async (_cas, data, message) => {
      const rpc = jest.fn(async () => ({ data, error: null }));
      const { svc, dossier } = await monde({ ...base(), rpc });
      expect((await echec(svc)).message).toContain(message);
      expect(await fichiersPieces(dossier)).toEqual([]);
    });

    it('aucune gamme indexable lue : arrêt', async () => {
      const { svc, rpc } = await monde({ ...base(), gammes: [] });
      expect((await echec(svc)).message).toContain(
        'aucune gamme indexable lue',
      );
      expect(rpc).not.toHaveBeenCalled();
    });

    it('gamme indexable absente de pieces_gamme : arrêt', async () => {
      const m = base();
      const { svc } = await monde({
        ...m,
        tables: { ...m.tables, pieces_gamme: [] },
      });
      expect((await echec(svc)).message).toContain(
        'gamme indexable 7 absente de pieces_gamme',
      );
    });

    it.each(['auto_type', 'auto_modele', 'auto_marque'])(
      'lecture de %s en erreur : arrêt',
      async (table) => {
        const m = base();
        const { svc, rpc } = await monde({
          ...m,
          tables: { ...m.tables, [table]: new Error('connexion perdue') },
        });
        expect((await echec(svc)).message).toContain(
          `lecture ${table} (ligne 0) : connexion perdue`,
        );
        expect(rpc).not.toHaveBeenCalled();
      },
    );

    it('aucune URL produite : un sitemap vide ne remplace pas le précédent', async () => {
      const m = await monde({ ...base(), couples: new Map() });
      const precedent = path.join(m.dossier, 'sitemap-pieces-1.xml');
      await fs.writeFile(precedent, '<urlset></urlset>', 'utf8');
      const e = await echec(m.svc);
      expect(e.message).toContain('aucune URL produite');
      expect(e.keptFilePaths).toEqual([precedent]);
      expect(await fs.readFile(precedent, 'utf8')).toBe('<urlset></urlset>');
    });

    it('un dossier d’attente laissé par une génération interrompue est purgé', async () => {
      const m = await monde({ ...base(), couples: new Map([[7, [1]]]) });
      const attente = path.join(m.dossier, DOSSIER_ATTENTE_PIECES);
      await fs.mkdir(attente);
      await fs.writeFile(path.join(attente, 'sitemap-pieces-9.xml'), 'reste');
      const r = await m.svc.generatePiecesSitemapsFromVendable('stable');
      expect(r.totalCount).toBe(1);
      expect(await fs.readdir(m.dossier)).toEqual(['sitemap-pieces.xml']);
    });
  });
});

describe('SitemapV10Service — bascule SITEMAP_R2_SOURCE', () => {
  function orchestrateur(source: 'legacy' | 'vendable', vendable: jest.Mock) {
    const index = jest.fn(async (_chemins: string[]) => '/x/sitemap.xml');
    const legacy = jest.fn(async (bucket: string) =>
      bucket === 'stable'
        ? { filePaths: ['/x/sitemap-pieces-1.xml'], totalCount: 3 }
        : { filePaths: [], totalCount: 0 },
    );
    const logGeneration = jest.fn();
    const svc = Object.create(SitemapV10Service.prototype) as SitemapV10Service;
    Object.assign(svc as unknown as Record<string, unknown>, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      xmlService: {
        cleanupObsoleteFiles: jest.fn(),
        generateSitemapIndexFromPaths: index,
      },
      dataService: {
        resetCaches: jest.fn(),
        clearCaches: jest.fn(),
        logGeneration,
      },
      staticService: {
        generateRacineSitemap: async () => '/x/sitemap-racine.xml',
        generateCategoriesSitemap: async () => null,
        collectBrandUrls: async () => [],
        generateBrandsSitemap: async () => null,
        generateVehiculesSitemap: async () => null,
        generateBlogSitemap: async () => null,
        generatePagesSitemap: async () => null,
        generateDiagnosticSitemap: async () => null,
        generateReferenceSitemap: async () => null,
      },
      piecesService: { generatePiecesSitemapsFromV9Source: legacy },
      piecesVendableService: { generatePiecesSitemapsFromVendable: vendable },
      hubsService: {
        generateAllHubsRobust: async () => ({
          summary: { totalUrls: 0, totalFiles: 0 },
        }),
      },
      featureFlags: { sitemapR2Source: source },
    });
    return { svc, index, legacy, logGeneration };
  }

  it('legacy (défaut) : seule la source figée est appelée', async () => {
    const vendable = jest.fn();
    const { svc, index, legacy } = orchestrateur('legacy', vendable);
    const r = await svc.generateAll();
    expect(r.success).toBe(true);
    expect(legacy.mock.calls.map((c) => c[0])).toEqual([
      'hot',
      'stable',
      'cold',
    ]);
    expect(vendable).not.toHaveBeenCalled();
    expect(index).toHaveBeenCalledWith([
      '/x/sitemap-racine.xml',
      '/x/sitemap-pieces-1.xml',
    ]);
  });

  it('vendable : seule la source vendable est appelée', async () => {
    const vendable = jest.fn(async (bucket: string) =>
      bucket === 'stable'
        ? {
            filePaths: ['/x/sitemap-pieces-1.xml', '/x/sitemap-pieces-2.xml'],
            totalCount: 60000,
          }
        : { filePaths: [], totalCount: 0 },
    );
    const { svc, index, legacy } = orchestrateur('vendable', vendable);
    const r = await svc.generateAll();
    expect(r.success).toBe(true);
    expect(r.totalUrls).toBe(60000);
    expect(legacy).not.toHaveBeenCalled();
    expect(vendable.mock.calls.map((c) => c[0])).toEqual([
      'hot',
      'stable',
      'cold',
    ]);
    expect(index).toHaveBeenCalledWith([
      '/x/sitemap-racine.xml',
      '/x/sitemap-pieces-1.xml',
      '/x/sitemap-pieces-2.xml',
    ]);
  });

  it('vendable arrêté sans publier : fichiers précédents gardés dans l’index, génération en échec', async () => {
    const vendable = jest.fn(async (bucket: string) => {
      if (bucket !== 'stable') return { filePaths: [], totalCount: 0 };
      throw new SitemapR2NonPublieError('garde-fou : 6 URL cliquées sur 100', [
        '/x/sitemap-pieces-1.xml',
        '/x/sitemap-pieces-2.xml',
        '/x/sitemap-pieces-3.xml',
      ]);
    });
    const { svc, index, legacy, logGeneration } = orchestrateur(
      'vendable',
      vendable,
    );
    const r = await svc.generateAll();
    expect(r.success).toBe(false);
    expect(legacy).not.toHaveBeenCalled();
    expect(index).toHaveBeenCalledWith([
      '/x/sitemap-racine.xml',
      '/x/sitemap-pieces-1.xml',
      '/x/sitemap-pieces-2.xml',
      '/x/sitemap-pieces-3.xml',
    ]);
    const stable = r.results.find((x) => x.bucket === 'stable');
    expect(stable).toMatchObject({
      success: false,
      error: 'garde-fou : 6 URL cliquées sur 100',
    });
    expect(logGeneration).toHaveBeenCalledWith(
      expect.any(String),
      'stable',
      'failed',
      0,
      0,
      expect.any(Number),
      'garde-fou : 6 URL cliquées sur 100',
    );
  });
});
