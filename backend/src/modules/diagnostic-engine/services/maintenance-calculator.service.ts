/**
 * MaintenanceCalculatorService — calculs entretien périodique + alertes paliers
 *
 * ADR-032 D2/D3/D7/D9 (Phase 2 PR-2 ex-PR-3).
 *
 * Wraps les RPCs `kg_*` créées en PR-1 (migration 20260429_diag_maintenance_via_kg.sql).
 * Single point of access pour le calendrier maintenance — supprime les queries
 * directes vers `__diag_maintenance_*` (tables ghost qui n'existaient pas en DB).
 *
 * Méthodes :
 *   - getSchedule(typeId, currentKm) → MaintenanceInterval items personnalisés (fuel-aware)
 *   - getAlerts(typeId, milestones?) → 5 paliers d'actions (zéro hardcode des paliers)
 *
 * `getCalendar(typeId, currentKm)` agrégé (D9) sera implémenté en Phase 4 PR-6
 * (dépend de `DiagnosticContentService` qui lit `controles-mensuels.md` via
 * submodule git wiki). Découplage scope cohérent.
 *
 * @see governance-vault/ledger/decisions/adr/ADR-032-diagnostic-maintenance-unification.md
 * @see backend/supabase/migrations/20260429_diag_maintenance_via_kg.sql
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { DiagnosticContentService } from './diagnostic-content.service';

// ── DTOs (aligned on RPC return shapes) ─────────────────

export interface MaintenanceScheduleItem {
  rule_alias: string;
  rule_label: string;
  km_interval: number | null;
  month_interval: number | null;
  maintenance_priority: 'critique' | 'important' | 'normal' | null;
  applies_to_fuel: 'essence' | 'diesel' | null;
  km_remaining: number;
  status: 'ok' | 'due_soon' | 'overdue' | 'time_only';
}

export interface MaintenanceAlertAction {
  rule_alias: string;
  rule_label: string;
  maintenance_priority: 'critique' | 'important' | 'normal' | null;
  km_interval: number | null;
}

export interface MaintenanceAlertMilestone {
  milestone_km: number;
  actions: MaintenanceAlertAction[];
}

/**
 * Calendrier d'entretien agrégé (ADR-032 D9).
 * Frontend `calendrier-entretien.tsx` consomme un seul fetch pour tout
 * remplacer les 212 lignes de constants (`ENTRETIEN_PERIODIQUE`,
 * `CONTROLES_MENSUELS`, `ALERTES_KM`).
 */
export interface MaintenanceCalendar {
  type_id: number | null;
  current_km: number;
  fuel_type: string | null;
  schedule: MaintenanceScheduleItem[];
  alerts: MaintenanceAlertMilestone[];
  controles_mensuels: Array<{
    element: string;
    icon: string;
    detail: string;
  }>;
}

const DEFAULT_MILESTONES = [10000, 30000, 60000, 100000, 150000];

@Injectable()
export class MaintenanceCalculatorService extends SupabaseBaseService {
  protected readonly logger = new Logger(MaintenanceCalculatorService.name);

  @Inject(DiagnosticContentService)
  protected readonly diagnosticContent!: DiagnosticContentService;

  /**
   * Schedule entretien périodique pour un véhicule donné.
   * Fuel-aware automatique via auto_type.type_fuel (ADR-032 D2).
   *
   * @param typeId    auto_type.type_id (résolu en fuel_type côté RPC)
   * @param currentKm kilométrage actuel du véhicule
   * @param fuelType  override explicite (optionnel)
   */
  async getSchedule(
    typeId: number | null,
    currentKm: number,
    fuelType?: string | null,
  ): Promise<MaintenanceScheduleItem[]> {
    const { data, error } = await this.callRpc<MaintenanceScheduleItem[]>(
      'kg_get_smart_maintenance_schedule',
      {
        p_type_id: typeId,
        p_current_km: currentKm,
        p_fuel_type: fuelType ?? null,
      },
      { source: 'internal' },
    );

    if (error) {
      this.logger.error(
        `kg_get_smart_maintenance_schedule failed for type_id=${typeId}: ${error.message}`,
      );
      return [];
    }
    return data ?? [];
  }

  /**
   * Alertes regroupées par palier kilométrique.
   * Zéro hardcode des paliers — la RPC dérive depuis kg_nodes (ADR-032 D7).
   *
   * @param fuelType   filtre fuel-aware optionnel
   * @param milestones paliers personnalisés (default: 10k/30k/60k/100k/150k)
   */
  async getAlerts(
    fuelType?: string | null,
    milestones: number[] = DEFAULT_MILESTONES,
  ): Promise<MaintenanceAlertMilestone[]> {
    const { data, error } = await this.callRpc<MaintenanceAlertMilestone[]>(
      'kg_get_maintenance_alerts_by_milestone',
      {
        p_milestones: milestones,
        p_fuel_type: fuelType ?? null,
      },
      { source: 'internal' },
    );

    if (error) {
      this.logger.error(
        `kg_get_maintenance_alerts_by_milestone failed: ${error.message}`,
      );
      return [];
    }
    return data ?? [];
  }

  /**
   * Calendrier agrégé (ADR-032 D9).
   *
   * Combine schedule + alerts + controles-mensuels (wiki/support/) en un
   * seul fetch pour le frontend `calendrier-entretien.tsx`.
   *
   * Note : la jointure `wiki/gamme/<slug>.md` pour `educational_advice`
   * (D9 ADR-032) est différée Phase 4 RG-2/RG-3 (10 gammes entretien).
   * Tant que ces wiki/gamme/ n'existent pas, `schedule[i].educational_advice`
   * sera `undefined` et le frontend affiche un placeholder.
   */
  async getCalendar(
    typeId: number | null,
    currentKm: number,
    fuelType?: string | null,
  ): Promise<MaintenanceCalendar> {
    const [schedule, alerts] = await Promise.all([
      this.getSchedule(typeId, currentKm, fuelType),
      this.getAlerts(fuelType),
    ]);
    const controlesEntry = this.diagnosticContent.getControlesMensuels();
    const controlesItems = (controlesEntry?.entity_data?.items ?? []) as Array<{
      element: string;
      icon: string;
      detail: string;
    }>;
    return {
      type_id: typeId,
      current_km: currentKm,
      fuel_type: fuelType ?? null,
      schedule,
      alerts,
      controles_mensuels: controlesItems,
    };
  }
}
