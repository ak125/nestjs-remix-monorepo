---
check: partition-cron-gap
severity: critical
confidence: high
expected_false_positive_rate: 0.10
autofixable: false
sources:
  - pg_partitioned_table via supabase MCP
  - cron.job via supabase MCP
  - backend/supabase/migrations/**/*.sql
incidents_proven:
  - "#697 (2026-05-22, snapshot daily partitions épuisées — no partition found for row)"
  - "#698 (2026-05-22, gsc/ga4/cwv monthly partition falaise 2026-07-01)"
risk_documented:
  - reference_partitioned_snapshot_tables_need_premake_cron.md
  - reference_seo_partition_rotation_pattern.md
---

# Check : Partitioned Tables Without Rotation Cron

## Pattern audité

Tables partitionnées par range (daily / monthly) qui :

1. N'ont **aucune partition future** disponible au-delà des N prochains jours/mois
2. Ont une fonction de maintenance (`maintain_*_partitions`, `ensure_next_*_partition`)
   définie mais **AUCUNE entrée `cron.job` correspondante**

**Impact** : à la frontière temporelle, `INSERT` échoue avec
`no partition found for row` — cas PR #697/#698. Symptôme typique : incident
nocturne / mensuel à minuit UTC.

## Origine

- PR #697 : snapshot daily partitions hardcodées épuisées, rotation jamais
  schédulée.
- PR #698 : gsc/ga4/cwv monthly partitions falaise au 2026-07-01.
- Pattern récurrent documenté
  [reference_partitioned_snapshot_tables_need_premake_cron.md](reference_partitioned_snapshot_tables_need_premake_cron.md).

## Méthode

1. Lister les tables partitionnées par range :
   ```sql
   SELECT parent.relname AS parent_table, partstrat
   FROM pg_partitioned_table pt
   JOIN pg_class parent ON parent.oid = pt.partrelid
   WHERE partstrat = 'r'
   ```
2. Pour chaque table partitionnée, lister les partitions :
   ```sql
   SELECT inhrelid::regclass AS partition_name,
          pg_get_expr(c.relpartbound, c.oid) AS bound
   FROM pg_inherits i
   JOIN pg_class c ON c.oid = i.inhrelid
   WHERE i.inhparent = '<parent>'::regclass
   ```
3. Parser les bornes max → identifier les tables sans partition couvrant
   les N prochaines unités (N=14 days pour daily, N=2 months pour monthly,
   N=12 months pour yearly).
4. Vérifier `cron.job` :
   ```sql
   SELECT jobname, schedule, command FROM cron.job
   ```
   Pour chaque table en risque, chercher un job dont `command` mentionne
   `maintain_<table>_partitions` ou `ensure_next_<table>_partition`.
5. Findings :
   - `no_future_partition` : pas de partition au-delà du seuil N (severity critical)
   - `no_rotation_cron` : fonction maintenance présente mais pas dans `cron.job`
     (severity high)

## Sortie attendue (JSON)

```json
{
  "check": "partition-cron-gap",
  "pass": false,
  "findings": [
    {
      "table": "__seo_snapshot_daily",
      "max_partition_date": "2026-06-15",
      "days_remaining": 23,
      "category": "no_future_partition",
      "severity": "critical",
      "fix_hint": "CALL maintain_snapshot_daily_partitions() + schedule pg_cron"
    },
    {
      "table": "__quality_history_monthly",
      "maintenance_fn": "ensure_next_quality_history_partition",
      "cron_job": null,
      "category": "no_rotation_cron",
      "severity": "high",
      "fix_hint": "SELECT cron.schedule('quality-history-rotation', '0 3 * * *', 'CALL ensure_next_quality_history_partition()')"
    }
  ],
  "summary": { "scanned": 8, "at_risk": 2 }
}
```

## Faux positifs connus

- Tables partitionnées historiques (archives) où l'absence de partition
  future est volontaire. Mitigation : whitelist via commentaire SQL
  `COMMENT ON TABLE <t> IS 'archive-no-future-partition'`.

## Limites

- Ne couvre que `RANGE` partitioning (pas `LIST` ni `HASH`).
- Le seuil N par type est codé en dur ; à externaliser dans une V2 si
  besoin de tuning par table.
