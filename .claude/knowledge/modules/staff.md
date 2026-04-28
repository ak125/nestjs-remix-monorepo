---
module: staff
sources:
- backend/src/modules/staff
last_scan: '2026-04-28'
primary_files:
- backend/src/modules/staff/dto/staff.dto.ts
- backend/src/modules/staff/services/staff-data.service.ts
- backend/src/modules/staff/staff.controller.ts
- backend/src/modules/staff/staff.module.ts
- backend/src/modules/staff/staff.service.ts
depends_on:
- ConfigModule
---

# Module Staff

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `StaffService`

### Providers (top 15)
- `StaffDataService`
- `StaffService`

### Fichiers primaires
- [backend/src/modules/staff/dto/staff.dto.ts](../../../backend/src/modules/staff/dto/staff.dto.ts)
- [backend/src/modules/staff/services/staff-data.service.ts](../../../backend/src/modules/staff/services/staff-data.service.ts)
- [backend/src/modules/staff/staff.controller.ts](../../../backend/src/modules/staff/staff.controller.ts)
- [backend/src/modules/staff/staff.module.ts](../../../backend/src/modules/staff/staff.module.ts)
- [backend/src/modules/staff/staff.service.ts](../../../backend/src/modules/staff/staff.service.ts)

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
