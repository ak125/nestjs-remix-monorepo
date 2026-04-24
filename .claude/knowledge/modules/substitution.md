---
module: substitution
sources:
- backend/src/modules/substitution
last_scan: '2026-04-24'
primary_files:
- backend/src/modules/substitution/controllers/substitution.controller.ts
- backend/src/modules/substitution/services/intent-extractor.service.ts
- backend/src/modules/substitution/services/substitution-logger.service.ts
- backend/src/modules/substitution/services/substitution.service.ts
- backend/src/modules/substitution/substitution.module.ts
- backend/src/modules/substitution/types/substitution.types.ts
depends_on:
- ConfigModule
---

# Module Substitution

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `SubstitutionService`
- `IntentExtractorService`

### Providers (top 15)
- `IntentExtractorService`
- `SubstitutionService`
- `SubstitutionLoggerService`

### Fichiers primaires
- [backend/src/modules/substitution/controllers/substitution.controller.ts](../../../backend/src/modules/substitution/controllers/substitution.controller.ts)
- [backend/src/modules/substitution/services/intent-extractor.service.ts](../../../backend/src/modules/substitution/services/intent-extractor.service.ts)
- [backend/src/modules/substitution/services/substitution-logger.service.ts](../../../backend/src/modules/substitution/services/substitution-logger.service.ts)
- [backend/src/modules/substitution/services/substitution.service.ts](../../../backend/src/modules/substitution/services/substitution.service.ts)
- [backend/src/modules/substitution/substitution.module.ts](../../../backend/src/modules/substitution/substitution.module.ts)
- [backend/src/modules/substitution/types/substitution.types.ts](../../../backend/src/modules/substitution/types/substitution.types.ts)

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
