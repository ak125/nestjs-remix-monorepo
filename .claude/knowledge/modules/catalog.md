---
module: catalog
sources:
- backend/src/modules/catalog
last_scan: '2026-04-29'
primary_files:
- backend/src/modules/catalog/catalog.controller.ts
- backend/src/modules/catalog/catalog.module.ts
- backend/src/modules/catalog/catalog.service.ts
- backend/src/modules/catalog/controllers/catalog-integrity.controller.ts
- backend/src/modules/catalog/controllers/compatibility.controller.ts
- backend/src/modules/catalog/controllers/enhanced-vehicle-catalog.controller.ts
- backend/src/modules/catalog/controllers/equipementiers.controller.ts
- backend/src/modules/catalog/controllers/gamme-unified.controller.ts
depends_on:
- DatabaseModule
- NestCacheModule
---

# Module Catalog

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `CatalogService`
- `EnhancedVehicleCatalogService`
- `VehicleFilteredCatalogV4HybridService`
- `CatalogDataIntegrityService`
- `GammeUnifiedService`
- `VehiclePiecesCompatibilityService`
- `OemPlatformMappingService`
- `SeoTemplateService`
- `UnifiedPageDataService`
- `HomepageRpcService`
- `CatalogHierarchyService`
- `CompatibilityService`
- `PopularGammesService`

### Providers (top 15)
- `CatalogService`
- `EnhancedVehicleCatalogService`
- `GammeUnifiedService`
- `EquipementiersService`
- `VehicleFilteredCatalogV4HybridService`
- `VehiclePiecesCompatibilityService`
- `CatalogDataIntegrityService`
- `PricingService`
- `OemPlatformMappingService`
- `SeoTemplateService`
- `UnifiedPageDataService`
- `HomepageRpcService`
- `CatalogHierarchyService`
- `CacheWarmingService`
- `CompatibilityService`

### Fichiers primaires
- [backend/src/modules/catalog/catalog.controller.ts](../../../backend/src/modules/catalog/catalog.controller.ts)
- [backend/src/modules/catalog/catalog.module.ts](../../../backend/src/modules/catalog/catalog.module.ts)
- [backend/src/modules/catalog/catalog.service.ts](../../../backend/src/modules/catalog/catalog.service.ts)
- [backend/src/modules/catalog/controllers/catalog-integrity.controller.ts](../../../backend/src/modules/catalog/controllers/catalog-integrity.controller.ts)
- [backend/src/modules/catalog/controllers/compatibility.controller.ts](../../../backend/src/modules/catalog/controllers/compatibility.controller.ts)
- [backend/src/modules/catalog/controllers/enhanced-vehicle-catalog.controller.ts](../../../backend/src/modules/catalog/controllers/enhanced-vehicle-catalog.controller.ts)
- [backend/src/modules/catalog/controllers/equipementiers.controller.ts](../../../backend/src/modules/catalog/controllers/equipementiers.controller.ts)
- [backend/src/modules/catalog/controllers/gamme-unified.controller.ts](../../../backend/src/modules/catalog/controllers/gamme-unified.controller.ts)

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
