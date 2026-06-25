---
module: merchant-center
sources:
- backend/src/modules/merchant-center
last_scan: '2026-06-25'
primary_files:
- backend/src/modules/merchant-center/controllers/merchant-center.controller.ts
- backend/src/modules/merchant-center/merchant-center.module.ts
- backend/src/modules/merchant-center/services/merchant-center-feed.service.ts
depends_on:
- DatabaseModule
---

# Module Merchant Center

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `MerchantCenterFeedService`

### Providers (top 15)
- `MerchantCenterFeedService`

### Fichiers primaires
- [backend/src/modules/merchant-center/controllers/merchant-center.controller.ts](../../../backend/src/modules/merchant-center/controllers/merchant-center.controller.ts)
- [backend/src/modules/merchant-center/merchant-center.module.ts](../../../backend/src/modules/merchant-center/merchant-center.module.ts)
- [backend/src/modules/merchant-center/services/merchant-center-feed.service.ts](../../../backend/src/modules/merchant-center/services/merchant-center-feed.service.ts)

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
