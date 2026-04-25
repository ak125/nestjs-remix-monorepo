---
module: vehicles
sources:
- backend/src/modules/vehicles
last_scan: '2026-04-25'
primary_files:
- backend/src/modules/vehicles/brands.controller.ts
- backend/src/modules/vehicles/controllers/admin-vehicle-cache.controller.ts
- backend/src/modules/vehicles/decorators/performance-monitoring.decorator.ts
- backend/src/modules/vehicles/dto/vehicles-simple-zod.dto.ts
- backend/src/modules/vehicles/dto/vehicles-zod.dto.ts
- backend/src/modules/vehicles/dto/vehicles.dto.ts
- backend/src/modules/vehicles/pipes/vehicle-validation.pipe.ts
- backend/src/modules/vehicles/services/brand-bestsellers.service.ts
depends_on:
- ConfigModule
- DatabaseModule
- CatalogModule
- CacheModule
---

# Module Vehicles

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `VehiclesService`
- `EnhancedVehicleService`
- `VehicleBrandsService`
- `VehicleModelsService`
- `VehicleTypesService`
- `VehicleSearchService`
- `VehicleMineService`
- `VehicleCacheService`
- `VehicleRpcService`
- `BrandRpcService`
- `VehicleMetaService`
- `BrandBestsellersService`
- `VehicleMotorCodesService`
- `VehicleProfileService`

### Providers (top 15)
- `VehiclesService`
- `EnhancedVehicleService`
- `VehicleCacheService`
- `VehicleEnrichmentService`
- `VehicleBrandsService`
- `VehicleModelsService`
- `VehicleTypesService`
- `VehicleSearchService`
- `VehicleMineService`
- `BrandSeoService`
- `VehicleMetaService`
- `BrandBestsellersService`
- `VehicleMotorCodesService`
- `VehicleProfileService`
- `VehicleRpcService`

### Fichiers primaires
- [backend/src/modules/vehicles/brands.controller.ts](../../../backend/src/modules/vehicles/brands.controller.ts)
- [backend/src/modules/vehicles/controllers/admin-vehicle-cache.controller.ts](../../../backend/src/modules/vehicles/controllers/admin-vehicle-cache.controller.ts)
- [backend/src/modules/vehicles/decorators/performance-monitoring.decorator.ts](../../../backend/src/modules/vehicles/decorators/performance-monitoring.decorator.ts)
- [backend/src/modules/vehicles/dto/vehicles-simple-zod.dto.ts](../../../backend/src/modules/vehicles/dto/vehicles-simple-zod.dto.ts)
- [backend/src/modules/vehicles/dto/vehicles-zod.dto.ts](../../../backend/src/modules/vehicles/dto/vehicles-zod.dto.ts)
- [backend/src/modules/vehicles/dto/vehicles.dto.ts](../../../backend/src/modules/vehicles/dto/vehicles.dto.ts)
- [backend/src/modules/vehicles/pipes/vehicle-validation.pipe.ts](../../../backend/src/modules/vehicles/pipes/vehicle-validation.pipe.ts)
- [backend/src/modules/vehicles/services/brand-bestsellers.service.ts](../../../backend/src/modules/vehicles/services/brand-bestsellers.service.ts)

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
