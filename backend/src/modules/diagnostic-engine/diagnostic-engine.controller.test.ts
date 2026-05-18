/**
 * PR-B.4 — Pure mapping coverage : analyze input → VehicleContext cookie
 * payload. Pure function tests live here rather than a controller-level
 * jest spec because importing the controller drags in transitive modules
 * (RagProxy, engines, content services) whose pre-existing TS errors break
 * ts-jest compilation.
 *
 * Controller behaviour (persist conditional on success, silent on port
 * throw) is covered by inspection — the controller body is now 5 lines.
 */

import { mapAnalyzeInputToVehicleContextPayload } from './vehicle-context-mapping';

describe('mapAnalyzeInputToVehicleContextPayload (PR-B.4)', () => {
  test('maps full input with type_id + brand + model + engine + year + mileage', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: {
        type_id: 12345,
        brand: 'audi',
        model: 'a3',
        engine: '2-0-tdi-150',
        year: 2018,
        mileage_km: 87000,
        fuel: 'diesel', // discarded
      },
    });
    expect(payload).toEqual({
      source: 'diagnostic',
      type_id: 12345,
      brand_slug: 'audi',
      model_slug: 'a3',
      engine_slug: '2-0-tdi-150',
      year: 2018,
      mileage_km: 87000,
    });
  });

  test('persists with type_id alone (sufficient identifier)', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: { type_id: 999 },
    });
    expect(payload).toEqual({ source: 'diagnostic', type_id: 999 });
  });

  test('persists with brand + model (alternative identifier)', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: { brand: 'audi', model: 'a3' },
    });
    expect(payload).toEqual({
      source: 'diagnostic',
      brand_slug: 'audi',
      model_slug: 'a3',
    });
  });

  test('returns null when input has only brand (no model)', () => {
    expect(
      mapAnalyzeInputToVehicleContextPayload({
        vehicle_context: { brand: 'audi' },
      }),
    ).toBeNull();
  });

  test('returns null when input has only model (no brand)', () => {
    expect(
      mapAnalyzeInputToVehicleContextPayload({
        vehicle_context: { model: 'a3' },
      }),
    ).toBeNull();
  });

  test('returns null when input has only non-identifying fields', () => {
    expect(
      mapAnalyzeInputToVehicleContextPayload({
        vehicle_context: { mileage_km: 50000, year: 2020 },
      }),
    ).toBeNull();
  });

  test('returns null when vehicle_context is absent', () => {
    expect(mapAnalyzeInputToVehicleContextPayload({ signals: [] })).toBeNull();
  });

  test('returns null when body is null / undefined / non-object', () => {
    expect(mapAnalyzeInputToVehicleContextPayload(null)).toBeNull();
    expect(mapAnalyzeInputToVehicleContextPayload(undefined)).toBeNull();
    expect(mapAnalyzeInputToVehicleContextPayload('string')).toBeNull();
    expect(mapAnalyzeInputToVehicleContextPayload(42)).toBeNull();
  });

  test('returns null when vehicle_context is null', () => {
    expect(
      mapAnalyzeInputToVehicleContextPayload({ vehicle_context: null }),
    ).toBeNull();
  });

  test('forces source = "diagnostic" even if caller attempts override', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: { type_id: 1, source: 'manual' },
    });
    expect(payload?.source).toBe('diagnostic');
  });

  test('strips unknown fields (cookie schema is `.strict()`)', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: {
        type_id: 1,
        owner_name: 'attacker', // unknown — schema rejects strict
        history: ['oil change'],
      },
    });
    // Unknown keys are stripped because we whitelist (not pass-through).
    expect(payload).toEqual({ source: 'diagnostic', type_id: 1 });
  });

  test('returns null on out-of-range year (schema rejects)', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: { type_id: 1, year: 1800 },
    });
    expect(payload).toBeNull();
  });

  test('returns null on out-of-range mileage (schema rejects)', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: { type_id: 1, mileage_km: 5_000_000 },
    });
    expect(payload).toBeNull();
  });

  test('ignores fields with wrong types (e.g. type_id as string)', () => {
    const payload = mapAnalyzeInputToVehicleContextPayload({
      vehicle_context: {
        type_id: '12345', // string ignored → no identifier
        brand: 'audi',
        model: 'a3',
      },
    });
    // Falls back on brand+model identifier path.
    expect(payload).toEqual({
      source: 'diagnostic',
      brand_slug: 'audi',
      model_slug: 'a3',
    });
  });
});
