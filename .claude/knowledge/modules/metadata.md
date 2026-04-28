---
module: metadata
sources:
- backend/src/modules/metadata
last_scan: '2026-04-28'
primary_files:
- backend/src/modules/metadata/controllers/breadcrumb-admin.controller.ts
- backend/src/modules/metadata/controllers/optimized-breadcrumb.controller.ts
- backend/src/modules/metadata/controllers/optimized-metadata.controller.ts
- backend/src/modules/metadata/metadata.module.ts
- backend/src/modules/metadata/services/optimized-breadcrumb.service.ts
- backend/src/modules/metadata/services/optimized-metadata.service.ts
depends_on:
- CacheModule
- DatabaseModule
---

# Module Metadata

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `OptimizedMetadataService`
- `OptimizedBreadcrumbService`

### Providers (top 15)
- `OptimizedMetadataService`
- `OptimizedBreadcrumbService`

### Fichiers primaires
- [backend/src/modules/metadata/controllers/breadcrumb-admin.controller.ts](../../../backend/src/modules/metadata/controllers/breadcrumb-admin.controller.ts)
- [backend/src/modules/metadata/controllers/optimized-breadcrumb.controller.ts](../../../backend/src/modules/metadata/controllers/optimized-breadcrumb.controller.ts)
- [backend/src/modules/metadata/controllers/optimized-metadata.controller.ts](../../../backend/src/modules/metadata/controllers/optimized-metadata.controller.ts)
- [backend/src/modules/metadata/metadata.module.ts](../../../backend/src/modules/metadata/metadata.module.ts)
- [backend/src/modules/metadata/services/optimized-breadcrumb.service.ts](../../../backend/src/modules/metadata/services/optimized-breadcrumb.service.ts)
- [backend/src/modules/metadata/services/optimized-metadata.service.ts](../../../backend/src/modules/metadata/services/optimized-metadata.service.ts)

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
