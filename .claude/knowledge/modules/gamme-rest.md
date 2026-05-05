---
module: gamme-rest
sources:
- backend/src/modules/gamme-rest
last_scan: '2026-05-05'
primary_files:
- backend/src/modules/gamme-rest/controllers/admin-gamme-cache.controller.ts
- backend/src/modules/gamme-rest/controllers/admin-r1-related-blocks-cache.controller.ts
- backend/src/modules/gamme-rest/gamme-rest-optimized.controller.ts
- backend/src/modules/gamme-rest/gamme-rest-rpc-v2.controller.ts
- backend/src/modules/gamme-rest/gamme-rest.module.ts
- backend/src/modules/gamme-rest/services/buying-guide-data.service.ts
- backend/src/modules/gamme-rest/services/gamme-data-transformer.service.ts
- backend/src/modules/gamme-rest/services/gamme-page-data.service.ts
depends_on:
- CatalogModule
- DatabaseModule
- SeoModule
- AdminModule
---

# Module Gamme Rest

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- _(aucun export dans le `@Module({exports: [...]})`)_

### Providers (top 15)
- `GammeDataTransformerService`
- `GammeRpcService`
- `GammeResponseBuilderService`
- `GammePageDataService`
- `BuyingGuideDataService`
- `R1RelatedResourcesService`

### Fichiers primaires
- [backend/src/modules/gamme-rest/gamme-rest-optimized.controller.ts](../../../backend/src/modules/gamme-rest/gamme-rest-optimized.controller.ts)
- [backend/src/modules/gamme-rest/gamme-rest-rpc-v2.controller.ts](../../../backend/src/modules/gamme-rest/gamme-rest-rpc-v2.controller.ts)
- [backend/src/modules/gamme-rest/gamme-rest.module.ts](../../../backend/src/modules/gamme-rest/gamme-rest.module.ts)
- [backend/src/modules/gamme-rest/services/buying-guide-data.service.ts](../../../backend/src/modules/gamme-rest/services/buying-guide-data.service.ts)
- [backend/src/modules/gamme-rest/services/gamme-data-transformer.service.ts](../../../backend/src/modules/gamme-rest/services/gamme-data-transformer.service.ts)
- [backend/src/modules/gamme-rest/services/gamme-page-data.service.ts](../../../backend/src/modules/gamme-rest/services/gamme-page-data.service.ts)
- [backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts](../../../backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts)
- [backend/src/modules/gamme-rest/services/gamme-rpc.schema.ts](../../../backend/src/modules/gamme-rest/services/gamme-rpc.schema.ts)

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
