/**
 * Wiring test across two modules: diagnostic-engine emits
 * `diagnostic_provenance_evaluated`, observability counts it. The event name
 * and the payload labels are the diagnostic engine's; this wires the real
 * service to the real listener through the Nest event bus, so a renamed event
 * or label value fails here, not silently in production.
 */
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { Registry } from 'prom-client';
import { FeatureFlagsService } from '../../src/config/feature-flags.service';
import {
  DiagnosticEngineDataService,
  type DiagMergedCauseLink,
} from '../../src/modules/diagnostic-engine/diagnostic-engine.data-service';
import { DiagnosticProvenanceService } from '../../src/modules/diagnostic-engine/services/diagnostic-provenance.service';
import {
  buildDiagnosticProvenanceCounter,
  DIAGNOSTIC_PROVENANCE_METRIC_NAME,
} from '../../src/modules/observability/diagnostic-provenance.metrics';
import { DiagnosticProvenanceMetricsListener } from '../../src/modules/observability/diagnostic-provenance-metrics.listener';
import { DIAGNOSTIC_PROVENANCE_COUNTER } from '../../src/modules/observability/observability.tokens';

async function count(registry: Registry, labels: string): Promise<number> {
  const text = await registry.metrics();
  const line = text
    .split('\n')
    .find((l) =>
      l.startsWith(`${DIAGNOSTIC_PROVENANCE_METRIC_NAME}{${labels}}`),
    );
  return line ? Number(line.trim().split(/\s+/).pop()) : 0;
}

describe('diagnostic provenance → metrics wiring', () => {
  test('counts what DiagnosticProvenanceService emits, through the event bus', async () => {
    const registry = new Registry();
    const link: DiagMergedCauseLink = {
      id: 11,
      symptom_id: 1,
      cause_id: 1,
      relative_score: 90,
      evidence_for: ['Symptôme déclaré'],
      evidence_against: [],
      requires_verification: true,
      active: true,
      cause: {
        id: 1,
        slug: 'battery_dead',
        system_id: 1,
        label: 'battery_dead',
        cause_type: 'component_fault',
        description: null,
        verification_method: null,
        urgency: 'moyenne',
        active: true,
      },
      contributions: [
        {
          link_id: 11,
          symptom_slug: 'demarrage-difficile',
          relative_score: 90,
        },
      ],
      symptom_count: 1,
    };
    const env: Record<string, string> = {
      DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED: 'true',
    };
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        {
          provide: DIAGNOSTIC_PROVENANCE_COUNTER,
          useFactory: () => buildDiagnosticProvenanceCounter(registry),
        },
        DiagnosticProvenanceMetricsListener,
        DiagnosticProvenanceService,
        {
          provide: DiagnosticEngineDataService,
          useValue: {
            getLiveLinkProvenance: async () => [
              {
                link_id: 11,
                wiki_path: 'gammes/batterie.md',
                gamme_slug: 'batterie',
                relation_to_part: 'direct_cause',
                diagnostic_safe: true,
              },
            ],
          },
        },
        {
          provide: FeatureFlagsService,
          useValue: new FeatureFlagsService({
            get: (key: string) => env[key],
          } as unknown as ConfigService),
        },
      ],
    }).compile();
    await moduleRef.init();

    await moduleRef
      .get(DiagnosticProvenanceService)
      .rank([link], (links) =>
        links.map((l) => ({ hypothesis_id: l.cause!.slug })),
      );
    await moduleRef.close();

    expect(
      await count(
        registry,
        'mode="expose",status="available",top_state="sourced",rank_changed="false"',
      ),
    ).toBe(1);
  });
});
