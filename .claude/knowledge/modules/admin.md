---
module: admin
sources:
- backend/src/modules/admin
last_scan: '2026-04-24'
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
- `AdminProductsService`
- `GammeDetailEnricherService`
- `GammeVLevelService`
- `StockMovementService`
- `StockReportService`
- `PageBriefService`
- `Export`
- `WorkerModule`
- `BriefGatesService`
- `HardGatesService`
- `ImageGatesService`
- `AdminJobHealthService`
- `RagSafeDistillService`
- `RAG`
- `KeywordPlanGatesService`
- `R1KeywordPlanGatesService`
- `R1`
- `R8VehicleEnricherService`
- `R7BrandEnricherService`
- `R7`
- `VehicleRagGeneratorService`
- `R8`
- `RagGammeReaderService`

### Providers (top 15)
- `ConfigurationService`
- `StockManagementService`
- `Service`
- `WorkingStockService`
- `RealStockService`
- `ReportingService`
- `UserManagementService`
- `AdminProductsService`
- `StaffService`
- `StaffModule`
- `AdminGammesSeoService`
- `Gammes`
- `SEO`
- `GammeSeoThresholdsService`
- `Seuils`

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
