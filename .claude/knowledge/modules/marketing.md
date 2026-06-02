---
module: marketing
sources:
- backend/src/modules/marketing
last_scan: '2026-06-02'
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

### Backlinks — deux tables distinctes, ne pas confondre

Le repo a **deux tables backlinks** qui répondent à deux questions différentes :

| Table | Module | Source | Statut runtime | Quoi |
|---|---|---|---|---|
| `__marketing_backlinks` | `marketing/` (ce module) | CRUD manuel | **Peuplée (~122 rows constatées 2026-05-24)** | Pilotage outreach : campaign_id, anchor_type, da_score, status (`pending`, `live`, `lost`…) |
| `__seo_gsc_links_weekly` | `seo-monitoring/` (autre module) | Pipeline auto via `GscLinksFetcherService` | **0 rows par design** | Snapshot hebdo GSC top backlinks — VIDE par limitation Google API publique |

- L'UI admin `/admin/marketing/backlinks` lit `__marketing_backlinks` via `MarketingDataService.getBacklinks()` ([marketing-data.service.ts:43](../../../backend/src/modules/marketing/services/marketing-data.service.ts)), **pas** `__seo_gsc_links_weekly`.
- Si un dump GSC manuel (export web) doit être ingéré, c'est dans `__marketing_backlinks` via `POST /api/admin/marketing/backlinks` (CRUD) ou bulk via `MarketingBacklinksService.bulkImport()`.

### Pipeline `__seo_gsc_links_weekly` — vide intentionnellement

`GscLinksFetcherService` ([gsc-links-fetcher.service.ts:103-130](../../../backend/src/modules/seo-monitoring/services/gsc-links-fetcher.service.ts)) :

- Tourne **chaque jour à 02:00 UTC** (worker BullMQ queue `seo-monitor`, processor `seo-daily-fetch.processor.ts`).
- L'API Google Search Console v1 publique **n'expose pas** d'endpoint `listBacklinks` / top linking sites.
- Le service appelle `sc.sites.list({})` comme health-check d'auth, log `runs.logCompleted({rowsInserted: 0})`, et pousse le warning `gsc_links_endpoint_not_publicly_available_v1__use_bulk_export_or_v2_dataforseo` dans `__seo_event_log`.
- Comportement **100% intentionnel et documenté** dans le code. Pas un bug.
- Débloquage prévu V2 paid provider (DataForSEO ou Ahrefs) — ADR-025 reporte budget.

**Anti-pattern à éviter** : ouvrir une PR pour « réparer » l'ingestion `__seo_gsc_links_weekly`. Vérifier d'abord `__seo_event_log WHERE payload->>'source' = 'gsc_links'` — si warnings = `gsc_links_endpoint_not_publicly_available_v1__*`, c'est attendu. Verdict empirique 2026-05-24.

### Schémas distincts

`__marketing_backlinks` (CRUD) : `id (int)`, `campaign_id`, `source_url`, `source_domain`, `target_url`, `anchor_text`, `anchor_type`, `link_type`, `status`, `da_score`, `dr_score`, `first_seen`, `last_checked`, `source_category`, `notes`, `created_at`, `updated_at`.

`__seo_gsc_links_weekly` (snapshot GSC) : `snapshot_date`, `source_domain`, `source_url`, `target_url`, `anchor_text` (cf. ADR-025 + migration `20260425_seo_observability_timeseries.sql`).

## Références

- **ADR-025** SEO Department Architecture (vault) — déclaration `__seo_gsc_links_weekly` + report V2 paid provider
- **ADR-045** SEO Monitoring Cron v0 (vault) — chaîne `payload->>source IN ('gsc', 'ga4', 'cwv', 'gsc_links')` dans `__seo_event_log`
- **Migration** [20260425_seo_observability_timeseries.sql](../../../backend/supabase/migrations/20260425_seo_observability_timeseries.sql) — création `__seo_gsc_links_weekly`
- **Migration** [20260430_marketing_layer_phase1.sql](../../../backend/supabase/migrations/20260430_marketing_layer_phase1.sql) — création `__marketing_backlinks`
- **Service auto** [GscLinksFetcherService](../../../backend/src/modules/seo-monitoring/services/gsc-links-fetcher.service.ts) (seo-monitoring)
- **Service CRUD** [MarketingBacklinksService](../../../backend/src/modules/marketing/services/marketing-backlinks.service.ts) (ce module)
- **Controller CRUD** [MarketingBacklinksController](../../../backend/src/modules/marketing/controllers/marketing-backlinks.controller.ts) `/api/admin/marketing/backlinks`
- **UI admin** [admin.marketing.backlinks.tsx](../../../frontend/app/routes/admin.marketing.backlinks.tsx)
- **Audit trail runtime** `__seo_event_log` (table) — filter `payload->>'source' = 'gsc_links'` pour voir les runs quotidiens et leurs warnings
