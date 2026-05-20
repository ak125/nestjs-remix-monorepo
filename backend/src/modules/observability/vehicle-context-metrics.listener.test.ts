/**
 * PR-C — VehicleContextMetricsListener unit tests.
 *
 * Pure : instantiates the listener with an isolated Prometheus Registry
 * per test ; no NestJS Test module needed.
 */

import { Registry } from 'prom-client';
import {
  buildVehicleContextCounters,
  VEHICLE_CTX_METRIC_NAMES,
} from './vehicle-context.metrics';
import { VehicleContextMetricsListener } from './vehicle-context-metrics.listener';

function setup(): {
  listener: VehicleContextMetricsListener;
  registry: Registry;
} {
  const registry = new Registry();
  const counters = buildVehicleContextCounters(registry);
  const listener = new VehicleContextMetricsListener(counters);
  return { listener, registry };
}

async function metricLine(
  registry: Registry,
  metricName: string,
  labelMatch: string,
): Promise<number | null> {
  const text = await registry.metrics();
  for (const line of text.split('\n')) {
    if (!line.startsWith(metricName)) continue;
    if (!line.includes(labelMatch)) continue;
    const value = Number(line.trim().split(/\s+/).pop());
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

describe('VehicleContextMetricsListener (PR-C)', () => {
  test('onSet bumps vehicle_ctx_set_total with source + type_id_present labels', async () => {
    const { listener, registry } = setup();
    listener.onSet({ source: 'diagnostic', type_id_present: true });
    listener.onSet({ source: 'diagnostic', type_id_present: true });
    listener.onSet({ source: 'manual', type_id_present: false });

    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.set,
        'source="diagnostic",type_id_present="true"',
      ),
    ).toBe(2);
    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.set,
        'source="manual",type_id_present="false"',
      ),
    ).toBe(1);
  });

  test('onInvalid bumps vehicle_ctx_invalid_total with reason label', async () => {
    const { listener, registry } = setup();
    listener.onInvalid({ reason: 'bad_signature' });
    listener.onInvalid({ reason: 'bad_signature' });
    listener.onInvalid({ reason: 'bad_schema' });

    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.invalid,
        'reason="bad_signature"',
      ),
    ).toBe(2);
    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.invalid,
        'reason="bad_schema"',
      ),
    ).toBe(1);
  });

  test('onConsumed bumps vehicle_ctx_consumed_total with route label', async () => {
    const { listener, registry } = setup();
    listener.onConsumed({ route: 'R1' });
    listener.onConsumed({ route: 'R5' });
    listener.onConsumed({ route: 'R1' });

    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.consumed,
        'route="R1"',
      ),
    ).toBe(2);
    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.consumed,
        'route="R5"',
      ),
    ).toBe(1);
  });

  test('missing label falls back to unknown bucket (never throws)', async () => {
    const { listener, registry } = setup();
    listener.onSet({});
    listener.onInvalid(null);
    listener.onConsumed(undefined);

    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.set,
        'source="unknown",type_id_present="unknown"',
      ),
    ).toBe(1);
    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.invalid,
        'reason="unknown"',
      ),
    ).toBe(1);
    expect(
      await metricLine(
        registry,
        VEHICLE_CTX_METRIC_NAMES.consumed,
        'route="unknown"',
      ),
    ).toBe(1);
  });

  test('counter names match event-taxonomy.yaml l1_metric exactly (anti-drift)', () => {
    expect(VEHICLE_CTX_METRIC_NAMES.set).toBe('vehicle_ctx_set_total');
    expect(VEHICLE_CTX_METRIC_NAMES.invalid).toBe('vehicle_ctx_invalid_total');
    expect(VEHICLE_CTX_METRIC_NAMES.consumed).toBe(
      'vehicle_ctx_consumed_total',
    );
  });

  test('registry.metrics() output is valid Prometheus text format', async () => {
    const { listener, registry } = setup();
    listener.onSet({ source: 'gsc', type_id_present: false });
    const text = await registry.metrics();
    expect(text).toContain('# HELP vehicle_ctx_set_total');
    expect(text).toContain('# TYPE vehicle_ctx_set_total counter');
    expect(text).toMatch(/vehicle_ctx_set_total\{[^}]+\} 1/);
  });
});
