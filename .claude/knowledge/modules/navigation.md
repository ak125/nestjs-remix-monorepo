---
module: navigation
sources:
- backend/src/modules/navigation
last_scan: '2026-05-06'
primary_files:
- backend/src/modules/navigation/navigation.controller.ts
- backend/src/modules/navigation/navigation.module.ts
- backend/src/modules/navigation/navigation.service.ts
- backend/src/modules/navigation/services/commercial-menu.service.ts
- backend/src/modules/navigation/services/expedition-menu.service.ts
- backend/src/modules/navigation/services/seo-menu.service.ts
depends_on:
- DatabaseModule
- NestCacheModule
---

# Module Navigation

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `NavigationService`

### Providers (top 15)
- `NavigationService`
- `CommercialMenuService`
- `ExpeditionMenuService`
- `SeoMenuService`

### Fichiers primaires
- [backend/src/modules/navigation/navigation.controller.ts](../../../backend/src/modules/navigation/navigation.controller.ts)
- [backend/src/modules/navigation/navigation.module.ts](../../../backend/src/modules/navigation/navigation.module.ts)
- [backend/src/modules/navigation/navigation.service.ts](../../../backend/src/modules/navigation/navigation.service.ts)
- [backend/src/modules/navigation/services/commercial-menu.service.ts](../../../backend/src/modules/navigation/services/commercial-menu.service.ts)
- [backend/src/modules/navigation/services/expedition-menu.service.ts](../../../backend/src/modules/navigation/services/expedition-menu.service.ts)
- [backend/src/modules/navigation/services/seo-menu.service.ts](../../../backend/src/modules/navigation/services/seo-menu.service.ts)

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
