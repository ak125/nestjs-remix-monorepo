---
module: analytics
sources:
- backend/src/modules/analytics
last_scan: '2026-10-23'
primary_files:
- backend/src/modules/analytics/analytics.module.ts
- backend/src/modules/analytics/controllers/landing-attribution.controller.test.ts
- backend/src/modules/analytics/controllers/landing-attribution.controller.ts
- backend/src/modules/analytics/controllers/simple-analytics.controller.ts
- backend/src/modules/analytics/index.ts
- backend/src/modules/analytics/landing-attribution-cutover.nest.test.ts
- backend/src/modules/analytics/landing-source.classifier.test.ts
- backend/src/modules/analytics/landing-source.classifier.ts
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
- `TrackingIntegrityService`

### Providers (top 15)
- `SimpleAnalyticsService`
- `TrackingIntegrityService`

### Fichiers primaires
- [backend/src/modules/analytics/analytics.module.ts](../../../backend/src/modules/analytics/analytics.module.ts)
- [backend/src/modules/analytics/controllers/landing-attribution.controller.test.ts](../../../backend/src/modules/analytics/controllers/landing-attribution.controller.test.ts)
- [backend/src/modules/analytics/controllers/landing-attribution.controller.ts](../../../backend/src/modules/analytics/controllers/landing-attribution.controller.ts)
- [backend/src/modules/analytics/controllers/simple-analytics.controller.ts](../../../backend/src/modules/analytics/controllers/simple-analytics.controller.ts)
- [backend/src/modules/analytics/index.ts](../../../backend/src/modules/analytics/index.ts)
- [backend/src/modules/analytics/landing-attribution-cutover.nest.test.ts](../../../backend/src/modules/analytics/landing-attribution-cutover.nest.test.ts)
- [backend/src/modules/analytics/landing-source.classifier.test.ts](../../../backend/src/modules/analytics/landing-source.classifier.test.ts)
- [backend/src/modules/analytics/landing-source.classifier.ts](../../../backend/src/modules/analytics/landing-source.classifier.ts)

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
