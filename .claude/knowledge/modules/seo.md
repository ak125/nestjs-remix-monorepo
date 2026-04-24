---
module: seo
sources:
- backend/src/modules/seo
last_scan: '2026-04-24'
primary_files:
- backend/src/modules/seo/config/hreflang.config.ts
- backend/src/modules/seo/config/sitemap.config.ts
- backend/src/modules/seo/constants/seo-templates.constants.ts
- backend/src/modules/seo/controllers/diagnostic.controller.ts
- backend/src/modules/seo/controllers/keywords-dashboard.controller.ts
- backend/src/modules/seo/controllers/r2-page.controller.ts
- backend/src/modules/seo/controllers/reference.controller.ts
- backend/src/modules/seo/controllers/robots-txt.controller.ts
depends_on:
- ConfigModule
- DatabaseModule
- WorkerModule
- CatalogModule
- AiContentModule
- NestCacheModule
---

# Module Seo

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `Core`
- `SeoService`
- `DynamicSeoV4UltimateService`
- `HreflangService`
- `ProductImageService`
- `RobotsTxtService`
- `SeoHeadersService`
- `UrlCompatibilityService`
- `Validation`
- `PageRoleValidatorService`
- `QualityValidatorService`
- `PurchaseGuideValidatorService`
- `Linking`
- `InternalLinkingService`
- `SeoLinkTrackingService`
- `Monitoring`
- `SeoMonitoringService`
- `SeoPilotageService`
- `SeoKpisService`
- `RiskFlagsEngineService`
- `GooglebotDetectorService`
- `KeywordsDashboardService`
- `LogIngestionService`
- `Sitemap`
- `SitemapV10Service`
- `SitemapV10HubsService`
- `SitemapV10ScoringService`
- `SitemapDeltaService`
- `SitemapStreamingService`
- `SitemapHygieneService`
- `SitemapVehiclePiecesValidator`
- `Content`
- `ReferenceService`
- `DiagnosticService`
- `SeoGeneratorService`
- `SeoTitleEngineService`

### Providers (top 15)
- `Core`
- `SeoService`
- `SeoV4SwitchEngineService`
- `SeoV4MonitoringService`
- `DynamicSeoV4UltimateService`
- `HreflangService`
- `ProductImageService`
- `RobotsTxtService`
- `SeoHeadersService`
- `UrlCompatibilityService`
- `Validation`
- `PageRoleValidatorService`
- `QualityValidatorService`
- `PurchaseGuideValidatorService`
- `Linking`

### Fichiers primaires
- [backend/src/modules/seo/config/hreflang.config.ts](../../../backend/src/modules/seo/config/hreflang.config.ts)
- [backend/src/modules/seo/config/sitemap.config.ts](../../../backend/src/modules/seo/config/sitemap.config.ts)
- [backend/src/modules/seo/constants/seo-templates.constants.ts](../../../backend/src/modules/seo/constants/seo-templates.constants.ts)
- [backend/src/modules/seo/controllers/diagnostic.controller.ts](../../../backend/src/modules/seo/controllers/diagnostic.controller.ts)
- [backend/src/modules/seo/controllers/keywords-dashboard.controller.ts](../../../backend/src/modules/seo/controllers/keywords-dashboard.controller.ts)
- [backend/src/modules/seo/controllers/r2-page.controller.ts](../../../backend/src/modules/seo/controllers/r2-page.controller.ts)
- [backend/src/modules/seo/controllers/reference.controller.ts](../../../backend/src/modules/seo/controllers/reference.controller.ts)
- [backend/src/modules/seo/controllers/robots-txt.controller.ts](../../../backend/src/modules/seo/controllers/robots-txt.controller.ts)

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
