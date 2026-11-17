---
module: cart
sources:
- backend/src/modules/cart
last_scan: '2026-11-18'
primary_files:
- backend/src/modules/cart/cart.module.ts
- backend/src/modules/cart/config/return-policy-wording.test.ts
- backend/src/modules/cart/config/return-policy.config.test.ts
- backend/src/modules/cart/config/return-policy.config.ts
- backend/src/modules/cart/config/shipping-policy.config.test.ts
- backend/src/modules/cart/config/shipping-policy.config.ts
- backend/src/modules/cart/controllers/cart-analytics.controller.ts
- backend/src/modules/cart/controllers/cart-controller.utils.ts
depends_on:
- DatabaseModule
- ProductsModule
- PromoModule
- FeatureFlagsModule
- BullModule
---

# Module Cart

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `CartService`
- `CartValidationService`
- `CartAnalyticsService`
- `ShippingCalculatorService`
- `AbandonedCartService`
- `CartDataService`

### Providers (top 15)
- `CartService`
- `CartValidationService`
- `CartAnalyticsService`
- `ShippingCalculatorService`
- `AbandonedCartService`
- `AbandonedCartDataService`
- `CartDataService`
- `PromoDataService`
- `ShippingDataService`

### Fichiers primaires
- [backend/src/modules/cart/cart.module.ts](../../../backend/src/modules/cart/cart.module.ts)
- [backend/src/modules/cart/config/return-policy-wording.test.ts](../../../backend/src/modules/cart/config/return-policy-wording.test.ts)
- [backend/src/modules/cart/config/return-policy.config.test.ts](../../../backend/src/modules/cart/config/return-policy.config.test.ts)
- [backend/src/modules/cart/config/return-policy.config.ts](../../../backend/src/modules/cart/config/return-policy.config.ts)
- [backend/src/modules/cart/config/shipping-policy.config.test.ts](../../../backend/src/modules/cart/config/shipping-policy.config.test.ts)
- [backend/src/modules/cart/config/shipping-policy.config.ts](../../../backend/src/modules/cart/config/shipping-policy.config.ts)
- [backend/src/modules/cart/controllers/cart-analytics.controller.ts](../../../backend/src/modules/cart/controllers/cart-analytics.controller.ts)
- [backend/src/modules/cart/controllers/cart-controller.utils.ts](../../../backend/src/modules/cart/controllers/cart-controller.utils.ts)

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
