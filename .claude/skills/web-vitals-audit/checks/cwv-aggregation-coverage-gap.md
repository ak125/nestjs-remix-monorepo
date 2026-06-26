---
check: cwv-aggregation-coverage-gap
severity: critical
confidence: high
expected_false_positive_rate: 0.05
autofixable: false
sources:
  - __seo_cwv_raw + __seo_cwv_hourly + __seo_cwv_daily_rum via supabase MCP (anti-join)
  - cron.job + cron.job_run_details via supabase MCP (both pg_cron jobs)
  - scripts/audit/runtime-truth/bull-repeatable-drift.ts (no Bull dup)
incidents_proven:
  - "web-vitals-attribution-unstable — agrégation CWV RUM figée 2026-06-03→2026-06-23 (raw afflue, hourly vide, daily_rum gelé ; ~20j perdus passé le TTL raw ~48h). Fix pg_cron #1165 + Bull retiré #1166."
---

# Check : CWV Aggregation Coverage Gap (RUM raw → hourly → daily_rum)

## Pattern audité

`__seo_cwv_raw` reçoit des **beacons humains** mais ces heures **ne sont pas
agrégées** dans `__seo_cwv_hourly` (et donc jamais roulées dans `__seo_cwv_daily_rum`).
L'agrégation s'est arrêtée → la donnée RUM se perd silencieusement (raw TTL ~48 h).

C'est l'incident **2026-06-03→2026-06-23** : l'orchestration était un scheduler **Bull v4**
sur un worker DEV mort, dont `onModuleInit` retournait sur flag-off *avant* le nettoyage.
Désormais l'orchestration est **pg_cron** (jobs `cwv-hourly-aggregation` @ `:05` /
`cwv-daily-rum-aggregation` @ `00:15` UTC, migration `20260626_seo_cwv_aggregation_cron`).

> Distinct de `cwv-beacon-ingestion-gap` (raw **vide**) et de `__seo_cwv_daily` (table
> **lab PageSpeed**, pas la chaîne RUM).

## Méthode

1. **Anti-join couverture** (heures raw humaines complètes absentes de hourly) :
   ```sql
   WITH raw_hours AS (
     SELECT DISTINCT date_trunc('hour', received_at) AS hour
     FROM __seo_cwv_raw
     WHERE ua_class = 'human' AND received_at < date_trunc('hour', now())
   )
   SELECT count(*) AS missing_complete_hours
   FROM raw_hours r
   WHERE NOT EXISTS (
     SELECT 1 FROM __seo_cwv_hourly h WHERE h.hour = r.hour AND h.ua_class = 'human'
   );
   ```
2. **Les deux jobs pg_cron existent + ont tourné** (exécution, pas existence) :
   ```sql
   SELECT j.jobname, j.schedule, j.active, r.status, r.return_message, r.end_time
   FROM cron.job j
   LEFT JOIN LATERAL (SELECT * FROM cron.job_run_details d
                      WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1) r ON true
   WHERE j.jobname IN ('cwv-hourly-aggregation', 'cwv-daily-rum-aggregation');
   ```
   (Nécessite `cron.log_run = on` pour `job_run_details`.)
3. **Pas de double orchestrateur Bull** : `tsx scripts/audit/runtime-truth/bull-repeatable-drift.ts`
   → 0 repeatable `cwv-aggregation-*` (sinon dual-orchestrator, cf. runtime-truth-audit
   `scheduled-orchestrator-drift`).
4. **Fraîcheur daily** : `max(date) FROM __seo_cwv_daily_rum` doit être ≥ hier (UTC).

## Findings

- `missing_complete_hours > 0` **OU** un job `missing` / `not active` / dernier run ≠
  `succeeded` / jamais exécuté → `aggregation_coverage_gap` (severity **critical**).
- `daily_rum` plus vieux qu'hier alors que hourly est frais → `daily_rollup_stalled`.
- Une repeatable Bull `cwv-aggregation-*` survivante → `dual_orchestrator` (renvoyer vers
  runtime-truth-audit).
- Tout vert (`missing=0`, deux jobs `succeeded`, daily J-1, 0 Bull) → `pass`.

## Sortie attendue (JSON)

```json
{
  "check": "cwv-aggregation-coverage-gap",
  "pass": false,
  "findings": [
    {
      "category": "aggregation_coverage_gap",
      "missing_complete_hours": 17,
      "hourly_job_last_status": "succeeded",
      "daily_job_last_status": "no run found",
      "newest_daily_rum": "2026-06-03",
      "bull_repeatables_cwv": 0,
      "severity": "critical",
      "fix_hint": "Backfill OWNER : aggregate_cwv_hourly(<hour>) puis aggregate_cwv_daily_rum(<date>) AVANT purge raw (TTL ~48h). Vérifier cron.job_run_details + cron.log_run=on. ADR-045."
    }
  ],
  "summary": { "missing_complete_hours": 17, "pg_cron_jobs_healthy": false }
}
```

## Faux positifs connus

- Fenêtre de grâce : l'heure courante + la précédente ne sont pas encore agrégées (job @ `:05`).
  Mitigation : l'anti-join exclut déjà l'heure en cours ; tolérer 1 heure isolée.
- Maintenance DB courte ratée puis rattrapée (auto-heal 48 h). Mitigation : le détecteur
  `detect_cwv_aggregation_coverage_gap()` a un seuil anti-flapping (`p_min_missing = 2`).

## Limites

- Lit la couverture, pas la justesse de l'agrégat (poids `sample_count`, `priority_tier`).
- Ne backfille jamais automatiquement (le backfill est owner-gated avant purge raw).
