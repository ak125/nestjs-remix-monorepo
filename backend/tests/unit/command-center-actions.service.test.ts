/**
 * CommandCenterActionsService — live engine honesty + mode gating.
 *
 * The pure rule functions are covered by command-center-action-rules.test.ts.
 * This proves the END-TO-END guarantee that the unit tests cannot: when the GSC
 * RPC and the pricing queries FAIL, the orchestrator must surface honest
 * `certification` actions (sourceUnavailable), NEVER a business/risk insight on a
 * broken source — and that non-`full` modes expose nothing. supabase-js resolves
 * `{ error }` (it does not throw), so the mock returns errors, not rejections.
 */
import { CommandCenterActionsService } from '../../src/modules/admin/services/command-center-actions.service';

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

/** A supabase whose every read resolves an error (broken source). */
function brokenSupabase() {
  const err = { data: null, count: null, error: { message: 'boom' } };
  const chain: Record<string, unknown> = {};
  for (const m of [
    'from',
    'select',
    'eq',
    'gt',
    'or',
    'limit',
    'order',
    'gte',
  ]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  // thenable → `await chain...` resolves the error result at the end of the chain
  chain.then = (resolve: (v: typeof err) => unknown) => resolve(err);
  chain.rpc = jest
    .fn()
    .mockResolvedValue({ data: null, error: { message: 'boom' } });
  return chain;
}

function makeService(supabase: ReturnType<typeof brokenSupabase>) {
  const service = new (CommandCenterActionsService as unknown as new (
    c: unknown,
  ) => CommandCenterActionsService)(mockConfigService);
  Object.defineProperty(service, 'supabase', {
    get: () => supabase,
    configurable: true,
  });
  return service;
}

describe('CommandCenterActionsService — honest by construction', () => {
  it('broken sources → ONLY certification actions, never business/risk', async () => {
    const service = makeService(brokenSupabase());
    const queue = await service.computeActionQueue([], [], 'full');

    // Every produced action is a certification (the broken-source honesty path)
    expect(queue.length).toBeGreaterThanOrEqual(2);
    expect(queue.every((a) => a.action_type === 'certification')).toBe(true);
    expect(queue.some((a) => a.action_type === 'business')).toBe(false);
    expect(queue.some((a) => a.action_type === 'risk')).toBe(false);

    const seo = queue.find((a) => a.id === 'unavailable:seo');
    const pricing = queue.find((a) => a.id === 'unavailable:pricing');
    expect(seo?.action_type).toBe('certification');
    expect(pricing?.action_type).toBe('certification');
    // honest LOW confidence (UNKNOWN), not fake-green
    expect(seo?.data_confidence).toBe(25);
    expect(pricing?.data_confidence).toBe(25);
  });

  it('certification dept + broken sources still yields zero business/risk actions', async () => {
    const service = makeService(brokenSupabase());
    const depts = [
      {
        id: 'sales',
        label: 'Ventes',
        certification: 'PARTIAL',
        kpi_primary: 'k',
      },
    ];
    const queue = await service.computeActionQueue(depts as never, [], 'full');
    expect(queue.some((a) => a.id === 'repair:sales')).toBe(true);
    expect(queue.some((a) => a.action_type === 'business')).toBe(false);
    expect(queue.some((a) => a.action_type === 'risk')).toBe(false);
  });

  it('non-full modes expose nothing (no queries, empty queue)', async () => {
    const supabase = brokenSupabase();
    const service = makeService(supabase);
    expect(await service.computeActionQueue([], [], 'light')).toEqual([]);
    expect(await service.computeActionQueue([], [], 'disabled')).toEqual([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

/**
 * A supabase whose table reads succeed (empty pricing) and whose rpc() is
 * driven per-function — isolates the SEO v2/v1 path.
 */
function seoSupabase(
  rpcImpl: (name: string) => { data: unknown; error: unknown },
) {
  const ok = { data: [], count: 0, error: null };
  const chain: Record<string, unknown> = {};
  for (const m of [
    'from',
    'select',
    'eq',
    'gt',
    'or',
    'limit',
    'order',
    'gte',
  ]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: typeof ok) => unknown) => resolve(ok);
  chain.rpc = jest
    .fn()
    .mockImplementation((name: string) => Promise.resolve(rpcImpl(name)));
  return chain as ReturnType<typeof brokenSupabase>;
}

describe('PR4: rpc_seo_low_ctr_v4 envelope + explicit v3 → v2 → v1 fallback', () => {
  const gscRow = {
    page: '/pieces/filtre-a-air-8/x-1/y-2/z-3.html',
    impressions: 200,
    clicks: 0,
    avg_position: 4.2,
  };
  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  /** Enveloppe v4 certifiable (grain fidèle, jours complets, couverture ok). */
  const v4Envelope = (
    lastDate: string,
    over: Record<string, unknown> = {},
  ) => ({
    rows: [gscRow],
    total_qualifying: 147,
    data_from: '2026-06-01',
    data_to: lastDate,
    last_data_date: lastDate,
    grain: 'page_totals',
    days_expected: 90,
    days_present: 90,
    missing_dates: [],
    retrieval_status: 'complete',
    retrieval_gap_dates: [],
    gsc_aggregation: {
      page_vs_property_clicks_ratio: 1,
      page_vs_property_impressions_ratio: 1.04,
      blocking: false,
    },
    coverage_status: 'ok',
    ...over,
  });

  it('v4 envelope (grain fidèle, jours complets, couverture ok, frais) → CERTIFIED 90, cap + jours dans la raison', async () => {
    // last ingested date 2 days ago → within the 7-day freshness SLA
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v4'
        ? { data: v4Envelope(freshDate), error: null }
        : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product).toBeDefined();
    expect(product!.action_type).toBe('business');
    expect(product!.data_confidence).toBe(90);
    expect(product!.title).toMatch(/top 1/); // 147 qualifying > 1 shown → cap disclosed
    expect(product!.reason).toMatch(/147 pages qualifiantes/);
    expect(product!.reason).toMatch(
      new RegExp(`2026-06-01 au ${freshDate} \\(90/90 jours\\)`),
    );
    expect(product!.reason).not.toMatch(/non exhaustif/);
    // v4 est seule à recevoir le plancher de jours attendus (défaut documenté : la
    // config de test renvoie 'mock-value' → invalide → défaut appliqué et loggué).
    // Aucun ratio d'agrégation n'est passé : il ne décide pas du statut.
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('rpc_seo_low_ctr_v4', {
      p_window_days: 120,
      p_min_impressions: 50,
      p_max_ctr: 0,
      p_limit: 50,
      p_expected_from: '2026-06-01',
    });
  });

  it('v4 avec jours manquants (incomplete_days) → PARTIAL 55, N/M jours et totaux non exhaustifs dits', async () => {
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v4'
        ? {
            data: v4Envelope(freshDate, {
              total_qualifying: 1,
              days_expected: 28,
              days_present: 15,
              coverage_status: 'incomplete_days',
            }),
            error: null,
          }
        : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product!.data_confidence).toBe(55);
    expect(product!.reason).toMatch(/\(15\/28 jours\)/);
    expect(product!.reason).toMatch(/jours GSC manquants/);
    expect(product!.reason).toMatch(/Liste non exhaustive/);
    expect(product!.reason).not.toMatch(/Liste complète/);
  });

  it('v4 annonçant un autre grain que page_totals → fidélité inconnue, PARTIAL 55', async () => {
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v4'
        ? { data: v4Envelope(freshDate, { grain: 'pages' }), error: null }
        : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product!.data_confidence).toBe(55);
    expect(product!.reason).toMatch(/fidélité du grain pages inconnue/);
  });

  it('v4 : grain page non récupéré sur un jour commité (coverage_gap) → PARTIAL 55, dit comme tel', async () => {
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v4'
        ? {
            data: v4Envelope(freshDate, {
              retrieval_status: 'gap',
              retrieval_gap_dates: ['2026-08-20'],
              coverage_status: 'coverage_gap',
            }),
            error: null,
          }
        : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const queue = await makeService(supabase).computeActionQueue(
      [],
      [],
      'full',
    );
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product!.data_confidence).toBe(55);
    expect(product!.reason).toMatch(/grain page non récupéré/);
  });

  it('v4 sans impression commitée (insufficient_data) ou sans statut publié → jamais CERTIFIED', async () => {
    const freshDate = daysAgo(2);
    for (const over of [
      { coverage_status: 'insufficient_data' },
      { coverage_status: undefined },
      { coverage_status: null },
    ]) {
      const supabase = seoSupabase((name) =>
        name === 'rpc_seo_low_ctr_v4'
          ? { data: v4Envelope(freshDate, over), error: null }
          : { data: null, error: { message: `unexpected call to ${name}` } },
      );
      const queue = await makeService(supabase).computeActionQueue(
        [],
        [],
        'full',
      );
      const product = queue.find((a) => a.id === 'seo:opportunity:product');
      expect(product!.data_confidence).toBe(55);
    }
  });

  it('v4 : un écart d’agrégation GSC fort (ratios ≪ 1) ne décide pas du statut — jours commités et grain récupéré → CERTIFIED', async () => {
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v4'
        ? {
            data: v4Envelope(freshDate, {
              gsc_aggregation: {
                page_vs_property_clicks_ratio: 0.5,
                page_vs_property_impressions_ratio: 0.6,
                blocking: false,
              },
            }),
            error: null,
          }
        : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const queue = await makeService(supabase).computeActionQueue(
      [],
      [],
      'full',
    );
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product!.data_confidence).toBe(90);
  });

  it('repli v3 annonçant grain page_totals et coverage ok : reste lossy → PARTIAL 55 (un repli ne se présente pas comme certifié)', async () => {
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v3'
        ? {
            data: {
              rows: [gscRow],
              total_qualifying: 1,
              data_from: '2026-06-01',
              data_to: freshDate,
              last_data_date: freshDate,
              grain: 'page_totals',
              days_expected: 90,
              days_present: 90,
              coverage_status: 'ok',
            },
            error: null,
          }
        : {
            data: null,
            error: { message: `function ${name} does not exist` },
          },
    );
    const queue = await makeService(supabase).computeActionQueue(
      [],
      [],
      'full',
    );
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product!.data_confidence).toBe(55);
    expect(product!.reason).toMatch(/grain pages non exhaustif/);
  });

  it('v4 absente → repli v3 EXPLICITE (sans les params v4) : grain lossy → PARTIAL 55 même frais et couvert', async () => {
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v3'
        ? {
            data: {
              rows: [gscRow],
              total_qualifying: 1,
              data_from: '2026-06-01',
              data_to: freshDate,
              last_data_date: freshDate,
              coverage_status: 'ok',
            },
            error: null,
          }
        : {
            data: null,
            error: { message: `function ${name} does not exist` },
          },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product!.action_type).toBe('business');
    expect(product!.data_confidence).toBe(55);
    expect(product!.reason).toMatch(/grain pages non exhaustif/);
    expect(product!.reason).toMatch(/Liste non exhaustive/);
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'rpc_seo_low_ctr_v3', {
      p_window_days: 120,
      p_min_impressions: 50,
      p_max_ctr: 0,
      p_limit: 50,
    });
  });

  it('v2 envelope (v4/v3 absentes) → meta wired mais grain requêtes lossy : fresh = PARTIAL 55, cap + real coverage in reason', async () => {
    // Changement délibéré (2026-09-11) : ce cas valait CERTIFIED 90 alors que le grain
    // sommé restitue ~7 % des clics (mesure API) — le 90 ne vaut plus que pour v4.
    const freshDate = daysAgo(2);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v2'
        ? {
            data: {
              rows: [gscRow],
              total_qualifying: 147,
              data_from: '2026-04-01',
              data_to: freshDate,
              last_data_date: freshDate,
            },
            error: null,
          }
        : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product).toBeDefined();
    expect(product!.action_type).toBe('business');
    expect(product!.data_confidence).toBe(55);
    expect(product!.title).toMatch(/top 1/); // 147 qualifying > 1 shown → cap disclosed
    expect(product!.reason).toMatch(/147 pages qualifiantes/);
    expect(product!.reason).toMatch(new RegExp(`2026-04-01 au ${freshDate}`));
    expect(product!.reason).toMatch(/grain pages non exhaustif/);
  });

  it('v2 stale ingestion → business action survives at PARTIAL (55), staleness said out loud', async () => {
    const staleDate = daysAgo(20);
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v2'
        ? {
            data: {
              rows: [gscRow],
              total_qualifying: 1,
              data_from: '2026-04-01',
              data_to: staleDate,
              last_data_date: staleDate,
            },
            error: null,
          }
        : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product).toBeDefined();
    expect(product!.data_confidence).toBe(55);
    expect(product!.reason).toMatch(/fraîcheur GSC dégradée/i);
  });

  it('v2 unavailable → EXPLICIT v1 fallback: confidence degraded to 55, unknown coverage said out loud', async () => {
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v1'
        ? { data: [gscRow], error: null }
        : {
            data: null,
            error: { message: 'function rpc_seo_low_ctr_v2 does not exist' },
          },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product).toBeDefined();
    expect(product!.action_type).toBe('business'); // 55 ≥ floor 40 — survives flagged « prudence »
    expect(product!.data_confidence).toBe(55);
    expect(product!.reason).toMatch(/total qualifiant inconnu/i);
    expect(product!.reason).toMatch(
      /Couverture réelle des données GSC inconnue/,
    );
  });

  it('v2 returns a v1-style ARRAY (invalid envelope) → explicit v1 fallback at PARTIAL', async () => {
    const supabase = seoSupabase((name) =>
      name === 'rpc_seo_low_ctr_v2'
        ? { data: [gscRow], error: null } // array, no .rows envelope
        : name === 'rpc_seo_low_ctr_v1'
          ? { data: [gscRow], error: null }
          : { data: null, error: { message: `unexpected call to ${name}` } },
    );
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    const product = queue.find((a) => a.id === 'seo:opportunity:product');
    expect(product).toBeDefined();
    expect(product!.data_confidence).toBe(55); // meta unknown → PARTIAL, no fake 90
    expect(product!.reason).toMatch(/total qualifiant inconnu/i);
  });

  it('freshness boundary is calendar-day based: 7 days ago = fresh (90), 8 days ago = stale (55)', async () => {
    // Enveloppe v4 certifiable par ailleurs : seule la fraîcheur fait basculer.
    for (const [lag, expected] of [
      [7, 90],
      [8, 55],
    ] as const) {
      const d = daysAgo(lag);
      const supabase = seoSupabase((name) =>
        name === 'rpc_seo_low_ctr_v4'
          ? { data: v4Envelope(d, { total_qualifying: 1 }), error: null }
          : { data: null, error: { message: `unexpected call to ${name}` } },
      );
      const service = makeService(supabase);
      const queue = await service.computeActionQueue([], [], 'full');
      const product = queue.find((a) => a.id === 'seo:opportunity:product');
      expect(product!.data_confidence).toBe(expected);
    }
  });

  it('v4, v3, v2 AND v1 broken → honest sourceUnavailable certification, never business', async () => {
    const supabase = seoSupabase(() => ({
      data: null,
      error: { message: 'boom' },
    }));
    const service = makeService(supabase);
    const queue = await service.computeActionQueue([], [], 'full');
    expect(queue.find((a) => a.id === 'unavailable:seo')).toBeDefined();
    expect(queue.some((a) => a.id.startsWith('seo:opportunity:'))).toBe(false);
  });
});
