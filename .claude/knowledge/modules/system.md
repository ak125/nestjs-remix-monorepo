---
module: system
sources:
- backend/src/modules/system
last_scan: '2026-04-28'
primary_files:
- backend/src/modules/system/processors/metrics.processor.ts
- backend/src/modules/system/services/database-monitor.service.ts
- backend/src/modules/system/services/db-governance.service.ts
- backend/src/modules/system/services/health-check.service.ts
- backend/src/modules/system/services/metrics.service.ts
- backend/src/modules/system/services/system.service.ts
- backend/src/modules/system/simple.service.ts
- backend/src/modules/system/system-health.controller.ts
depends_on:
- ConfigModule
- DatabaseModule
---

# Module System

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `SystemHealthService`
- `SystemService`
- `MetricsService`
- `DatabaseMonitorService`
- `DbGovernanceService`

### Providers (top 15)
- `SystemHealthService`
- `SystemService`
- `MetricsService`
- `DatabaseMonitorService`
- `DbGovernanceService`

### Fichiers primaires
- [backend/src/modules/system/processors/metrics.processor.ts](../../../backend/src/modules/system/processors/metrics.processor.ts)
- [backend/src/modules/system/services/database-monitor.service.ts](../../../backend/src/modules/system/services/database-monitor.service.ts)
- [backend/src/modules/system/services/db-governance.service.ts](../../../backend/src/modules/system/services/db-governance.service.ts)
- [backend/src/modules/system/services/health-check.service.ts](../../../backend/src/modules/system/services/health-check.service.ts)
- [backend/src/modules/system/services/metrics.service.ts](../../../backend/src/modules/system/services/metrics.service.ts)
- [backend/src/modules/system/services/system.service.ts](../../../backend/src/modules/system/services/system.service.ts)
- [backend/src/modules/system/simple.service.ts](../../../backend/src/modules/system/simple.service.ts)
- [backend/src/modules/system/system-health.controller.ts](../../../backend/src/modules/system/system-health.controller.ts)

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
