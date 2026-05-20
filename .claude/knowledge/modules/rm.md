---
module: rm
sources:
- backend/src/modules/rm
last_scan: '2026-05-19'
primary_files:
- backend/src/modules/rm/controllers/rm.controller.ts
- backend/src/modules/rm/dto/alternatives-v2.dto.ts
- backend/src/modules/rm/rm.module.ts
- backend/src/modules/rm/rm.types.ts
- backend/src/modules/rm/services/__tests__/rm-alternatives.service.test.ts
- backend/src/modules/rm/services/__tests__/rm-builder-seo-shadow.test.ts
- backend/src/modules/rm/services/__tests__/rm-soft404-tracker.service.test.ts
- backend/src/modules/rm/services/gamme-clusters.const.ts
depends_on:
- DatabaseModule
- CatalogModule
- SeoShadowObservatoryModule
---

# Module Rm

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `RmBuilderService`

### Providers (top 15)
- `RmBuilderService`

### Fichiers primaires
- [backend/src/modules/rm/controllers/rm.controller.ts](../../../backend/src/modules/rm/controllers/rm.controller.ts)
- [backend/src/modules/rm/rm.module.ts](../../../backend/src/modules/rm/rm.module.ts)
- [backend/src/modules/rm/rm.types.ts](../../../backend/src/modules/rm/rm.types.ts)
- [backend/src/modules/rm/services/rm-builder.service.ts](../../../backend/src/modules/rm/services/rm-builder.service.ts)

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
