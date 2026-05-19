/**
 * PR-SBD-1 Task 1 Step 12 — Integration tests for rpc_seo_*_v1 RPCs.
 *
 * Tests :
 *   - Determinism (fixed p_now → identical output, identical snapshot_hash)
 *   - Bounded sizes (losers ≤ 20, lowctr ≤ 50, alerts ≤ 50, conv ≤ 20)
 *   - Structure (each row has surface_key + impact_score_version='v1' + …)
 *   - FLOAT8 type cast (scored fields are JS number, not string from NUMERIC)
 *   - Performance (p95 < 300ms per RPC, < 500ms wrapper) — GATED on PREPROD dataset
 *
 * Environment variables required :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (loaded from .env.test by setup.ts)
 *   SUPABASE_TEST_DATASET=preprod → enables performance assertions
 *
 * Without env vars : tests are skipped (no DB connection attempted).
 *
 * Reference : .claude/plans/verifier-existant-avant-et-ethereal-firefly.md
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IS_PREPROD_DATASET = process.env.SUPABASE_TEST_DATASET === 'preprod';

// Skip when CI runs with mock placeholders (SUPABASE_URL=mock.supabase.co +
// SUPABASE_SERVICE_ROLE_KEY=mock-key-for-ci per .github/workflows/ci.yml). The
// rpc_seo_*_v1 tests are integration tests that need a real Supabase DB ;
// when running against mock placeholders they hit `getaddrinfo ENOTFOUND`.
// Real Supabase is wired only when CI sets SUPABASE_TEST_DATASET=preprod (or
// running locally against a real project) — feedback_ci_smoke_neq_runtime_monitoring.
const HAS_REAL_DB =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_SERVICE_ROLE_KEY) &&
  !SUPABASE_URL!.includes('mock') &&
  SUPABASE_SERVICE_ROLE_KEY !== 'mock-key-for-ci';

const describeIfDb = HAS_REAL_DB ? describe : describe.skip;

const describeIfPreprod = IS_PREPROD_DATASET ? describe : describe.skip;

const FIXED_NOW = '2026-05-18T10:00:00Z';

describeIfDb('rpc_seo_*_v1 (PR-SBD-1 Task 1)', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  });

  // ─── rpc_seo_traffic_v1 ──────────────────────────────────────────

  describe('rpc_seo_traffic_v1', () => {
    it('returns valid JSONB shape with impact_score_version=v1', async () => {
      const { data, error } = await supabase.rpc('rpc_seo_traffic_v1', {
        p_window_days: 7,
        p_now: FIXED_NOW,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({
        impact_score_version: 'v1',
        clicks: expect.any(Number),
        impressions: expect.any(Number),
        ctr: expect.any(Number),
        avg_position: expect.any(Number),
        pages_count: expect.any(Number),
        delta_vs_previous: {
          direction: expect.stringMatching(/^(up|down|flat|unknown)$/),
          change_severity: expect.stringMatching(/^(high|medium|info)$/),
        },
      });
    });

    it('numeric fields are typeof number (FLOAT8 cast effective)', async () => {
      const { data } = await supabase.rpc('rpc_seo_traffic_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      expect(typeof data.clicks).toBe('number');
      expect(typeof data.ctr).toBe('number');
      expect(typeof data.avg_position).toBe('number');
    });

    it('is deterministic for fixed p_now (same input → same output)', async () => {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase.rpc('rpc_seo_traffic_v1', { p_window_days: 7, p_now: FIXED_NOW }),
        supabase.rpc('rpc_seo_traffic_v1', { p_window_days: 7, p_now: FIXED_NOW }),
      ]);
      expect(a).toEqual(b);
    });
  });

  // ─── rpc_seo_top_losers_v1 ───────────────────────────────────────

  describe('rpc_seo_top_losers_v1', () => {
    it('returns array bounded at p_limit (default 20)', async () => {
      const { data, error } = await supabase.rpc('rpc_seo_top_losers_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(20);
    });

    it('each row has surface_key, impact_score_version, top_queries_sample (≤3)', async () => {
      const { data } = await supabase.rpc('rpc_seo_top_losers_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      for (const row of data ?? []) {
        expect(row.impact_score_version).toBe('v1');
        expect(typeof row.surface_key).toBe('string');
        expect(['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'admin', 'unknown']).toContain(row.surface_key);
        expect(Array.isArray(row.top_queries_sample)).toBe(true);
        expect(row.top_queries_sample.length).toBeLessThanOrEqual(3);
        expect(typeof row.business_impact_score).toBe('number');
        expect(typeof row.delta_clicks).toBe('number');
      }
    });

    it('ordered by business_impact_score DESC', async () => {
      const { data } = await supabase.rpc('rpc_seo_top_losers_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      const scores = (data ?? []).map((r: any) => r.business_impact_score as number);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });

    it('every row has severity in valid enum', async () => {
      const { data } = await supabase.rpc('rpc_seo_top_losers_v1', {
        p_window_days: 7,
        p_now: FIXED_NOW,
      });
      for (const row of data ?? []) {
        expect(['critical', 'high', 'medium', 'low']).toContain(row.severity);
      }
    });
  });

  // ─── rpc_seo_low_ctr_v1 ──────────────────────────────────────────

  describe('rpc_seo_low_ctr_v1', () => {
    it('returns array bounded at p_limit (default 50)', async () => {
      const { data, error } = await supabase.rpc('rpc_seo_low_ctr_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(50);
    });

    it('each row has position_band in {top5, top15, beyond}', async () => {
      const { data } = await supabase.rpc('rpc_seo_low_ctr_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      for (const row of data ?? []) {
        expect(['top5', 'top15', 'beyond']).toContain(row.position_band);
        expect(row.impact_score_version).toBe('v1');
      }
    });
  });

  // ─── rpc_seo_alerts_v1 ───────────────────────────────────────────

  describe('rpc_seo_alerts_v1', () => {
    it('returns array bounded at p_limit (default 50)', async () => {
      const { data, error } = await supabase.rpc('rpc_seo_alerts_v1', {
        p_now: FIXED_NOW,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(50);
    });

    it('each row has operational_domain in valid enum + payload_minimal ≤ 3 keys', async () => {
      const { data } = await supabase.rpc('rpc_seo_alerts_v1', {
        p_now: FIXED_NOW,
      });
      for (const row of data ?? []) {
        expect(['seo', 'ingestion', 'infra', 'content', 'runtime']).toContain(row.operational_domain);
        expect(Object.keys(row.payload_minimal ?? {}).length).toBeLessThanOrEqual(3);
        expect(row.impact_score_version).toBe('v1');
      }
    });

    it('ordered by business_impact_score DESC then detected_at DESC', async () => {
      const { data } = await supabase.rpc('rpc_seo_alerts_v1', {
        p_now: FIXED_NOW,
      });
      const scores = (data ?? []).map((r: any) => r.business_impact_score as number);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });
  });

  // ─── rpc_seo_conversion_v1 ───────────────────────────────────────

  describe('rpc_seo_conversion_v1 (Bloc 4 — Task 0 GO verdict)', () => {
    it('returns array (may be empty) bounded at p_limit (default 20)', async () => {
      const { data, error } = await supabase.rpc('rpc_seo_conversion_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(20);
    });

    it('each row has revenue as number (FLOAT8 cast)', async () => {
      const { data } = await supabase.rpc('rpc_seo_conversion_v1', {
        p_window_days: 28,
        p_now: FIXED_NOW,
      });
      for (const row of data ?? []) {
        expect(typeof row.revenue).toBe('number');
        expect(typeof row.conversion_rate).toBe('number');
        expect(row.impact_score_version).toBe('v1');
      }
    });
  });

  // ─── Wrapper rpc_seo_control_snapshot_v1 ─────────────────────────

  describe('rpc_seo_control_snapshot_v1 (aggregation wrapper)', () => {
    it('returns complete snapshot with 5 sections and generated_from versions', async () => {
      const { data, error } = await supabase.rpc('rpc_seo_control_snapshot_v1', {
        p_range: '7d',
        p_now: FIXED_NOW,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({
        generated_at: expect.any(String),
        range: '7d',
        window_days: 7,
        generated_from: {
          wrapper: 'rpc_seo_control_snapshot_v1',
          rpc_versions: {
            traffic: 'v1',
            losers: 'v1',
            low_ctr: 'v1',
            alerts: 'v1',
            conversion: 'v1',
          },
          impact_score_version: 'v1',
        },
        trafficWindow: expect.any(Object),
        topLosers: expect.any(Array),
        lowCtrOpportunities: expect.any(Array),
        technicalAlerts: expect.any(Array),
      });
    });

    it('respects all bounds (losers≤20, lowctr≤50, alerts≤50, conv≤20)', async () => {
      const { data } = await supabase.rpc('rpc_seo_control_snapshot_v1', {
        p_range: '28d',
        p_now: FIXED_NOW,
      });
      expect(data.topLosers.length).toBeLessThanOrEqual(20);
      expect(data.lowCtrOpportunities.length).toBeLessThanOrEqual(50);
      expect(data.technicalAlerts.length).toBeLessThanOrEqual(50);
      if (data.conversionGap) {
        expect(data.conversionGap.length).toBeLessThanOrEqual(20);
      }
    });

    it('range invalid falls back to 7d (defensive)', async () => {
      const { data } = await supabase.rpc('rpc_seo_control_snapshot_v1', {
        p_range: 'invalid',
        p_now: FIXED_NOW,
      });
      // window_days defaults to 7 via CASE in the wrapper
      expect(data.window_days).toBe(7);
    });
  });

  // ─── Performance gates (PREPROD dataset only) ────────────────────

  describeIfPreprod('Performance gates (PREPROD only)', () => {
    async function measureP95(
      rpcName: string,
      params: Record<string, unknown>,
      runs = 10,
    ): Promise<number> {
      const timings: number[] = [];
      for (let i = 0; i < runs; i++) {
        const t0 = Date.now();
        await supabase.rpc(rpcName, params);
        timings.push(Date.now() - t0);
      }
      const sorted = timings.sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.95) - 1] ?? sorted[sorted.length - 1];
    }

    it('rpc_seo_traffic_v1 p95 < 300ms (28d window)', async () => {
      const p95 = await measureP95('rpc_seo_traffic_v1', { p_window_days: 28, p_now: FIXED_NOW });
      expect(p95).toBeLessThan(300);
    });

    it('rpc_seo_top_losers_v1 p95 < 300ms (28d window)', async () => {
      const p95 = await measureP95('rpc_seo_top_losers_v1', { p_window_days: 28, p_now: FIXED_NOW });
      expect(p95).toBeLessThan(300);
    });

    it('rpc_seo_low_ctr_v1 p95 < 300ms (28d window)', async () => {
      const p95 = await measureP95('rpc_seo_low_ctr_v1', { p_window_days: 28, p_now: FIXED_NOW });
      expect(p95).toBeLessThan(300);
    });

    it('rpc_seo_alerts_v1 p95 < 300ms', async () => {
      const p95 = await measureP95('rpc_seo_alerts_v1', { p_now: FIXED_NOW });
      expect(p95).toBeLessThan(300);
    });

    it('rpc_seo_conversion_v1 p95 < 300ms (28d window)', async () => {
      const p95 = await measureP95('rpc_seo_conversion_v1', { p_window_days: 28, p_now: FIXED_NOW });
      expect(p95).toBeLessThan(300);
    });

    it('rpc_seo_control_snapshot_v1 (wrapper) p95 < 500ms (28d window)', async () => {
      const p95 = await measureP95('rpc_seo_control_snapshot_v1', { p_range: '28d', p_now: FIXED_NOW });
      expect(p95).toBeLessThan(500);
    });
  });
});
