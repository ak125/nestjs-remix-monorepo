---
module: seo-control-plane
sources:
- backend/src/modules/seo-control-plane
last_scan: '2026-05-24'
primary_files:
- backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.processor.ts
- backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.scheduler.service.ts
- backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.service.test.ts
- backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.service.ts
- backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.types.ts
- backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.processor.ts
- backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.scheduler.service.ts
- backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.service.test.ts
depends_on:
- ConfigModule
- DatabaseModule
- BullModule
---

# Module Seo Control Plane

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `CriticalityLoaderService`

### Providers (top 15)
- `CriticalityLoaderService`
- `SyntheticCrawlerService`
- `SyntheticCrawlerSchedulerService`
- `CfAnalyticsCollectorService`
- `CfAnalyticsSchedulerService`
- `CfRumCollectorService`
- `CfRumSchedulerService`
- `RuntimeLogsCollectorService`
- `RuntimeLogsSchedulerService`

### Fichiers primaires
- [backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.processor.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.processor.ts)
- [backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.scheduler.service.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.scheduler.service.ts)
- [backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.service.test.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.service.test.ts)
- [backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.service.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.service.ts)
- [backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.types.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-analytics/cf-analytics.types.ts)
- [backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.processor.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.processor.ts)
- [backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.scheduler.service.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.scheduler.service.ts)
- [backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.service.test.ts](../../../backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.service.test.ts)

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
