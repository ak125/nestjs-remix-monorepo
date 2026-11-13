/**
 * Lot A V-Level (2026-11-04) — indicateurs globaux lus dans __seo_keywords et
 * pieces_gamme : exhaustivité au-delà d'une page, échec explicite, identité
 * total = classés + sans niveau + inattendus, intersection G1 ∩ V2, tranches
 * de fraîcheur, absence d'écriture et gardes admin conservées.
 */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { OperationFailedException } from '@common/exceptions';
import { AdminGammesSeoVlevelController } from '../controllers/admin-gammes-seo-vlevel.controller';
import {
  GammeSeoBadgesService,
  VLevelStatsReadError,
} from './gamme-seo-badges.service';

type Row = Record<string, unknown>;
interface FakeTable {
  key: string;
  rows: Row[];
  /** Comptage exact renvoyé (défaut : nombre de lignes). */
  count?: number;
  countError?: boolean;
  /** Plafond serveur inférieur à la limite demandée (simule max-rows). */
  serverCap?: number;
  failPage?: number;
  nullDataPage?: number;
  pageCalls?: number;
}

const READ_METHODS = new Set(['from', 'select', 'order', 'limit', 'gt']);

function makeClient(tables: Record<string, FakeTable>, calls: string[]) {
  return {
    from(table: string) {
      calls.push('from');
      const t = tables[table];
      if (!t) throw new Error(`table inattendue: ${table}`);
      const state: { head?: boolean; gt?: unknown; limit?: number } = {};
      const exec = () => {
        if (state.head) {
          return t.countError
            ? { count: null, error: { message: 'count failed' } }
            : { count: t.count ?? t.rows.length, error: null };
        }
        t.pageCalls = (t.pageCalls ?? 0) + 1;
        if (t.failPage === t.pageCalls) {
          return { data: null, error: { message: 'page failed' } };
        }
        if (t.nullDataPage === t.pageCalls) return { data: null, error: null };
        const sorted = [...t.rows].sort(
          (a, b) => Number(a[t.key]) - Number(b[t.key]),
        );
        const after =
          state.gt === undefined
            ? sorted
            : sorted.filter((r) => Number(r[t.key]) > Number(state.gt));
        const cap = Math.min(state.limit ?? Infinity, t.serverCap ?? Infinity);
        return { data: after.slice(0, cap), error: null };
      };
      const builder: Record<string, unknown> = {
        select(_c: string, opts?: { head?: boolean }) {
          calls.push('select');
          if (opts?.head) state.head = true;
          return builder;
        },
        order() {
          calls.push('order');
          return builder;
        },
        limit(n: number) {
          calls.push('limit');
          state.limit = n;
          return builder;
        },
        gt(_k: string, v: unknown) {
          calls.push('gt');
          state.gt = v;
          return builder;
        },
        then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) {
          return Promise.resolve(exec()).then(res, rej);
        },
      };
      return builder;
    },
  };
}

interface Internals {
  supabase: unknown;
  logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  callRpc: jest.Mock;
  getVLevelGlobalStats: GammeSeoBadgesService['getVLevelGlobalStats'];
}

function makeService(tables: Record<string, FakeTable>) {
  const calls: string[] = [];
  const svc = Object.create(GammeSeoBadgesService.prototype) as Internals;
  svc.supabase = makeClient(tables, calls);
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.callRpc = jest.fn();
  return { svc, calls };
}

const NOW = new Date('2026-11-04T22:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const OLD = '2026-06-18T17:22:16+00:00';

const catalogue = (rows: Array<[number, string | null]>): FakeTable => ({
  key: 'pg_id',
  rows: rows.map(([pg_id, pg_top]) => ({ pg_id, pg_top })),
});

let nextId = 1;
const kw = (
  pg_id: number | null,
  v_level: string | null,
  collected_at: string | null = OLD,
  updated_at: string | null = OLD,
): Row => ({ id: nextId++, pg_id, v_level, collected_at, updated_at });

beforeEach(() => {
  nextId = 1;
});

describe('getVLevelGlobalStats — contrat nominal', () => {
  it('compte des lignes de mots-clés, signale NULL, inattendus et gammes hors catalogue', async () => {
    const { svc } = makeService({
      // 1, 2, 4 = G1 ; 3 = non G1
      pieces_gamme: catalogue([
        [1, '1'],
        [2, '1'],
        [3, '0'],
        [4, '1'],
      ]),
      __seo_keywords: {
        key: 'id',
        rows: [
          kw(1, 'V2'),
          kw(1, 'V2'),
          kw(1, 'V2'), // doublons V2 dans une même gamme G1
          kw(3, 'V2'), // V2 hors G1
          kw(2, 'V3'),
          kw(2, 'V4'),
          kw(2, 'V5'),
          kw(2, null),
          kw(null, null),
          kw(2, 'v2'), // casse non reconnue
          kw(2, 'V7'),
          kw(2, ''),
          kw(999, 'V3'), // gamme absente du catalogue
        ],
      },
    });

    const s = await svc.getVLevelGlobalStats(NOW);

    expect(s.contract).toBe('vlevel-global-stats.v2');
    expect(s.source).toEqual({
      keywords: '__seo_keywords',
      catalogue: 'pieces_gamme',
    });
    expect(s.keywords.total).toBe(13);
    expect(s.keywords.byLevel).toEqual({
      V1: 0,
      V2: 4,
      V3: 2,
      V4: 1,
      V5: 1,
      V6: 0,
    });
    expect(s.keywords.classified).toBe(8);
    expect(s.keywords.unclassified).toBe(2);
    expect(s.keywords.unexpectedLevel).toBe(3);
    expect(s.keywords.unexpectedLevelValues).toEqual([
      { value: '', count: 1 },
      { value: 'V7', count: 1 },
      { value: 'v2', count: 1 },
    ]);
    expect(
      s.keywords.classified +
        s.keywords.unclassified +
        s.keywords.unexpectedLevel,
    ).toBe(s.keywords.total);
    expect(s.keywords.withoutCatalogueGamme).toBe(2); // null + 999
    // Gammes du catalogue portant un niveau reconnu : 1, 2, 3 (999 exclue)
    expect(s.gammes).toEqual({
      catalogueTotal: 4,
      withClassification: 3,
      g1Total: 3,
      g1WithV2: 1, // gamme 1 comptée une fois, gamme 3 non G1 exclue
    });
  });

  it("n'écrit rien : seules des méthodes de lecture sont appelées, aucune RPC", async () => {
    const { svc, calls } = makeService({
      pieces_gamme: catalogue([[1, '1']]),
      __seo_keywords: { key: 'id', rows: [kw(1, 'V2')] },
    });
    await svc.getVLevelGlobalStats(NOW);
    expect(calls.every((c) => READ_METHODS.has(c))).toBe(true);
    expect(svc.callRpc).not.toHaveBeenCalled();
  });
});

describe('getVLevelGlobalStats — exhaustivité', () => {
  it('prend en compte toutes les lignes au-delà de 1 000, même si le serveur plafonne à 500', async () => {
    const rows = Array.from({ length: 2345 }, (_, i) =>
      kw(1, i < 100 ? 'V2' : i < 2000 ? 'V4' : null),
    );
    const { svc } = makeService({
      pieces_gamme: catalogue([[1, '1']]),
      __seo_keywords: { key: 'id', rows, serverCap: 500 },
    });

    const s = await svc.getVLevelGlobalStats(NOW);

    expect(s.keywords.total).toBe(2345);
    expect(s.keywords.byLevel.V2).toBe(100);
    expect(s.keywords.byLevel.V4).toBe(1900);
    expect(s.keywords.unclassified).toBe(345);
    // 5 pages pleines/partielles de 500 + 1 page vide de fin
    expect(s.read.keywordPages).toBe(6);
  });

  it('échoue si une page échoue après une première page réussie', async () => {
    const rows = Array.from({ length: 1500 }, () => kw(1, 'V4'));
    const { svc } = makeService({
      pieces_gamme: catalogue([[1, '1']]),
      __seo_keywords: { key: 'id', rows, failPage: 2 },
    });
    await expect(svc.getVLevelGlobalStats(NOW)).rejects.toBeInstanceOf(
      VLevelStatsReadError,
    );
  });

  it('échoue si une page renvoie data = null sans erreur', async () => {
    const { svc } = makeService({
      pieces_gamme: catalogue([[1, '1']]),
      __seo_keywords: { key: 'id', rows: [kw(1, 'V2')], nullDataPage: 1 },
    });
    await expect(svc.getVLevelGlobalStats(NOW)).rejects.toThrow(
      'Lecture __seo_keywords interrompue',
    );
  });

  it('échoue si le catalogue est illisible (comptage en erreur)', async () => {
    const { svc } = makeService({
      pieces_gamme: { ...catalogue([[1, '1']]), countError: true },
      __seo_keywords: { key: 'id', rows: [kw(1, 'V2')] },
    });
    await expect(svc.getVLevelGlobalStats(NOW)).rejects.toThrow(
      'Comptage pieces_gamme impossible',
    );
  });

  it('échoue si les lignes lues diffèrent du comptage exact (écriture concurrente)', async () => {
    const { svc } = makeService({
      pieces_gamme: catalogue([[1, '1']]),
      __seo_keywords: { key: 'id', rows: [kw(1, 'V2')], count: 2 },
    });
    await expect(svc.getVLevelGlobalStats(NOW)).rejects.toThrow(
      'Lecture __seo_keywords incohérente',
    );
  });

  it('échoue au-delà de la borne de pages au lieu de boucler', async () => {
    const rows = Array.from({ length: 250 }, () => kw(1, 'V4'));
    const { svc } = makeService({
      pieces_gamme: catalogue([[1, '1']]),
      __seo_keywords: { key: 'id', rows, serverCap: 1 },
    });
    await expect(svc.getVLevelGlobalStats(NOW)).rejects.toThrow(
      'dépasse la borne',
    );
  });
});

describe('getVLevelGlobalStats — source vide et dénominateurs nuls', () => {
  it('source vide lue intégralement : zéros mesurés, dates inconnues', async () => {
    const { svc } = makeService({
      pieces_gamme: catalogue([[3, '0']]),
      __seo_keywords: { key: 'id', rows: [] },
    });
    const s = await svc.getVLevelGlobalStats(NOW);
    expect(s.keywords.total).toBe(0);
    expect(s.keywords.classified).toBe(0);
    expect(s.gammes.g1Total).toBe(0);
    expect(s.dates).toEqual({ latestCollectedAt: null, latestUpdatedAt: null });
    expect(svc.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('source vide'),
    );
  });
});

describe('getVLevelGlobalStats — fraîcheur sur collected_at', () => {
  it('bornes 7 et 30 jours incluses ; absente, invalide et future = inconnue', async () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    const { svc } = makeService({
      pieces_gamme: catalogue([[1, '1']]),
      __seo_keywords: {
        key: 'id',
        rows: [
          kw(1, 'V3', ago(0)),
          kw(1, 'V3', ago(7 * DAY)), // 7 j pile → ≤ 7 j
          kw(1, 'V3', ago(7 * DAY + 1)), // → ]7 ; 30]
          kw(1, 'V3', ago(30 * DAY)), // 30 j pile → ]7 ; 30]
          kw(1, 'V3', ago(30 * DAY + 1)), // → > 30 j
          kw(1, 'V3', null),
          kw(1, 'V3', 'pas-une-date'),
          kw(1, 'V3', future, future),
        ],
      },
    });

    const s = await svc.getVLevelGlobalStats(NOW);

    expect(s.freshness).toEqual({
      upTo7Days: 2,
      from7To30Days: 2,
      over30Days: 1,
      unknownOrInvalid: 3,
    });
    const sum =
      s.freshness.upTo7Days +
      s.freshness.from7To30Days +
      s.freshness.over30Days +
      s.freshness.unknownOrInvalid;
    expect(sum).toBe(s.keywords.total);
    // La date future n'est ni « dernière collecte » ni « dernière modification »
    expect(s.dates.latestCollectedAt).toBe(NOW.toISOString());
    expect(s.dates.latestUpdatedAt).toBe(new Date(OLD).toISOString());
    expect(s.read.startedAt).toBe(NOW.toISOString());
  });
});

describe('AdminGammesSeoVlevelController — global-stats', () => {
  it('conserve AuthenticatedGuard et IsAdminGuard sur le contrôleur', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminGammesSeoVlevelController,
    );
    expect(guards).toEqual([AuthenticatedGuard, IsAdminGuard]);
  });

  it('transforme une lecture impossible en échec explicite, sans détail technique', async () => {
    const getVLevelGlobalStats = jest
      .fn()
      .mockRejectedValue(new VLevelStatsReadError('Lecture X interrompue'));
    const controller = new AdminGammesSeoVlevelController({
      getBadgesService: () => ({ getVLevelGlobalStats }),
    } as never);
    (
      controller as unknown as { logger: { log: jest.Mock; error: jest.Mock } }
    ).logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const err = await controller.getVLevelGlobalStats().catch((e) => e);
    expect(err).toBeInstanceOf(OperationFailedException);
    expect(JSON.stringify(err.getResponse())).toContain(
      'Indicateurs V-Level indisponibles',
    );
    expect(JSON.stringify(err.getResponse())).not.toContain('Lecture X');
  });

  it('renvoie le contrat dans une enveloppe success/data/timestamp', async () => {
    const stats = { contract: 'vlevel-global-stats.v2' };
    const controller = new AdminGammesSeoVlevelController({
      getBadgesService: () => ({
        getVLevelGlobalStats: jest.fn().mockResolvedValue(stats),
      }),
    } as never);
    (controller as unknown as { logger: { log: jest.Mock } }).logger = {
      log: jest.fn(),
    } as never;
    const res = await controller.getVLevelGlobalStats();
    expect(res.success).toBe(true);
    expect(res.data).toBe(stats);
    expect(typeof res.timestamp).toBe('string');
  });
});
