---
module: seo-logs
sources:
- backend/src/modules/seo-logs
last_scan: '2026-05-01'
primary_files:
- backend/src/modules/seo-logs/controllers/crawl-budget-audit.controller.ts
- backend/src/modules/seo-logs/controllers/crawl-budget-experiment.controller.ts
- backend/src/modules/seo-logs/controllers/seo-audit.controller.ts
- backend/src/modules/seo-logs/controllers/seo-kpi.controller.ts
- backend/src/modules/seo-logs/dto/crawl-budget-experiment.dto.ts
- backend/src/modules/seo-logs/seo-logs.module.ts
- backend/src/modules/seo-logs/services/crawl-budget-audit.service.ts
- backend/src/modules/seo-logs/services/crawl-budget-experiment.service.ts
depends_on: []
---

# Module Seo Logs

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `SeoAuditSchedulerService`
- `CrawlBudgetOrchestratorService`

### Providers (top 15)
- `SeoAuditSchedulerService`
- `CrawlBudgetSupabaseService`
- `GoogleSearchConsoleService`
- `GoogleAnalyticsService`
- `SitemapGeneratorService`
- `CrawlBudgetOrchestratorService`
- `CrawlBudgetAuditService`

### Fichiers primaires
- [backend/src/modules/seo-logs/controllers/crawl-budget-audit.controller.ts](../../../backend/src/modules/seo-logs/controllers/crawl-budget-audit.controller.ts)
- [backend/src/modules/seo-logs/controllers/crawl-budget-experiment.controller.ts](../../../backend/src/modules/seo-logs/controllers/crawl-budget-experiment.controller.ts)
- [backend/src/modules/seo-logs/controllers/seo-audit.controller.ts](../../../backend/src/modules/seo-logs/controllers/seo-audit.controller.ts)
- [backend/src/modules/seo-logs/controllers/seo-kpi.controller.ts](../../../backend/src/modules/seo-logs/controllers/seo-kpi.controller.ts)
- [backend/src/modules/seo-logs/dto/crawl-budget-experiment.dto.ts](../../../backend/src/modules/seo-logs/dto/crawl-budget-experiment.dto.ts)
- [backend/src/modules/seo-logs/seo-logs.module.ts](../../../backend/src/modules/seo-logs/seo-logs.module.ts)
- [backend/src/modules/seo-logs/services/crawl-budget-audit.service.ts](../../../backend/src/modules/seo-logs/services/crawl-budget-audit.service.ts)
- [backend/src/modules/seo-logs/services/crawl-budget-experiment.service.ts](../../../backend/src/modules/seo-logs/services/crawl-budget-experiment.service.ts)

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
