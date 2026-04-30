---
module: users
sources:
- backend/src/modules/users
last_scan: '2026-04-30'
primary_files:
- backend/src/modules/users/controllers/addresses.controller.ts
- backend/src/modules/users/controllers/password.controller.ts
- backend/src/modules/users/controllers/user-shipment.controller.ts
- backend/src/modules/users/dto/addresses.dto.ts
- backend/src/modules/users/dto/change-password.dto.ts
- backend/src/modules/users/dto/create-user.dto.ts
- backend/src/modules/users/dto/index.ts
- backend/src/modules/users/dto/login.dto.ts
depends_on:
- ConfigModule
- DatabaseModule
- AuthModule
- MessagesModule
- JwtModule
---

# Module Users

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `UsersFinalService`
- `UserDataConsolidatedService`
- `ProfileService`
- `UsersAdminService`
- `PasswordService`
- `AddressesService`
- `UserShipmentService`

### Providers (top 15)
- `UsersFinalService`
- `UserDataConsolidatedService`
- `ProfileService`
- `UsersAdminService`
- `PasswordService`
- `AddressesService`
- `UserShipmentService`

### Fichiers primaires
- [backend/src/modules/users/controllers/addresses.controller.ts](../../../backend/src/modules/users/controllers/addresses.controller.ts)
- [backend/src/modules/users/controllers/password.controller.ts](../../../backend/src/modules/users/controllers/password.controller.ts)
- [backend/src/modules/users/controllers/user-shipment.controller.ts](../../../backend/src/modules/users/controllers/user-shipment.controller.ts)
- [backend/src/modules/users/dto/addresses.dto.ts](../../../backend/src/modules/users/dto/addresses.dto.ts)
- [backend/src/modules/users/dto/change-password.dto.ts](../../../backend/src/modules/users/dto/change-password.dto.ts)
- [backend/src/modules/users/dto/create-user.dto.ts](../../../backend/src/modules/users/dto/create-user.dto.ts)
- [backend/src/modules/users/dto/index.ts](../../../backend/src/modules/users/dto/index.ts)
- [backend/src/modules/users/dto/login.dto.ts](../../../backend/src/modules/users/dto/login.dto.ts)

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
