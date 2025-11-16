# 🚀 Guide de déploiement - Optimisation performance 146M lignes

## 📋 Contexte

Table `pieces_relation_type` contenant **146 373 485 lignes (12 GB)** causant des timeouts (30-60s) sur les requêtes de catalogue véhicule.

**Symptôme actuel:** Catalogue retourne 0 familles pour les pages véhicules (exemple: Porsche Cayenne TDI type_id=30764).

---

## 🎯 Stratégie de déploiement progressive

### Phase 1: Index composite (PRIORITÉ CRITIQUE - À faire MAINTENANT)
- **Objectif:** Résoudre immédiatement les timeouts
- **Durée:** 5-10 minutes de création + 2 minutes de tests
- **Impact:** 30-60s → 1-2s par requête
- **Risque:** ZÉRO (lecture seule, pas de modification code)

### Phase 2: Vue matérialisée + CRON (Optimisation long terme)
- **Objectif:** Cache haute performance
- **Durée:** 20-30 minutes première création + 10 minutes configuration
- **Impact:** 1-2s → 5-10ms par requête
- **Risque:** Faible (logique fallback en place)

---

## 📝 Étape 1: Créer l'index composite (URGENT)

### 1.1 Exécuter le script SQL dans Supabase

1. Ouvrir [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Copier-coller le contenu de `backend/sql/001-create-index-vehicle-compatibility.sql`
3. **Cliquer sur "Run"** (⏱️ Durée attendue: 5-10 minutes)

```sql
-- Le script créera automatiquement l'index sans bloquer la production
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_vehicle 
ON pieces_relation_type (rtp_type_id, rtp_pg_id);
```

### 1.2 Vérifier la création de l'index

Exécuter dans SQL Editor:

```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes 
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
WHERE tablename = 'pieces_relation_type'
AND indexname = 'idx_pieces_relation_type_vehicle';
```

**Résultat attendu:**
```
indexname: idx_pieces_relation_type_vehicle
index_size: ~2-3 GB
```

### 1.3 Tester les performances

```sql
EXPLAIN ANALYZE
SELECT DISTINCT rtp_pg_id 
FROM pieces_relation_type
WHERE rtp_type_id = 30764
LIMIT 50000;
```

**Résultat attendu:**
```
Execution Time: 1000-2000 ms (au lieu de 30000-60000 ms)
Planning Time: < 5 ms
Index Scan using idx_pieces_relation_type_vehicle
```

### 1.4 Invalider le cache backend

```bash
# Option A: Redémarrer le backend NestJS
cd /workspaces/nestjs-remix-monorepo/backend
npm run start:dev

# Option B: Vider Redis (si configuré)
redis-cli FLUSHDB
```

### 1.5 Tester l'API

```bash
# Test véhicule Porsche Cayenne TDI (type_id=30764)
curl http://localhost:3000/api/catalog/families/vehicle-v4/30764 | jq

# Résultat attendu:
# {
#   "queryType": "V4_INDEXED_TABLE",
#   "totalFamilies": 8-12,  # Au lieu de 0
#   "families": [...]
# }
```

---

## 📝 Étape 2: Vue matérialisée + CRON (Optionnel - Week-end)

⚠️ **NE PAS EXÉCUTER AVANT D'AVOIR VALIDÉ L'INDEX PHASE 1**

### 2.1 Exécuter le script SQL Phase 2

1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier-coller le contenu de `backend/sql/002-create-materialized-view-cron.sql`
3. **Cliquer sur "Run"** (⏱️ Durée attendue: 20-30 minutes)

Le script effectue automatiquement:
- Création vue matérialisée `mv_vehicle_compatible_gammes`
- Création index unique (obligatoire pour refresh CONCURRENTLY)
- Configuration CRON refresh nocturne (2h du matin)
- Table de logs `mv_refresh_log` pour monitoring

### 2.2 Vérifier la vue matérialisée

```sql
-- Vérifier la taille (devrait être ~50-100 MB au lieu de 12 GB)
SELECT pg_size_pretty(pg_total_relation_size('mv_vehicle_compatible_gammes'));

-- Compter les lignes (devrait être ~500K au lieu de 146M)
SELECT COUNT(*) FROM mv_vehicle_compatible_gammes;

-- Vérifier fraîcheur
SELECT MAX(last_updated) FROM mv_vehicle_compatible_gammes;
```

### 2.3 Tester les performances

```sql
EXPLAIN ANALYZE
SELECT pg_id, pieces_count
FROM mv_vehicle_compatible_gammes
WHERE type_id = 30764;
```

**Résultat attendu:**
```
Execution Time: 5-10 ms (au lieu de 1000-2000 ms)
Index Scan using idx_mv_vehicle_gammes_pk
```

### 2.4 Vérifier le CRON

```sql
-- Lister les jobs CRON
SELECT * FROM cron.job WHERE jobname LIKE '%vehicle%';

-- Résultat attendu:
-- jobname: refresh-vehicle-compatible-gammes
-- schedule: 0 2 * * * (tous les jours à 2h)
-- active: true
```

### 2.5 Tester l'API avec la vue

```bash
curl http://localhost:3000/api/catalog/families/vehicle-v4/30764 | jq

# Résultat attendu:
# {
#   "queryType": "V4_MATERIALIZED_VIEW",  # Au lieu de V4_INDEXED_TABLE
#   "performance": {
#     "source": "materialized_view",
#     "duration_ms": 5-10
#   },
#   "totalFamilies": 8-12,
#   "families": [...]
# }
```

---

## 🔍 Monitoring et maintenance

### Dashboard de monitoring recommandé

```sql
-- Vérifier l'historique des refresh
SELECT 
  refresh_started_at,
  refresh_completed_at,
  refresh_completed_at - refresh_started_at as duration,
  rows_affected,
  success,
  error_message
FROM mv_refresh_log
WHERE view_name = 'mv_vehicle_compatible_gammes'
ORDER BY refresh_started_at DESC
LIMIT 10;
```

### Alertes à configurer

1. **Vue non rafraîchie depuis > 24h**
   ```sql
   SELECT NOW() - MAX(last_updated) as age
   FROM mv_vehicle_compatible_gammes;
   -- Si > 24h → alerte
   ```

2. **Refresh CRON échoué**
   ```sql
   SELECT * FROM mv_refresh_log
   WHERE success = FALSE
   ORDER BY refresh_started_at DESC
   LIMIT 1;
   ```

3. **Performance dégradée backend**
   - Logs NestJS: Surveiller `[NIVEAU 2]` ou `[NIVEAU 3]` dans les logs
   - Si majorité des requêtes utilisent NIVEAU 2 → vue stale
   - Si NIVEAU 3 → problème critique (index + vue indisponibles)

---

## 🚨 Troubleshooting

### Problème 1: Index ne s'améliore pas les performances

**Symptôme:** Requête toujours timeout après création index

**Diagnostic:**
```sql
-- Vérifier que l'index est utilisé
EXPLAIN SELECT DISTINCT rtp_pg_id 
FROM pieces_relation_type
WHERE rtp_type_id = 30764;

-- Devrait afficher: "Index Scan using idx_pieces_relation_type_vehicle"
-- Si affiche: "Seq Scan" → index non utilisé
```

**Solution:**
```sql
-- Forcer analyse table
ANALYZE pieces_relation_type;

-- Réessayer la requête
```

### Problème 2: Vue matérialisée vide

**Symptôme:** `SELECT COUNT(*) FROM mv_vehicle_compatible_gammes` retourne 0

**Solution:**
```sql
-- Refresh manuel
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vehicle_compatible_gammes;

-- Si erreur "no unique index" :
CREATE UNIQUE INDEX idx_mv_vehicle_gammes_pk 
ON mv_vehicle_compatible_gammes (type_id, pg_id);
```

### Problème 3: CRON ne s'exécute pas

**Diagnostic:**
```sql
-- Vérifier l'extension pg_cron
SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- Vérifier les jobs
SELECT * FROM cron.job;
```

**Solution Supabase:**
Sur Supabase, pg_cron est géré automatiquement. Si le job n'apparaît pas:
1. Vérifier que vous êtes sur un plan payant (pg_cron non disponible en free tier)
2. Créer le job via Supabase Dashboard > Database > Cron Jobs

### Problème 4: Backend retourne toujours 0 familles

**Symptôme:** API retourne `totalFamilies: 0` même après création index

**Solution:**
```bash
# 1. Vider le cache Redis
redis-cli FLUSHDB

# 2. Redémarrer backend
cd /workspaces/nestjs-remix-monorepo/backend
npm run start:dev

# 3. Vérifier les logs backend (doit afficher "NIVEAU 1" ou "NIVEAU 2")
tail -f logs/backend.log | grep "NIVEAU"
```

---

## 📊 Comparatif performances attendues

| Étape | Temps requête | Source données | Fraîcheur | Scalabilité |
|-------|---------------|----------------|-----------|-------------|
| **Avant (aucun index)** | 30-60s ❌ | Table 146M lignes | Temps réel | Timeout |
| **Phase 1 (index)** | 1-2s ⚠️ | Table indexée | Temps réel | OK jusqu'à 200M |
| **Phase 2 (vue MV)** | 5-10ms ✅ | Vue 500K lignes | < 24h | Excellente |

---

## ✅ Checklist de déploiement

### Phase 1 (URGENT - Cette semaine)
- [ ] Exécuter `001-create-index-vehicle-compatibility.sql` dans Supabase
- [ ] Vérifier création index (taille ~2-3 GB)
- [ ] Tester performance SQL (1-2s au lieu de 30-60s)
- [ ] Redémarrer backend ou vider cache Redis
- [ ] Tester API `/api/catalog/families/vehicle-v4/30764`
- [ ] Vérifier logs backend `[NIVEAU 2 - INDEX COMPOSITE]`
- [ ] Valider catalogue affiche 8-12 familles (diesel pour Porsche TDI)

### Phase 2 (OPTIONNEL - Week-end)
- [ ] Exécuter `002-create-materialized-view-cron.sql` dans Supabase
- [ ] Vérifier création vue (taille ~50-100 MB, ~500K lignes)
- [ ] Vérifier CRON configuré (schedule: 0 2 * * *)
- [ ] Tester performance SQL (5-10ms)
- [ ] Tester API retourne `queryType: V4_MATERIALIZED_VIEW`
- [ ] Vérifier logs backend `[NIVEAU 1 - VUE MATÉRIALISÉE]`
- [ ] Configurer alertes monitoring (refresh failed, vue stale)

---

## 📞 Support

**En cas de problème:**
1. Vérifier les logs backend: `tail -f backend/logs/*.log`
2. Vérifier les logs CRON: `SELECT * FROM mv_refresh_log`
3. Vérifier les index PostgreSQL: `\di+ pieces_relation_type`
4. Contacter l'équipe infra avec:
   - Type véhicule testé (ex: type_id=30764)
   - Logs backend (NIVEAU 1/2/3)
   - Résultat `EXPLAIN ANALYZE` de la requête SQL
