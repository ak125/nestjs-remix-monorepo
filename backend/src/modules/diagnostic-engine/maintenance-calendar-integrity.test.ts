import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { MaintenanceCalculatorService } from './services/maintenance-calculator.service';

const interval = {
  rule_alias: 'vidange-essence',
  rule_label: 'Vidange moteur essence',
  km_interval: 15000,
  month_interval: 12,
  maintenance_priority: 'critique',
  applies_to_fuel: 'essence',
  km_remaining: 0,
  status: 'overdue',
};
function fixture() {
  // Only the remote boundaries (RPCs, auto_type row) are replaced;
  // calculation and controller run.
  const service = Object.create(
    MaintenanceCalculatorService.prototype,
  ) as MaintenanceCalculatorService;
  const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
  const typeRow = jest
    .fn()
    .mockResolvedValue({ data: { type_fuel: 'Essence' }, error: null });
  const typeQuery = {
    select: () => typeQuery,
    eq: () => typeQuery,
    maybeSingle: typeRow,
  };
  Object.assign(service, {
    callRpc: rpc,
    supabase: { from: () => typeQuery },
    logger: { error: jest.fn() },
    diagnosticContent: { getControlesMensuels: () => null },
  });
  const controller = new DiagnosticEngineController(
    {} as never,
    {} as never,
    service,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, controller, rpc, typeRow };
}

describe('calendar does not infer maintenance history from the odometer', () => {
  test.each(['ok', 'due_soon', 'overdue', 'time_only'])(
    'neutralizes the legacy %s assessment without losing intervals',
    async (status) => {
      const { service, rpc } = fixture();
      rpc.mockResolvedValue({ data: [{ ...interval, status }], error: null });
      const schedule = await service.getSchedule(123, 80000);
      expect(schedule).toEqual([
        {
          ...interval,
          status: 'unknown',
          km_remaining: null,
          status_reason: 'maintenance_history_missing',
          applicability: 'unverified',
        },
      ]);
    },
  );
  test('calendar carries the same unknown status at zero km and exposes generic scope', async () => {
    const { controller, rpc } = fixture();
    rpc.mockImplementation(async (name: string) => ({
      data: name === 'kg_get_smart_maintenance_schedule' ? [interval] : [],
      error: null,
    }));
    const calendar = await controller.maintenanceCalendar(undefined, '0');
    expect(calendar).toMatchObject({
      current_km: 0,
      assessment_basis: 'generic_intervals',
      applicability: 'unverified',
      schedule: [{ status: 'unknown', km_remaining: null }],
    });
  });
  test.each(['maintenanceSchedule', 'maintenanceCalendar'] as const)(
    '%s reports an absent mileage as unknown instead of zero',
    async (endpoint) => {
      const { controller, rpc } = fixture();
      const result = await controller[endpoint]();
      expect(result.current_km).toBeNull();
      expect(rpc).toHaveBeenCalledWith(
        'kg_get_smart_maintenance_schedule',
        { p_type_id: null, p_fuel_type: null },
        { source: 'internal' },
      );
    },
  );
});

describe('monthly checks distinguish unavailable content from an empty list', () => {
  const item = { element: 'Pneus', icon: 'Gauge', detail: 'Pression' };
  test.each([
    ['a valid list', { entity_data: { items: [item] } }, [item]],
    ['an empty list', { entity_data: { items: [] } }, []],
  ])('returns %s as provided', async (_, entry, expected) => {
    const { service } = fixture();
    Object.assign(service, {
      diagnosticContent: { getControlesMensuels: () => entry },
    });
    const calendar = await service.getCalendar(null, null);
    expect(calendar.controles_mensuels).toEqual(expected);
  });
  test('returns null for a missing file, which the content service logs', async () => {
    const { service } = fixture();
    const calendar = await service.getCalendar(null, null);
    expect(calendar.controles_mensuels).toBeNull();
    expect(calendar.schedule).toEqual([]);
  });
  test.each([
    ['without items', { entity_data: {} }],
    [
      'with a malformed item',
      { entity_data: { items: [{ element: '', icon: 'x', detail: 'y' }] } },
    ],
  ])('returns null and logs when the content is %s', async (_, entry) => {
    const { service } = fixture();
    const logger = { error: jest.fn() };
    Object.assign(service, {
      logger,
      diagnosticContent: { getControlesMensuels: () => entry },
    });
    const calendar = await service.getCalendar(null, null);
    expect(calendar.controles_mensuels).toBeNull();
    expect(calendar.schedule).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      'Monthly checks content is malformed',
    );
  });
});

describe('calendar rejects corrupt sources instead of producing plausible output', () => {
  test.each([
    {},
    'not an array',
    [null],
    [{ ...interval, rule_alias: '' }],
    [{ ...interval, km_interval: -1 }],
    [{ ...interval, month_interval: 0 }],
    [{ ...interval, km_interval: null, month_interval: null }],
    [interval, interval],
  ])('rejects malformed schedules: %j', async (data) => {
    const { service, rpc } = fixture();
    rpc.mockResolvedValue({ data, error: null });
    await expect(service.getSchedule(null, 0)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  test.each([
    {},
    [{ milestone_km: -1, actions: [] }],
    [{ milestone_km: 30000, actions: {} }],
    [{ milestone_km: 30000, actions: [{ rule_alias: 'oil' }] }],
  ])('rejects malformed milestones: %j', async (data) => {
    const { service, rpc } = fixture();
    rpc.mockResolvedValue({ data, error: null });
    await expect(service.getAlerts()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  test('a thrown transport error is a sanitized 503', async () => {
    const { service, rpc } = fixture();
    rpc.mockRejectedValue(new Error('private transport detail'));
    const error = await service.getSchedule(null, 0).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(error)).not.toContain('private transport detail');
  });
});

describe.each(['maintenanceSchedule', 'maintenanceCalendar'] as const)(
  '%s query validation',
  (endpoint) => {
    test.each([
      '-1',
      '1.5',
      '12000km',
      'NaN',
      'Infinity',
      '2147483648',
      '',
      '1e3',
    ])('rejects invalid current_km %j before querying', async (km) => {
      const { controller, rpc } = fixture();
      await expect(controller[endpoint](undefined, km)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(rpc).not.toHaveBeenCalled();
    });
    test.each(['0', '-1', '12x', '1.5', '2147483648', '', ['1', '2']])(
      'rejects invalid type_id %j',
      async (id) => {
        const { controller, rpc } = fixture();
        await expect(controller[endpoint](id as string)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(rpc).not.toHaveBeenCalled();
      },
    );
    test.each([undefined, 'diesel'])(
      'rejects a type_id absent from auto_type (fuel %j) as not found',
      async (fuel) => {
        const { controller, rpc, typeRow } = fixture();
        typeRow.mockResolvedValue({ data: null, error: null });
        await expect(
          controller[endpoint]('999999', undefined, fuel),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(rpc).not.toHaveBeenCalled();
      },
    );
  },
);

describe('milestone query validation', () => {
  test.each([
    '',
    '10000,nope,30000',
    '-1',
    '0',
    '1.5',
    '10000,,30000',
    '10000,10000',
    '2147483648',
  ])(
    'rejects invalid milestones %j without dropping bad entries',
    async (milestones) => {
      const { controller, rpc } = fixture();
      await expect(
        controller.maintenanceAlerts(undefined, milestones),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  test('preserves valid custom order and absent defaults', async () => {
    const { controller, rpc } = fixture();
    await controller.maintenanceAlerts('diesel', '30000, 10000');
    expect(rpc).toHaveBeenLastCalledWith(
      'kg_get_maintenance_alerts_by_milestone',
      { p_fuel_type: 'diesel', p_milestones: [30000, 10000] },
      { source: 'internal' },
    );
    // Without explicit milestones the RPC default applies; it is not copied here.
    await controller.maintenanceAlerts();
    expect(rpc).toHaveBeenLastCalledWith(
      'kg_get_maintenance_alerts_by_milestone',
      { p_fuel_type: null },
      { source: 'internal' },
    );
  });
});
