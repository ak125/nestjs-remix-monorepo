import { MaintenanceIntelligenceEngine } from './maintenance-intelligence.engine';
import { AnalyzeDiagnosticInputSchema } from '../types/diagnostic-input.schema';

const op = (slug: string, extra = {}) => ({
  id: 1,
  slug,
  label: slug,
  description: null,
  interval_km_min: 15000,
  interval_km_max: 20000,
  interval_months_min: null,
  interval_months_max: null,
  severity_if_overdue: 'moderate',
  normal_wear_km_min: 10000,
  normal_wear_km_max: 15000,
  related_gamme_slug: null,
  related_pg_id: null,
  ...extra,
});
const input = (usage: unknown, mileage = 100000) =>
  AnalyzeDiagnosticInputSchema.parse({
    intent_type: 'diagnostic_symptom',
    system_scope: 'freinage',
    vehicle_context: { mileage_km: mileage },
    signal_input: { primary_signal: 'noise', signal_mode: 'symptom_slugs' },
    usage_context: usage,
  });
async function assess(
  operations: ReturnType<typeof op>[],
  usage: unknown,
  mileage = 100000,
) {
  const engine = new MaintenanceIntelligenceEngine({} as never);
  // Only the persistence boundary is mocked; assess and deadline calculation are real.
  Object.assign(engine, {
    fetchLinkedOperations: async () =>
      operations.map((operation) => ({ operation, relevance: 'primary' })),
  });
  const parsed = input(usage, mileage);
  return engine.assess(['noise'], parsed.vehicle_context, parsed.usage_context);
}

describe('operation maintenance deadlines', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  test('a global service cannot reset unrelated operations or imply wear from the total odometer', async () => {
    const result = await assess([op('oil'), op('belt')], {
      last_service_km: 99000,
    });
    expect(result.recommendations.map((r) => r.overdue_status)).toEqual([
      'unknown',
      'unknown',
    ]);
  });
  test('one operation history never resets another', async () => {
    const result = await assess([op('oil'), op('belt')], {
      maintenance_records: [{ operation_slug: 'oil', last_service_km: 99000 }],
    });
    expect(result.recommendations.map((r) => r.overdue_status)).toEqual([
      'ok',
      'unknown',
    ]);
  });
  test.each([
    [0, 0, 'ok'],
    [0, 15000, 'approaching'],
    [0, 20000, 'overdue'],
    [99000, 100000, 'ok'],
  ] as const)(
    'last %s current %s gives %s at inclusive interval boundaries',
    async (last_service_km, current, status) => {
      const result = await assess(
        [op('oil')],
        { maintenance_records: [{ operation_slug: 'oil', last_service_km }] },
        current,
      );
      expect(result.recommendations[0].overdue_status).toBe(status);
    },
  );
  test('an old date alone marks a time-only operation overdue', async () => {
    const result = await assess(
      [
        op('fluid', {
          interval_km_min: null,
          interval_km_max: null,
          interval_months_min: 12,
          interval_months_max: 24,
        }),
      ],
      {
        maintenance_records: [
          { operation_slug: 'fluid', last_service_date: '2024-03-26' },
        ],
      },
    );
    expect(result.recommendations[0].overdue_status).toBe('overdue');
  });
  test('unknown time history prevents OK despite recent mileage', async () => {
    const result = await assess(
      [op('oil', { interval_months_min: 12, interval_months_max: 24 })],
      {
        maintenance_records: [
          { operation_slug: 'oil', last_service_km: 99000 },
        ],
      },
    );
    expect(result.recommendations[0].overdue_status).toBe('unknown');
  });
  test('a known overdue axis wins over missing information on the other axis', async () => {
    const result = await assess(
      [op('oil', { interval_months_min: 12, interval_months_max: 24 })],
      { maintenance_records: [{ operation_slug: 'oil', last_service_km: 0 }] },
    );
    expect(result.recommendations[0].overdue_status).toBe('overdue');
  });
  test('calendar addition clamps month ends and leap days', async () => {
    jest.setSystemTime(new Date('2025-02-28T00:00:00Z'));
    const result = await assess(
      [
        op('fluid', {
          interval_km_min: null,
          interval_km_max: null,
          interval_months_min: 12,
          interval_months_max: 12,
        }),
      ],
      {
        maintenance_records: [
          { operation_slug: 'fluid', last_service_date: '2024-02-29' },
        ],
      },
    );
    expect(result.recommendations[0].overdue_status).toBe('overdue');
  });
  test('a safety-critical operation sorts before high/moderate/low at equal relevance', async () => {
    const result = await assess(
      ['low', 'high', 'moderate', 'critical'].map((severity_if_overdue) =>
        op(severity_if_overdue, { severity_if_overdue }),
      ),
      {},
    );
    expect(result.recommendations.map((r) => r.severity_if_overdue)).toEqual([
      'critical',
      'high',
      'moderate',
      'low',
    ]);
  });
  test('the schedule identifies a missing history instead of relabelling intervals as absolute mileage', async () => {
    const result = await assess([op('oil')], {});
    expect(result.preventive_schedule?.[0].next_at_km).toBe(
      'historique de cette opération inconnu',
    );
  });
  test('a known history yields a labelled estimated absolute mileage range', async () => {
    const result = await assess([op('oil')], {
      maintenance_records: [{ operation_slug: 'oil', last_service_km: 99000 }],
    });
    expect(result.preventive_schedule?.[0].next_at_km).toBe(
      '114 000 - 119 000 km (estimation)',
    );
  });
  test('formatting does not round 1500 km to 2000 km', async () => {
    const result = await assess(
      [op('oil', { interval_km_min: 1500, interval_km_max: 2500 })],
      {},
    );
    expect(result.recommendations[0].interval_km).toBe('1 500 - 2 500 km');
  });
});
