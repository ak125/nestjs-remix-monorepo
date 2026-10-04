/**
 * TrackingIntegrityService — producteur de `tracking-integrity-verdict.v1`.
 *
 * Cas de référence relevé en base le 2026-10-04 : les événements « commande
 * passée » portaient un n° de transaction bancaire à 6 chiffres, jamais un
 * `ord_id` — aucun ne se reliait à une commande. Le verdict doit le dire
 * (NOT_CERTIFIED), et ne jamais certifier sur une source illisible, tronquée ou vide.
 * supabase-js résout `{ error }` (il ne lève pas) : le mock renvoie des résultats.
 */
import { TABLES } from '@repo/database-types';
import {
  TrackingIntegrityService,
  evaluateTrackingIntegrity,
  trackingWindow,
  type OrderPlacedEventRow,
} from './tracking-integrity.service';
import { TrackingIntegrityVerdictV1Schema } from './tracking-integrity-verdict.schema';

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
    };
    return map[key] ?? 'mock-value';
  }),
  getOrThrow: jest.fn().mockReturnValue('mock-value'),
};

const NOW = new Date('2026-10-04T12:00:00.000Z');
const WINDOW = trackingWindow(NOW);

type ReadResult = {
  data: unknown[] | null;
  count?: number | null;
  error: { code?: string; message: string } | null;
};

interface Query {
  table: string;
  calls: Array<[string, unknown[]]>;
}

/** Chaque `from(table)` ouvre une requête thenable ; `respond` décide du résultat. */
function fakeSupabase(respond: (q: Query) => ReadResult) {
  const queries: Query[] = [];
  const from = jest.fn((table: string) => {
    const q: Query = { table, calls: [] };
    queries.push(q);
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'lte', 'lt', 'limit', 'in']) {
      chain[m] = (...args: unknown[]) => {
        q.calls.push([m, args]);
        return chain;
      };
    }
    chain.then = (resolve: (v: ReadResult) => unknown) => resolve(respond(q));
    return chain;
  });
  return { supabase: { from }, queries };
}

const isLookup = (q: Query) => q.calls.some(([m]) => m === 'in');

function makeService(supabase: unknown) {
  const service = new (TrackingIntegrityService as unknown as new (
    c: unknown,
  ) => TrackingIntegrityService)(mockConfigService);
  Object.defineProperty(service, 'supabase', {
    get: () => supabase,
    configurable: true,
  });
  return service;
}

/** Paiement confirmé deux jours avant NOW : réglé, dans la fenêtre. */
const PAID = '2026-10-02T09:30:00.000Z';

interface ConfirmedRead {
  ord_id: string;
  ord_date_pay: string | null;
}

/** Répond selon la table : événements, commandes confirmées, recherche d'ord_id. */
function tables(opts: {
  events: OrderPlacedEventRow[];
  confirmed: ConfirmedRead[];
  existing: string[];
}) {
  return (q: Query): ReadResult => {
    if (q.table === '__seo_event_log') {
      return { data: opts.events, count: opts.events.length, error: null };
    }
    if (isLookup(q)) {
      const keys = q.calls.find(([m]) => m === 'in')![1][1] as string[];
      return {
        data: opts.existing
          .filter((id) => keys.includes(id))
          .map((ord_id) => ({ ord_id })),
        error: null,
      };
    }
    return { data: opts.confirmed, count: opts.confirmed.length, error: null };
  };
}

describe('evaluateTrackingIntegrity (règle pure)', () => {
  it('événements portant un n° de transaction (cas réel) → NOT_CERTIFIED, les deux contrôles en échec', () => {
    const verdict = evaluateTrackingIntegrity({
      window: WINDOW,
      events: [
        { id: 'evt-1', order_id: '123456' },
        { id: 'evt-2', order_id: '654321' },
      ],
      confirmedOrders: [{ ord_id: 'ORD-1' }, { ord_id: 'ORD-2' }],
      knownOrderIds: new Set(),
    });
    expect(verdict.status).toBe('NOT_CERTIFIED');
    expect(verdict.checks).toEqual([
      expect.objectContaining({
        id: 'order_event_key',
        status: 'FAIL',
        observed: 0,
        expected: 2,
        samples: ['evt-1', 'evt-2'],
      }),
      expect.objectContaining({
        id: 'order_event_coverage',
        status: 'FAIL',
        observed: 0,
        expected: 2,
        samples: ['ORD-1', 'ORD-2'],
      }),
    ]);
    expect(TrackingIntegrityVerdictV1Schema.safeParse(verdict).success).toBe(
      true,
    );
  });

  it('chaque événement porte un ord_id existant et chaque paiement confirmé a le sien → CERTIFIED', () => {
    const verdict = evaluateTrackingIntegrity({
      window: WINDOW,
      events: [
        { id: 'evt-1', order_id: 'ORD-1' },
        { id: 'evt-2', order_id: 'ORD-2' },
      ],
      confirmedOrders: [{ ord_id: 'ORD-1' }, { ord_id: 'ORD-2' }],
      knownOrderIds: new Set(['ORD-1', 'ORD-2']),
    });
    expect(verdict.status).toBe('CERTIFIED');
    expect(verdict.reason).toBeNull();
    expect(TrackingIntegrityVerdictV1Schema.safeParse(verdict).success).toBe(
      true,
    );
  });

  it('clé correcte mais une commande payée sans événement → NOT_CERTIFIED sur la couverture seule', () => {
    const verdict = evaluateTrackingIntegrity({
      window: WINDOW,
      events: [{ id: 'evt-1', order_id: 'ORD-1' }],
      confirmedOrders: [{ ord_id: 'ORD-1' }, { ord_id: 'ORD-2' }],
      knownOrderIds: new Set(['ORD-1']),
    });
    expect(verdict.status).toBe('NOT_CERTIFIED');
    expect(verdict.checks.map((c) => c.status)).toEqual(['PASS', 'FAIL']);
    expect(verdict.checks[1].samples).toEqual(['ORD-2']);
  });

  it('événement sans order_id → compte comme non relié', () => {
    const verdict = evaluateTrackingIntegrity({
      window: WINDOW,
      events: [{ id: 'evt-1', order_id: null }],
      confirmedOrders: [],
      knownOrderIds: new Set(),
    });
    expect(verdict.checks[0]).toMatchObject({
      status: 'FAIL',
      samples: ['evt-1'],
    });
  });

  it('aucune donnée sur la fenêtre → UNKNOWN avec raison, jamais CERTIFIED', () => {
    const verdict = evaluateTrackingIntegrity({
      window: WINDOW,
      events: [],
      confirmedOrders: [],
      knownOrderIds: new Set(),
    });
    expect(verdict.status).toBe('UNKNOWN');
    expect(verdict.checks.map((c) => c.status)).toEqual(['NO_DATA', 'NO_DATA']);
    expect(verdict.reason).toMatch(/Données insuffisantes/);
    expect(TrackingIntegrityVerdictV1Schema.safeParse(verdict).success).toBe(
      true,
    );
  });

  it('événements reliés mais aucun paiement confirmé → UNKNOWN (une moitié de mesure ne certifie pas)', () => {
    const verdict = evaluateTrackingIntegrity({
      window: WINDOW,
      events: [{ id: 'evt-1', order_id: 'ORD-1' }],
      confirmedOrders: [],
      knownOrderIds: new Set(['ORD-1']),
    });
    expect(verdict.status).toBe('UNKNOWN');
    expect(verdict.reason).toMatch(/order_event_coverage/);
  });

  it('échantillons bornés à 5', () => {
    const events = Array.from({ length: 8 }, (_, i) => ({
      id: `evt-${i}`,
      order_id: `${i}`,
    }));
    const verdict = evaluateTrackingIntegrity({
      window: WINDOW,
      events,
      confirmedOrders: [],
      knownOrderIds: new Set(),
    });
    expect(verdict.checks[0].samples).toHaveLength(5);
  });
});

describe('TrackingIntegrityVerdictV1Schema (contrat)', () => {
  const base = {
    contract: 'tracking-integrity-verdict.v1',
    producer: 'data',
    consumer: 'sales',
    window: WINDOW,
    reason: null,
  };

  it('refuse CERTIFIED sans contrôle', () => {
    expect(
      TrackingIntegrityVerdictV1Schema.safeParse({
        ...base,
        status: 'CERTIFIED',
        checks: [],
      }).success,
    ).toBe(false);
  });

  it('refuse un PASS dont observed ≠ expected', () => {
    expect(
      TrackingIntegrityVerdictV1Schema.safeParse({
        ...base,
        status: 'CERTIFIED',
        checks: [
          {
            id: 'order_event_key',
            status: 'PASS',
            observed: 1,
            expected: 2,
            detail: '',
            samples: [],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('refuse UNKNOWN sans raison', () => {
    expect(
      TrackingIntegrityVerdictV1Schema.safeParse({
        ...base,
        status: 'UNKNOWN',
        checks: [],
      }).success,
    ).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    expect(
      TrackingIntegrityVerdictV1Schema.safeParse({
        ...base,
        status: 'UNKNOWN',
        checks: [],
        reason: 'x',
        extra: 1,
      }).success,
    ).toBe(false);
  });
});

describe('TrackingIntegrityService.evaluate', () => {
  it('lit en lecture seule, sur la fenêtre de 30 jours, les bonnes colonnes', async () => {
    const { supabase, queries } = fakeSupabase(
      tables({
        events: [{ id: 'evt-1', order_id: 'ORD-1' }],
        confirmed: [{ ord_id: 'ORD-1', ord_date_pay: PAID }],
        existing: ['ORD-1'],
      }),
    );
    const verdict = await makeService(supabase).evaluate(NOW);
    expect(verdict.status).toBe('CERTIFIED');

    const [events, confirmed, lookup] = queries;
    expect(events).toEqual({
      table: '__seo_event_log',
      calls: [
        ['select', ['id, order_id:payload->>order_id', { count: 'exact' }]],
        ['eq', ['event_type', 'r2_order_placed']],
        ['gte', ['created_at', '2026-09-04T12:00:00.000Z']],
        ['lte', ['created_at', '2026-10-04T12:00:00.000Z']],
        ['limit', [1000]],
      ],
    });
    // sur-ensemble par préfixe de jour ; la fenêtre exacte est appliquée après lecture
    expect(confirmed).toEqual({
      table: TABLES.xtr_order,
      calls: [
        ['select', ['ord_id, ord_date_pay', { count: 'exact' }]],
        ['eq', ['payment_confirmed', true]],
        ['gte', ['ord_date_pay', '2026-09-04']],
        ['lt', ['ord_date_pay', '2026-10-05']],
        ['limit', [1000]],
      ],
    });
    expect(lookup).toEqual({
      table: TABLES.xtr_order,
      calls: [
        ['select', ['ord_id']],
        ['in', ['ord_id', ['ORD-1']]],
      ],
    });
  });

  it("recherche des ord_id par lots de 200 (longueur d'URL)", async () => {
    const events = Array.from({ length: 450 }, (_, i) => ({
      id: `evt-${i}`,
      order_id: `K-${i}`,
    }));
    const { supabase, queries } = fakeSupabase(
      tables({ events, confirmed: [], existing: [] }),
    );
    await makeService(supabase).evaluate(NOW);
    const lookups = queries.filter(isLookup);
    expect(lookups).toHaveLength(3);
    expect(
      lookups.map(
        (q) => (q.calls.find(([m]) => m === 'in')![1][1] as string[]).length,
      ),
    ).toEqual([200, 200, 50]);
  });

  it('erreur de lecture (ex. 42501 en PREPROD, rôle anon) → UNKNOWN avec raison et avertissement', async () => {
    const { supabase } = fakeSupabase(() => ({
      data: null,
      count: null,
      error: { code: '42501', message: 'permission denied' },
    }));
    const service = makeService(supabase);
    const warn = jest.spyOn(
      (service as unknown as { logger: { warn: () => void } }).logger,
      'warn',
    );
    const verdict = await service.evaluate(NOW);
    expect(verdict.status).toBe('UNKNOWN');
    expect(verdict.checks).toEqual([]);
    expect(verdict.reason).toMatch(/42501/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('42501'));
    expect(TrackingIntegrityVerdictV1Schema.safeParse(verdict).success).toBe(
      true,
    );
  });

  it('lecture tronquée (count ≠ lignes reçues) → UNKNOWN, jamais un verdict partiel', async () => {
    const { supabase } = fakeSupabase((q) =>
      q.table === '__seo_event_log'
        ? {
            data: [{ id: 'evt-1', order_id: 'ORD-1' }],
            count: 1500,
            error: null,
          }
        : { data: [], count: 0, error: null },
    );
    const verdict = await makeService(supabase).evaluate(NOW);
    expect(verdict.status).toBe('UNKNOWN');
    expect(verdict.reason).toMatch(/tronquée/);
  });

  it('commandes confirmées tronquées → UNKNOWN', async () => {
    const { supabase } = fakeSupabase((q) =>
      q.table === '__seo_event_log'
        ? { data: [], count: 0, error: null }
        : {
            data: [{ ord_id: 'ORD-1', ord_date_pay: PAID }],
            count: 2000,
            error: null,
          },
    );
    const verdict = await makeService(supabase).evaluate(NOW);
    expect(verdict.status).toBe('UNKNOWN');
    expect(verdict.reason).toMatch(/tronquée/);
  });

  it('cas réel : clés à 6 chiffres absentes de ___xtr_order → NOT_CERTIFIED', async () => {
    const { supabase } = fakeSupabase(
      tables({
        events: [{ id: 'evt-1', order_id: '123456' }],
        confirmed: [{ ord_id: 'ORD-1', ord_date_pay: PAID }],
        existing: ['ORD-1'],
      }),
    );
    const verdict = await makeService(supabase).evaluate(NOW);
    expect(verdict.status).toBe('NOT_CERTIFIED');
    expect(verdict.checks.map((c) => [c.id, c.status])).toEqual([
      ['order_event_key', 'FAIL'],
      ['order_event_coverage', 'FAIL'],
    ]);
  });

  it('fenêtre exacte : bords du sur-ensemble exclus, commande de la dernière heure pas encore jugée', async () => {
    const { supabase } = fakeSupabase(
      tables({
        events: [{ id: 'evt-1', order_id: 'ORD-IN' }],
        confirmed: [
          // même jour que le début de fenêtre, mais avant lui
          { ord_id: 'ORD-EARLY', ord_date_pay: '2026-09-04T11:59:59.999Z' },
          { ord_id: 'ORD-IN', ord_date_pay: PAID },
          // payée il y a 30 min : son événement peut encore arriver
          { ord_id: 'ORD-FRESH', ord_date_pay: '2026-10-04T11:30:00.000Z' },
        ],
        existing: ['ORD-IN'],
      }),
    );
    const verdict = await makeService(supabase).evaluate(NOW);
    expect(verdict.status).toBe('CERTIFIED');
    expect(verdict.checks[1]).toMatchObject({ observed: 1, expected: 1 });
  });

  it('date de paiement hors format ISO UTC dans la fenêtre → UNKNOWN nommant la commande', async () => {
    const { supabase } = fakeSupabase(
      tables({
        events: [],
        confirmed: [
          { ord_id: 'ORD-PG', ord_date_pay: '2026-09-20 10:00:00.123456+00' },
        ],
        existing: [],
      }),
    );
    const verdict = await makeService(supabase).evaluate(NOW);
    expect(verdict.status).toBe('UNKNOWN');
    expect(verdict.reason).toMatch(/hors format ISO UTC \(ord_id ORD-PG\)/);
  });
});
