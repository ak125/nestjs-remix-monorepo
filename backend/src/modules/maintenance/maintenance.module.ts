import { Module } from "@nestjs/common";

/**
 * MaintenanceModule (D16) — Preventive Maintenance domain.
 *
 * Scope (Diagnostic Control Plane V1, PR-A skeleton) :
 * - Service intervals (vidange, distribution, filtres, révision constructeur)
 * - Oil specifications par moteur
 * - Maintenance schedules vehicle-aware
 *
 * Strict NON-scope (HORS V1) :
 * - Carnet entretien (stateful user-history) → futur domaine séparé si activé
 * - Programmatic SEO pages `/entretien/*` → bloqué par invariant Rego
 *   `no-programmatic-seo-pages` (canon `feedback_opa_rego_invariants_only.md`)
 * - Routes publiques nouvelles → bloqué par `feedback_no_url_changes_ever.md`
 *
 * Decoupling cible PR-D : MaintenanceIntelligenceEngine actuellement dans
 * diagnostic-engine/engines/ sera déplacé ici, exposé via MaintenancePort
 * consommé par DiagnosticEngineOrchestrator (cross-domain handoff via port,
 * jamais import direct entre modules).
 *
 * Bounded context = D16 dans `packages/registry/src/shared/domain.ts` +
 * `.spec/00-canon/repository-registry/domains.yaml`.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class MaintenanceModule {}
