/**
 * MaintenanceCalculatorService.getCalendar() Unit Tests
 *
 * ADR-032 D9 — endpoint agrégé pour calendrier-entretien.tsx.
 * Vérifie l'agrégation : schedule + alerts + controles_mensuels (wiki).
 *
 * @see backend/src/modules/diagnostic-engine/services/maintenance-calculator.service.ts
 */
import {
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MaintenanceCalculatorService } from '../../src/modules/diagnostic-engine/services/maintenance-calculator.service';
import { DiagnosticContentService } from '../../src/modules/diagnostic-engine/services/diagnostic-content.service';

describe('MaintenanceCalculatorService.getCalendar() (ADR-032 D9)', () => {
  let service: MaintenanceCalculatorService;
  let mockRpc: jest.Mock;
  let mockGetControles: jest.Mock;
  let mockFrom: jest.Mock;
  let mockEq: jest.Mock;
  let mockTypeRow: jest.Mock;

  beforeEach(async () => {
    mockRpc = jest.fn();
    mockGetControles = jest.fn();
    // Only the auto_type row read is replaced: resolution runs as in prod.
    mockTypeRow = jest
      .fn()
      .mockResolvedValue({ data: { type_fuel: 'Essence' }, error: null });
    const typeQuery = {
      select: jest.fn(() => typeQuery),
      eq: jest.fn(() => typeQuery),
      maybeSingle: mockTypeRow,
    };
    mockEq = typeQuery.eq;
    mockFrom = jest.fn(() => typeQuery);

    const mockConfig = {
      getOrThrow: jest.fn(() => 'mock'),
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
          useValue: { getControlesMensuels: mockGetControles },
        },
      ],
    }).compile();

    service = module.get(MaintenanceCalculatorService);
    (service as unknown as { callRpc: typeof mockRpc }).callRpc = mockRpc;
    (service as unknown as { supabase: unknown }).supabase = {
      from: mockFrom,
    };
  });

  it('aggregates schedule + alerts + controles_mensuels into one payload', async () => {
    // First RPC call : kg_get_smart_maintenance_schedule
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
    // Second RPC : kg_get_maintenance_alerts_by_milestone
    mockRpc.mockResolvedValueOnce({
      data: [
        { milestone_km: 10000, actions: [] },
        { milestone_km: 30000, actions: [{ rule_alias: 'vidange-essence', rule_label: 'Vidange moteur essence', maintenance_priority: 'important', km_interval: 15000 }] },
        { milestone_km: 60000, actions: [] },
        { milestone_km: 100000, actions: [] },
        { milestone_km: 150000, actions: [] },
      ],
      error: null,
    });
    mockGetControles.mockReturnValue({
      slug: 'controles-mensuels',
      title: 'Contrôles mensuels',
      entity_data: {
        items: [
          { element: "Niveau d'huile moteur", icon: 'Droplets', detail: '...' },
          { element: 'Pression des pneus', icon: 'Gauge', detail: '...' },
        ],
      },
      body: '',
    });

    const calendar = await service.getCalendar(12345, 80000);

    expect(calendar.type_id).toBe(12345);
    expect(calendar.current_km).toBe(80000);
    expect(calendar.schedule).toHaveLength(1);
    expect(calendar.alerts).toHaveLength(5);
    expect(calendar.controles_mensuels).toHaveLength(2);
    expect(calendar.controles_mensuels[0].element).toContain('huile');
  });

  it('returns null controles_mensuels when wiki content is missing (absence is not an empty list)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockGetControles.mockReturnValue(null);

    const calendar = await service.getCalendar(null, 0);

    expect(calendar.controles_mensuels).toBeNull();
    expect(calendar.schedule).toEqual([]);
    expect(calendar.alerts).toEqual([]);
  });

  it('forwards fuel_type to both RPCs', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockGetControles.mockReturnValue(null);

    await service.getCalendar(null, 50000, 'diesel');

    expect(mockRpc).toHaveBeenCalledWith(
      'kg_get_smart_maintenance_schedule',
      expect.objectContaining({ p_fuel_type: 'diesel' }),
      expect.any(Object),
    );
    expect(mockRpc).toHaveBeenCalledWith(
      'kg_get_maintenance_alerts_by_milestone',
      expect.objectContaining({ p_fuel_type: 'diesel' }),
      expect.any(Object),
    );
  });

  describe('schedule and milestones filter on one resolved fuel', () => {
    const fuelSentTo = (rpc: string) =>
      mockRpc.mock.calls.find(([name]) => name === rpc)?.[1]?.p_fuel_type;

    beforeEach(() => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      mockGetControles.mockReturnValue(null);
    });

    it('uses the fuel of the type when the caller gives none', async () => {
      mockTypeRow.mockResolvedValue({
        data: { type_fuel: 'Diesel-Électrique' },
        error: null,
      });

      const calendar = await service.getCalendar(42, null);

      expect(mockFrom).toHaveBeenCalledWith('auto_type');
      expect(mockEq).toHaveBeenCalledWith('type_id', '42');
      expect(fuelSentTo('kg_get_smart_maintenance_schedule')).toBe(
        'Diesel-Électrique',
      );
      expect(fuelSentTo('kg_get_maintenance_alerts_by_milestone')).toBe(
        'Diesel-Électrique',
      );
      expect(calendar.fuel_type).toBe('Diesel-Électrique');
    });

    it('lets an explicit fuel win over the fuel of the type it validates', async () => {
      const calendar = await service.getCalendar(42, null, 'diesel');

      expect(mockEq).toHaveBeenCalledWith('type_id', '42');
      expect(fuelSentTo('kg_get_smart_maintenance_schedule')).toBe('diesel');
      expect(fuelSentTo('kg_get_maintenance_alerts_by_milestone')).toBe(
        'diesel',
      );
      expect(calendar.fuel_type).toBe('diesel');
    });

    it('rejects a type absent from auto_type instead of a generic calendar', async () => {
      mockTypeRow.mockResolvedValue({ data: null, error: null });

      await expect(service.getCalendar(999999, null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockGetControles).not.toHaveBeenCalled();
    });

    it('reads the type once for the schedule and the milestones', async () => {
      await service.getCalendar(42, 80000);

      expect(mockTypeRow).toHaveBeenCalledTimes(1);
    });

    it('is unavailable, not unfiltered, when the type cannot be read', async () => {
      mockTypeRow.mockResolvedValue({
        data: null,
        error: { message: 'private database detail' },
      });

      const error = await service
        .getCalendar(42, null)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(JSON.stringify(error)).not.toContain('private database detail');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  it.each([
    'kg_get_smart_maintenance_schedule',
    'kg_get_maintenance_alerts_by_milestone',
  ])(
    'propagates unavailability from %s instead of a partial calendar',
    async (failedRpc) => {
      mockRpc.mockImplementation(async (rpc: string) =>
        rpc === failedRpc
          ? { data: null, error: { message: 'private database detail' } }
          : { data: [], error: null },
      );

      await expect(service.getCalendar(12345, 80000)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(mockGetControles).not.toHaveBeenCalled();
    },
  );
});
