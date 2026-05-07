/**
 * MetricsService — counters minimaux MVP-0 (ADR-050 Livrable 3 bis).
 *
 * Implémente 2 counters minimum requis par ADR-050 :
 *   - seo_enrich_total{role, outcome}     : success | gate_blocked | error
 *   - seo_gate_violation_total{role, gate} : nom du gate violé
 *
 * Storage : in-memory Map (perdu au restart — acceptable pour MVP-0, scrape
 * Prometheus toutes les 15s typique).
 *
 * Cardinalité bornée :
 *   - role : 9 valeurs (R0..R8)
 *   - outcome : 3 valeurs
 *   - gate : ~6 valeurs
 *   → max 9*3 + 9*6 = 81 séries (cf. ADR-050 ligne 152-154).
 *
 * Pour OTel proper (histograms, exporter Prometheus push, Grafana dashboard) :
 * voir Phase 7 PR-X2-extended du plan refondation.
 */

import { Injectable, Logger } from '@nestjs/common';

export type EnrichOutcome = 'success' | 'gate_blocked' | 'error';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly enrichCounters = new Map<string, number>();
  private readonly gateCounters = new Map<string, number>();

  /**
   * Increment seo_enrich_total{role, outcome}.
   */
  incrementEnrich(role: string, outcome: EnrichOutcome): void {
    const key = `${role}|${outcome}`;
    this.enrichCounters.set(key, (this.enrichCounters.get(key) ?? 0) + 1);
  }

  /**
   * Increment seo_gate_violation_total{role, gate}.
   */
  incrementGateViolation(role: string, gate: string): void {
    const key = `${role}|${gate}`;
    this.gateCounters.set(key, (this.gateCounters.get(key) ?? 0) + 1);
  }

  /**
   * Render counters in Prometheus text exposition format.
   * Cf. https://prometheus.io/docs/instrumenting/exposition_formats/
   */
  renderPrometheus(): string {
    const lines: string[] = [];

    lines.push('# HELP seo_enrich_total Total enrichments by role and outcome (ADR-050).');
    lines.push('# TYPE seo_enrich_total counter');
    for (const [key, value] of this.enrichCounters.entries()) {
      const [role, outcome] = key.split('|');
      lines.push(`seo_enrich_total{role="${role}",outcome="${outcome}"} ${value}`);
    }

    lines.push('# HELP seo_gate_violation_total Total gate violations by role and gate name (ADR-050).');
    lines.push('# TYPE seo_gate_violation_total counter');
    for (const [key, value] of this.gateCounters.entries()) {
      const [role, gate] = key.split('|');
      lines.push(`seo_gate_violation_total{role="${role}",gate="${gate}"} ${value}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Snapshot des counters pour debugging / smoke test.
   */
  snapshot(): {
    enrich: Record<string, number>;
    gateViolation: Record<string, number>;
  } {
    return {
      enrich: Object.fromEntries(this.enrichCounters),
      gateViolation: Object.fromEntries(this.gateCounters),
    };
  }
}
