/**
 * FunnelEventsService — r2_order_placed reçu par la balise publique.
 *
 * Le service étend SupabaseBaseService (createClient + SUPABASE_URL) : comme
 * pour OrderFunnelListener, l'instance est construite via Object.create et le
 * client Supabase est un faux qui, à l'image de PostgREST, répond une erreur
 * pour toute colonne inconnue.
 */
import type { FunnelEventInput } from '@repo/seo-types';
import { FunnelEventsController } from '../controllers/funnel-events.controller';
import { FunnelEventsService, toCents } from './funnel-events.service';

const COLUMNS: Record<string, Set<string>> = {
  ___xtr_order_line: new Set(['orl_ord_id']),
  ___xtr_order: new Set(['ord_id']),
};

interface Fixture {
  lines: Array<{ orl_ord_id: string }>;
  orders: Array<{ ord_id: string; ord_total_ttc: string }>;
  failOn?: '___xtr_order_line' | '___xtr_order';
}

function fakeSupabase(fx: Fixture, inserted: unknown[]) {
  return {
    from(table: string) {
      if (table === '__seo_event_log') {
        return {
          insert(row: unknown) {
            inserted.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      const rows: Array<Record<string, string>> =
        table === '___xtr_order_line' ? fx.lines : fx.orders;
      const filters: Array<[string, string]> = [];
      let error: { message: string } | null =
        fx.failOn === table ? { message: 'db down' } : null;
      const matched = () =>
        rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      const chain = {
        select() {
          return chain;
        },
        eq(column: string, value: string) {
          if (!COLUMNS[table]?.has(column) && !error) {
            error = { message: `column ${table}.${column} does not exist` };
          }
          filters.push([column, value]);
          return chain;
        },
        maybeSingle() {
          return Promise.resolve(
            error
              ? { data: null, error }
              : { data: matched()[0] ?? null, error },
          );
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(
            error ? { count: null, error } : { count: matched().length, error },
          ).then(resolve);
        },
      };
      return chain;
    },
  };
}

function makeService(fx: Fixture) {
  const inserted: unknown[] = [];
  const logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  const service = Object.create(
    FunnelEventsService.prototype,
  ) as FunnelEventsService;
  Object.assign(service, { supabase: fakeSupabase(fx, inserted), logger });
  return { service, inserted, logger };
}

const COMMANDE: Fixture = {
  lines: [{ orl_ord_id: 'ORD-1' }, { orl_ord_id: 'ORD-1' }],
  orders: [{ ord_id: 'ORD-1', ord_total_ttc: '58.72' }],
};

const BEACON: FunnelEventInput = {
  event_type: 'r2_order_placed',
  entity_url: null,
  payload: {
    session_id: 'sess-9',
    order_id: 'ORD-1',
    item_count: 1,
    revenue_cents: 1,
    referrer: 'diagnostic',
  },
};

describe('FunnelEventsService.record — r2_order_placed', () => {
  it('prend item_count et revenue_cents dans la commande, garde session et referrer', async () => {
    const { service, inserted } = makeService(COMMANDE);
    await expect(service.record(BEACON)).resolves.toEqual({
      ok: true,
      deduped: false,
    });
    expect(inserted).toEqual([
      {
        event_type: 'r2_order_placed',
        entity_url: null,
        severity: 'info',
        payload: {
          session_id: 'sess-9',
          order_id: 'ORD-1',
          item_count: 2,
          revenue_cents: 5872,
          referrer: 'diagnostic',
        },
      },
    ]);
  });

  it('refuse une commande inconnue, sans écrire', async () => {
    const { service, inserted, logger } = makeService(COMMANDE);
    const res = await service.record({
      ...BEACON,
      payload: { ...BEACON.payload, order_id: 'ORD-404' },
    } as FunnelEventInput);
    expect(res).toEqual({ ok: false, deduped: false });
    expect(inserted).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('refuse sans écrire et journalise quand les lignes sont illisibles', async () => {
    const { service, inserted, logger } = makeService({
      ...COMMANDE,
      failOn: '___xtr_order_line',
    });
    await expect(service.record(BEACON)).resolves.toEqual({
      ok: false,
      deduped: false,
    });
    expect(inserted).toEqual([]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('écrit un revenu null (warn) quand le total est illisible', async () => {
    const { service, inserted, logger } = makeService({
      ...COMMANDE,
      failOn: '___xtr_order',
    });
    await service.record(BEACON);
    expect(inserted).toHaveLength(1);
    expect(
      (inserted[0] as { payload: { revenue_cents: unknown } }).payload
        .revenue_cents,
    ).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("n'interroge pas la commande pour les autres événements", async () => {
    const { service, inserted } = makeService({ lines: [], orders: [] });
    await service.record({
      event_type: 'r2_add_to_cart',
      entity_url: null,
      payload: { session_id: 's1', product_id: 'p1', quantity: 1 },
    } as FunnelEventInput);
    expect(inserted).toHaveLength(1);
  });
});

describe('FunnelEventsController.event — balise publique', () => {
  it("répond pareil pour une commande connue et inconnue (pas d'oracle d'existence)", async () => {
    const known = makeService(COMMANDE);
    const unknown = makeService(COMMANDE);
    const knownRes = await new FunnelEventsController(known.service).event(
      BEACON,
    );
    const unknownRes = await new FunnelEventsController(unknown.service).event({
      ...BEACON,
      payload: { ...BEACON.payload, order_id: 'ORD-404' },
    });
    expect(known.inserted).toHaveLength(1);
    expect(unknown.inserted).toEqual([]);
    expect(knownRes).toBeUndefined();
    expect(unknownRes).toBeUndefined();
  });

  it("classe l'agent utilisateur et n'enregistre que la classe, jamais l'agent brut", async () => {
    const chrome =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    const cases = [
      [chrome, 'human'],
      [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'bot',
      ],
      ['curl/8.5.0', 'suspect'],
      [undefined, 'suspect'],
    ] as const;
    for (const [ua, expected] of cases) {
      const { service, inserted } = makeService({ lines: [], orders: [] });
      await new FunnelEventsController(service).event(
        {
          event_type: 'r2_view',
          entity_url:
            'https://www.example.test/pieces/plaquette-de-frein-402.html',
          payload: {
            session_id: 's1',
            referrer: 'diagnostic',
            gamme_slug: 'plaquette-de-frein',
          },
        },
        ua,
      );
      expect(inserted).toHaveLength(1);
      const payload = (inserted[0] as { payload: Record<string, unknown> })
        .payload;
      expect(payload.traffic_class).toBe(expected);
      if (ua) expect(JSON.stringify(inserted)).not.toContain(ua);
    }
  });

  it('une classe fournie par le client est retirée et remplacée par celle du serveur', async () => {
    const { service, inserted } = makeService({ lines: [], orders: [] });
    await new FunnelEventsController(service).event(
      {
        event_type: 'r2_view',
        entity_url: null,
        payload: {
          session_id: 's1',
          referrer: 'diagnostic',
          gamme_slug: null,
          traffic_class: 'human',
        },
      },
      'curl/8.5.0',
    );
    expect(
      (inserted[0] as { payload: Record<string, unknown> }).payload
        .traffic_class,
    ).toBe('suspect');
  });

  it('r2_order_placed porte aussi la classe, avec les faits lus dans la commande', async () => {
    const { service, inserted } = makeService(COMMANDE);
    await new FunnelEventsController(service).event(BEACON, 'curl/8.5.0');
    expect(
      (inserted[0] as { payload: Record<string, unknown> }).payload,
    ).toMatchObject({
      item_count: 2,
      revenue_cents: 5872,
      traffic_class: 'suspect',
    });
  });

  it('ignore un corps malformé sans toucher à la base', async () => {
    const { service, inserted } = makeService(COMMANDE);
    await expect(
      new FunnelEventsController(service).event({ event_type: 'nope' }),
    ).resolves.toBeUndefined();
    expect(inserted).toEqual([]);
  });
});

describe('toCents', () => {
  it.each([
    ['49.90', 4990],
    ['10', 1000],
    ['0', 0],
  ])('convertit %s en %s centimes', (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  it.each([[null], [undefined], ['abc'], ['-5']])(
    'renvoie null pour %s',
    (input) => {
      expect(toCents(input)).toBeNull();
    },
  );
});
