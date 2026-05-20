# EXPLAIN (ANALYZE, BUFFERS) — PR-SBD-1 Task 1 gate merge

> **Date** : 2026-05-18
> **Status** : 🟡 GATE MERGE BLOQUANT — à exécuter sur PREPROD AVANT merge
> **Plan ref** : `.claude/plans/verifier-existant-avant-et-ethereal-firefly.md` (Task 1 Step 13)
> **PR** : PR-SBD-1.A

---

## Objet

Ce document est le gate merge obligatoire pour PR-SBD-1.A. Il documente :
1. Les commandes EXPLAIN à exécuter sur PREPROD pour chaque RPC v1
2. Les critères d'acceptation (verdict PASS / FAIL)
3. Les plans d'exécution capturés (à remplir au moment de la PR)

**Sans ce fichier complété avec verdict PASS, la PR ne peut pas être mergée.**

---

## Pré-requis

- Migrations Task 1 appliquées sur PREPROD :
  - `20260518_seo_control_000_enum_extension.sql`
  - `20260518_seo_control_001_helpers.sql`
  - `20260518_seo_control_002_rpcs.sql`
  - `20260518_seo_control_003_indexes.sql` (CONCURRENTLY, hors transaction)
- Dataset PREPROD avec données GSC réelles (≥ 30 jours d'historique idéal)
- Accès psql via `$PREPROD_DB_URL` (cf. `feedback_verify_db_secret_target_before_assume`)

---

## Critères d'acceptation (verdict)

Pour chacune des 6 RPCs (5 publiques + 1 wrapper), valider :

| Critère | Seuil | Vérification |
|---|---|---|
| **Aucun Seq Scan** sur `__seo_gsc_daily` | 0 | Chercher `Seq Scan on __seo_gsc_daily` dans le plan → DOIT être absent |
| **Aucun disk spill** (sort externe) | 0 | Chercher `Sort Method: external merge Disk:` → DOIT être absent (uniquement `quicksort Memory:`) |
| **Cache hit ratio** ≥ 95% | ≥ 95% | `buffers shared hit=X read=Y` → `X/(X+Y) ≥ 0.95` sur 2e exécution warm |
| **Execution Time p95** | < 300ms (per RPC) / < 500ms (wrapper) | 10 runs, prendre p95 |

Si **un seul critère échoue** sur une seule RPC, la PR est bloquée jusqu'à correction (index manquant, requête à reformuler, etc.).

---

## Commandes à exécuter

### Setup

```bash
# Sur la machine ayant accès PREPROD
export PREPROD_DB_URL="postgresql://..." # cf. secrets canon repo, vérifier cible
psql "$PREPROD_DB_URL" -c "SELECT version();"  # sanity check
```

### Warm-up cache (3 runs pour stabiliser shared_buffers)

```bash
for i in 1 2 3; do
  psql "$PREPROD_DB_URL" -c "SELECT rpc_seo_control_snapshot_v1('28d', '2026-05-18T10:00:00Z'::timestamptz);" > /dev/null
done
```

### 1. `rpc_seo_traffic_v1`

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT rpc_seo_traffic_v1(28, '2026-05-18T10:00:00Z'::timestamptz);
```

**Plan attendu (esquisse)** :
- Aggregate sur `__seo_gsc_daily` avec Index Scan sur `idx_gsc_daily_date_page`
- 2 sous-aggregates (curr + prev) parallélisables
- Pas de sort externe

**Plan capturé (à remplir lors de la PR)** :

```
<COLLER LE PLAN EXPLAIN ICI>
```

**Verdict** : ☐ PASS  ☐ FAIL (raison : ___)

---

### 2. `rpc_seo_top_losers_v1`

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT rpc_seo_top_losers_v1(28, '2026-05-18T10:00:00Z'::timestamptz, 20);
```

**Plan attendu** :
- Index Scan sur `idx_gsc_daily_date_page` pour curr/prev
- Hash Left Join curr ↔ prev
- Nested Loop LATERAL pour `_seo_top_queries_for_page_jsonb` (utilise `idx_gsc_daily_page_query_date`)
- ⚠️ Surveiller : `Sort Method` doit être `quicksort Memory:` pour `ORDER BY business_impact_score DESC LIMIT 20`

**Plan capturé** :

```
<COLLER LE PLAN EXPLAIN ICI>
```

**Verdict** : ☐ PASS  ☐ FAIL (raison : ___)

---

### 3. `rpc_seo_low_ctr_v1`

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT rpc_seo_low_ctr_v1(28, '2026-05-18T10:00:00Z'::timestamptz, 100, 0.01, 50);
```

**Plan attendu** :
- Index Scan sur `idx_gsc_daily_date_page`
- Aggregate avec HAVING (filtre côté SQL)
- `quicksort Memory:` pour LIMIT 50

**Plan capturé** :

```
<COLLER LE PLAN EXPLAIN ICI>
```

**Verdict** : ☐ PASS  ☐ FAIL (raison : ___)

---

### 4. `rpc_seo_alerts_v1`

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT rpc_seo_alerts_v1('2026-05-18T10:00:00Z'::timestamptz, 50);
```

**Plan attendu** :
- Index Scan sur `idx_seo_audit_findings_severity_open` (déjà existant)
- Index Scan sur `idx_seo_event_log_severity_unresolved` (déjà existant)
- Append (UNION ALL)
- Nested Loop LATERAL pour clicks_7d (utilise `idx_gsc_daily_page_date`)
- `quicksort Memory:` pour LIMIT 50

**Plan capturé** :

```
<COLLER LE PLAN EXPLAIN ICI>
```

**Verdict** : ☐ PASS  ☐ FAIL (raison : ___)

---

### 5. `rpc_seo_conversion_v1`

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT rpc_seo_conversion_v1(28, '2026-05-18T10:00:00Z'::timestamptz, 20);
```

**Plan attendu** :
- Index Scan sur `__seo_ga4_daily` via `idx_ga4_daily_page_date` (déjà existant)
- Index Scan sur `___xtr_order_line` via `idx_xtr_order_line_website_url_paid` (nouveau)
- Index Scan sur `___xtr_order` via `idx_xtr_order_date_paid` (nouveau)
- Hash Left Join traffic ↔ conv
- `quicksort Memory:` pour LIMIT 20

**⚠️ Risque** : si `idx_xtr_order_line_website_url_paid` n'est pas créé (CONCURRENTLY peut échouer silencieusement), fallback Seq Scan sur `___xtr_order_line` (table potentiellement large). Vérifier `\d ___xtr_order_line` montre l'index présent.

**Plan capturé** :

```
<COLLER LE PLAN EXPLAIN ICI>
```

**Verdict** : ☐ PASS  ☐ FAIL (raison : ___)

---

### 6. `rpc_seo_control_snapshot_v1` (wrapper, agrégation)

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT rpc_seo_control_snapshot_v1('28d', '2026-05-18T10:00:00Z'::timestamptz);
```

**Plan attendu** : appels séquentiels aux 5 RPCs ci-dessus. Execution Time = somme des 5 RPCs ≤ 500ms p95.

**Plan capturé** :

```
<COLLER LE PLAN EXPLAIN ICI>
```

**Verdict** : ☐ PASS  ☐ FAIL (raison : ___)

---

## Mesure performance p95 (10 runs warm)

Pattern bash automatique pour mesurer p95 par RPC :

```bash
measure_p95() {
  local rpc="$1"
  shift
  local timings=()
  for i in $(seq 1 10); do
    local start_ms=$(date +%s%3N)
    psql "$PREPROD_DB_URL" -c "SELECT $rpc;" > /dev/null
    local end_ms=$(date +%s%3N)
    timings+=($((end_ms - start_ms)))
  done
  IFS=$'\n' sorted=($(sort -n <<<"${timings[*]}"))
  unset IFS
  # p95 = 9e élément trié sur 10 (index 0-based = 8)
  echo "p95 ${rpc}: ${sorted[8]}ms"
}

measure_p95 "rpc_seo_traffic_v1(28, '2026-05-18T10:00:00Z'::timestamptz)"
measure_p95 "rpc_seo_top_losers_v1(28, '2026-05-18T10:00:00Z'::timestamptz, 20)"
measure_p95 "rpc_seo_low_ctr_v1(28, '2026-05-18T10:00:00Z'::timestamptz, 100, 0.01, 50)"
measure_p95 "rpc_seo_alerts_v1('2026-05-18T10:00:00Z'::timestamptz, 50)"
measure_p95 "rpc_seo_conversion_v1(28, '2026-05-18T10:00:00Z'::timestamptz, 20)"
measure_p95 "rpc_seo_control_snapshot_v1('28d', '2026-05-18T10:00:00Z'::timestamptz)"
```

**Résultats p95 (à remplir)** :

| RPC | p95 mesurée (ms) | Seuil (ms) | Verdict |
|---|---|---|---|
| `rpc_seo_traffic_v1` | ___ | 300 | ☐ PASS  ☐ FAIL |
| `rpc_seo_top_losers_v1` | ___ | 300 | ☐ PASS  ☐ FAIL |
| `rpc_seo_low_ctr_v1` | ___ | 300 | ☐ PASS  ☐ FAIL |
| `rpc_seo_alerts_v1` | ___ | 300 | ☐ PASS  ☐ FAIL |
| `rpc_seo_conversion_v1` | ___ | 300 | ☐ PASS  ☐ FAIL |
| `rpc_seo_control_snapshot_v1` (wrapper) | ___ | 500 | ☐ PASS  ☐ FAIL |

---

## Vérification indexes effectivement appliqués

Avant les EXPLAIN, confirmer que les 4 indexes CONCURRENTLY sont bien créés (parfois CONCURRENTLY échoue silencieusement) :

```sql
\d+ __seo_gsc_daily
-- doit lister : idx_gsc_daily_date_page (date, page) ← NOUVEAU
-- doit lister : idx_gsc_daily_page_query_date (page, query, date) WHERE query IS NOT NULL ← NOUVEAU

\d+ ___xtr_order_line
-- doit lister : idx_xtr_order_line_website_url_paid ← NOUVEAU

\d+ ___xtr_order
-- doit lister : idx_xtr_order_date_paid ← NOUVEAU
```

Si un index manque (état `INVALID`), il faut le `REINDEX CONCURRENTLY` ou `DROP + CREATE CONCURRENTLY` à nouveau.

---

## Verdict final

**Tous les critères PASS pour les 6 RPCs ?**

- ☐ Oui → PR-SBD-1.A peut être mergée
- ☐ Non → bloquant, corriger avant merge

**Validateur** : ___________ (signature)
**Date validation** : ___________

---

## Notes

- Si une régression perf est observée post-merge en PROD (synthetic monitoring déclenche), ce document doit être ré-exécuté sur PROD avec les nouveaux résultats annexés.
- En cas de p95 borderline (240-290ms), surveiller mais pas bloquant. < 300ms = strict.
- En cas de Sort Method `external merge`, possibilités : augmenter `work_mem` session, ajouter index couvrant, ou réduire le `LIMIT`.
