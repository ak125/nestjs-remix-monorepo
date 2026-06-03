import {
  SupplierTruthRepository,
  type SnapshotInsert,
  type ProjectionRow,
} from './supplier-truth.repository';

/**
 * Chainable Supabase mock that records the method chain so we can assert the
 * exact query shape — and prove the snapshot path is append-only (never
 * update/delete).
 */
function makeSupabaseMock(result: { data?: unknown; error?: unknown } = {}) {
  const calls: { m: string; args: unknown[] }[] = [];
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'insert',
      'upsert',
      'update',
      'delete',
      'eq',
      'not',
      'order',
      'limit',
    ]) {
      chain[m] = (...args: unknown[]) => {
        calls.push({ m, args });
        if (m === 'insert' || m === 'upsert') return Promise.resolve(resolved);
        return chain;
      };
    }
    chain.maybeSingle = (...args: unknown[]) => {
      calls.push({ m: 'maybeSingle', args });
      return Promise.resolve(resolved);
    };
    // make the chain awaitable (for select().eq().order().limit())
    (chain as { then: unknown }).then = (res: (v: unknown) => unknown) =>
      res(resolved);
    return chain;
  };
  const from = (table: string) => {
    calls.push({ m: 'from', args: [table] });
    return makeChain();
  };
  return { client: { from }, calls };
}

// stub ConfigService so the base constructor has dummy Supabase config (no real DB)
const cfgStub = {
  get: (k: string) =>
    (
      ({
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      }) as Record<string, string>
    )[k],
} as unknown as import('@nestjs/config').ConfigService;

function newRepo(mock: ReturnType<typeof makeSupabaseMock>) {
  const repo = new SupplierTruthRepository(cfgStub);
  // override the real client created in the base constructor with our mock
  (repo as unknown as { supabase: unknown }).supabase = mock.client;
  return repo;
}

const snap: SnapshotInsert = {
  supplier_id: '26',
  piece_id: 12345,
  raw_ref: 'SCL4123',
  normalized_ref: 'SCL4123',
  available: true,
  delay_days: null,
  parse_error: false,
  freshness_provenance: 'CONNECTOR_FETCHED',
};

const projection: ProjectionRow = {
  piece_id: 12345,
  state: 'VERIFIED_AVAILABLE',
  confidence: 85,
  delay_days: null,
  source_supplier: '26',
  conflict_kind: 'NONE',
  state_counter: 0,
  projection_reason_code: 'STATE_VERIFIED_AVAILABLE',
  projection_inputs_hash: 'abc',
  projection_version: 1,
};

describe('SupplierTruthRepository', () => {
  it('insertSnapshot uses insert into the snapshots table and NEVER update/delete (append-only)', async () => {
    const mock = makeSupabaseMock();
    await newRepo(mock).insertSnapshot(snap);
    expect(mock.calls).toContainEqual({
      m: 'from',
      args: ['supplier_inventory_snapshots'],
    });
    expect(mock.calls.some((c) => c.m === 'insert')).toBe(true);
    expect(mock.calls.some((c) => c.m === 'update' || c.m === 'delete')).toBe(
      false,
    );
  });

  it('readRecentSnapshots selects by piece_id ordered by fetched_at desc with a limit', async () => {
    const mock = makeSupabaseMock({ data: [] });
    await newRepo(mock).readRecentSnapshots(12345, 20);
    expect(mock.calls).toContainEqual({ m: 'eq', args: ['piece_id', 12345] });
    expect(mock.calls).toContainEqual({
      m: 'order',
      args: ['fetched_at', { ascending: false }],
    });
    expect(mock.calls).toContainEqual({ m: 'limit', args: [20] });
  });

  it('upsertProjection upserts on piece_id conflict', async () => {
    const mock = makeSupabaseMock();
    await newRepo(mock).upsertProjection(projection);
    expect(mock.calls).toContainEqual({
      m: 'from',
      args: ['supplier_truth_projection'],
    });
    const up = mock.calls.find((c) => c.m === 'upsert');
    expect(up?.args[1]).toEqual({ onConflict: 'piece_id' });
  });

  it('getProjection returns null when absent (caller treats as UNKNOWN)', async () => {
    const mock = makeSupabaseMock({ data: null });
    const r = await newRepo(mock).getProjection(999);
    expect(r).toBeNull();
    expect(mock.calls.some((c) => c.m === 'maybeSingle')).toBe(true);
  });

  it('getSupplierProfile returns null when none yet (cold start)', async () => {
    const mock = makeSupabaseMock({ data: null });
    const r = await newRepo(mock).getSupplierProfile('26');
    expect(r).toBeNull();
    expect(mock.calls).toContainEqual({
      m: 'from',
      args: ['supplier_runtime_profile'],
    });
  });

  it('getWorkingSet is bounded by a hard limit (anti-ban) and returns distinct refs + brand', async () => {
    const mock = makeSupabaseMock({
      data: [
        { orl_art_ref: 'SCL4123', orl_pm_id: 59 },
        { orl_art_ref: 'SCL4123', orl_pm_id: 59 },
        { orl_art_ref: ' ELH4261 ', orl_pm_id: 41 },
        { orl_art_ref: null, orl_pm_id: 1 },
      ],
    });
    const ws = await newRepo(mock).getWorkingSet(500);
    expect(mock.calls).toContainEqual({
      m: 'from',
      args: ['___xtr_order_line'],
    });
    expect(mock.calls).toContainEqual({ m: 'limit', args: [500] });
    expect(ws).toEqual([
      { ref: 'SCL4123', pmId: 59 },
      { ref: 'ELH4261', pmId: 41 }, // distinct + trimmed, null ref dropped
    ]);
  });

  it('getSupplierLinkedBrands returns the brands a supplier carries (___xtr_supplier_link_pm)', async () => {
    const mock = makeSupabaseMock({
      data: [{ slpm_pm_id: 41 }, { slpm_pm_id: 59 }, { slpm_pm_id: 41 }],
    });
    const brands = await newRepo(mock).getSupplierLinkedBrands('26');
    expect(mock.calls).toContainEqual({
      m: 'from',
      args: ['___xtr_supplier_link_pm'],
    });
    expect(mock.calls).toContainEqual({ m: 'eq', args: ['slpm_spl_id', '26'] });
    expect(brands.sort((a, b) => a - b)).toEqual([41, 59]); // distinct
  });

  it('resolveRefToPieceIds queries both ref indexes and returns distinct ids', async () => {
    const mock = makeSupabaseMock({ data: [{ prs_piece_id_i: '12345' }] });
    const ids = await newRepo(mock).resolveRefToPieceIds('SCL4123');
    expect(mock.calls).toContainEqual({
      m: 'from',
      args: ['pieces_ref_search'],
    });
    expect(mock.calls).toContainEqual({ m: 'from', args: ['pieces_ref_oem'] });
    expect(mock.calls).toContainEqual({
      m: 'eq',
      args: ['prs_search', 'SCL4123'],
    });
    expect(mock.calls).toContainEqual({
      m: 'eq',
      args: ['pro_oem_serach', 'SCL4123'],
    });
    expect(ids).toEqual([12345]);
  });
});
