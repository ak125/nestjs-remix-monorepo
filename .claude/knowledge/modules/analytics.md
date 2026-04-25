---
module: analytics
sources:
- backend/src/modules/analytics
last_scan: '2026-04-25'
primary_files:
- backend/src/modules/analytics/analytics.module.ts
- backend/src/modules/analytics/controllers/simple-analytics.controller.ts
- backend/src/modules/analytics/services/simple-analytics.service.ts
depends_on:
- ConfigModule
- DatabaseModule
---

# Module Analytics

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `SimpleAnalyticsService`

### Providers (top 15)
- `SimpleAnalyticsService`

### Fichiers primaires
- [backend/src/modules/analytics/analytics.module.ts](../../../backend/src/modules/analytics/analytics.module.ts)
- [backend/src/modules/analytics/controllers/simple-analytics.controller.ts](../../../backend/src/modules/analytics/controllers/simple-analytics.controller.ts)
- [backend/src/modules/analytics/services/simple-analytics.service.ts](../../../backend/src/modules/analytics/services/simple-analytics.service.ts)

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
