---
module: shipping
sources:
- backend/src/modules/shipping
last_scan: '2026-04-26'
primary_files:
- backend/src/modules/shipping/shipping-new.module.ts
- backend/src/modules/shipping/shipping.controller.ts
- backend/src/modules/shipping/shipping.module.ts
- backend/src/modules/shipping/shipping.service.ts
depends_on:
- CartModule
---

# Module Shipping

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `ShippingService`

### Providers (top 15)
- `ShippingService`

### Fichiers primaires
- [backend/src/modules/shipping/shipping-new.module.ts](../../../backend/src/modules/shipping/shipping-new.module.ts)
- [backend/src/modules/shipping/shipping.controller.ts](../../../backend/src/modules/shipping/shipping.controller.ts)
- [backend/src/modules/shipping/shipping.module.ts](../../../backend/src/modules/shipping/shipping.module.ts)
- [backend/src/modules/shipping/shipping.service.ts](../../../backend/src/modules/shipping/shipping.service.ts)

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
