---
module: seo-monitoring
sources:
- backend/src/modules/seo-monitoring
last_scan: '2026-10-11'
primary_files:
- backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.args.test.ts
- backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.args.ts
- backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.ts
- backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.test.ts
- backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts
- backend/src/modules/seo-monitoring/controllers/cwv-dashboard.controller.ts
- backend/src/modules/seo-monitoring/controllers/funnel-events.controller.ts
- backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts
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
- `GscIndexHistoryCollectorService`
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
- `GscIndexHistoryCollectorService`
- `CruxFieldFetcherService`
- `CruxAlerterService`
- `AuditFindingsService`
- `RContentAuditorService`
- `QualityHistorySnapshotService`
- `RagMirrorFreshnessService`
- `FunnelEventsService`
- `CwvBeaconService`

### Fichiers primaires
- [backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.args.test.ts](../../../backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.args.test.ts)
- [backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.args.ts](../../../backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.args.ts)
- [backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.ts](../../../backend/src/modules/seo-monitoring/cli/run-ingestion-backfill.ts)
- [backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.test.ts](../../../backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.test.ts)
- [backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts)
- [backend/src/modules/seo-monitoring/controllers/cwv-dashboard.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/cwv-dashboard.controller.ts)
- [backend/src/modules/seo-monitoring/controllers/funnel-events.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/funnel-events.controller.ts)
- [backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts)

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
