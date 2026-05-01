---
module: suppliers
sources:
- backend/src/modules/suppliers
last_scan: '2026-05-01'
primary_files:
- backend/src/modules/suppliers/dto/index.ts
- backend/src/modules/suppliers/dto/supplier.dto.ts
- backend/src/modules/suppliers/dto/supplier.schemas.ts
- backend/src/modules/suppliers/suppliers-modern.controller.ts
- backend/src/modules/suppliers/suppliers.controller.ts
- backend/src/modules/suppliers/suppliers.module.ts
- backend/src/modules/suppliers/suppliers.service.ts
depends_on:
- DatabaseModule
---

# Module Suppliers

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `SuppliersService`

### Providers (top 15)
- `SuppliersService`

### Fichiers primaires
- [backend/src/modules/suppliers/dto/index.ts](../../../backend/src/modules/suppliers/dto/index.ts)
- [backend/src/modules/suppliers/dto/supplier.dto.ts](../../../backend/src/modules/suppliers/dto/supplier.dto.ts)
- [backend/src/modules/suppliers/dto/supplier.schemas.ts](../../../backend/src/modules/suppliers/dto/supplier.schemas.ts)
- [backend/src/modules/suppliers/suppliers-modern.controller.ts](../../../backend/src/modules/suppliers/suppliers-modern.controller.ts)
- [backend/src/modules/suppliers/suppliers.controller.ts](../../../backend/src/modules/suppliers/suppliers.controller.ts)
- [backend/src/modules/suppliers/suppliers.module.ts](../../../backend/src/modules/suppliers/suppliers.module.ts)
- [backend/src/modules/suppliers/suppliers.service.ts](../../../backend/src/modules/suppliers/suppliers.service.ts)

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
