/**
 * MaintenanceCalculatorService Unit Tests
 *
 * Vérifie que getSchedule() et getAlerts() appellent les bonnes RPCs avec
 * les bons paramètres. Les RPCs elles-mêmes sont créées par PR-1 (migration
 * 20260429_diag_maintenance_via_kg.sql) et testées via smoke SQL.
 *
 * Convention : Jest + mocks Supabase client (pas de connexion DB réelle).
 *
 * @see backend/src/modules/diagnostic-engine/services/maintenance-calculator.service.ts
 * @see governance-vault/ledger/decisions/adr/ADR-032-diagnostic-maintenance-unification.md
 */
// Note: jest globals (describe/it/expect/beforeEach/jest) are auto-injected
// by ts-jest preset. Pattern aligned on tests/unit/rag-proxy.service.test.ts.
// Do NOT import from '@jest/globals' (strict typing breaks
// mockResolvedValueOnce<T>() inference).
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MaintenanceCalculatorService } from '../../src/modules/diagnostic-engine/services/maintenance-calculator.service';

describe('MaintenanceCalculatorService (ADR-032 PR-2)', () => {
  let service: MaintenanceCalculatorService;
  let mockRpc: jest.Mock;

  beforeEach(async () => {
    mockRpc = jest.fn();

    const mockConfig = {
      getOrThrow: jest.fn((key: string) => {
        const config: Record<string, string> = {
          SUPABASE_URL: 'http://mock',
          SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
        };
        return config[key] ?? '';
      }),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCalculatorService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(MaintenanceCalculatorService);
    // Override the protected callRpc method (gate-aware wrapper from
    // SupabaseBaseService) — RPC Safety Gate compliant.
    (service as unknown as { callRpc: typeof mockRpc }).callRpc = mockRpc;
  });

  describe('getSchedule()', () => {
    it('calls kg_get_smart_maintenance_schedule with type_id and current_km', async () => {
      mockRpc.mockResolvedValueOnce({
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

      const items = await service.getSchedule(12345, 80000);

      expect(mockRpc).toHaveBeenCalledWith(
        'kg_get_smart_maintenance_schedule',
        expect.objectContaining({
          p_type_id: 12345,
          p_current_km: 80000,
          p_fuel_type: null,
        }),
      );
      expect(items).toHaveLength(1);
      expect(items[0].maintenance_priority).toBe('critique');
    });

    it('passes fuel_type override when provided', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await service.getSchedule(null, 0, 'diesel');

      expect(mockRpc).toHaveBeenCalledWith(
        'kg_get_smart_maintenance_schedule',
        expect.objectContaining({ p_fuel_type: 'diesel' }),
      );
    });

    it('returns empty array on RPC error (graceful degradation)', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'rpc failed' },
      });

      const items = await service.getSchedule(12345, 80000);

      expect(items).toEqual([]);
    });
  });

  describe('getAlerts()', () => {
    it('uses default 5 milestones (10k/30k/60k/100k/150k) when none provided', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { milestone_km: 10000, actions: [] },
          { milestone_km: 30000, actions: [{ rule_alias: 'vidange-essence' }] },
          { milestone_km: 60000, actions: [] },
          { milestone_km: 100000, actions: [{ rule_alias: 'distribution' }] },
          { milestone_km: 150000, actions: [] },
        ],
        error: null,
      });

      const alerts = await service.getAlerts();

      expect(mockRpc).toHaveBeenCalledWith(
        'kg_get_maintenance_alerts_by_milestone',
        expect.objectContaining({
          p_milestones: [10000, 30000, 60000, 100000, 150000],
          p_fuel_type: null,
        }),
      );
      expect(alerts).toHaveLength(5);
    });

    it('accepts custom milestones array', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await service.getAlerts('essence', [50000]);

      expect(mockRpc).toHaveBeenCalledWith(
        'kg_get_maintenance_alerts_by_milestone',
        expect.objectContaining({
          p_milestones: [50000],
          p_fuel_type: 'essence',
        }),
      );
    });
  });
});
