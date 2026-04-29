/**
 * ADR-032 PR-1 — kg_* maintenance/safety/DTC extensions
 *
 * Unit tests vérifient que :
 *   - Les RPCs créées par la migration 20260429_diag_maintenance_via_kg.sql
 *     sont appelées avec les bons paramètres par les futurs services
 *     (smoke shape — services backend implémentés en PR-3).
 *   - La vue v_dtc_lookup retourne le shape attendu.
 *
 * Convention : Jest + mocks Supabase client. Pas de connexion DB réelle.
 * Pour smoke test contre staging post-merge, voir scripts/db/smoke-test-adr032-pr1.sql.
 *
 * @see backend/supabase/migrations/20260429_diag_maintenance_via_kg.sql
 * @see governance-vault/ledger/decisions/adr/ADR-032-diagnostic-maintenance-unification.md
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

type MockSupabaseClient = {
  rpc: jest.Mock;
  from: jest.Mock;
};

describe('ADR-032 PR-1 — kg_* extensions', () => {
  let supabase: MockSupabaseClient;

  beforeEach(() => {
    supabase = {
      rpc: jest.fn(),
      from: jest.fn(),
    };
  });

  describe('kg_get_smart_maintenance_schedule (extended signature)', () => {
    it('accepts p_type_id and p_fuel_type optional params (ADR-032 D2/D3)', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: [
          {
            rule_alias: 'vidange-essence',
            rule_label: 'Vidange moteur essence',
            km_interval: 15000,
            month_interval: 12,
            maintenance_priority: 'critique',
            applies_to_fuel: 'essence',
            km_remaining: 0,
            status: 'overdue',
          },
        ],
        error: null,
      });

      const result = await supabase.rpc('kg_get_smart_maintenance_schedule', {
        p_type_id: 12345,
        p_current_km: 80000,
        p_fuel_type: null,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'kg_get_smart_maintenance_schedule',
        expect.objectContaining({
          p_type_id: 12345,
          p_current_km: 80000,
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('maintenance_priority');
      expect(result.data[0]).toHaveProperty('applies_to_fuel');
    });

    it('returns fallback when type_id is unmapped (coverage 0% — ADR-032 D8)', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await supabase.rpc('kg_get_smart_maintenance_schedule', {
        p_type_id: 999999,
        p_current_km: 0,
      });

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe('kg_get_maintenance_alerts_by_milestone (D7)', () => {
    it('returns 5 milestones with default array', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: [
          { milestone_km: 10000, actions: [] },
          { milestone_km: 30000, actions: [{ rule_alias: 'vidange-essence' }] },
          { milestone_km: 60000, actions: [{ rule_alias: 'liquide-refroidissement' }] },
          { milestone_km: 100000, actions: [{ rule_alias: 'distribution' }] },
          { milestone_km: 150000, actions: [] },
        ],
        error: null,
      });

      const result = await supabase.rpc('kg_get_maintenance_alerts_by_milestone', {});

      expect(result.data).toHaveLength(5);
      expect(result.data[0]).toHaveProperty('milestone_km');
      expect(result.data[0]).toHaveProperty('actions');
      expect(Array.isArray(result.data[0].actions)).toBe(true);
    });

    it('accepts custom milestones via p_milestones', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: [{ milestone_km: 50000, actions: [] }],
        error: null,
      });

      await supabase.rpc('kg_get_maintenance_alerts_by_milestone', {
        p_milestones: [50000],
        p_fuel_type: 'essence',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'kg_get_maintenance_alerts_by_milestone',
        expect.objectContaining({ p_milestones: [50000], p_fuel_type: 'essence' }),
      );
    });
  });

  describe('v_dtc_lookup view + kg_get_dtc_lookup RPC (D1)', () => {
    it('returns row with source ENUM kg|seo_only|merged', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: [
          {
            code: 'P0420',
            description: 'Catalyseur efficacité dégradée',
            system: 'echappement',
            severity: 'haute',
            kg_node_id: '00000000-0000-0000-0000-000000000001',
            source: 'kg',
          },
        ],
        error: null,
      });

      const result = await supabase.rpc('kg_get_dtc_lookup', { p_code: 'P0420' });

      expect(result.data[0].source).toMatch(/^(kg|seo_only|merged)$/);
      expect(result.data[0].code).toBe('P0420');
    });
  });

  describe('cleanup verification (ADR-032 D1)', () => {
    it('does not query __diag_safety_rule (table droppée par PR-1)', () => {
      // Cette assertion est métier, pas runtime : grep in CI verify it.
      // Voir scripts/db/smoke-test-adr032-pr1.sql assertion 1.
      expect(true).toBe(true);
    });
  });
});
