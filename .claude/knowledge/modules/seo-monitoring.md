---
module: seo-monitoring
sources:
- backend/src/modules/seo-monitoring
last_scan: '2026-06-23'
primary_files:
- backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts
- backend/src/modules/seo-monitoring/controllers/cwv-dashboard.controller.ts
- backend/src/modules/seo-monitoring/controllers/funnel-events.controller.ts
- backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts
- backend/src/modules/seo-monitoring/controllers/runtime-events.controller.ts
- backend/src/modules/seo-monitoring/controllers/seo-monitoring.controller.ts
- backend/src/modules/seo-monitoring/helpers/ai-readiness-detectors.ts
- backend/src/modules/seo-monitoring/listeners/order-funnel.listener.test.ts
depends_on:
- ConfigModule
---

# Module Seo Monitoring

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `GoogleCredentialsService`
- `GscDailyFetcherService`
- `Ga4DailyFetcherService`
- `CwvFetcherService`
- `GscLinksFetcherService`
- `CruxFieldFetcherService`
- `CruxAlerterService`
- `AuditFindingsService`
- `RContentAuditorService`
- `QualityHistorySnapshotService`
- `RagMirrorFreshnessService`

### Providers (top 15)
- `GoogleCredentialsService`
- `SeoMonitoringRunsService`
- `GscDailyFetcherService`
- `Ga4DailyFetcherService`
- `CwvFetcherService`
- `GscLinksFetcherService`
- `CruxFieldFetcherService`
- `CruxAlerterService`
- `AuditFindingsService`
- `RContentAuditorService`
- `QualityHistorySnapshotService`
- `RagMirrorFreshnessService`

### Fichiers primaires
- [backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts)
- [backend/src/modules/seo-monitoring/controllers/seo-monitoring.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/seo-monitoring.controller.ts)
- [backend/src/modules/seo-monitoring/processors/seo-daily-fetch.processor.ts](../../../backend/src/modules/seo-monitoring/processors/seo-daily-fetch.processor.ts)
- [backend/src/modules/seo-monitoring/seo-monitoring.module.ts](../../../backend/src/modules/seo-monitoring/seo-monitoring.module.ts)
- [backend/src/modules/seo-monitoring/services/audit-findings.service.ts](../../../backend/src/modules/seo-monitoring/services/audit-findings.service.ts)
- [backend/src/modules/seo-monitoring/services/crux-alerter.service.ts](../../../backend/src/modules/seo-monitoring/services/crux-alerter.service.ts)
- [backend/src/modules/seo-monitoring/services/crux-alerter.test.ts](../../../backend/src/modules/seo-monitoring/services/crux-alerter.test.ts)
- [backend/src/modules/seo-monitoring/services/crux-api-client.service.ts](../../../backend/src/modules/seo-monitoring/services/crux-api-client.service.ts)

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
