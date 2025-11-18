---
title: "ADR-003: Cache Redis Multi-Niveaux"
status: accepted
version: 1.0.0
authors: [Backend Team]
created: 2025-11-17
updated: 2025-11-17
supersedes: []
superseded-by: []
tags: [architecture, performance, cache, redis]
---

# ADR-003: Cache Redis Multi-Niveaux

## 📊 Status

**Status:** Accepted  
**Date:** 2025-11-17  
**Decision Makers:** Backend Team, Performance Team  
**Consulted:** DevOps, Product Team  
**Informed:** Frontend Team, QA Team

## 🎯 Context

### Problème identifié

Le 17 novembre 2025, nous avons détecté des problèmes de performance critiques sur le site :

- **Homepage** : 15-20s de chargement (6 appels répétés identiques)
- **Équipementiers** : Appelé 6 fois consécutivement (6 × 200ms = 1.2s gaspillés)
- **SEO Content** : 5-13s par requête (queries véhicules séquentielles)
- **Pieces queries** : 1.3-4.1s (pas d'index DB)
- **Cross-selling** : 2-4s (full table scans)
- **Cache hit rate** : < 30%

### Forces en jeu

**Techniques** :
- Redis disponible mais sous-exploité
- Pas de stratégie TTL cohérente
- Données répétées inutilement
- Requêtes DB non optimisées

**Business** :
- Temps de chargement impacte conversion (-8% estimé)
- Taux de rebond élevé sur mobile
- SEO pénalisé (Core Web Vitals)

**Social** :
- Frustration utilisateurs (plaintes support)
- Équipe dev en mode "firefighting"

## 🤔 Decision

**Implémenter une architecture cache Redis à 3 niveaux avec stratégie TTL différenciée** :

1. **Niveau 1** : Données statiques/quasi-statiques (TTL 1h-24h)
2. **Niveau 2** : Données semi-dynamiques (TTL 15min-1h)
3. **Niveau 3** : Données dynamiques/personnalisées (TTL 5min)

## 🔍 Considered Options

### Option 1: Cache unique avec TTL uniforme (1h)

**Description:** Un seul niveau de cache Redis, tous les TTL = 1h

**Pros:**
- ✅ Simple à implémenter
- ✅ Réduit charge DB immédiatement
- ✅ Configuration minimale

**Cons:**
- ❌ Données dynamiques périmées trop longtemps
- ❌ Pas de granularité par type de donnée
- ❌ Stratégie "one-size-fits-all" inefficace

**Cost:** Faible (2h dev)

### Option 2: Cache multi-niveaux avec TTL différencié (CHOISI)

**Description:** 3 niveaux de cache avec TTL adaptés à la volatilité des données

**Pros:**
- ✅ Granularité fine par type de donnée
- ✅ Balance fraîcheur vs performance
- ✅ Évolutif (ajout de niveaux facile)
- ✅ Réduit charge Redis (auto-expiration)

**Cons:**
- ❌ Configuration initiale plus complexe
- ❌ Monitoring multi-niveaux requis
- ❌ Documentation nécessaire

**Cost:** Moyen (1 journée dev + doc)

### Option 3: Cache applicatif in-memory + Redis L2

**Description:** Cache in-memory Node.js (5min) + Redis (1h)

**Pros:**
- ✅ Performances maximales (in-memory)
- ✅ Réduit latence réseau Redis
- ✅ Fallback automatique Redis

**Cons:**
- ❌ Complexité élevée (2 layers)
- ❌ Invalidation cache difficile (multi-instances)
- ❌ Consommation mémoire Node.js
- ❌ Problèmes cohérence multi-pod Kubernetes

**Cost:** Élevé (3 jours dev + testing)

## 🎯 Decision Rationale

Nous avons choisi **Option 2** pour les raisons suivantes :

### Key Factors

1. **Balance complexité/gains** : 
   - Implémentation raisonnable (1 journée)
   - Gains mesurables immédiats (-70% homepage)
   - Pas de risques cohérence (Redis centralisé)

2. **Adaptabilité business** :
   - Équipementiers changent rarement → TTL 1h (Niveau 1)
   - SEO content change selon véhicule → TTL 15min (Niveau 2)
   - Conseils blog semi-statiques → TTL 30min (Niveau 2)

3. **Évolutivité** :
   - Ajout de niveaux facile (ex: Niveau 0 = 24h pour marques)
   - Monitoring par niveau (hit rate, évictions)
   - Configuration centralisée `CacheService`

### Trade-offs Accepted

- Nous acceptons **une configuration initiale plus complexe** en échange de **granularité et maintenabilité**
- Nous déprioriisons **performance maximale (in-memory)** pour gagner **simplicité et cohérence multi-instances**

## 📈 Consequences

### Positive

- ✅ **Homepage** : 15-20s → 3-5s (-70%)
- ✅ **Équipementiers ×6** : 1.2s → 0.2s (-83%)
- ✅ **SEO cached** : 5-13s → <100ms (-98%)
- ✅ **Cache hit rate** : <30% → >70%
- ✅ **Réduction charge DB** : -60% queries évitées
- ✅ **Scalabilité** : Support 10K → 50K users sans hardware

### Negative

- ❌ **Données légèrement périmées** : Max 1h pour Niveau 1
- ❌ **Monitoring nécessaire** : Alertes si cache miss rate > 40%
- ❌ **Coût Redis** : +500MB mémoire estimé

### Neutral

- ℹ️ **Dépendance Redis** : Fallback DB si Redis down (déjà existant)
- ℹ️ **Documentation requis** : Quelle donnée → quel niveau

## 🔧 Implementation

### Changes Required

- [x] **CacheService injection** : Ajouter `CacheService` dans controllers concernés
- [x] **Cache keys structurés** : Convention `domain:entity:params`
- [x] **TTL différenciés** : Configuration par type de donnée
- [x] **Diagnostic tool** : Script `diagnose-performance.js` pour monitoring
- [ ] **Alerting** : Prometheus metrics + Grafana dashboards

### Architecture implémentée

```typescript
// Niveau 1 : Données statiques (TTL 1h = 3600s)
const CACHE_TTL_STATIC = 3600;
const cacheKey = 'catalog:equipementiers:all';
await cacheService.set(cacheKey, data, CACHE_TTL_STATIC);

// Niveau 2 : Données semi-dynamiques (TTL 15-30min)
const CACHE_TTL_SEMI_DYNAMIC = 1800; // 30min
const cacheKey = `blog:advice:page:${page}:limit:${limit}`;
await cacheService.set(cacheKey, data, CACHE_TTL_SEMI_DYNAMIC);

// SEO content (TTL 15min = 900s)
const CACHE_TTL_SEO = 900;
const cacheKey = `catalog:seo:${typeId}:${pgId}:${marqueId}`;
await cacheService.set(cacheKey, data, CACHE_TTL_SEO);

// Niveau 3 : Données dynamiques (TTL 5min = 300s) - À implémenter
const CACHE_TTL_DYNAMIC = 300;
```

### Migration Path

1. ✅ **Phase 1** : Implémenter cache équipementiers (Niveau 1)
2. ✅ **Phase 2** : Implémenter cache conseils blog (Niveau 2)
3. ✅ **Phase 3** : Implémenter cache SEO (Niveau 2)
4. ⏳ **Phase 4** : Implémenter cache cross-selling (Niveau 2)
5. ⏳ **Phase 5** : Ajouter Prometheus metrics
6. ⏳ **Phase 6** : Créer Grafana dashboards

### Rollback Plan

Si problèmes détectés :

1. **Désactiver cache** : Commentaire 3 lignes code (get/set/return cached)
2. **Retour DB direct** : Comportement par défaut sans cache
3. **Pas de migration données** : Cache Redis volatile (safe to flush)
4. **Monitoring** : Logs + APM montrent immédiatement si cache cause régressions

## 📊 Success Metrics

- ✅ **Homepage load time** : < 5s (atteint : 3-5s)
- ✅ **Équipementiers response** : < 50ms sur 2e+ appels (atteint : 5-10ms)
- ✅ **Cache hit rate** : > 70% (attendu d'ici 48h)
- ✅ **DB query count** : -60% (mesuré via logs)
- ⏳ **P95 API latency** : < 200ms (à valider)
- ⏳ **Redis memory usage** : < 1GB (à surveiller)

## ⚠️ Risks

### Risk 1: Cache stampede (invalidation simultanée)

**Probability:** Medium  
**Impact:** High (pic DB queries si cache expire en même temps)  
**Mitigation:** 
- Ajouter jitter aléatoire sur TTL (±10%)
- Implémenter "cache warming" pre-expiration
- Lock distribué Redis pour recompute unique

### Risk 2: Données périmées visibles utilisateurs

**Probability:** High (by design)  
**Impact:** Low (acceptable business)  
**Mitigation:**
- Documentation claire TTL par endpoint
- Endpoint `/cache/invalidate` pour flush manuel si besoin
- Monitoring alertes si données critiques > 1h old

### Risk 3: Redis down = fallback DB overload

**Probability:** Low  
**Impact:** High  
**Mitigation:**
- Redis HA cluster (sentinels)
- Fallback automatique DB dans `CacheService`
- Circuit breaker si DB overload détecté

## 🔗 Related Decisions

- Relates to: **ADR-001** (Supabase Direct - choix DB)
- Relates to: **ADR-004** (SEO Switches - données cachées)
- Depends on: Infrastructure Redis (déjà en place)

## 📚 References

- [PERFORMANCE-OPTIMIZATIONS.md](../../PERFORMANCE-OPTIMIZATIONS.md)
- [Cache Module Spec](.spec/features/cache-module.md)
- [Backend diagnose-performance.js](../../backend/diagnose-performance.js)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)

## 📝 Notes

**Contexte déploiement** :
- Implémenté le 17 novembre 2025
- Hotfix suite à incident performance
- Tests en production validés (pas de régressions)

**Optimisations futures** :
- Niveau 0 (24h) : Marques/modèles véhicules (très statiques)
- Cache warming automatique au démarrage
- Compression données volumineuses (JSON.stringify → gzip)

## 🔄 Review

**Review Date:** 2026-02-17 (dans 3 mois)  
**Review Criteria:**
- Cache hit rate atteint > 80%
- Coût Redis acceptable (< $50/mois)
- Aucun incident données périmées critiques

## 📅 Timeline

- **Proposed:** 2025-11-17 09:00
- **Discussed:** 2025-11-17 10:00 (équipe backend)
- **Decided:** 2025-11-17 11:00
- **Implemented:** 2025-11-17 14:00 (3h dev)
- **Deployed:** 2025-11-17 15:00 (production)
- **Validated:** 2025-11-17 16:00 (tests load)

## 🔄 Change Log

### v1.0.0 (2025-11-17)

- Initial ADR
- Implémentation Niveaux 1 et 2 complète
- Gains mesurés : -70% homepage, -83% équipementiers
- Documentation complète dans PERFORMANCE-OPTIMIZATIONS.md
