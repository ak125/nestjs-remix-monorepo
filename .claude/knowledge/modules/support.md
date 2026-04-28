---
module: support
sources:
- backend/src/modules/support
last_scan: '2026-04-28'
primary_files:
- backend/src/modules/support/controllers/ai-support.controller.ts
- backend/src/modules/support/controllers/claim.controller.ts
- backend/src/modules/support/controllers/contact.controller.ts
- backend/src/modules/support/controllers/faq.controller.ts
- backend/src/modules/support/controllers/legal.controller.ts
- backend/src/modules/support/controllers/quote.controller.ts
- backend/src/modules/support/controllers/review.controller.ts
- backend/src/modules/support/controllers/support-analytics.controller.ts
depends_on:
- ConfigModule
- DatabaseModule
- NotificationsModule
---

# Module Support

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `ContactService`
- `NotificationService`
- `SupportAnalyticsService`
- `SupportConfigService`
- `AISentimentService`
- `AICategorizationService`
- `AISmartResponseService`
- `AIPredictiveService`
- `LegalVersionService`
- `LegalPageService`

### Providers (top 15)
- `ReviewService`
- `ContactService`
- `QuoteService`
- `FaqService`
- `LegalService`
- `ClaimService`
- `NotificationService`
- `SupportAnalyticsService`
- `SupportConfigService`
- `AISentimentService`
- `AICategorizationService`
- `AISmartResponseService`
- `AIPredictiveService`
- `LegalVersionService`
- `LegalPageService`

### Fichiers primaires
- [backend/src/modules/support/controllers/ai-support.controller.ts](../../../backend/src/modules/support/controllers/ai-support.controller.ts)
- [backend/src/modules/support/controllers/claim.controller.ts](../../../backend/src/modules/support/controllers/claim.controller.ts)
- [backend/src/modules/support/controllers/contact.controller.ts](../../../backend/src/modules/support/controllers/contact.controller.ts)
- [backend/src/modules/support/controllers/faq.controller.ts](../../../backend/src/modules/support/controllers/faq.controller.ts)
- [backend/src/modules/support/controllers/legal.controller.ts](../../../backend/src/modules/support/controllers/legal.controller.ts)
- [backend/src/modules/support/controllers/quote.controller.ts](../../../backend/src/modules/support/controllers/quote.controller.ts)
- [backend/src/modules/support/controllers/review.controller.ts](../../../backend/src/modules/support/controllers/review.controller.ts)
- [backend/src/modules/support/controllers/support-analytics.controller.ts](../../../backend/src/modules/support/controllers/support-analytics.controller.ts)

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
