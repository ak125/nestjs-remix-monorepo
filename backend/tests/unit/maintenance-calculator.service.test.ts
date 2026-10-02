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
import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MaintenanceCalculatorService } from '../../src/modules/diagnostic-engine/services/maintenance-calculator.service';
import { DiagnosticContentService } from '../../src/modules/diagnostic-engine/services/diagnostic-content.service';

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
      get: jest.fn(
        (key: string) =>
          ({
            SUPABASE_URL: 'http://mock',
            SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
          })[key],
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCalculatorService,
        { provide: ConfigService, useValue: mockConfig },
        {
          provide: DiagnosticContentService,
          useValue: { getControlesMensuels: jest.fn().mockReturnValue(null) },
        },
      ],
    }).compile();

    service = module.get(MaintenanceCalculatorService);
    // Override the protected callRpc method (gate-aware wrapper from
    // SupabaseBaseService) — RPC Safety Gate compliant.
    (service as unknown as { callRpc: typeof mockRpc }).callRpc = mockRpc;
    // The auto_type row read that resolves and validates the type.
    const typeQuery = {
      select: jest.fn(() => typeQuery),
      eq: jest.fn(() => typeQuery),
      maybeSingle: jest
        .fn()
        .mockResolvedValue({ data: { type_fuel: 'Essence' }, error: null }),
    };
    (service as unknown as { supabase: unknown }).supabase = {
      from: jest.fn(() => typeQuery),
    };
  });

  describe('getSchedule()', () => {
    it('calls kg_get_smart_maintenance_schedule with type_id, current_km and the fuel of the type', async () => {
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
          p_fuel_type: 'Essence',
        }),
        expect.objectContaining({ source: 'internal' }),
      );
      expect(items).toHaveLength(1);
      expect(items[0].maintenance_priority).toBe('critique');
    });

    it('passes fuel_type override when provided', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await expect(service.getSchedule(null, 0, 'diesel')).resolves.toEqual([]);

      expect(mockRpc).toHaveBeenCalledWith(
        'kg_get_smart_maintenance_schedule',
        expect.objectContaining({ p_fuel_type: 'diesel' }),
        expect.objectContaining({ source: 'internal' }),
      );
    });
  });

  describe('getAlerts()', () => {
    it('leaves the default milestones to the RPC when none provided', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          { milestone_km: 10000, actions: [] },
          { milestone_km: 30000, actions: [{ rule_alias: 'vidange-essence', rule_label: 'Vidange moteur essence', maintenance_priority: 'important', km_interval: 15000 }] },
          { milestone_km: 60000, actions: [] },
          { milestone_km: 100000, actions: [{ rule_alias: 'distribution', rule_label: 'Distribution', maintenance_priority: 'important', km_interval: 100000 }] },
          { milestone_km: 150000, actions: [] },
        ],
        error: null,
      });

      const alerts = await service.getAlerts();

      // p_milestones is omitted so the RPC's own DEFAULT applies; the service
      // keeps no copy of it.
      expect(mockRpc).toHaveBeenCalledWith(
        'kg_get_maintenance_alerts_by_milestone',
        { p_fuel_type: null },
        expect.objectContaining({ source: 'internal' }),
      );
      expect(alerts).toHaveLength(5);
    });

    it('accepts custom milestones array', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await expect(service.getAlerts('essence', [50000])).resolves.toEqual([]);

      expect(mockRpc).toHaveBeenCalledWith(
        'kg_get_maintenance_alerts_by_milestone',
        expect.objectContaining({
          p_milestones: [50000],
          p_fuel_type: 'essence',
        }),
        expect.objectContaining({ source: 'internal' }),
      );
    });
  });

  describe.each(['schedule', 'alerts'] as const)(
    '%s availability',
    (source) => {
      it.each([
        [
          'RPC error',
          { data: null, error: { message: 'private database detail' } },
        ],
        ['absent data without RPC error', { data: null, error: null }],
      ])(
        'rejects %s with a public HTTP 503 error',
        async (_reason, response) => {
          mockRpc.mockResolvedValueOnce(response);

          const request =
            source === 'schedule'
              ? service.getSchedule(12345, 80000)
              : service.getAlerts();
          const failure = await request.catch((error: unknown) => error);

          expect(failure).toBeInstanceOf(ServiceUnavailableException);
          if (!(failure instanceof ServiceUnavailableException)) {
            throw new Error('Expected an unavailable maintenance source');
          }
          expect(failure.getStatus()).toBe(503);
          expect(JSON.stringify(failure.getResponse())).not.toContain(
            'private database detail',
          );
          expect(JSON.stringify(failure.getResponse())).not.toContain(
            'kg_get_',
          );
        },
      );
    },
  );
});
