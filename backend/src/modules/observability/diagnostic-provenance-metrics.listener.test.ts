import { Registry } from 'prom-client';
import {
  buildDiagnosticProvenanceCounter,
  DIAGNOSTIC_PROVENANCE_METRIC_NAME,
} from './diagnostic-provenance.metrics';
import { DiagnosticProvenanceMetricsListener } from './diagnostic-provenance-metrics.listener';

function setup(): {
  listener: DiagnosticProvenanceMetricsListener;
  registry: Registry;
} {
  const registry = new Registry();
  return {
    listener: new DiagnosticProvenanceMetricsListener(
      buildDiagnosticProvenanceCounter(registry),
    ),
    registry,
  };
}

async function count(registry: Registry, labels: string): Promise<number> {
  const text = await registry.metrics();
  const line = text
    .split('\n')
    .find((l) =>
      l.startsWith(`${DIAGNOSTIC_PROVENANCE_METRIC_NAME}{${labels}}`),
    );
  return line ? Number(line.trim().split(/\s+/).pop()) : 0;
}

// The service → event bus → counter wiring spans two modules; it lives in
// tests/unit/diagnostic-provenance-metrics-wiring.test.ts.
describe('DiagnosticProvenanceMetricsListener', () => {
  test('counts an available evaluation under its four labels', async () => {
    const { listener, registry } = setup();
    const payload = {
      mode: 'expose',
      status: 'available',
      top_state: 'partial',
      rank_changed: true,
    };
    listener.onEvaluated(payload);
    listener.onEvaluated(payload);
    expect(
      await count(
        registry,
        'mode="expose",status="available",top_state="partial",rank_changed="true"',
      ),
    ).toBe(2);
  });

  test('labels the fields an unavailable provenance does not carry "none"', async () => {
    const { listener, registry } = setup();
    listener.onEvaluated({ mode: 'primary', status: 'unavailable' });
    expect(
      await count(
        registry,
        'mode="primary",status="unavailable",top_state="none",rank_changed="none"',
      ),
    ).toBe(1);
  });

  test('buckets any value outside the known sets as "unknown" (bounded cardinality, never throws)', async () => {
    const { listener, registry } = setup();
    listener.onEvaluated({
      mode: 'battery_dead',
      status: 'maybe',
      top_state: 'gammes/batterie.md',
      rank_changed: 'yes',
    });
    listener.onEvaluated(null);
    expect(
      await count(
        registry,
        'mode="unknown",status="unknown",top_state="unknown",rank_changed="unknown"',
      ),
    ).toBe(1);
    expect(
      await count(
        registry,
        'mode="unknown",status="unknown",top_state="none",rank_changed="none"',
      ),
    ).toBe(1);
  });

  test('metric name matches the canonical constant, with HELP and TYPE', async () => {
    const { listener, registry } = setup();
    expect(DIAGNOSTIC_PROVENANCE_METRIC_NAME).toBe(
      'diagnostic_provenance_evaluated_total',
    );
    listener.onEvaluated({ mode: 'expose', status: 'unavailable' });
    const text = await registry.metrics();
    expect(text).toContain(`# HELP ${DIAGNOSTIC_PROVENANCE_METRIC_NAME}`);
    expect(text).toContain(
      `# TYPE ${DIAGNOSTIC_PROVENANCE_METRIC_NAME} counter`,
    );
  });
});
