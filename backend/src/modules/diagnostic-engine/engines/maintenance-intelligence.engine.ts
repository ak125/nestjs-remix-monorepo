/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MaintenanceIntelligenceEngine
 *
 * Relie symptomes → operations de maintenance avec intervalles.
 * Fournit des fourchettes (pas de km absolu) conformes au contrat.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  DiagnosticEngineDataService,
  type MaintenanceOperation,
} from '../diagnostic-engine.data-service';
import type {
  VehicleContextInput,
  UsageContextInput,
} from '../types/diagnostic-input.schema';

export interface MaintenanceRecommendation {
  operation_slug: string;
  operation_label: string;
  description: string;
  relevance: 'primary' | 'related' | 'selected';
  applicability?: 'unverified';
  interval_source?: '__diag_maintenance_operation';
  last_service_km?: number;
  last_service_date?: string;
  next_at_km?: string;
  next_at_date?: string;
  interval_km: string; // fourchette ex: "20 000 - 60 000 km"
  interval_months: string; // fourchette ex: "24 - 48 mois"
  severity_if_overdue: string;
  overdue_status?: 'overdue' | 'approaching' | 'ok' | 'unknown';
  related_gamme_slug?: string;
  related_pg_id?: number;
}

export interface PreventiveScheduleItem {
  operation: string;
  next_at_km: string;
  status: 'overdue' | 'approaching' | 'ok' | 'unknown';
}

export interface MaintenanceAssessment {
  recommendations: MaintenanceRecommendation[];
  maintenance_links: string[];
  overdue_count: number;
  preventive_schedule?: PreventiveScheduleItem[];
}

@Injectable()
export class MaintenanceIntelligenceEngine {
  private readonly logger = new Logger(MaintenanceIntelligenceEngine.name);

  constructor(private readonly dataService: DiagnosticEngineDataService) {}

  async assess(
    symptomSlugs: string[],
    vehicle?: VehicleContextInput,
    usage?: UsageContextInput,
    evaluatedAt = new Date(),
  ): Promise<MaintenanceAssessment> {
    if (!symptomSlugs.length) {
      return { recommendations: [], maintenance_links: [], overdue_count: 0 };
    }

    // Fetch maintenance operations linked to symptoms
    const operations = await this.fetchLinkedOperations(symptomSlugs);

    return this.assessOperations(operations, vehicle, usage, evaluatedAt);
  }

  async assessSelected(
    vehicle: VehicleContextInput,
    usage: UsageContextInput,
    evaluatedAt = new Date(),
  ): Promise<MaintenanceAssessment> {
    const selected = usage.maintenance_records ?? [];
    if (!selected.length) throw new Error('Aucune opération sélectionnée');
    const available = await this.dataService.getMaintenanceOperations();
    const operations = selected.map((record) => {
      const matches = available.filter(
        (op) => op.slug === record.operation_slug,
      );
      if (matches.length !== 1)
        throw new Error('Opération inconnue ou inactive');
      const operation = matches[0];
      for (const [min, max] of [
        [operation.interval_km_min, operation.interval_km_max],
        [operation.interval_months_min, operation.interval_months_max],
      ]) {
        if (
          [min, max].some(
            (n) => n !== null && (!Number.isSafeInteger(n) || n <= 0),
          ) ||
          (min !== null && max !== null && min > max)
        ) {
          throw new Error('Intervalle de maintenance invalide');
        }
      }
      return { operation, relevance: 'selected' };
    });
    return this.assessOperations(operations, vehicle, usage, evaluatedAt);
  }

  private assessOperations(
    operations: { operation: MaintenanceOperation; relevance: string }[],
    vehicle?: VehicleContextInput,
    usage?: UsageContextInput,
    evaluatedAt = new Date(),
  ): MaintenanceAssessment {
    const recommendations: MaintenanceRecommendation[] = [];
    let overdueCount = 0;

    for (const op of operations) {
      const overdueStatus = this.evaluateOverdueStatus(
        op.operation,
        vehicle,
        usage,
        evaluatedAt,
      );
      if (overdueStatus === 'overdue') overdueCount++;

      recommendations.push({
        operation_slug: op.operation.slug,
        operation_label: op.operation.label,
        description: op.operation.description || '',
        relevance: op.relevance as MaintenanceRecommendation['relevance'],
        interval_km: this.formatKmRange(
          op.operation.interval_km_min,
          op.operation.interval_km_max,
        ),
        interval_months: this.formatMonthsRange(
          op.operation.interval_months_min,
          op.operation.interval_months_max,
        ),
        severity_if_overdue: op.operation.severity_if_overdue,
        overdue_status: overdueStatus,
        related_gamme_slug: op.operation.related_gamme_slug || undefined,
        related_pg_id: op.operation.related_pg_id || undefined,
      });
    }

    // Sort: primary first, then by severity
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      moderate: 2,
      low: 3,
    };
    recommendations.sort((a, b) => {
      if (a.relevance !== b.relevance)
        return a.relevance === 'primary' ? -1 : 1;
      return (
        (severityOrder[a.severity_if_overdue] ?? 3) -
        (severityOrder[b.severity_if_overdue] ?? 3)
      );
    });

    // Build human-readable maintenance links
    const maintenanceLinks = recommendations.map((r) => {
      const status =
        r.overdue_status === 'overdue'
          ? ' (possiblement en retard)'
          : r.overdue_status === 'approaching'
            ? ' (à vérifier prochainement)'
            : '';
      return `${r.operation_label}${status} — intervalle : ${r.interval_km || r.interval_months}`;
    });

    // An interval is not an absolute odometer deadline. Only the matching
    // operation history can anchor this estimate; global history cannot.
    const preventiveSchedule: PreventiveScheduleItem[] = recommendations.map(
      (r) => {
        const operation = operations.find(
          (op) => op.operation.slug === r.operation_slug,
        )!.operation;
        const record = usage?.maintenance_records?.find(
          (entry) => entry.operation_slug === r.operation_slug,
        );
        let nextKm = 'historique de cette opération inconnu';
        if (
          record?.last_service_km !== undefined &&
          record.last_service_km >= 0 &&
          (vehicle?.mileage_km === undefined ||
            record.last_service_km <= vehicle.mileage_km)
        ) {
          const min = operation.interval_km_min;
          const max = operation.interval_km_max;
          const estimate = this.formatKmRange(
            min !== null ? record.last_service_km + min : null,
            max !== null ? record.last_service_km + max : null,
          );
          nextKm = estimate
            ? `${estimate} (estimation)`
            : 'échéance temporelle — kilométrage non applicable';
        }
        // Expose the anchor and both deadlines alongside the same assessment.
        r.last_service_km = record?.last_service_km;
        r.last_service_date = record?.last_service_date;
        r.next_at_km = nextKm;
        r.next_at_date = 'historique de cette opération inconnu';
        if (record?.last_service_date) {
          const date = new Date(`${record.last_service_date}T00:00:00Z`);
          const bounds = [
            operation.interval_months_min,
            operation.interval_months_max,
          ]
            .filter((n): n is number => n !== null)
            .map((n) => this.addCalendarMonths(date, n));
          const unique = [...new Set(bounds)];
          r.next_at_date = unique.length
            ? `${unique.join(' - ')} (estimation)`
            : 'échéance kilométrique — date non applicable';
        }
        r.applicability = 'unverified';
        r.interval_source = '__diag_maintenance_operation';
        return {
          operation: r.operation_label,
          next_at_km: nextKm,
          status: r.overdue_status ?? 'unknown',
        };
      },
    );

    return {
      recommendations,
      maintenance_links: maintenanceLinks,
      overdue_count: overdueCount,
      preventive_schedule:
        preventiveSchedule.length > 0 ? preventiveSchedule : undefined,
    };
  }

  /**
   * Fetch maintenance operations linked to given symptoms
   */
  private async fetchLinkedOperations(
    symptomSlugs: string[],
  ): Promise<{ operation: MaintenanceOperation; relevance: string }[]> {
    const results: { operation: MaintenanceOperation; relevance: string }[] =
      [];

    for (const slug of symptomSlugs) {
      const symptom = await this.dataService.getSymptomBySlug(slug);
      if (!symptom) continue;

      const { data: links, error: linksError } = await (
        this.dataService as any
      ).supabase
        .from('__diag_maintenance_symptom_link')
        .select('operation_id, relevance')
        .eq('symptom_id', symptom.id)
        .eq('active', true);

      if (linksError) throw new Error('Maintenance links unavailable');
      if (!links?.length) continue;

      const opIds = links.map((l: any) => l.operation_id);
      const { data: ops, error: opsError } = await (
        this.dataService as any
      ).supabase
        .from('__diag_maintenance_operation')
        .select('*')
        .in('id', opIds)
        .eq('active', true);

      if (opsError) throw new Error('Maintenance operations unavailable');
      if (!ops) continue;

      const opMap = new Map(
        (ops as MaintenanceOperation[]).map((o) => [o.id, o]),
      );
      for (const link of links as {
        operation_id: number;
        relevance: string;
      }[]) {
        const op = opMap.get(link.operation_id);
        if (op && !results.some((r) => r.operation.slug === op.slug)) {
          results.push({ operation: op, relevance: link.relevance });
        }
      }
    }

    return results;
  }

  /**
   * Evaluate if a maintenance operation is overdue
   */
  private evaluateOverdueStatus(
    op: MaintenanceOperation,
    vehicle?: VehicleContextInput,
    usage?: UsageContextInput,
    evaluatedAt = new Date(),
  ): 'overdue' | 'approaching' | 'ok' | 'unknown' {
    const record = usage?.maintenance_records?.find(
      (entry) => entry.operation_slug === op.slug,
    );
    if (!record) return 'unknown';
    const km = vehicle?.mileage_km;
    const lastKm = record.last_service_km;
    if (
      lastKm !== undefined &&
      (!Number.isFinite(lastKm) ||
        lastKm < 0 ||
        (km !== undefined && lastKm > km))
    )
      return 'unknown';

    const statuses: ('overdue' | 'approaching' | 'ok' | 'unknown')[] = [];
    if (op.interval_km_min !== null || op.interval_km_max !== null) {
      if (
        km === undefined ||
        !Number.isFinite(km) ||
        km < 0 ||
        lastKm === undefined
      ) {
        statuses.push('unknown');
      } else {
        const elapsed = km - lastKm;
        if (op.interval_km_max !== null && elapsed >= op.interval_km_max)
          statuses.push('overdue');
        else if (op.interval_km_min !== null && elapsed >= op.interval_km_min)
          statuses.push('approaching');
        else statuses.push(op.interval_km_max !== null ? 'ok' : 'unknown');
      }
    }
    if (op.interval_months_min !== null || op.interval_months_max !== null) {
      const value = record.last_service_date;
      const date = value ? new Date(`${value}T00:00:00Z`) : undefined;
      const today = evaluatedAt.toISOString().slice(0, 10);
      if (
        !date ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value ||
        value! > today
      ) {
        statuses.push('unknown');
      } else if (
        op.interval_months_max !== null &&
        today >= this.addCalendarMonths(date, op.interval_months_max)
      ) {
        statuses.push('overdue');
      } else if (
        op.interval_months_min !== null &&
        today >= this.addCalendarMonths(date, op.interval_months_min)
      ) {
        statuses.push('approaching');
      } else {
        statuses.push(op.interval_months_max !== null ? 'ok' : 'unknown');
      }
    }
    // A known due axis wins. OK requires complete information on every
    // applicable axis; absence of history is never proof of recent service.
    if (statuses.includes('overdue')) return 'overdue';
    if (statuses.includes('approaching')) return 'approaching';
    if (!statuses.length || statuses.includes('unknown')) return 'unknown';
    return 'ok';
  }

  private addCalendarMonths(date: Date, months: number): string {
    const target = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
    );
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
    return target.toISOString().slice(0, 10);
  }

  private formatKmRange(min: number | null, max: number | null): string {
    const format = (value: number) =>
      value.toLocaleString('fr-FR').replace(/\s/g, ' ');
    if (min === null && max === null) return '';
    if (min !== null && max !== null)
      return min === max
        ? `${format(min)} km`
        : `${format(min)} - ${format(max)} km`;
    if (min !== null) return `à partir de ${format(min)} km`;
    return `jusqu'à ${format(max!)} km`;
  }

  private formatMonthsRange(min: number | null, max: number | null): string {
    if (min === null && max === null) return '';
    if (min !== null && max !== null)
      return min === max ? `${min} mois` : `${min} - ${max} mois`;
    if (min !== null) return `à partir de ${min} mois`;
    return `jusqu'à ${max} mois`;
  }
}
