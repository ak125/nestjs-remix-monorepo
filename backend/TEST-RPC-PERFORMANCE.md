# 🚀 Test de Performance RPC Optimisé

## Étapes de déploiement

### 1. Déployer la fonction SQL sur Supabase

1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier le contenu de `backend/prisma/supabase-functions/get_gamme_page_data_optimized.sql`
3. Exécuter la requête (devrait retourner "Success. No rows returned")

### 2. Tester l'endpoint RPC V2

```bash
# Test avec gamme 2066 (rotule de direction)
time curl -s "http://localhost:3000/api/gamme-rest-optimized/2066/page-data-rpc-v2" | jq -r '.performance'

# Test avec gamme 10 (courroie d'accessoire)
time curl -s "http://localhost:3000/api/gamme-rest-optimized/10/page-data-rpc-v2" | jq -r '.performance'
```

### 3. Comparer avec l'ancien endpoint

```bash
# Ancien endpoint (multiple requêtes REST)
time curl -s "http://localhost:3000/api/gamme-rest-optimized/2066/page-data" | jq -r '.performance.total_time_ms'

# Nouveau endpoint RPC (1 seule requête)
time curl -s "http://localhost:3000/api/gamme-rest-optimized/2066/page-data-rpc-v2" | jq -r '.performance.total_time_ms'
```

## Objectifs de performance

- **Ancien système** : 138s (140 secondes) ❌
- **Objectif** : <5s ✅
- **Performance attendue RPC** : ~1.5-3s (latence réseau Supabase depuis Codespaces)

## Résultats

| Endpoint | Gamme | Temps (ms) | Amélioration |
|----------|-------|------------|--------------|
| `/page-data` | 10 | 528ms | ✅ Baseline |
| `/page-data` | 2066 | 180000ms | ❌ Très lent |
| `/page-data-rpc-v2` | 10 | ? | 🧪 À tester |
| `/page-data-rpc-v2` | 2066 | ? | 🧪 À tester |

## Notes

- La latence réseau vers Supabase depuis Codespaces est de **~1.5s par requête**
- L'endpoint RPC remplace **15+ requêtes HTTP** par **1 seule requête**
- Le cache Redis de page complète reste actif (TTL: 1h)
- Les types SQL ont été corrigés (INTEGER au lieu de TEXT pour *_pg_id)
