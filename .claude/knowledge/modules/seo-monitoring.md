---
module: seo-monitoring
sources:
- backend/src/modules/seo-monitoring
last_scan: '2026-06-25'
primary_files:
- backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts
- backend/src/modules/seo-monitoring/controllers/cwv-dashboard.controller.ts
- backend/src/modules/seo-monitoring/controllers/funnel-events.controller.ts
- backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts
- backend/src/modules/seo-monitoring/controllers/runtime-events.controller.ts
- backend/src/modules/seo-monitoring/controllers/seo-monitoring.controller.ts
- backend/src/modules/seo-monitoring/helpers/ai-readiness-detectors.ts
- backend/src/modules/seo-monitoring/listeners/order-funnel.listener.test.ts
depends_on:
- ConfigModule
---

# Module Seo Monitoring

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
Module d'**observabilité SEO** (Phase 1) : ingestion quotidienne des sources Google
gratuites (GSC, GA4, CrUX, GSC Links) + collecte **RUM CWV** (beacons web-vitals)
dans des tables Postgres time-series partitionnées (`__seo_*`), avec dashboards et
alertes (`__seo_event_log`). Couche **consommatrice / observabilité** — jamais source
de vérité métier.

<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->

### Exports publics du module
- `GoogleCredentialsService`
- `GscDailyFetcherService`
- `Ga4DailyFetcherService`
- `CwvFetcherService`
- `GscLinksFetcherService`
- `CruxFieldFetcherService`
- `CruxAlerterService`
- `AuditFindingsService`
- `RContentAuditorService`
- `QualityHistorySnapshotService`
- `RagMirrorFreshnessService`

### Providers (top 15)
- `GoogleCredentialsService`
- `SeoMonitoringRunsService`
- `GscDailyFetcherService`
- `Ga4DailyFetcherService`
- `CwvFetcherService`
- `GscLinksFetcherService`
- `CruxFieldFetcherService`
- `CruxAlerterService`
- `AuditFindingsService`
- `RContentAuditorService`
- `QualityHistorySnapshotService`
- `RagMirrorFreshnessService`

### Fichiers primaires
- [backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/quality-history.controller.ts)
- [backend/src/modules/seo-monitoring/controllers/seo-monitoring.controller.ts](../../../backend/src/modules/seo-monitoring/controllers/seo-monitoring.controller.ts)
- [backend/src/modules/seo-monitoring/processors/seo-daily-fetch.processor.ts](../../../backend/src/modules/seo-monitoring/processors/seo-daily-fetch.processor.ts)
- [backend/src/modules/seo-monitoring/seo-monitoring.module.ts](../../../backend/src/modules/seo-monitoring/seo-monitoring.module.ts)
- [backend/src/modules/seo-monitoring/services/audit-findings.service.ts](../../../backend/src/modules/seo-monitoring/services/audit-findings.service.ts)
- [backend/src/modules/seo-monitoring/services/crux-alerter.service.ts](../../../backend/src/modules/seo-monitoring/services/crux-alerter.service.ts)
- [backend/src/modules/seo-monitoring/services/crux-alerter.test.ts](../../../backend/src/modules/seo-monitoring/services/crux-alerter.test.ts)
- [backend/src/modules/seo-monitoring/services/crux-api-client.service.ts](../../../backend/src/modules/seo-monitoring/services/crux-api-client.service.ts)

<!-- END AUTO-GENERATED -->

## Pourquoi
<!-- À compléter à la main : contraintes architecturales, décisions historiques, trade-offs. -->
Deux familles d'orchestration cohabitent **par sous-système** (pas un défaut global) :

- **NestJS-side (BullMQ/Bull, queue `seo-monitor`)** — le travail à I/O externe : fetch
  GSC/GA4/CrUX/Links (`SeoDailyFetchProcessor`, cron applicatif). L'app est le bon endroit
  (HTTP authentifié, secrets, retry applicatif).
- **DB-side (pg_cron)** — le SQL/RPC idempotent local à la donnée : agrégation CWV RUM
  `__seo_cwv_raw → __seo_cwv_hourly → __seo_cwv_daily_rum` (RPCs `aggregate_cwv_hourly` /
  `aggregate_cwv_daily_rum` ; jobs `cwv-hourly-aggregation` @ `:05` / `cwv-daily-rum-aggregation`
  @ `00:15` UTC, migration `20260626_seo_cwv_aggregation_cron`) + rotations de partitions.
  pg_cron tourne **là où vit la donnée** → toujours-actif, survit aux restarts/déploiements,
  zéro dépendance app/flag/DEV.

ADR-045 (amendement 2026-06-26) gouverne ce placement ; ADR-063 gouverne la distinction
RUM (field, beacons) vs CrUX (field API) vs lab.

## Gotchas
<!-- À compléter à la main : pièges connus, bugs célèbres, invariants non évidents. -->
- **CWV aggregation = pg_cron, plus Bull.** L'ancien `CwvAggregationSchedulerService`
  (Bull v4 repeatables) a été **retiré** (#1166). Il ne tournait que sur un worker runtime
  (poste **DEV**) et son `onModuleInit` retournait sur flag-off *avant*
  `removeStaleRepeatables()` → une chaîne de données PROD dépendait du poste DEV (anti-pattern
  `deployment.md`). La pipeline a été **figée 2026-06-03 → 2026-06-23** par ce trou ; le raw
  perdu passé le TTL (~48 h) n'est pas reconstructible.
- **Couverture observée, pas devinée.** `detect_cwv_aggregation_coverage_gap()` (job
  `cwv-aggregation-coverage-check` @ `35 * * * *`) alerte sur des heures raw humaines non
  agrégées et **auto-résout** quand la couverture revient (OPEN→RESOLVED, ADR-063). Pour le
  dernier statut d'un job : `cron.job_run_details` (+ `cron.log_run=on`), pas un health endpoint
  applicatif.
- **Latent — clé `ON CONFLICT`.** `aggregate_cwv_*` groupe par `priority_tier` mais la clé
  d'upsert l'omet et *remplace* `sample_count` → last-wins silencieux si `priority_tier` dérivait
  dans une même clé (sûr aujourd'hui : dérivé serveur déterministe).
- **`fetched_at`** = « dernière recomputation » (réagrégation 48 h auto-heal), pas « première vue ».

## Références
<!-- À compléter à la main : liens vers `.claude/rules/`, vault ADRs, MEMORY.md entries. -->
- Migrations : [`20260626_seo_cwv_aggregation_cron.sql`](../../../backend/supabase/migrations/20260626_seo_cwv_aggregation_cron.sql)
  · [`20260601_seo_cwv_aggregation_coverage_alert.sql`](../../../backend/supabase/migrations/20260601_seo_cwv_aggregation_coverage_alert.sql)
- Déploiement (DEV vs PROD, anti-pattern data-chain-sur-DEV) : [`.claude/rules/deployment.md`](../../rules/deployment.md)
- Vault : ADR-045 (cron SEO), ADR-063 (CWV RUM vs CrUX), runbook `ops/runbooks/cwv-rum-pipeline-recovery.md`
- Skills : `web-vitals-audit`, `runtime-truth-audit`
