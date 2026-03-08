/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MaintenanceIntelligenceEngine
 *
 * Relie symptomes → operations de maintenance avec intervalles.
 * Fournit des fourchettes (pas de km absolu) conformes au contrat.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DiagnosticEngineDataService } from '../diagnostic-engine.data-service';
import type {
  VehicleContextInput,
  UsageContextInput,
} from '../types/diagnostic-input.schema';

export interface MaintenanceRecommendation {
  operation_slug: string;
  operation_label: string;
  description: string;
  relevance: 'primary' | 'related';
  interval_km: string; // fourchette ex: "20 000 - 60 000 km"
  interval_months: string; // fourchette ex: "24 - 48 mois"
  severity_if_overdue: string;
  overdue_status?: 'overdue' | 'approaching' | 'ok' | 'unknown';
  related_gamme_slug?: string;
  related_pg_id?: number;
}

export interface MaintenanceAssessment {
  recommendations: MaintenanceRecommendation[];
  maintenance_links: string[];
  overdue_count: number;
}

interface MaintenanceOp {
  id: number;
  slug: string;
  label: string;
  description: string | null;
  interval_km_min: number | null;
  interval_km_max: number | null;
  interval_months_min: number | null;
  interval_months_max: number | null;
  severity_if_overdue: string;
  normal_wear_km_min: number | null;
  normal_wear_km_max: number | null;
  related_gamme_slug: string | null;
  related_pg_id: number | null;
}

@Injectable()
export class MaintenanceIntelligenceEngine {
  private readonly logger = new Logger(MaintenanceIntelligenceEngine.name);

  constructor(private readonly dataService: DiagnosticEngineDataService) {}

  async assess(
    symptomSlugs: string[],
    vehicle?: VehicleContextInput,
    usage?: UsageContextInput,
  ): Promise<MaintenanceAssessment> {
    if (!symptomSlugs.length) {
      return { recommendations: [], maintenance_links: [], overdue_count: 0 };
    }

    // Fetch maintenance operations linked to symptoms
    const operations = await this.fetchLinkedOperations(symptomSlugs);

    const recommendations: MaintenanceRecommendation[] = [];
    let overdueCount = 0;

    for (const op of operations) {
      const overdueStatus = this.evaluateOverdueStatus(
        op.operation,
        vehicle,
        usage,
      );
      if (overdueStatus === 'overdue') overdueCount++;

      recommendations.push({
        operation_slug: op.operation.slug,
        operation_label: op.operation.label,
        description: op.operation.description || '',
        relevance: op.relevance as 'primary' | 'related',
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
        (severityOrder[a.severity_if_overdue] || 3) -
        (severityOrder[b.severity_if_overdue] || 3)
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

    return {
      recommendations,
      maintenance_links: maintenanceLinks,
      overdue_count: overdueCount,
    };
  }

  /**
   * Fetch maintenance operations linked to given symptoms
   */
  private async fetchLinkedOperations(
    symptomSlugs: string[],
  ): Promise<{ operation: MaintenanceOp; relevance: string }[]> {
    const results: { operation: MaintenanceOp; relevance: string }[] = [];

    for (const slug of symptomSlugs) {
      const symptom = await this.dataService.getSymptomBySlug(slug);
      if (!symptom) continue;

      const { data: links } = await (this.dataService as any).supabase
        .from('__diag_maintenance_symptom_link')
        .select('operation_id, relevance')
        .eq('symptom_id', symptom.id)
        .eq('active', true);

      if (!links?.length) continue;

      const opIds = links.map((l: any) => l.operation_id);
      const { data: ops } = await (this.dataService as any).supabase
        .from('__diag_maintenance_operation')
        .select('*')
        .in('id', opIds)
        .eq('active', true);

      if (!ops) continue;

      const opMap = new Map((ops as MaintenanceOp[]).map((o) => [o.id, o]));
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
    op: MaintenanceOp,
    vehicle?: VehicleContextInput,
    usage?: UsageContextInput,
  ): 'overdue' | 'approaching' | 'ok' | 'unknown' {
    if (!vehicle?.mileage_km) return 'unknown';

    const km = vehicle.mileage_km;
    const lastServiceKm = usage?.last_service_km;

    if (op.interval_km_max && lastServiceKm) {
      const kmSinceService = km - lastServiceKm;
      if (kmSinceService > op.interval_km_max) return 'overdue';
      if (kmSinceService > op.interval_km_min!) return 'approaching';
      return 'ok';
    }

    // Without service history, estimate from normal wear
    if (op.normal_wear_km_max) {
      if (km > op.normal_wear_km_max) return 'overdue';
      if (op.normal_wear_km_min && km > op.normal_wear_km_min)
        return 'approaching';
      return 'ok';
    }

    return 'unknown';
  }

  private formatKmRange(min: number | null, max: number | null): string {
    if (!min && !max) return '';
    if (min && max) {
      return `${(min / 1000).toFixed(0)} 000 - ${(max / 1000).toFixed(0)} 000 km`;
    }
    if (min) return `à partir de ${(min / 1000).toFixed(0)} 000 km`;
    return `jusqu'à ${(max! / 1000).toFixed(0)} 000 km`;
  }

  private formatMonthsRange(min: number | null, max: number | null): string {
    if (!min && !max) return '';
    if (min && max) return `${min} - ${max} mois`;
    if (min) return `à partir de ${min} mois`;
    return `jusqu'à ${max} mois`;
  }
}
