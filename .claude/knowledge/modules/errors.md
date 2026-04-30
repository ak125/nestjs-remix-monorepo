---
module: errors
sources:
- backend/src/modules/errors
last_scan: '2026-04-30'
primary_files:
- backend/src/modules/errors/controllers/error.controller.ts
- backend/src/modules/errors/controllers/internal-error-log.controller.ts
- backend/src/modules/errors/entities/error-log.entity.ts
- backend/src/modules/errors/errors.module.ts
- backend/src/modules/errors/filters/global-error.filter.ts
- backend/src/modules/errors/services/error-log.service.ts
- backend/src/modules/errors/services/error.service.ts
- backend/src/modules/errors/services/redirect.service.ts
depends_on: []
---

# Module Errors

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `ErrorService`
- `ErrorLogService`
- `RedirectService`

### Providers (top 15)
- `ErrorService`
- `ErrorLogService`
- `RedirectService`
- `GlobalErrorFilter`

### Fichiers primaires
- [backend/src/modules/errors/controllers/error.controller.ts](../../../backend/src/modules/errors/controllers/error.controller.ts)
- [backend/src/modules/errors/entities/error-log.entity.ts](../../../backend/src/modules/errors/entities/error-log.entity.ts)
- [backend/src/modules/errors/errors.module.ts](../../../backend/src/modules/errors/errors.module.ts)
- [backend/src/modules/errors/filters/global-error.filter.ts](../../../backend/src/modules/errors/filters/global-error.filter.ts)
- [backend/src/modules/errors/services/error-log.service.ts](../../../backend/src/modules/errors/services/error-log.service.ts)
- [backend/src/modules/errors/services/error.service.ts](../../../backend/src/modules/errors/services/error.service.ts)
- [backend/src/modules/errors/services/redirect.service.ts](../../../backend/src/modules/errors/services/redirect.service.ts)

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
