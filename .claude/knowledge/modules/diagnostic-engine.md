---
module: diagnostic-engine
sources:
- backend/src/modules/diagnostic-engine
last_scan: '2026-05-02'
primary_files:
- backend/src/modules/diagnostic-engine/constants/gamme-map.constants.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.controller.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts
- backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts
- backend/src/modules/diagnostic-engine/engines/catalog-orientation.engine.ts
- backend/src/modules/diagnostic-engine/engines/hypothesis-scoring.engine.ts
- backend/src/modules/diagnostic-engine/engines/maintenance-intelligence.engine.ts
depends_on:
- DatabaseModule
- RagProxyModule
---

# Module Diagnostic Engine

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `DiagnosticEngineDataService`

### Providers (top 15)
- `DiagnosticEngineDataService`

### Fichiers primaires
- [backend/src/modules/diagnostic-engine/constants/gamme-map.constants.ts](../../../backend/src/modules/diagnostic-engine/constants/gamme-map.constants.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.controller.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.controller.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts)
- [backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts](../../../backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts)
- [backend/src/modules/diagnostic-engine/engines/catalog-orientation.engine.ts](../../../backend/src/modules/diagnostic-engine/engines/catalog-orientation.engine.ts)
- [backend/src/modules/diagnostic-engine/engines/hypothesis-scoring.engine.ts](../../../backend/src/modules/diagnostic-engine/engines/hypothesis-scoring.engine.ts)
- [backend/src/modules/diagnostic-engine/engines/maintenance-intelligence.engine.ts](../../../backend/src/modules/diagnostic-engine/engines/maintenance-intelligence.engine.ts)

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
