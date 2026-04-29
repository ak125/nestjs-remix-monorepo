/**
 * MaintenanceCalculatorService.getCalendar() Unit Tests
 *
 * ADR-032 D9 — endpoint agrégé pour calendrier-entretien.tsx.
 * Vérifie l'agrégation : schedule + alerts + controles_mensuels (wiki).
 *
 * @see backend/src/modules/diagnostic-engine/services/maintenance-calculator.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MaintenanceCalculatorService } from '../../src/modules/diagnostic-engine/services/maintenance-calculator.service';
import { DiagnosticContentService } from '../../src/modules/diagnostic-engine/services/diagnostic-content.service';

describe('MaintenanceCalculatorService.getCalendar() (ADR-032 D9)', () => {
  let service: MaintenanceCalculatorService;
  let mockRpc: jest.Mock;
  let mockGetControles: jest.Mock;

  beforeEach(async () => {
    mockRpc = jest.fn();
    mockGetControles = jest.fn();

    const mockConfig = {
      getOrThrow: jest.fn(() => 'mock'),
      get: jest.fn(),
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
        { milestone_km: 30000, actions: [{ rule_alias: 'vidange-essence' }] },
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
          { element: 'Niveau d\'huile moteur', icon: 'Droplets', detail: '...' },
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

  it('returns empty controles_mensuels when wiki content missing (graceful)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockGetControles.mockReturnValue(null);

    const calendar = await service.getCalendar(null, 0);

    expect(calendar.controles_mensuels).toEqual([]);
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
});
