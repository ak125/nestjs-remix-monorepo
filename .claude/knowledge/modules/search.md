---
module: search
sources:
- backend/src/modules/search
last_scan: '2026-05-03'
primary_files:
- backend/src/modules/search/controllers/pieces.controller.ts
- backend/src/modules/search/controllers/search-debug.controller.ts
- backend/src/modules/search/controllers/search-enhanced-existing.controller.ts
- backend/src/modules/search/controllers/search.controller.ts
- backend/src/modules/search/search.module.ts
- backend/src/modules/search/services/database-analysis.service.ts
- backend/src/modules/search/services/indexation.service.ts
- backend/src/modules/search/services/meilisearch.service.ts
depends_on:
- ConfigModule
- DatabaseModule
---

# Module Search

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `MeilisearchService`
- `SearchMonitoringService`
- `SearchCacheService`
- `SearchEnhancedExistingService`
- `SupabaseIndexationService`

### Providers (top 15)
- `MeilisearchService`
- `SearchMonitoringService`
- `SearchCacheService`
- `DatabaseAnalysisService`
- `VehicleNamingService`
- `PiecesAnalysisService`
- `SearchSuggestionService`
- `SearchFilterService`
- `IndexationService`
- `SupabaseIndexationService`
- `SearchEnhancedExistingService`
- `SearchSimpleService`

### Fichiers primaires
- [backend/src/modules/search/controllers/pieces.controller.ts](../../../backend/src/modules/search/controllers/pieces.controller.ts)
- [backend/src/modules/search/controllers/search-debug.controller.ts](../../../backend/src/modules/search/controllers/search-debug.controller.ts)
- [backend/src/modules/search/controllers/search-enhanced-existing.controller.ts](../../../backend/src/modules/search/controllers/search-enhanced-existing.controller.ts)
- [backend/src/modules/search/controllers/search.controller.ts](../../../backend/src/modules/search/controllers/search.controller.ts)
- [backend/src/modules/search/search.module.ts](../../../backend/src/modules/search/search.module.ts)
- [backend/src/modules/search/services/database-analysis.service.ts](../../../backend/src/modules/search/services/database-analysis.service.ts)
- [backend/src/modules/search/services/indexation.service.ts](../../../backend/src/modules/search/services/indexation.service.ts)
- [backend/src/modules/search/services/meilisearch.service.ts](../../../backend/src/modules/search/services/meilisearch.service.ts)

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
