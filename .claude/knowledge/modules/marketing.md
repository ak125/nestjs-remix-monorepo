---
module: marketing
sources:
- backend/src/modules/marketing
last_scan: '2026-05-06'
primary_files:
- backend/src/modules/marketing/controllers/marketing-backlinks.controller.ts
- backend/src/modules/marketing/controllers/marketing-briefs.controller.ts
- backend/src/modules/marketing/controllers/marketing-content-roadmap.controller.ts
- backend/src/modules/marketing/controllers/marketing-dashboard.controller.ts
- backend/src/modules/marketing/controllers/marketing-pipeline.controller.ts
- backend/src/modules/marketing/controllers/marketing-social-posts.controller.ts
- backend/src/modules/marketing/dto/marketing-brief.dto.ts
- backend/src/modules/marketing/interfaces/marketing-hub.interfaces.ts
depends_on:
- DatabaseModule
- AiContentModule
---

# Module Marketing

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `MarketingDataService`
- `MarketingHubDataService`
- `UTMBuilderService`

### Providers (top 15)
- `MarketingDataService`
- `MarketingDashboardService`
- `MarketingBacklinksService`
- `MarketingContentRoadmapService`
- `MarketingHubDataService`
- `UTMBuilderService`
- `WeeklyPlanGeneratorService`
- `MultiChannelCopywriterService`
- `BrandComplianceGateService`
- `PublishQueueService`

### Fichiers primaires
- [backend/src/modules/marketing/controllers/marketing-backlinks.controller.ts](../../../backend/src/modules/marketing/controllers/marketing-backlinks.controller.ts)
- [backend/src/modules/marketing/controllers/marketing-content-roadmap.controller.ts](../../../backend/src/modules/marketing/controllers/marketing-content-roadmap.controller.ts)
- [backend/src/modules/marketing/controllers/marketing-dashboard.controller.ts](../../../backend/src/modules/marketing/controllers/marketing-dashboard.controller.ts)
- [backend/src/modules/marketing/controllers/marketing-pipeline.controller.ts](../../../backend/src/modules/marketing/controllers/marketing-pipeline.controller.ts)
- [backend/src/modules/marketing/controllers/marketing-social-posts.controller.ts](../../../backend/src/modules/marketing/controllers/marketing-social-posts.controller.ts)
- [backend/src/modules/marketing/interfaces/marketing-hub.interfaces.ts](../../../backend/src/modules/marketing/interfaces/marketing-hub.interfaces.ts)
- [backend/src/modules/marketing/interfaces/marketing.interfaces.ts](../../../backend/src/modules/marketing/interfaces/marketing.interfaces.ts)
- [backend/src/modules/marketing/marketing.module.ts](../../../backend/src/modules/marketing/marketing.module.ts)

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
