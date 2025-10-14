# Diagnostic des Problèmes d'Authentification et Supabase

**Date**: 8 octobre 2025, 22:14

## Problèmes Identifiés

### 1. 🔒 Échec d'Authentification Systématique
```
[AuthenticatedGuard] AuthenticatedGuard - Path: /api/orders, Authenticated: false, User: none
❌ [Frontend] Erreur loader: Error: Erreur lors du chargement des commandes
```

**Cause**: Le `AuthenticatedGuard` bloque l'accès à `/api/orders` car `request.isAuthenticated()` retourne `false`.

### 2. ⏱️ Timeouts Supabase Massifs
```
TypeError: fetch failed
errno: 'ETIMEDOUT',
code: 'ETIMEDOUT',
```

**Cause**: Les requêtes vers Supabase (`cxpojprgwgubzjyqzmoq.supabase.co`) échouent systématiquement avec des timeouts réseau.

### 3. 👤 Tentatives de Récupération d'Utilisateurs Inexistants
```
❌ Erreur récupération utilisateur 80878: NotFoundException
❌ Erreur récupération utilisateur 80758: NotFoundException
❌ Erreur récupération utilisateur 80840: NotFoundException
...
```

**Cause**: Le système tente de récupérer des utilisateurs qui n'existent pas dans `___xtr_customer`.

### 4. 🔄 Problème de Désérialisation de Session
```
⚠️ User not found during deserialization: adm_superadmin_1753375556.651700
Erreur lors de la récupération utilisateur: FetchError: ETIMEDOUT
```

**Cause**: La stratégie de désérialisation Passport échoue car Supabase ne répond pas.

## Solutions Proposées

### Solution 1: Désactiver Temporairement le Guard (Développement)

Pour débloquer le développement immédiatement, désactiver le guard sur `/api/orders`.

### Solution 2: Ajouter un Système de Fallback

Implémenter un fallback quand Supabase est indisponible:
- Cache local des utilisateurs
- Mode dégradé sans vérification d'authentification
- Retry logic avec backoff exponentiel

### Solution 3: Optimiser les Requêtes Utilisateurs

- Implémenter un cache Redis pour les utilisateurs
- Batch les requêtes utilisateurs
- Éviter les requêtes utilisateur inutiles dans la liste des commandes

### Solution 4: Améliorer la Gestion des Sessions

- Ajouter un timeout plus court sur les requêtes Supabase
- Implémenter un circuit breaker
- Logger les sessions dans Redis plutôt que Supabase

## Actions Recommandées

### Immédiat
1. ✅ Désactiver le `AuthenticatedGuard` sur `/api/orders` en dev
2. ✅ Ajouter un timeout de 3 secondes sur les requêtes Supabase
3. ✅ Implémenter un cache en mémoire pour les utilisateurs

### Court terme
1. Migrer la gestion des sessions vers Redis
2. Implémenter un circuit breaker pour Supabase
3. Ajouter des logs de performance

### Long terme
1. Revoir l'architecture d'authentification
2. Implémenter un système de cache distribué
3. Ajouter des métriques et alertes

## Impact

### Utilisateurs Affectés
- ❌ Impossible de charger la page des commandes
- ❌ Impossible de voir les détails des commandes
- ❌ Authentification non fonctionnelle

### Performance
- ⏱️ Timeouts multiples (>10 secondes par requête)
- 🔄 Retry loops consommant des ressources
- 💾 Pas de cache, requêtes répétées

## Tests à Effectuer

1. Vérifier la connectivité Supabase:
   ```bash
   curl -I https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/___xtr_customer
   ```

2. Tester l'authentification:
   ```bash
   curl http://localhost:3000/api/auth/profile -H "Cookie: connect.sid=..."
   ```

3. Vérifier Redis:
   ```bash
   redis-cli ping
   ```
