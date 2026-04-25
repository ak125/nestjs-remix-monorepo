---
module: dashboard
sources:
- backend/src/modules/dashboard
last_scan: '2026-04-25'
primary_files:
- backend/src/modules/dashboard/dashboard.controller.ts
- backend/src/modules/dashboard/dashboard.module.ts
- backend/src/modules/dashboard/dashboard.service.ts
depends_on:
- DatabaseModule
- AuthModule
- ConfigModule
- NestCacheModule
---

# Module Dashboard

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `DashboardService`

### Providers (top 15)
- `DashboardService`

### Fichiers primaires
- [backend/src/modules/dashboard/dashboard.controller.ts](../../../backend/src/modules/dashboard/dashboard.controller.ts)
- [backend/src/modules/dashboard/dashboard.module.ts](../../../backend/src/modules/dashboard/dashboard.module.ts)
- [backend/src/modules/dashboard/dashboard.service.ts](../../../backend/src/modules/dashboard/dashboard.service.ts)

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
