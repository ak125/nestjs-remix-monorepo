---
check: scheduled-orchestrator-drift
severity: critical
confidence: high
expected_false_positive_rate: 0.05
autofixable: false
sources:
  - cron.job + cron.job_run_details via supabase MCP (declared vs ran)
  - scripts/audit/runtime-truth/bull-repeatable-drift.ts (persisted Bull repeatables)
  - backend/src/workers/worker.module.ts (BullMQ/Bull processors + schedulers)
  - backend/.env.example (orphan scheduler kill switches)
  - audit/registry/canonical.json
incidents_proven:
  - "web-vitals-attribution-unstable — CWV RUM aggregation orchestrated by a dead Bull v4 scheduler on the DEV worker (onModuleInit returned on flag-off BEFORE removeStaleRepeatables). Frozen 2026-06-03→2026-06-23. Fix = pg_cron #1165, Bull retired #1166."
---

# Check : Scheduled Orchestrator Drift

## Pattern audité

Un **travail planifié déclaré** (pg_cron `cron.job` OU repeatable BullMQ/Bull) ne se
comporte pas comme attendu en runtime : il **n'existe pas**, **existe en double**, a une
**définition divergente**, **n'a jamais tourné**, **ne produit pas sa sortie**, son
**consommateur ne l'observe pas**, ou une **repeatable survit après le retrait de son
orchestrateur** (deux orchestrateurs pour le même travail).

C'est la généralisation de l'incident CWV : l'agrégation tournait sur un scheduler Bull
mort (worker DEV), une chaîne de données PROD ne doit jamais dépendre du poste DEV
(`deployment.md`). Le swap d'orchestrateur (Bull → pg_cron) doit **supprimer l'état
persistant** de l'ancien, sinon dual-orchestrator silencieux.

## Findings (taxonomie)

| id | sens |
|---|---|
| `missing` | job attendu absent de `cron.job` (ou repeatable attendue absente) |
| `duplicate` | 2+ jobs même `jobname` (souvent owners différents) → exécution ambiguë |
| `mismatch` | schedule/command divergent de la définition de migration attendue |
| `never_ran` | job présent mais `cron.job_run_details` vide (jamais déclenché) |
| `output_not_produced` | a tourné `succeeded` mais l'effet attendu manque (ex. `missing_complete_hours > 0`) |
| `consumer_not_observing` | sortie produite mais le consommateur (dashboard/SLO) ne la lit pas |
| `persisted_repeatable_after_retirement` | repeatable Bull `*-aggregation` survit après bascule pg_cron |

Toute occurrence ⇒ severity **critical** (perte de données / dérive silencieuse).

## Méthode

1. **pg_cron déclaré vs réel** : pour chaque job attendu (liste dérivée des migrations
   `cron.schedule(...)`), vérifier présence unique + `active` + schedule/command =
   définition attendue (marqueur de provenance inclus) :
   ```sql
   SELECT jobname, count(*) AS n, bool_and(active) AS all_active
   FROM cron.job GROUP BY jobname HAVING count(*) > 1;          -- duplicate
   ```
2. **Exécution, pas existence** : dernier `cron.job_run_details` par job (nécessite
   `cron.log_run = on`) — statut `succeeded` + `end_time` récent ; sinon `never_ran` /
   `mismatch`.
3. **Sortie réelle** : la conséquence métier existe (ex. CWV : anti-join
   `missing_complete_hours = 0` ; daily ≥ J-1). Sinon `output_not_produced`.
4. **Pas de double orchestrateur** : `tsx scripts/audit/runtime-truth/bull-repeatable-drift.ts`
   → 0 repeatable `*-aggregation` retirée encore persistée dans Redis worker.
5. **Consommateur** : la surface qui lit l'agrégat (dashboard, SLO) renvoie des lignes
   fraîches. Sinon `consumer_not_observing`.

## Sortie attendue (JSON)

```json
{
  "check_name": "scheduled-orchestrator-drift",
  "health_status": "FAIL",
  "coverage_status": "RECURRING",
  "findings": [
    {
      "id": "scheduled-orchestrator:cwv-daily-rum-aggregation:never_ran",
      "severity": "critical",
      "title": "cwv-daily-rum-aggregation present but cron.job_run_details empty",
      "detail": { "jobname": "cwv-daily-rum-aggregation", "schedule": "15 0 * * *", "last_run": null },
      "fix_hint": "Vérifier cron.log_run=on + que pg_cron est actif ; backfill aggregate_cwv_daily_rum(<date>) si trou."
    }
  ],
  "evidence": { "pg_cron_jobs": 2, "bull_repeatables_retired_persisted": 0 }
}
```

## Faux positifs connus

- Job tout juste créé (migration appliquée < 1 cycle) : pas encore de run. Mitigation :
  borner `job_run_details` à `>= migration_applied_at`, tolérer le premier cycle.
- Bull repeatable d'un travail **non retiré** (légitime, ex. `seo-daily-fetch`). Mitigation :
  le probe ne flag que le **préfixe retiré** (`cwv-aggregation-*`).

## Limites

- Lit l'orchestration + la sortie, pas la justesse interne de l'agrégat.
- N'écrit jamais : ni `cron.schedule`, ni purge Redis. Le remède (backfill, purge
  repeatable) est owner-gated.
