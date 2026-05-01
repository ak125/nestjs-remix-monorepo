---
module: ai-content
sources:
- backend/src/modules/ai-content
last_scan: '2026-05-02'
primary_files:
- backend/src/modules/ai-content/ai-content-cache.service.ts
- backend/src/modules/ai-content/ai-content.controller.ts
- backend/src/modules/ai-content/ai-content.module.ts
- backend/src/modules/ai-content/ai-content.service.ts
- backend/src/modules/ai-content/config/models.constants.ts
- backend/src/modules/ai-content/dto/generate-content.dto.ts
- backend/src/modules/ai-content/dto/prompt-template.dto.ts
- backend/src/modules/ai-content/prompt-template.controller.ts
depends_on:
- ConfigModule
---

# Module Ai Content

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `AiContentService`
- `PromptTemplateService`
- `CircuitBreakerService`

### Providers (top 15)
- `AiContentService`
- `AiContentCacheService`
- `PromptTemplateService`
- `CircuitBreakerService`

### Fichiers primaires
- [backend/src/modules/ai-content/ai-content-cache.service.ts](../../../backend/src/modules/ai-content/ai-content-cache.service.ts)
- [backend/src/modules/ai-content/ai-content.controller.ts](../../../backend/src/modules/ai-content/ai-content.controller.ts)
- [backend/src/modules/ai-content/ai-content.module.ts](../../../backend/src/modules/ai-content/ai-content.module.ts)
- [backend/src/modules/ai-content/ai-content.service.ts](../../../backend/src/modules/ai-content/ai-content.service.ts)
- [backend/src/modules/ai-content/config/models.constants.ts](../../../backend/src/modules/ai-content/config/models.constants.ts)
- [backend/src/modules/ai-content/dto/generate-content.dto.ts](../../../backend/src/modules/ai-content/dto/generate-content.dto.ts)
- [backend/src/modules/ai-content/dto/prompt-template.dto.ts](../../../backend/src/modules/ai-content/dto/prompt-template.dto.ts)
- [backend/src/modules/ai-content/prompt-template.controller.ts](../../../backend/src/modules/ai-content/prompt-template.controller.ts)

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
