---
module: observability
sources:
- backend/src/modules/observability
last_scan: '2026-05-27'
primary_files:
- backend/src/modules/observability/diagnostic-kg-shadow-metrics.listener.test.ts
- backend/src/modules/observability/diagnostic-kg-shadow-metrics.listener.ts
- backend/src/modules/observability/diagnostic-kg-shadow.metrics.ts
- backend/src/modules/observability/observability.module.ts
- backend/src/modules/observability/observability.tokens.ts
- backend/src/modules/observability/prometheus.controller.ts
- backend/src/modules/observability/vehicle-context-metrics.listener.test.ts
- backend/src/modules/observability/vehicle-context-metrics.listener.ts
depends_on:
- EventEmitterModule
---

# Module Observability

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- _(aucun export dans le `@Module({exports: [...]})`)_

### Providers (top 15)
- _(aucun provider détecté)_

### Fichiers primaires
- [backend/src/modules/observability/diagnostic-kg-shadow-metrics.listener.test.ts](../../../backend/src/modules/observability/diagnostic-kg-shadow-metrics.listener.test.ts)
- [backend/src/modules/observability/diagnostic-kg-shadow-metrics.listener.ts](../../../backend/src/modules/observability/diagnostic-kg-shadow-metrics.listener.ts)
- [backend/src/modules/observability/diagnostic-kg-shadow.metrics.ts](../../../backend/src/modules/observability/diagnostic-kg-shadow.metrics.ts)
- [backend/src/modules/observability/observability.module.ts](../../../backend/src/modules/observability/observability.module.ts)
- [backend/src/modules/observability/observability.tokens.ts](../../../backend/src/modules/observability/observability.tokens.ts)
- [backend/src/modules/observability/prometheus.controller.ts](../../../backend/src/modules/observability/prometheus.controller.ts)
- [backend/src/modules/observability/vehicle-context-metrics.listener.test.ts](../../../backend/src/modules/observability/vehicle-context-metrics.listener.test.ts)
- [backend/src/modules/observability/vehicle-context-metrics.listener.ts](../../../backend/src/modules/observability/vehicle-context-metrics.listener.ts)

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
