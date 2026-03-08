/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HypothesisScoringEngine
 *
 * Scoring multi-couches des hypotheses :
 *   signal_match (0-30) + vehicle_fit (0-20) + lifecycle_fit (0-15) +
 *   maintenance_history (0-15) + plausibility (0-10) + context (0-10) = 0-100
 *
 * Chaque couche est calculee independamment puis combinee.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { DiagSymptomCauseLink } from '../diagnostic-engine.data-service';
import type {
  VehicleContextInput,
  UsageContextInput,
} from '../types/diagnostic-input.schema';
import { CAUSE_GAMME_MAP } from '../constants/gamme-map.constants';

export interface ScoredHypothesis {
  hypothesis_id: string;
  label: string;
  cause_type: string;
  // Multi-layer scores
  signal_match_score: number; // 0-30
  vehicle_fit_score: number; // 0-20
  lifecycle_fit_score: number; // 0-15
  maintenance_history_score: number; // 0-15
  plausibility_score: number; // 0-10
  context_score: number; // 0-10
  total_score: number; // 0-100
  // Metadata
  urgency: 'haute' | 'moyenne' | 'basse';
  evidence_for: string[];
  evidence_against: string[];
  verification_method?: string;
  requires_verification: boolean;
  related_gamme_slugs?: string[];
  plausible_km_min?: number;
  plausible_km_max?: number;
  workshop_priority?: string;
}

@Injectable()
export class HypothesisScoringEngine {
  private readonly logger = new Logger(HypothesisScoringEngine.name);

  score(
    links: DiagSymptomCauseLink[],
    vehicle: VehicleContextInput | undefined,
    usage: UsageContextInput | undefined,
  ): ScoredHypothesis[] {
    return links
      .filter((link) => link.cause)
      .map((link) => {
        const cause = link.cause!;
        const signalMatch = this.scoreSignalMatch(link.relative_score);
        const vehicleFit = this.scoreVehicleFit(cause, vehicle);
        const lifecycleFit = this.scoreLifecycleFit(cause, vehicle);
        const maintenanceHistory = this.scoreMaintenanceHistory(cause, usage);
        const plausibility = this.scorePlausibility(cause, vehicle);
        const context = this.scoreContext(link);

        const total =
          signalMatch +
          vehicleFit +
          lifecycleFit +
          maintenanceHistory +
          plausibility +
          context;

        return {
          hypothesis_id: cause.slug,
          label: cause.label,
          cause_type: cause.cause_type,
          signal_match_score: signalMatch,
          vehicle_fit_score: vehicleFit,
          lifecycle_fit_score: lifecycleFit,
          maintenance_history_score: maintenanceHistory,
          plausibility_score: plausibility,
          context_score: context,
          total_score: total,
          urgency: this.mapUrgency(cause.urgency),
          evidence_for: link.evidence_for,
          evidence_against: link.evidence_against,
          verification_method: cause.verification_method || undefined,
          requires_verification: link.requires_verification,
          related_gamme_slugs: CAUSE_GAMME_MAP[cause.slug]?.map((g) => g.slug),
          plausible_km_min: (cause as any).plausible_km_min ?? undefined,
          plausible_km_max: (cause as any).plausible_km_max ?? undefined,
          workshop_priority: (cause as any).workshop_priority ?? undefined,
        };
      })
      .sort((a, b) => b.total_score - a.total_score);
  }

  /**
   * Signal match: map relative_score (0-100) to 0-30
   */
  private scoreSignalMatch(relativeScore: number): number {
    return Math.round((relativeScore / 100) * 30);
  }

  /**
   * Vehicle fit: does the cause make sense for this vehicle type?
   * Without specific vehicle data, give a neutral score.
   */
  private scoreVehicleFit(cause: any, vehicle?: VehicleContextInput): number {
    if (!vehicle?.brand || !vehicle?.model) return 10; // neutral

    // Higher score if we have full vehicle info
    let score = 12;
    if (vehicle.year) score += 2;
    if (vehicle.mileage_km) score += 3;
    if (vehicle.fuel) score += 3;

    return Math.min(score, 20);
  }

  /**
   * Lifecycle fit: is the vehicle age/mileage consistent with this cause?
   */
  private scoreLifecycleFit(cause: any, vehicle?: VehicleContextInput): number {
    if (!vehicle?.mileage_km && !vehicle?.year) return 7; // neutral

    const km = vehicle?.mileage_km;
    const age = vehicle?.year
      ? new Date().getFullYear() - vehicle.year
      : undefined;
    const kmMin = cause.plausible_km_min;
    const kmMax = cause.plausible_km_max;

    if (!kmMin && !kmMax) return 7; // no plausibility data

    let score = 7;

    if (km && kmMin && kmMax) {
      if (km >= kmMin && km <= kmMax) {
        score = 15; // sweet spot
      } else if (km > kmMax) {
        score = 12; // overdue, very plausible
      } else if (km < kmMin * 0.5) {
        score = 3; // too early, unlikely
      } else {
        score = 8; // approaching range
      }
    }

    // Age bonus/penalty
    if (age && cause.plausible_age_min && cause.plausible_age_max) {
      if (age >= cause.plausible_age_min && age <= cause.plausible_age_max) {
        score = Math.min(score + 2, 15);
      } else if (age < cause.plausible_age_min) {
        score = Math.max(score - 2, 0);
      }
    }

    return score;
  }

  /**
   * Maintenance history: does the usage pattern suggest this cause?
   */
  private scoreMaintenanceHistory(
    _cause: any,
    usage?: UsageContextInput,
  ): number {
    if (!usage) return 7; // neutral

    let score = 7;

    // Severe usage profiles increase maintenance-related causes
    if (usage.usage_profile === 'urban_short_trips') score += 4;
    else if (usage.usage_profile === 'professional') score += 3;
    else if (usage.usage_profile === 'mixed') score += 1;

    // Long time since last service → higher maintenance risk
    if (usage.last_service_km && usage.last_service_km > 30000) score += 3;

    return Math.min(score, 15);
  }

  /**
   * Plausibility: general reality check
   */
  private scorePlausibility(cause: any, vehicle?: VehicleContextInput): number {
    if (!vehicle?.mileage_km) return 5; // neutral

    const km = vehicle.mileage_km;
    const kmMin = cause.plausible_km_min;

    if (!kmMin) return 5;

    // Very low mileage for this type of issue → less plausible
    if (km < kmMin * 0.3) return 2;
    // Normal range → full plausibility
    if (km >= kmMin) return 10;
    // Approaching → moderate
    return 6;
  }

  /**
   * Context: bonus for evidence richness
   */
  private scoreContext(link: DiagSymptomCauseLink): number {
    let score = 5;
    if (link.evidence_for.length >= 2) score += 2;
    if (link.evidence_against.length === 0) score += 2;
    if (!link.requires_verification) score += 1;
    return Math.min(score, 10);
  }

  private mapUrgency(u: string): 'haute' | 'moyenne' | 'basse' {
    return (['haute', 'moyenne', 'basse'].includes(u) ? u : 'moyenne') as any;
  }
}
