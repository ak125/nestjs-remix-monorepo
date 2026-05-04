---
module: orders
sources:
- backend/src/modules/orders
last_scan: '2026-05-04'
primary_files:
- backend/src/modules/orders/controllers/order-actions.controller.ts
- backend/src/modules/orders/controllers/order-archive.controller.ts
- backend/src/modules/orders/controllers/order-status.controller.ts
- backend/src/modules/orders/controllers/orders.controller.ts
- backend/src/modules/orders/controllers/tickets.controller.ts
- backend/src/modules/orders/dto/automotive-orders.dto.ts
- backend/src/modules/orders/dto/index.ts
- backend/src/modules/orders/dto/orders-enhanced.dto.ts
depends_on:
- DatabaseModule
- ShippingModule
- CartModule
- ApiModule
- AuthModule
- ConfigModule
---

# Module Orders

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `OrdersService`
- `OrderCalculationService`
- `OrderStatusService`
- `OrderArchiveService`
- `TicketsService`
- `OrderActionsService`

### Providers (top 15)
- `OrdersService`
- `OrderCalculationService`
- `OrderStatusService`
- `OrderArchiveService`
- `TicketsService`
- `OrderActionsService`
- `OrderCleanupService`

### Fichiers primaires
- [backend/src/modules/orders/controllers/order-actions.controller.ts](../../../backend/src/modules/orders/controllers/order-actions.controller.ts)
- [backend/src/modules/orders/controllers/order-archive.controller.ts](../../../backend/src/modules/orders/controllers/order-archive.controller.ts)
- [backend/src/modules/orders/controllers/order-status.controller.ts](../../../backend/src/modules/orders/controllers/order-status.controller.ts)
- [backend/src/modules/orders/controllers/orders.controller.ts](../../../backend/src/modules/orders/controllers/orders.controller.ts)
- [backend/src/modules/orders/controllers/tickets.controller.ts](../../../backend/src/modules/orders/controllers/tickets.controller.ts)
- [backend/src/modules/orders/dto/automotive-orders.dto.ts](../../../backend/src/modules/orders/dto/automotive-orders.dto.ts)
- [backend/src/modules/orders/dto/index.ts](../../../backend/src/modules/orders/dto/index.ts)
- [backend/src/modules/orders/dto/orders-enhanced.dto.ts](../../../backend/src/modules/orders/dto/orders-enhanced.dto.ts)

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
