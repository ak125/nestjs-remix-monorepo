# 🚀 Migration vers RPC V2 - Documentation

## ✅ Migration Complétée

**Date**: 13 novembre 2025  
**Statut**: ✅ Déployé avec fallback automatique

## 📊 Amélioration des Performances

| Métrique | Avant (Classic) | Après (RPC V2) | Gain |
|----------|-----------------|----------------|------|
| **Temps de réponse** | ~680ms | ~75ms | **9x plus rapide** |
| **Requêtes HTTP** | 15+ requêtes | 1 seule requête | **-93%** |
| **Complexité code** | 1186 lignes | 36 lignes | **-97%** |

## 🏗️ Architecture

### Avant
```
Frontend → API (15+ requêtes REST) → Supabase
         ↓
    ~680ms avec cache
```

### Après
```
Frontend → API (1 RPC) → PostgreSQL Function → Supabase
         ↓
    ~75ms avec fallback automatique
```

## 🔧 Implémentation

### Service API avec Fallback

Le nouveau service `gamme-api.service.ts` implémente une stratégie de fallback automatique :

1. **Tentative RPC V2** (ultra-rapide)
   - Si succès → retourne en ~75ms
   - Si échec → passe automatiquement à l'étape 2

2. **Fallback Classic** (méthode classique)
   - Méthode éprouvée avec cache Redis
   - Retourne en ~680ms

3. **Logging automatique**
   - Log des performances pour monitoring
   - Alertes en cas de fallback répété

### Routes Migrées

✅ `/app/routes/pieces.$slug.tsx`  
✅ `/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`  
✅ `/app/routes/test-catalogue-optimized.tsx`

## 🎛️ Feature Flag

Le RPC V2 est **activé par défaut** mais peut être désactivé via variable d'environnement :

```bash
# .env
ENABLE_RPC_V2=false  # Désactive RPC V2, utilise uniquement Classic
```

## 📈 Monitoring

### Logs à surveiller

**Succès RPC V2** :
```
✅ RPC V2 SUCCESS pour gamme 10 en 75ms (RPC: 75ms)
```

**Fallback activé** (à investiguer) :
```
⚠️ RPC V2 failed: ...
🔄 Fallback méthode classique pour gamme 10...
✅ Classic method SUCCESS pour gamme 10 en 680ms
```

### Métriques clés

- **Taux de succès RPC V2** : Doit être > 99%
- **Temps de réponse moyen** : Doit être < 100ms
- **Taux de fallback** : Doit être < 1%

## 🧪 Tests

### Test manuel

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev

# Terminal 3 - Test
curl -s http://localhost:3000/api/gamme-rest-optimized/10/page-data-rpc-v2 | jq '.performance'
```

### Test de fallback

```bash
# Désactiver RPC V2
export ENABLE_RPC_V2=false

# Relancer et vérifier que Classic fonctionne
curl -s http://localhost:3000/api/gamme-rest-optimized/10/page-data | jq '.performance'
```

## 🔄 Rollback

Si problème critique, rollback immédiat possible :

### Option 1 : Feature Flag (recommandé)
```bash
# .env
ENABLE_RPC_V2=false
```
Redémarrer le serveur → Utilise uniquement Classic

### Option 2 : Git Revert
```bash
git revert HEAD~1  # Revenir au commit précédent
git push
```

## 📝 Checklist de Déploiement

### Pré-déploiement
- [x] Fonction SQL déployée sur Supabase
- [x] Tests locaux passés (RPC V2 + fallback)
- [x] Feature flag configuré
- [x] Documentation à jour

### Post-déploiement (première semaine)
- [ ] Monitorer logs d'erreurs
- [ ] Vérifier taux de succès RPC V2 (> 99%)
- [ ] Mesurer performances réelles (< 100ms)
- [ ] Valider fallback en cas d'incident

### Nettoyage (après 2 semaines)
- [ ] Si RPC V2 stable → Supprimer ancien code Classic
- [ ] Si RPC V2 instable → Désactiver et investiguer
- [ ] Documenter lessons learned

## 🚨 Troubleshooting

### RPC V2 retourne des erreurs

1. Vérifier la fonction SQL sur Supabase
2. Checker les logs PostgreSQL
3. Activer fallback temporairement

### Performances dégradées

1. Vérifier le cache Redis
2. Analyser les slow queries
3. Vérifier la charge Supabase

### Fallback trop fréquent

1. Analyser les logs d'erreur
2. Vérifier la connexion Supabase
3. Investiguer la fonction SQL

## 📚 Références

- [Backend Controller RPC V2](../backend/src/modules/gamme-rest/gamme-rest-rpc-v2.controller.ts)
- [Service API avec Fallback](./app/services/api/gamme-api.service.ts)
- [Fonction SQL](../backend/prisma/supabase-functions/get_gamme_page_data_optimized_TEXT.sql)
- [Tests de Performance](../backend/TEST-RPC-PERFORMANCE.md)

## 🎯 Prochaines Étapes

1. **Semaine 1-2** : Monitoring intensif + ajustements
2. **Semaine 3** : Si stable → Supprimer ancien code
3. **Semaine 4** : Migrer autres endpoints vers RPC
