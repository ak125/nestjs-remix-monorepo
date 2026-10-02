import { McpQueryService } from './mcp-query.service';
import { DiagnoseInput, McpVerifyContext } from '../types/mcp-verify.types';

const observable = '12345678-abcd-4abc-8abc-123456789012';
const second = '12345678-abcd-4abc-8abc-123456789013';
const fault = {
  fault_id: '87654321-abcd-4abc-8abc-123456789012',
  fault_label: 'Défaut à contrôler',
  probability_score: 40,
  confidence_score: 55,
};
const context = {} as McpVerifyContext;
function fixture() {
  // Run the real service and registry; replace only its remote RPC boundary.
  const service = Object.create(McpQueryService.prototype) as McpQueryService;
  const rpc = jest.fn().mockResolvedValue({ data: [fault], error: null });
  Object.assign(service, {
    callRpc: rpc,
    logger: { warn: jest.fn(), error: jest.fn() },
  });
  const diagnose = (input: unknown) =>
    service.getQueryRegistry().diagnose(input as DiagnoseInput, context);
  return { diagnose, rpc };
}

describe('MCP diagnostic preserves supplied evidence without inventing mappings', () => {
  test('forwards the declared KG context and anchored maintenance history', async () => {
    const { diagnose, rpc } = fixture();
    const history = [
      {
        operation_slug: 'oil_change',
        last_service_km: 0,
        last_service_date: '2025-01-31',
      },
    ];
    const result = await diagnose({
      observable_ids: [observable, second],
      vehicle_context: {
        mileage_km: 12000,
        vehicle_id: second,
        engine_family_code: '  DV6  ',
      },
      last_maintenance_records: history,
      ctx_phase: 'demarrage',
      ctx_temp: 'froid',
      ctx_speed: '0_30',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'kg_diagnose_with_explainable_score',
      {
        p_observable_ids: [observable, second],
        p_vehicle_id: second,
        p_engine_family_code: 'DV6',
        p_current_km: 12000,
        p_last_maintenance_records: history,
        p_ctx_phase: 'demarrage',
        p_ctx_temp: 'froid',
        p_ctx_speed: '0_30',
        p_limit: 10,
      },
      { source: 'api' },
    );
    expect(result).toEqual({ faults: [fault], verifiedAt: expect.any(String) });
  });
  test('preserves zero odometer and zero service odometer', async () => {
    const { diagnose, rpc } = fixture();
    await diagnose({
      observable_ids: [observable],
      vehicle_context: { mileage_km: 0 },
      last_maintenance_records: [
        { operation_slug: 'oil_change', last_service_km: 0 },
      ],
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_current_km: 0,
      p_last_maintenance_records: [
        { operation_slug: 'oil_change', last_service_km: 0 },
      ],
    });
  });
  test.each([
    {},
    { ctx_phase: null, ctx_temp: null, ctx_speed: null },
    { ctx_phase: 'any', ctx_temp: 'any', ctx_speed: 'any' },
  ])('leaves absent or unconstrained context unknown: %j', async (extras) => {
    const { diagnose, rpc } = fixture();
    await diagnose({ observable_ids: [observable], ...extras });
    expect(rpc.mock.calls[0][1]).toEqual({
      p_observable_ids: [observable],
      p_vehicle_id: null,
      p_engine_family_code: null,
      p_current_km: null,
      p_last_maintenance_records: [],
      p_ctx_phase: null,
      p_ctx_temp: null,
      p_ctx_speed: null,
      p_limit: 10,
    });
  });
  test('accepts a real service date without assuming its mileage', async () => {
    const { diagnose, rpc } = fixture();
    const records = [
      { operation_slug: 'oil_change', last_service_date: '2024-02-29' },
    ];
    expect(
      await diagnose({
        observable_ids: [observable],
        last_maintenance_records: records,
      }),
    ).not.toBeNull();
    expect(rpc.mock.calls[0][1].p_last_maintenance_records).toEqual(records);
  });
  test('does not derive KG identity or scalar context from wizard fields', async () => {
    const { diagnose, rpc } = fixture();
    await diagnose({
      observable_ids: [observable],
      vehicle_context: {
        ktypnr: 123,
        type_id: 123,
        engine: '1.6 HDI',
        vehicle_age_years: 5,
      },
      usage_context: {
        maintenance_records: [
          { operation_slug: 'oil_change', last_service_km: 1000 },
        ],
      },
      signal_input: {
        context: {
          appears_when: ['en côte'],
          temperature_context: ['cold', 'hot'],
        },
      },
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_vehicle_id: null,
      p_engine_family_code: null,
      p_last_maintenance_records: [],
      p_ctx_phase: null,
      p_ctx_temp: null,
      p_ctx_speed: null,
    });
  });
  test('does not assert an unchecked safety result', async () => {
    const { diagnose, rpc } = fixture();
    const result = await diagnose({ observable_ids: [observable] });
    expect(result).not.toHaveProperty('safety_gate');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('MCP diagnostic rejects invalid evidence before querying', () => {
  const valid = { observable_ids: [observable] };
  test.each([
    null,
    {},
    { observable_ids: [] },
    { observable_ids: ['brake-noise'] },
    { observable_ids: [observable, observable.toUpperCase()] },
    { observable_ids: [observable, 123] },
    { ...valid, vehicle_context: { vehicle_id: '123' } },
    { ...valid, vehicle_context: { mileage_km: -1 } },
    { ...valid, vehicle_context: { mileage_km: 1.5 } },
    { ...valid, vehicle_context: { mileage_km: 2147483648 } },
    { ...valid, vehicle_context: { mileage_km: '1000' } },
    { ...valid, vehicle_context: { mileage_km: Infinity } },
    { ...valid, vehicle_context: { engine_family_code: '  ' } },
    { ...valid, ctx_phase: 'uphill' },
    { ...valid, ctx_phase: ['freinage', 'virage'] },
    { ...valid, ctx_temp: 'cold' },
    { ...valid, ctx_temp: ['froid', 'chaud'] },
    { ...valid, ctx_speed: '130' },
    { ...valid, last_maintenance_records: null },
    { ...valid, last_maintenance_records: [{}] },
    { ...valid, last_maintenance_records: [{ operation_slug: 'oil_change' }] },
    {
      ...valid,
      last_maintenance_records: [{ operation_slug: ' ', last_service_km: 0 }],
    },
    {
      ...valid,
      last_maintenance_records: [
        { operation_slug: 'oil_change', last_service_km: -1 },
      ],
    },
    {
      ...valid,
      last_maintenance_records: [
        { operation_slug: 'oil_change', last_service_date: '2025-02-29' },
      ],
    },
    {
      ...valid,
      last_maintenance_records: [
        { operation_slug: 'oil_change', last_service_date: '2999-01-01' },
      ],
    },
    {
      ...valid,
      vehicle_context: { mileage_km: 0 },
      last_maintenance_records: [
        { operation_slug: 'oil_change', last_service_km: 1 },
      ],
    },
    {
      ...valid,
      last_maintenance_records: [
        { operation_slug: 'oil_change', last_service_km: 0 },
        { operation_slug: ' oil_change ', last_service_date: '2025-01-01' },
      ],
    },
  ])('returns unverified for invalid input: %j', async (input) => {
    const { diagnose, rpc } = fixture();
    expect(await diagnose(input)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('MCP diagnostic rejects missing or corrupt RPC evidence', () => {
  test.each([
    null,
    undefined,
    {},
    'failure',
    [null],
    [{}],
    [{ ...fault, fault_id: 'not-a-uuid' }],
    [{ ...fault, fault_label: ' ' }],
    [{ ...fault, probability_score: '40' }],
    [{ ...fault, probability_score: -1 }],
    [{ ...fault, probability_score: 101 }],
    [{ ...fault, probability_score: 1.5 }],
    [{ ...fault, confidence_score: NaN }],
    [{ ...fault, confidence_score: 101 }],
    [fault, fault],
  ])('returns unverified for malformed response: %j', async (data) => {
    const { diagnose, rpc } = fixture();
    rpc.mockResolvedValue({ data, error: null });
    expect(await diagnose({ observable_ids: [observable] })).toBeNull();
  });
  test('preserves an actual empty result without asserting safety', async () => {
    const { diagnose, rpc } = fixture();
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await diagnose({ observable_ids: [observable] })).toEqual({
      faults: [],
      verifiedAt: expect.any(String),
    });
  });
  test('preserves valid scores including zero and strips unrelated RPC fields', async () => {
    const { diagnose, rpc } = fixture();
    const zero = { ...fault, probability_score: 0, confidence_score: 0 };
    rpc.mockResolvedValue({
      data: [
        {
          ...zero,
          safety_gate: 'none',
          confidence_explanation: 'not consumed',
        },
      ],
      error: null,
    });
    expect(await diagnose({ observable_ids: [observable] })).toEqual({
      faults: [zero],
      verifiedAt: expect.any(String),
    });
  });
  test('returns unverified when the RPC reports an error', async () => {
    const { diagnose, rpc } = fixture();
    rpc.mockResolvedValue({ data: [fault], error: { message: 'unavailable' } });
    expect(await diagnose({ observable_ids: [observable] })).toBeNull();
  });
  test('returns unverified after a transport exception', async () => {
    const { diagnose, rpc } = fixture();
    rpc.mockRejectedValue(new Error('unavailable'));
    expect(await diagnose({ observable_ids: [observable] })).toBeNull();
  });
});
