---
module: admin
sources:
- backend/src/modules/admin
last_scan: '2026-04-26'
primary_files:
- backend/src/modules/admin/admin.module.ts
- backend/src/modules/admin/controllers/admin-buying-guide-preview.controller.ts
- backend/src/modules/admin/controllers/admin-buying-guide.controller.ts
- backend/src/modules/admin/controllers/admin-conseil.controller.ts
- backend/src/modules/admin/controllers/admin-db-governance.controller.ts
- backend/src/modules/admin/controllers/admin-feature-flags.controller.ts
- backend/src/modules/admin/controllers/admin-gammes-seo-aggregates.controller.ts
- backend/src/modules/admin/controllers/admin-gammes-seo-list.controller.ts
depends_on:
- DatabaseModule
- OrdersModule
- StaffModule
- ProductsModule
- WorkerModule
- SeoModule
- RagProxyModule
- SystemModule
- AiContentModule
---

# Module Admin

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `ConfigurationService`
- `StockManagementService`
- `ReportingService`
- `UserManagementService`
- `GammeDetailEnricherService`
- `GammeVLevelService`
- `StockMovementService`
- `StockReportService`
- `PageBriefService`
- `BriefGatesService`
- `HardGatesService`
- `ImageGatesService`
- `AdminJobHealthService`
- `RagSafeDistillService`
- `KeywordPlanGatesService`
- `R1KeywordPlanGatesService`
- `R8VehicleEnricherService`
- `R7BrandEnricherService`
- `VehicleRagGeneratorService`
- `RagGammeReaderService`

### Providers (top 15)
- `ConfigurationService`
- `StockManagementService`
- `WorkingStockService`
- `ReportingService`
- `UserManagementService`
- `AdminGammesSeoService`
- `GammeSeoThresholdsService`
- `GammeSeoAuditService`
- `GammeSeoBadgesService`
- `SeoCockpitService`
- `GammeDetailEnricherService`
- `GammeVLevelService`
- `StockMovementService`
- `StockReportService`
- `BuyingGuideEnricherService`

### Fichiers primaires
- [backend/src/modules/admin/admin.module.ts](../../../backend/src/modules/admin/admin.module.ts)
- [backend/src/modules/admin/controllers/admin-buying-guide-preview.controller.ts](../../../backend/src/modules/admin/controllers/admin-buying-guide-preview.controller.ts)
- [backend/src/modules/admin/controllers/admin-buying-guide.controller.ts](../../../backend/src/modules/admin/controllers/admin-buying-guide.controller.ts)
- [backend/src/modules/admin/controllers/admin-conseil.controller.ts](../../../backend/src/modules/admin/controllers/admin-conseil.controller.ts)
- [backend/src/modules/admin/controllers/admin-db-governance.controller.ts](../../../backend/src/modules/admin/controllers/admin-db-governance.controller.ts)
- [backend/src/modules/admin/controllers/admin-feature-flags.controller.ts](../../../backend/src/modules/admin/controllers/admin-feature-flags.controller.ts)
- [backend/src/modules/admin/controllers/admin-gammes-seo-aggregates.controller.ts](../../../backend/src/modules/admin/controllers/admin-gammes-seo-aggregates.controller.ts)
- [backend/src/modules/admin/controllers/admin-gammes-seo-list.controller.ts](../../../backend/src/modules/admin/controllers/admin-gammes-seo-list.controller.ts)

<!-- END AUTO-GENERATED -->

## Pourquoi
<!-- À compléter à la main : contraintes architecturales, décisions historiques, trade-offs. -->
_Section à rédiger._

## Gotchas
<!-- À compléter à la main : pièges connus, bugs célèbres, invariants non évidents. -->
_Section à rédiger._

## Références
<!-- À compléter à la main : liens vers `.claude/rules/`, vault ADRs, MEMORY.md entries. -->
_Section à rédiger._
