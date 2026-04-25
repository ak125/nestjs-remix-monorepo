---
module: messages
sources:
- backend/src/modules/messages
last_scan: '2026-04-26'
primary_files:
- backend/src/modules/messages/dto/index.ts
- backend/src/modules/messages/dto/message.schemas.ts
- backend/src/modules/messages/index.ts
- backend/src/modules/messages/messages.controller.ts
- backend/src/modules/messages/messages.module.ts
- backend/src/modules/messages/messages.service.ts
- backend/src/modules/messages/messaging.gateway.ts
- backend/src/modules/messages/repositories/message-data.service.ts
depends_on:
- DatabaseModule
- JwtModule
---

# Module Messages

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `MessagesService`
- `MessageDataService`
- `MessagingGateway`

### Providers (top 15)
- `MessagesService`
- `MessageDataService`
- `MessagingGateway`

### Fichiers primaires
- [backend/src/modules/messages/dto/index.ts](../../../backend/src/modules/messages/dto/index.ts)
- [backend/src/modules/messages/dto/message.schemas.ts](../../../backend/src/modules/messages/dto/message.schemas.ts)
- [backend/src/modules/messages/index.ts](../../../backend/src/modules/messages/index.ts)
- [backend/src/modules/messages/messages.controller.ts](../../../backend/src/modules/messages/messages.controller.ts)
- [backend/src/modules/messages/messages.module.ts](../../../backend/src/modules/messages/messages.module.ts)
- [backend/src/modules/messages/messages.service.ts](../../../backend/src/modules/messages/messages.service.ts)
- [backend/src/modules/messages/messaging.gateway.ts](../../../backend/src/modules/messages/messaging.gateway.ts)
- [backend/src/modules/messages/repositories/message-data.service.ts](../../../backend/src/modules/messages/repositories/message-data.service.ts)

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
