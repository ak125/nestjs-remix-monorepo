---
module: payments
sources:
- backend/src/modules/payments
last_scan: '2026-05-04'
primary_files:
- backend/src/modules/payments/controllers/paybox-callback.controller.ts
- backend/src/modules/payments/controllers/paybox-monitoring.controller.ts
- backend/src/modules/payments/controllers/paybox-redirect.controller.ts
- backend/src/modules/payments/controllers/payment-admin.controller.ts
- backend/src/modules/payments/controllers/payment-callback.controller.ts
- backend/src/modules/payments/controllers/payment-controller.utils.ts
- backend/src/modules/payments/controllers/payment-core.controller.ts
- backend/src/modules/payments/controllers/payment-methods.controller.ts
depends_on:
- DatabaseModule
- ConfigModule
---

# Module Payments

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `PaymentService`
- `CyberplusService`
- `PaymentDataService`

### Providers (top 15)
- `PaymentService`
- `CyberplusService`
- `PayboxService`
- `PaymentValidationService`
- `PayboxCallbackGateService`
- `PaymentDataService`

### Fichiers primaires
- [backend/src/modules/payments/controllers/paybox-callback.controller.ts](../../../backend/src/modules/payments/controllers/paybox-callback.controller.ts)
- [backend/src/modules/payments/controllers/paybox-monitoring.controller.ts](../../../backend/src/modules/payments/controllers/paybox-monitoring.controller.ts)
- [backend/src/modules/payments/controllers/paybox-redirect.controller.ts](../../../backend/src/modules/payments/controllers/paybox-redirect.controller.ts)
- [backend/src/modules/payments/controllers/payment-admin.controller.ts](../../../backend/src/modules/payments/controllers/payment-admin.controller.ts)
- [backend/src/modules/payments/controllers/payment-callback.controller.ts](../../../backend/src/modules/payments/controllers/payment-callback.controller.ts)
- [backend/src/modules/payments/controllers/payment-controller.utils.ts](../../../backend/src/modules/payments/controllers/payment-controller.utils.ts)
- [backend/src/modules/payments/controllers/payment-core.controller.ts](../../../backend/src/modules/payments/controllers/payment-core.controller.ts)
- [backend/src/modules/payments/controllers/payment-methods.controller.ts](../../../backend/src/modules/payments/controllers/payment-methods.controller.ts)

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
