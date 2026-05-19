import { Registry } from 'prom-client';
import {
  buildDiagnosticKgShadowCounter,
  DIAGNOSTIC_KG_SHADOW_METRIC_NAME,
} from './diagnostic-kg-shadow.metrics';
import { DiagnosticKgShadowMetricsListener } from './diagnostic-kg-shadow-metrics.listener';

function setup(): {
  listener: DiagnosticKgShadowMetricsListener;
  registry: Registry;
} {
  const registry = new Registry();
  const counter = buildDiagnosticKgShadowCounter(registry);
  return {
    listener: new DiagnosticKgShadowMetricsListener(counter),
    registry,
  };
}

async function metricLine(
  registry: Registry,
  labelMatch: string,
): Promise<number | null> {
  const text = await registry.metrics();
  for (const line of text.split('\n')) {
    if (!line.startsWith(DIAGNOSTIC_KG_SHADOW_METRIC_NAME)) continue;
    if (!line.includes(labelMatch)) continue;
    const value = Number(line.trim().split(/\s+/).pop());
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

describe('DiagnosticKgShadowMetricsListener (PR-E)', () => {
  test('match payload increments has_divergence="false" reason="match"', async () => {
    const { listener, registry } = setup();
    listener.onDiverged({ reason: 'match', has_divergence: false });
    listener.onDiverged({ reason: 'match', has_divergence: false });
    expect(
      await metricLine(registry, 'reason="match",has_divergence="false"'),
    ).toBe(2);
  });

  test('top1_diff payload increments has_divergence="true"', async () => {
    const { listener, registry } = setup();
    listener.onDiverged({ reason: 'top1_diff', has_divergence: true });
    expect(
      await metricLine(registry, 'reason="top1_diff",has_divergence="true"'),
    ).toBe(1);
  });

  test('kg_error payload increments has_divergence="unknown" when omitted', async () => {
    const { listener, registry } = setup();
    listener.onDiverged({ reason: 'kg_error' });
    expect(
      await metricLine(registry, 'reason="kg_error",has_divergence="unknown"'),
    ).toBe(1);
  });

  test('null payload falls back to unknown bucket (never throws)', async () => {
    const { listener, registry } = setup();
    listener.onDiverged(null);
    expect(
      await metricLine(registry, 'reason="unknown",has_divergence="unknown"'),
    ).toBe(1);
  });

  test('metric name matches the canonical constant', () => {
    expect(DIAGNOSTIC_KG_SHADOW_METRIC_NAME).toBe(
      'diagnostic_kg_shadow_diverged_total',
    );
  });

  test('prom text output includes HELP + TYPE', async () => {
    const { listener, registry } = setup();
    listener.onDiverged({ reason: 'set_diff', has_divergence: true });
    const text = await registry.metrics();
    expect(text).toContain(`# HELP ${DIAGNOSTIC_KG_SHADOW_METRIC_NAME}`);
    expect(text).toContain(
      `# TYPE ${DIAGNOSTIC_KG_SHADOW_METRIC_NAME} counter`,
    );
  });
});
