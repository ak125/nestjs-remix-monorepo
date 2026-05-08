import { Injectable, Logger } from '@nestjs/common';
import { RoleId } from '@repo/seo-roles';

/**
 * Reason structurée pour laquelle un lien interne a été filtré au rendu.
 *
 * Mapping severity (dérivable au dashboard) :
 *   - `not_in_handoff_canon` → severity=hard (violation canon, action requise)
 *   - `not_routable_surface` → severity=soft (handoff valide, surface dépréciée)
 */
export type HandoffFilterReason =
  | 'not_in_handoff_canon'
  | 'not_routable_surface';

/** Snapshot d'un compteur unique pour exposition admin/debug. */
export interface HandoffMetricEntry {
  readonly source: RoleId;
  readonly target: RoleId;
  readonly reason: HandoffFilterReason;
  readonly count: number;
}

/**
 * Service in-memory pour observer les liens internes filtrés par
 * `isRenderableLinkAllowed()`. Pattern aligné `MetricsService`
 * existant (`modules/system/services/metrics.service.ts`) — sync
 * in-memory, pas de prom-client (absent du backend, cf ADR-052
 * follow-up Prometheus instrumentation).
 *
 * Coût : `Map.set()` = incrément mémoire sync sans I/O ; négligeable
 * vs rendu SEO (DB + template + str_replace). Cardinalité plafonnée
 * à 9 source × 9 target × 2 reason = 162 séries max (typiquement
 * ≪ 50 en pratique — matrice creuse).
 *
 * Exposé via endpoint admin existant `GET
 * /api/seo-dynamic-v4/internal-links/metrics` (ajouter section
 * `handoff_filtered`).
 *
 * @see ADR-052 (governance-vault) — observabilité initiale + follow-up Prometheus.
 */
@Injectable()
export class SeoHandoffMetricsService {
  private readonly logger = new Logger(SeoHandoffMetricsService.name);
  private readonly counts = new Map<string, number>();

  /** Incrémente le compteur (source, target, reason). */
  increment(source: RoleId, target: RoleId, reason: HandoffFilterReason): void {
    const key = this.makeKey(source, target, reason);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  /** Snapshot complet pour exposition endpoint admin. */
  snapshot(): readonly HandoffMetricEntry[] {
    const entries: HandoffMetricEntry[] = [];
    for (const [key, count] of this.counts) {
      const [source, target, reason] = key.split('|') as [
        RoleId,
        RoleId,
        HandoffFilterReason,
      ];
      entries.push({ source, target, reason, count });
    }
    return entries;
  }

  /** Reset (utile pour tests + rotation périodique si retenue). */
  reset(): void {
    const before = this.counts.size;
    this.counts.clear();
    if (before > 0) {
      this.logger.log(`[seo-handoff-metrics] reset (${before} keys cleared)`);
    }
  }

  private makeKey(
    source: RoleId,
    target: RoleId,
    reason: HandoffFilterReason,
  ): string {
    return `${source}|${target}|${reason}`;
  }
}
