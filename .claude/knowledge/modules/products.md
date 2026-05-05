---
module: products
sources:
- backend/src/modules/products
last_scan: '2026-05-05'
primary_files:
- backend/src/modules/products/controllers/products-admin.controller.ts
- backend/src/modules/products/controllers/products-catalog.controller.ts
- backend/src/modules/products/controllers/products-controller.utils.ts
- backend/src/modules/products/controllers/products-core.controller.ts
- backend/src/modules/products/controllers/products-inventory.controller.ts
- backend/src/modules/products/controllers/products-search.controller.ts
- backend/src/modules/products/cross-selling.controller.ts
- backend/src/modules/products/dto/additional-product.dto.ts
depends_on:
- DatabaseModule
- CacheModule
---

# Module Products

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `ProductsService`
- `ProductsCatalogService`
- `ProductsAdminService`
- `ProductsTechnicalService`
- `ProductEnhancementService`
- `ProductFilteringService`
- `PricingService`
- `CrossSellingService`
- `StockService`
- `CrossSellingSeoService`
- `CrossSellingSourceService`

### Providers (top 15)
- `ProductsService`
- `ProductsCatalogService`
- `ProductsAdminService`
- `ProductsTechnicalService`
- `ProductEnhancementService`
- `ProductFilteringService`
- `PricingService`
- `CrossSellingService`
- `StockService`
- `CrossSellingSeoService`
- `CrossSellingSourceService`

### Fichiers primaires
- [backend/src/modules/products/controllers/products-admin.controller.ts](../../../backend/src/modules/products/controllers/products-admin.controller.ts)
- [backend/src/modules/products/controllers/products-catalog.controller.ts](../../../backend/src/modules/products/controllers/products-catalog.controller.ts)
- [backend/src/modules/products/controllers/products-controller.utils.ts](../../../backend/src/modules/products/controllers/products-controller.utils.ts)
- [backend/src/modules/products/controllers/products-core.controller.ts](../../../backend/src/modules/products/controllers/products-core.controller.ts)
- [backend/src/modules/products/controllers/products-inventory.controller.ts](../../../backend/src/modules/products/controllers/products-inventory.controller.ts)
- [backend/src/modules/products/controllers/products-search.controller.ts](../../../backend/src/modules/products/controllers/products-search.controller.ts)
- [backend/src/modules/products/cross-selling.controller.ts](../../../backend/src/modules/products/cross-selling.controller.ts)
- [backend/src/modules/products/dto/additional-product.dto.ts](../../../backend/src/modules/products/dto/additional-product.dto.ts)

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
