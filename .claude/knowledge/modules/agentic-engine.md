---
module: agentic-engine
sources:
- backend/src/modules/agentic-engine
last_scan: '2026-04-24'
primary_files:
- backend/src/modules/agentic-engine/agentic-engine.controller.ts
- backend/src/modules/agentic-engine/agentic-engine.module.ts
- backend/src/modules/agentic-engine/constants/agentic.constants.ts
- backend/src/modules/agentic-engine/events/agentic.events.ts
- backend/src/modules/agentic-engine/services/agentic-data.service.ts
- backend/src/modules/agentic-engine/services/arbiter.service.ts
- backend/src/modules/agentic-engine/services/critic.service.ts
- backend/src/modules/agentic-engine/services/evidence-ledger.service.ts
depends_on:
- DatabaseModule
- FeatureFlagsModule
- BullModule
---

# Module Agentic Engine

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `RunManagerService`
- `AgenticDataService`
- `PlannerService`
- `SolverService`
- `CriticService`

### Providers (top 15)
- `AgenticDataService`
- `EvidenceLedgerService`
- `RunManagerService`
- `PlannerService`
- `SolverService`
- `CriticService`
- `VerifierService`
- `ArbiterService`

### Fichiers primaires
- [backend/src/modules/agentic-engine/agentic-engine.controller.ts](../../../backend/src/modules/agentic-engine/agentic-engine.controller.ts)
- [backend/src/modules/agentic-engine/agentic-engine.module.ts](../../../backend/src/modules/agentic-engine/agentic-engine.module.ts)
- [backend/src/modules/agentic-engine/constants/agentic.constants.ts](../../../backend/src/modules/agentic-engine/constants/agentic.constants.ts)
- [backend/src/modules/agentic-engine/events/agentic.events.ts](../../../backend/src/modules/agentic-engine/events/agentic.events.ts)
- [backend/src/modules/agentic-engine/services/agentic-data.service.ts](../../../backend/src/modules/agentic-engine/services/agentic-data.service.ts)
- [backend/src/modules/agentic-engine/services/arbiter.service.ts](../../../backend/src/modules/agentic-engine/services/arbiter.service.ts)
- [backend/src/modules/agentic-engine/services/critic.service.ts](../../../backend/src/modules/agentic-engine/services/critic.service.ts)
- [backend/src/modules/agentic-engine/services/evidence-ledger.service.ts](../../../backend/src/modules/agentic-engine/services/evidence-ledger.service.ts)

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
