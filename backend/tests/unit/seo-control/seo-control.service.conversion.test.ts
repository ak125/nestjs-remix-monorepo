/**
 * SeoControlService — conversion non mesurée (2026-11-11).
 *
 * rpc_seo_conversion_v1 rattache une commande payée à une page par
 * `___xtr_order_line.orl_website_url`. Relevé du 2026-11-11 sur 28 jours :
 * 4 commandes payées, 4 lignes, aucune adresse. La RPC rend alors 0 commande
 * pour chaque page, et le snapshot portait des décisions « blocage critique du
 * tunnel » fabriquées sur une donnée absente. Le snapshot doit dire « non
 * mesuré » (raison + comptages) et ne publier aucune ligne de conversion ; une
 * fenêtre attribuée, ou sans commande payée, reste inchangée.
 */
import { ConfigService } from '@nestjs/config';

import { SeoControlDecisionsService } from '../../../src/modules/admin/services/seo-control-decisions.service';
import { SeoControlService } from '../../../src/modules/admin/services/seo-control.service';

const NOW = new Date('2026-11-11T10:00:00Z'); // J = 2026-11-11 (UTC)

const traffic = {
  impact_score_version: 'v1',
  clicks: 700,
  impressions: 40000,
  ctr: 1.75,
  avg_position: 14.3,
  pages_count: 500,
  delta_vs_previous: {
    clicks_pct: 1.2,
    impressions_pct: 0.4,
    direction: 'up',
    change_severity: 'info',
  },
};

/** Ligne de rpc_seo_conversion_v1 : page à plus de 200 sessions, 0 commande. */
const zeroOrderRow = {
  page: '/pieces/demarreur-2.html',
  surface_key: 'R1',
  sessions: 320,
  orders_count: 0,
  conversion_rate: 0,
  revenue: 0,
  business_impact_score: 3.2,
  impact_score_version: 'v1',
  severity: 'critical',
};

const convertingRow = {
  ...zeroOrderRow,
  page: '/pieces/alternateur-4.html',
  orders_count: 2,
  conversion_rate: 0.63,
  revenue: 240,
  business_impact_score: 1.2,
  severity: 'medium',
};

/** Jours ISO de `from` à `to` inclus. */
function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (
    let t = Date.parse(`${from}T00:00:00Z`);
    t <= Date.parse(`${to}T00:00:00Z`);
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

type Line = { orl_ord_id: string; orl_website_url: string | null };

interface Fixture {
  /** Identifiants des commandes payées de la fenêtre. */
  paidOrderIds?: string[];
  /** Lignes de commande en base. */
  lines?: Line[];
  conversionRows?: unknown[] | null;
  ordersError?: unknown;
  linesError?: unknown;
  /** Comptage absent sans erreur (réponse dégradée). */
  linesCountMissing?: boolean;
  /** Valeur déjà en cache pour le bloc conversion. */
  cachedConversion?: unknown[];
  /** Backend en mode lecture seule (clé sans accès aux tables de commandes). */
  readOnly?: boolean;
}

function makeService(fixture: Fixture = {}) {
  const {
    paidOrderIds = [],
    lines = [],
    conversionRows = [zeroOrderRow],
    ordersError = null,
    linesError = null,
    linesCountMissing = false,
    cachedConversion,
    readOnly = false,
  } = fixture;
  const config = {
    get: (key: string) =>
      ({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
      })[key],
    getOrThrow: () => 'mock-value',
  } as unknown as ConfigService;
  const cache = {
    get: jest.fn((key: string) =>
      Promise.resolve(
        cachedConversion && key.startsWith('seo-control:conversion:')
          ? cachedConversion
          : null,
      ),
    ),
    set: jest.fn().mockResolvedValue(undefined),
    setNx: jest.fn().mockResolvedValue(false), // audit déjà journalisé → aucune écriture
  };

  // Fenêtres GSC complètes : hors sujet ici.
  const presence: Record<string, unknown> = {};
  for (const op of ['select', 'gte', 'lte', 'limit']) {
    presence[op] = () => presence;
  }
  presence.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: range('2026-09-01', '2026-11-10').map((date) => ({
        date,
        commit_version: 1,
      })),
      error: null,
    });

  const orderOps: Array<[string, unknown[]]> = [];
  const orders: Record<string, unknown> = {};
  for (const op of ['select', 'eq', 'gte', 'lt', 'order', 'limit']) {
    orders[op] = (...args: unknown[]) => {
      orderOps.push([op, args]);
      return orders;
    };
  }
  orders.then = (resolve: (v: unknown) => unknown) =>
    resolve(
      ordersError
        ? { data: null, error: ordersError }
        : { data: paidOrderIds.map((ord_id) => ({ ord_id })), error: null },
    );

  /** Comptage `head` des lignes, avec les filtres réellement posés. */
  const lineChunks: string[][] = [];
  const lineCount = () => {
    let ids: string[] = [];
    let attributedOnly = false;
    const b: Record<string, unknown> = {
      select: () => b,
      in: (_column: string, values: string[]) => {
        ids = values;
        lineChunks.push(values);
        return b;
      },
      not: () => {
        attributedOnly = true;
        return b;
      },
      neq: () => b,
    };
    b.then = (resolve: (v: unknown) => unknown) => {
      if (linesError) {
        return resolve({ count: null, error: linesError });
      }
      if (linesCountMissing) {
        return resolve({ count: null, error: null });
      }
      const matching = lines.filter(
        (line) =>
          ids.includes(line.orl_ord_id) &&
          (!attributedOnly ||
            (line.orl_website_url !== null &&
              line.orl_website_url !== '' &&
              line.orl_website_url !== 'System')),
      );
      return resolve({ count: matching.length, error: null });
    };
    return b;
  };

  const supabase = {
    from: jest.fn((table: string) => {
      if (table === '__seo_gsc_daily_property_total') return presence;
      if (table === '___xtr_order') return orders;
      if (table === '___xtr_order_line') return lineCount();
      throw new Error(`unexpected table ${table}`);
    }),
    rpc: jest.fn((name: string) =>
      Promise.resolve({
        data:
          {
            rpc_seo_traffic_v1: traffic,
            rpc_seo_top_losers_v1: [],
            rpc_seo_low_ctr_v1: [],
            rpc_seo_alerts_v1: [],
            rpc_seo_conversion_v1: conversionRows,
          }[name] ?? null,
        error: null,
      }),
    ),
  };
  const service = new SeoControlService(
    config,
    cache as never,
    new SeoControlDecisionsService(),
  );
  Object.defineProperty(service, 'supabase', {
    get: () => supabase,
    configurable: true,
  });
  Object.defineProperty(service, 'isReadOnlyMode', { value: readOnly });
  const warn = jest
    .spyOn(
      (service as unknown as { logger: { warn: () => void } }).logger,
      'warn',
    )
    .mockImplementation(() => undefined);
  jest
    .spyOn(
      (service as unknown as { logger: { error: () => void } }).logger,
      'error',
    )
    .mockImplementation(() => undefined);
  return { service, orderOps, lineChunks, warn, supabase };
}

describe('SeoControlService — attribution des commandes aux pages', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
      ],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('relevé du 2026-11-11 : 4 commandes payées, aucune ligne rattachée → non mesuré, aucune ligne ni décision publiée', async () => {
    const paidOrderIds = ['ORD-1', 'ORD-2', 'ORD-3', 'ORD-4'];
    const { service, orderOps, warn } = makeService({
      paidOrderIds,
      lines: paidOrderIds.map((orl_ord_id) => ({
        orl_ord_id,
        orl_website_url: null,
      })),
    });
    const snap = await service.getSnapshot('28d', 'admin-1');

    expect(snap.conversionAttribution).toEqual({
      measured: false,
      reason: 'no_attributed_order_line',
      source: '___xtr_order_line.orl_website_url',
      from: '2026-10-14',
      to: '2026-11-11',
      paid_orders: 4,
      paid_order_lines: 4,
      attributed_order_lines: 0,
    });
    expect(snap.conversionGap).toBeNull();
    expect(JSON.stringify(snap)).not.toContain('CONV_CRITICAL_FUNNEL_BLOCK_V1');
    expect(warn).toHaveBeenCalledTimes(1);
    // mêmes bornes que la RPC : [J-28, J[, commandes payées seulement
    expect(orderOps).toEqual([
      ['select', ['ord_id']],
      ['eq', ['ord_is_pay', '1']],
      ['gte', ['ord_date', '2026-10-14']],
      ['lt', ['ord_date', '2026-11-11']],
      ['order', ['ord_date', { ascending: false }]],
      ['limit', [1000]],
    ]);
  });

  it('adresse vide ou « System » → ne compte pas comme un rattachement', async () => {
    const { service } = makeService({
      paidOrderIds: ['ORD-1', 'ORD-2'],
      lines: [
        { orl_ord_id: 'ORD-1', orl_website_url: '' },
        { orl_ord_id: 'ORD-2', orl_website_url: 'System' },
      ],
    });
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.conversionAttribution.measured).toBe(false);
    expect(snap.conversionAttribution.from).toBe('2026-11-04');
    expect(snap.conversionAttribution.attributed_order_lines).toBe(0);
    expect(snap.conversionGap).toBeNull();
  });

  it('lignes rattachées à une page → mesuré, lignes de la RPC et décisions conservées', async () => {
    const { service, warn } = makeService({
      paidOrderIds: ['ORD-1', 'ORD-2'],
      lines: [
        { orl_ord_id: 'ORD-1', orl_website_url: '/pieces/alternateur-4.html' },
        { orl_ord_id: 'ORD-2', orl_website_url: '/pieces/alternateur-4.html' },
      ],
      conversionRows: [zeroOrderRow, convertingRow],
    });
    const snap = await service.getSnapshot('28d', 'admin-1');

    expect(snap.conversionAttribution).toMatchObject({
      measured: true,
      reason: null,
      paid_orders: 2,
      paid_order_lines: 2,
      attributed_order_lines: 2,
    });
    expect(snap.conversionGap).toHaveLength(2);
    expect(snap.conversionGap?.[0].decisions.decision_rule_ids).toEqual([
      'CONV_CRITICAL_FUNNEL_BLOCK_V1',
    ]);
    expect(snap.conversionGap?.[1].orders_count).toBe(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('attribution partielle → mesuré, comptages publiés', async () => {
    const { service } = makeService({
      paidOrderIds: ['ORD-1', 'ORD-2', 'ORD-3'],
      lines: [
        { orl_ord_id: 'ORD-1', orl_website_url: '/pieces/alternateur-4.html' },
        { orl_ord_id: 'ORD-2', orl_website_url: null },
        { orl_ord_id: 'ORD-3', orl_website_url: null },
        { orl_ord_id: 'ORD-9', orl_website_url: '/hors-fenetre' },
      ],
    });
    const snap = await service.getSnapshot('28d', null);

    expect(snap.conversionAttribution).toMatchObject({
      measured: true,
      paid_orders: 3,
      paid_order_lines: 3,
      attributed_order_lines: 1,
    });
    expect(snap.conversionGap).toHaveLength(1);
  });

  it('aucune commande payée dans la fenêtre → le zéro est réel : mesuré, aucune lecture de lignes', async () => {
    const { service, lineChunks } = makeService({ paidOrderIds: [] });
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.conversionAttribution).toMatchObject({
      measured: true,
      reason: null,
      paid_orders: 0,
      paid_order_lines: 0,
      attributed_order_lines: 0,
    });
    expect(snap.conversionGap).toHaveLength(1);
    expect(lineChunks).toEqual([]);
  });

  it('bloc conversion masqué (RPC sans résultat) → null, attribution toujours dite', async () => {
    const { service } = makeService({
      paidOrderIds: ['ORD-1'],
      lines: [{ orl_ord_id: 'ORD-1', orl_website_url: '/pieces/x-1.html' }],
      conversionRows: null,
    });
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.conversionGap).toBeNull();
    expect(snap.conversionAttribution.measured).toBe(true);
  });

  it('lignes de conversion encore en cache, attribution absente → non publiées', async () => {
    const { service, supabase } = makeService({
      paidOrderIds: ['ORD-1'],
      lines: [{ orl_ord_id: 'ORD-1', orl_website_url: null }],
      cachedConversion: [zeroOrderRow],
    });
    const snap = await service.getSnapshot('28d', 'admin-1');

    expect(snap.conversionAttribution.measured).toBe(false);
    expect(snap.conversionGap).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'rpc_seo_conversion_v1',
      expect.anything(),
    );
  });

  it('plus de 100 commandes payées → identifiants lus par lots, comptages additionnés', async () => {
    const paidOrderIds = Array.from({ length: 230 }, (_, i) => `ORD-${i}`);
    const { service, lineChunks } = makeService({
      paidOrderIds,
      lines: [
        ...paidOrderIds.map((orl_ord_id) => ({
          orl_ord_id,
          orl_website_url: null,
        })),
        { orl_ord_id: 'ORD-229', orl_website_url: '/pieces/x-1.html' },
      ],
    });
    const snap = await service.getSnapshot('28d', 'admin-1');

    expect(snap.conversionAttribution).toMatchObject({
      measured: true,
      paid_orders: 230,
      paid_order_lines: 231,
      attributed_order_lines: 1,
    });
    // 3 lots, chacun lu deux fois (lignes, lignes rattachées)
    expect(lineChunks.map((chunk) => chunk.length)).toEqual([
      100, 100, 100, 100, 30, 30,
    ]);
  });

  it('lecture des commandes en erreur → exception (jamais « mesuré » par défaut)', async () => {
    const { service } = makeService({
      ordersError: { message: 'permission denied' },
    });
    await expect(service.getSnapshot('7d', 'admin-1')).rejects.toEqual({
      message: 'permission denied',
    });
  });

  it('lecture des lignes en erreur → exception', async () => {
    const { service } = makeService({
      paidOrderIds: ['ORD-1'],
      linesError: { message: 'fetch failed' },
    });
    await expect(service.getSnapshot('7d', 'admin-1')).rejects.toEqual({
      message: 'fetch failed',
    });
  });

  it('comptage absent sans erreur → exception, pas un zéro', async () => {
    const { service } = makeService({
      paidOrderIds: ['ORD-1'],
      linesCountMissing: true,
    });
    await expect(service.getSnapshot('7d', 'admin-1')).rejects.toThrow(
      'Order lines attribution read returned no count',
    );
  });

  it('mode lecture seule (tables de commandes non lisibles) → non mesuré, aucune lecture, aucune ligne publiée', async () => {
    const { service, supabase, warn } = makeService({
      readOnly: true,
      // Ce que la clé ne voit pas : la lecture rendrait zéro ligne sans erreur.
      paidOrderIds: [],
      conversionRows: [zeroOrderRow],
    });
    const snap = await service.getSnapshot('28d', 'admin-1');

    expect(snap.conversionAttribution).toEqual({
      measured: false,
      reason: 'order_tables_not_readable',
      source: '___xtr_order_line.orl_website_url',
      from: '2026-10-14',
      to: '2026-11-11',
      paid_orders: 0,
      paid_order_lines: 0,
      attributed_order_lines: 0,
    });
    expect(snap.conversionGap).toBeNull();
    const tables = supabase.from.mock.calls.map(([table]) => table);
    expect(tables).not.toContain('___xtr_order');
    expect(tables).not.toContain('___xtr_order_line');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('lecture seule'));
  });
});
