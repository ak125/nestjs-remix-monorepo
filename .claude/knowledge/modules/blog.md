---
module: blog
sources:
- backend/src/modules/blog
last_scan: '2026-05-01'
primary_files:
- backend/src/modules/blog/blog.module.ts
- backend/src/modules/blog/controllers/advice-hierarchy.controller.ts
- backend/src/modules/blog/controllers/advice.controller.ts
- backend/src/modules/blog/controllers/blog.controller.ts
- backend/src/modules/blog/controllers/content.controller.ts
- backend/src/modules/blog/controllers/r3-guide.controller.ts
- backend/src/modules/blog/controllers/r6-guide.controller.ts
- backend/src/modules/blog/interfaces/blog.interfaces.ts
depends_on:
- CacheModule
- SearchModule
- SeoModule
---

# Module Blog

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `BlogService`
- `BlogCacheService`
- `AdviceService`
- `GuideService`
- `ConstructeurService`
- `GlossaryService`
- `ConstructeurSearchService`
- `ConstructeurTransformService`
- `AdviceTransformService`
- `AdviceEnrichmentService`

### Providers (top 15)
- `BlogService`
- `BlogCacheService`
- `HtmlContentSanitizerService`
- `BlogArticleTransformService`
- `BlogArticleDataService`
- `BlogStatisticsService`
- `BlogSeoService`
- `BlogArticleRelationService`
- `AdviceService`
- `GuideService`
- `ConstructeurService`
- `GlossaryService`
- `ConstructeurSearchService`
- `ConstructeurTransformService`
- `AdviceTransformService`

### Fichiers primaires
- [backend/src/modules/blog/blog.module.ts](../../../backend/src/modules/blog/blog.module.ts)
- [backend/src/modules/blog/controllers/advice-hierarchy.controller.ts](../../../backend/src/modules/blog/controllers/advice-hierarchy.controller.ts)
- [backend/src/modules/blog/controllers/advice.controller.ts](../../../backend/src/modules/blog/controllers/advice.controller.ts)
- [backend/src/modules/blog/controllers/blog.controller.ts](../../../backend/src/modules/blog/controllers/blog.controller.ts)
- [backend/src/modules/blog/controllers/content.controller.ts](../../../backend/src/modules/blog/controllers/content.controller.ts)
- [backend/src/modules/blog/controllers/r3-guide.controller.ts](../../../backend/src/modules/blog/controllers/r3-guide.controller.ts)
- [backend/src/modules/blog/controllers/r6-guide.controller.ts](../../../backend/src/modules/blog/controllers/r6-guide.controller.ts)
- [backend/src/modules/blog/interfaces/blog.interfaces.ts](../../../backend/src/modules/blog/interfaces/blog.interfaces.ts)

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
