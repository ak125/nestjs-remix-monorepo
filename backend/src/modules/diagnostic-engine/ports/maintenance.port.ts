import type { DomainId } from "@repo/registry";

/**
 * MaintenancePort — DiagnosticDomain (D4/D7) → MaintenanceDomain (D16) handoff.
 *
 * Single intent-based method : given vehicle context + diagnosed causes,
 * return related preventive maintenance schedule (km-based intervals).
 *
 * Implementation lives in `backend/src/modules/maintenance/` (D16). Until PR-D
 * extraction, adapter from `diagnostic-engine/engines/maintenance-intelligence.engine.ts`.
 *
 * STRICT scope (canon VehicleContext OPTION A) : reçoit `vehicleCtx` éphémère,
 * jamais session user / historique / ownership / carnet entretien. Si carnet
 * stateful nécessaire post-V1 → nouveau domaine séparé (pas extension D16).
 *
 * Contract stability : any signature change = bump registry version + ADR L4.
 */

export interface MaintenanceVehicleCtx {
  readonly type_id?: number;
  readonly brand_slug?: string;
  readonly model_slug?: string;
  readonly engine_slug?: string;
  readonly year?: number;
  readonly mileage_km?: number;
}

export interface MaintenanceCause {
  readonly cause_slug: string;
  readonly confidence: number;
}

export interface MaintenanceScheduleItem {
  readonly service_code: string;
  readonly km_due?: number;
  readonly months_due?: number;
  readonly urgency: "preventive" | "due_soon" | "overdue";
}

export interface MaintenancePort {
  getRelatedSchedule(
    vehicleCtx: MaintenanceVehicleCtx,
    causes: readonly MaintenanceCause[],
  ): Promise<readonly MaintenanceScheduleItem[]>;
}

export const MAINTENANCE_PORT = Symbol.for("DiagnosticDomain.MaintenancePort");

export const TARGET_DOMAIN: DomainId = "D16";
