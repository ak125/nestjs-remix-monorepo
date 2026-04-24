---
module: mcp-validation
sources:
- backend/src/modules/mcp-validation
last_scan: '2026-04-24'
primary_files:
- backend/src/modules/mcp-validation/config/mcp-route-map.config.ts
- backend/src/modules/mcp-validation/decorators/mcp-verify.decorator.ts
- backend/src/modules/mcp-validation/index.ts
- backend/src/modules/mcp-validation/interceptors/mcp-shadow.interceptor.ts
- backend/src/modules/mcp-validation/interceptors/mcp-verify.interceptor.ts
- backend/src/modules/mcp-validation/mcp-validation.module.ts
- backend/src/modules/mcp-validation/mcp-validation.service.ts
- backend/src/modules/mcp-validation/mcp-validation.types.ts
depends_on:
- ConfigModule
---

# Module Mcp Validation

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `McpValidationService`
- `McpQueryService`
- `McpAlertingService`
- `ChromeDevToolsClientService`
- `ExternalCompatibilityService`

### Providers (top 15)
- `McpValidationService`
- `McpQueryService`
- `McpAlertingService`
- `ChromeDevToolsClientService`
- `ExternalCompatibilityScrapingService`
- `ExternalCompatibilityConsensusService`
- `ExternalCompatibilityCacheService`
- `ExternalCompatibilityPartsLink24Service`
- `ExternalCompatibilityService`
- `McpShadowInterceptor`
- `McpVerifyInterceptor`

### Fichiers primaires
- [backend/src/modules/mcp-validation/config/mcp-route-map.config.ts](../../../backend/src/modules/mcp-validation/config/mcp-route-map.config.ts)
- [backend/src/modules/mcp-validation/decorators/mcp-verify.decorator.ts](../../../backend/src/modules/mcp-validation/decorators/mcp-verify.decorator.ts)
- [backend/src/modules/mcp-validation/index.ts](../../../backend/src/modules/mcp-validation/index.ts)
- [backend/src/modules/mcp-validation/interceptors/mcp-shadow.interceptor.ts](../../../backend/src/modules/mcp-validation/interceptors/mcp-shadow.interceptor.ts)
- [backend/src/modules/mcp-validation/interceptors/mcp-verify.interceptor.ts](../../../backend/src/modules/mcp-validation/interceptors/mcp-verify.interceptor.ts)
- [backend/src/modules/mcp-validation/mcp-validation.module.ts](../../../backend/src/modules/mcp-validation/mcp-validation.module.ts)
- [backend/src/modules/mcp-validation/mcp-validation.service.ts](../../../backend/src/modules/mcp-validation/mcp-validation.service.ts)
- [backend/src/modules/mcp-validation/mcp-validation.types.ts](../../../backend/src/modules/mcp-validation/mcp-validation.types.ts)

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
