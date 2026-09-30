/**
 * MaintenanceCalculatorService — calculs entretien périodique + alertes paliers
 *
 * ADR-032 D2/D3/D7/D9 (Phase 2 PR-2 ex-PR-3).
 *
 * Wraps les RPCs `kg_*` créées en PR-1 (migration 20260429_diag_maintenance_via_kg.sql).
 * Source du calendrier : intervalles MaintenanceInterval du KG, distincts des
 * opérations `__diag_maintenance_operation` et de leurs liens, présents en DB
 * et utilisés par le moteur d'entretien du parcours diagnostic.
 *
 * Méthodes :
 *   - getSchedule(typeId, currentKm) → MaintenanceInterval intervalles génériques (filtre carburant indicatif)
 *   - getAlerts(fuelType, milestones?) → actions par palier (paliers par défaut = défaut de la RPC)
 *
 * `getCalendar(typeId, currentKm)` agrège ces intervalles et les contrôles wiki.
 * Sans historique par opération, aucun statut personnel ne peut être calculé.
 *
 * @see governance-vault/ledger/decisions/adr/ADR-032-diagnostic-maintenance-unification.md
 * @see backend/supabase/migrations/20260429_diag_maintenance_via_kg.sql
 */
import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { DiagnosticContentService } from './diagnostic-content.service';

import {
  MaintenanceScheduleSchema,
  MaintenanceAlertsSchema,
  ControlesMensuelsSchema,
  type ControleMensuel,
  type MaintenanceScheduleItem,
  type MaintenanceAlertMilestone,
} from '../types/maintenance-calendar.schema';
export type {
  MaintenanceScheduleItem,
  MaintenanceAlertAction,
  MaintenanceAlertMilestone,
} from '../types/maintenance-calendar.schema';

/**
 * Calendrier d'entretien agrégé (ADR-032 D9).
 * Frontend `calendrier-entretien.tsx` consomme un seul fetch pour tout
 * remplacer les 212 lignes de constants (`ENTRETIEN_PERIODIQUE`,
 * `CONTROLES_MENSUELS`, `ALERTES_KM`).
 */
export interface MaintenanceCalendar {
  type_id: number | null;
  /** Kilométrage fourni par l'appelant ; `null` s'il n'en a fourni aucun. */
  current_km: number | null;
  fuel_type: string | null;
  assessment_basis: 'generic_intervals';
  applicability: 'unverified';
  schedule: MaintenanceScheduleItem[];
  alerts: MaintenanceAlertMilestone[];
  /** `null` = contenu wiki absent ou invalide, distinct d'une liste vide. */
  controles_mensuels: ControleMensuel[] | null;
}

@Injectable()
export class MaintenanceCalculatorService extends SupabaseBaseService {
  protected readonly logger = new Logger(MaintenanceCalculatorService.name);

  @Inject(DiagnosticContentService)
  protected readonly diagnosticContent!: DiagnosticContentService;

  /**
   * Intervalles génériques ; le filtre carburant de la RPC ne prouve pas
   * une applicabilité constructeur. Son statut sans historique est neutralisé.
   *
   * @param typeId    auto_type.type_id (résolu en fuel_type côté RPC)
   * @param currentKm kilométrage actuel du véhicule, `null` s'il est inconnu
   * @param fuelType  override explicite (optionnel)
   */
  async getSchedule(
    typeId: number | null,
    currentKm: number | null,
    fuelType?: string | null,
  ): Promise<MaintenanceScheduleItem[]> {
    try {
      const { data, error } = await this.callRpc<unknown>(
        'kg_get_smart_maintenance_schedule',
        {
          p_type_id: typeId,
          ...(currentKm !== null && { p_current_km: currentKm }),
          p_fuel_type: fuelType ?? null,
        },
        { source: 'internal' },
      );
      const parsed = MaintenanceScheduleSchema.safeParse(data);
      if (error || !parsed.success) {
        throw new Error(error?.message ?? 'Invalid schedule response');
      }
      return parsed.data;
    } catch (error) {
      this.logger.error(
        `Maintenance schedule unavailable: ${error instanceof Error ? error.message : 'RPC failure'}`,
      );
      throw new ServiceUnavailableException(
        "Les données d'entretien sont temporairement indisponibles.",
      );
    }
  }

  /**
   * Alertes regroupées par palier kilométrique.
   * Les actions de chaque palier viennent de kg_nodes (ADR-032 D7). Sans
   * paliers explicites, ceux par défaut de la RPC s'appliquent : ils ne sont
   * pas recopiés ici.
   *
   * @param fuelType   filtre fuel-aware optionnel
   * @param milestones paliers personnalisés (optionnel)
   */
  async getAlerts(
    fuelType?: string | null,
    milestones?: number[],
  ): Promise<MaintenanceAlertMilestone[]> {
    try {
      const { data, error } = await this.callRpc<unknown>(
        'kg_get_maintenance_alerts_by_milestone',
        {
          ...(milestones && { p_milestones: milestones }),
          p_fuel_type: fuelType ?? null,
        },
        { source: 'internal' },
      );
      const parsed = MaintenanceAlertsSchema.safeParse(data);
      if (error || !parsed.success) {
        throw new Error(error?.message ?? 'Invalid milestone response');
      }
      return parsed.data;
    } catch (error) {
      this.logger.error(
        `Maintenance milestones unavailable: ${error instanceof Error ? error.message : 'RPC failure'}`,
      );
      throw new ServiceUnavailableException(
        "Les données d'entretien sont temporairement indisponibles.",
      );
    }
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
    currentKm: number | null,
    fuelType?: string | null,
  ): Promise<MaintenanceCalendar> {
    const [schedule, alerts] = await Promise.all([
      this.getSchedule(typeId, currentKm, fuelType),
      this.getAlerts(fuelType),
    ]);
    return {
      type_id: typeId,
      current_km: currentKm,
      fuel_type: fuelType ?? null,
      assessment_basis: 'generic_intervals',
      applicability: 'unverified',
      schedule,
      alerts,
      controles_mensuels: this.getControlesMensuels(),
    };
  }

  /**
   * Les contrôles mensuels sont une section distincte des intervalles : leur
   * absence ne rend pas le calendrier indisponible, mais elle est renvoyée
   * comme `null`, jamais comme une liste vide.
   */
  private getControlesMensuels(): ControleMensuel[] | null {
    // A missing or unparseable file is already logged by DiagnosticContentService.
    const entry = this.diagnosticContent.getControlesMensuels();
    if (!entry) return null;
    const parsed = ControlesMensuelsSchema.safeParse(entry.entity_data.items);
    if (!parsed.success) {
      this.logger.error('Monthly checks content is malformed');
      return null;
    }
    return parsed.data;
  }
}
