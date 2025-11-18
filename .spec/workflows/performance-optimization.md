---
title: "Workflow: Performance Optimization"
status: approved
version: 1.0.0
authors: [Backend Team, DevOps]
created: 2025-11-17
updated: 2025-11-17
relates-to:
  - ../architecture/003-cache-redis-multi-levels.md
  - ../../PERFORMANCE-OPTIMIZATIONS.md
tags: [workflow, performance, monitoring, optimization]
---

# Workflow: Performance Optimization

## 📝 Overview

Ce workflow décrit le processus complet pour **diagnostiquer, corriger et valider** les problèmes de performance dans l'application. Il a été formalisé suite à l'incident du 17 novembre 2025 où la homepage prenait 15-20s à charger.

**Objectifs** :
- Détection rapide des problèmes performance (< 30min)
- Diagnostic structuré avec preuves mesurables
- Implémentation priorisée (quick wins first)
- Validation avec métriques avant/après
- Documentation pour réutilisabilité

## 🎯 Quand utiliser ce workflow

- ✅ Page lente signalée (> 3s load time)
- ✅ API endpoint > 1s response time
- ✅ Queries DB > 500ms
- ✅ Cache hit rate < 50%
- ✅ Alertes Prometheus/Grafana
- ✅ Plaintes utilisateurs support

## 🔄 Phases du workflow

```
1. Détection → 2. Diagnostic → 3. Priorisation → 4. Implémentation → 5. Validation → 6. Documentation
     ↓              ↓              ↓                  ↓                   ↓               ↓
  Alertes       Analyse       Quick wins         Correctifs          Tests          Post-mortem
  Logs          Metrics       vs Long-term       + Cache             A/B            ADR/Docs
  Support       Traces        Impact matrix      + Indexes           Monitoring     Learnings
```

---

## Phase 1: Détection 🔍

### Objectif
Confirmer et quantifier le problème de performance

### Actions

#### 1.1. Collecter les symptômes
- [ ] **Logs application** : `tail -n 500 logs/nest.log > incident.log`
- [ ] **Métriques utilisateur** : Temps de chargement reporté
- [ ] **URL/Endpoint** : Page ou API affectée
- [ ] **Contexte** : Heure, fréquence, utilisateurs impactés

#### 1.2. Reproduire le problème
```bash
# Test manuel
curl -w "@curl-format.txt" -o /dev/null -s https://app.com/page

# Ou avec outil diagnostic
node backend/diagnose-performance.js < logs/nest.log
```

#### 1.3. Critères de gravité

| Niveau | Critère | Action |
|--------|---------|--------|
| 🔴 **P0 Critical** | Page > 10s, Production down | Incident immediat, all hands |
| 🟠 **P1 High** | Page 5-10s, API > 2s | Fix dans 24h |
| 🟡 **P2 Medium** | Page 3-5s, API 1-2s | Fix dans 1 semaine |
| 🟢 **P3 Low** | Page < 3s, optimisation progressive | Backlog |

### Outputs
- ✅ Fichier logs incident (`incident-YYYY-MM-DD.log`)
- ✅ Priorité assignée (P0-P3)
- ✅ Owner responsable diagnostic

**Durée estimée** : 15-30 minutes

---

## Phase 2: Diagnostic 🔬

### Objectif
Identifier la cause racine avec preuves mesurables

### Actions

#### 2.1. Analyser les logs structurés

```bash
# Utiliser l'outil diagnostic
tail -f logs/nest.log | node backend/diagnose-performance.js

# Chercher patterns:
# - Requêtes dupliquées (>3 appels identiques)
# - Queries lentes (>1000ms)
# - Cache misses répétés
# - Erreurs silencieuses
```

**Outputs attendus** :
```
=== TOP 10 ENDPOINTS (par nombre d'appels) ===
/api/catalog/equipementiers : 6 appels
/api/catalog/gammes/hierarchy : 6 appels

=== REQUÊTES DUPLIQUÉES ===
GET /api/catalog/equipementiers - 6 appels en 2.3s

=== QUERIES LENTES (>1000ms) ===
SELECT * FROM pieces WHERE ... - 4123ms
```

#### 2.2. Profiler les requêtes DB

```sql
-- Activer logging queries lentes (Supabase Dashboard)
ALTER DATABASE postgres SET log_min_duration_statement = 1000;

-- Analyser explain plans
EXPLAIN ANALYZE SELECT * FROM pieces WHERE rtp_type_id = 1;
```

**Signaux d'alerte** :
- ❌ Seq Scan au lieu d'Index Scan
- ❌ Nested Loop avec millions de rows
- ❌ Query cost > 10000

#### 2.3. Tracer les appels réseau

```typescript
// Ajouter timing logs temporaires
const start = Date.now();
const result = await this.service.getData();
this.logger.debug(`getData took ${Date.now() - start}ms`);
```

#### 2.4. Vérifier le cache

```bash
# Stats Redis
redis-cli INFO stats

# Vérifier TTL keys
redis-cli --scan --pattern "catalog:*" | head -20

# Hit rate
# (keyspace_hits / (keyspace_hits + keyspace_misses)) * 100
```

### Checklist diagnostic

- [ ] **Frontend** : useEffect loops, fetches non-dedupés
- [ ] **Backend** : Queries N+1, pas de pagination
- [ ] **Database** : Indexes manquants, queries lentes
- [ ] **Cache** : TTL trop court, pas de cache
- [ ] **Réseau** : Latence externe, CDN slow
- [ ] **Code** : Loops imbriqués, mauvais algo

### Outputs
- ✅ Cause racine identifiée (ex: "6 appels dupliqués équipementiers")
- ✅ Métriques baseline (temps avant fix)
- ✅ Reproduction steps documentés

**Durée estimée** : 30-60 minutes

---

## Phase 3: Priorisation 📊

### Objectif
Identifier quick wins vs optimisations long-terme

### Impact Matrix

| Solution | Effort | Impact | ROI | Priorité |
|----------|--------|--------|-----|----------|
| **Cache Redis TTL 1h** | 1h | -83% | 🟢 Très haut | P0 |
| **Paralléliser queries** | 2h | -70% | 🟢 Très haut | P0 |
| **Indexes DB** | 30min | -60% | 🟢 Très haut | P1 |
| **Fix useEffect frontend** | 1h | -83% | 🟢 Très haut | P1 |
| **React Query dedupe** | 3h | -50% | 🟡 Moyen | P2 |
| **CDN logos** | 4h | -20% | 🟡 Moyen | P2 |
| **Connection pool** | 1h | -10% | 🟠 Faible | P3 |

### Stratégie recommandée

**Phase immédiate (< 4h)** :
1. Cache Redis (1h) → -83%
2. Parallélisation (2h) → -70%
3. Indexes DB (30min) → -60%

**Phase court-terme (< 1 semaine)** :
4. Fix frontend loops (1h)
5. React Query (3h)

**Phase long-terme (backlog)** :
6. CDN, connection pool, monitoring avancé

### Outputs
- ✅ Liste solutions priorisées (P0/P1/P2/P3)
- ✅ Estimation effort/impact par solution
- ✅ Plan d'action avec timeline

**Durée estimée** : 15-30 minutes

---

## Phase 4: Implémentation 🛠️

### Objectif
Appliquer les correctifs avec tests progressifs

### Bonnes pratiques

#### 4.1. Créer une branche dédiée
```bash
git checkout -b perf/fix-homepage-load-time
```

#### 4.2. Implémenter par ordre de priorité

**Quick Win 1: Cache Redis**
```typescript
// Avant
const data = await this.service.getEquipementiers();
return data;

// Après (1h dev)
const cacheKey = 'catalog:equipementiers:all';
const cached = await this.cacheService.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await this.service.getEquipementiers();
await this.cacheService.set(cacheKey, JSON.stringify(data), 3600);
return data;
```

**Quick Win 2: Parallélisation**
```typescript
// Avant (séquentiel 5s)
const marque = await supabase.from('auto_marque').select('*').eq('am_id', marqueId);
const modele = await supabase.from('auto_modele').select('*').eq('amod_id', modeleId);

// Après (parallèle 1.5s)
const [marqueResult, modeleResult] = await Promise.all([
  marqueId ? supabase.from('auto_marque').select('*').eq('am_id', marqueId) : null,
  modeleId ? supabase.from('auto_modele').select('*').eq('amod_id', modeleId) : null
]);
```

**Quick Win 3: Indexes DB**
```sql
-- Supabase Dashboard > SQL Editor
CREATE INDEX CONCURRENTLY idx_rtp_type_pg_display 
ON pieces_relation_type(rtp_type_id, rtp_pg_id, rtp_display)
WHERE rtp_display = 1;

CREATE INDEX CONCURRENTLY idx_pri_piece_dispo 
ON pieces_price(pri_piece_id, pri_dispo)
WHERE pri_dispo = 1;
```

#### 4.3. Tester localement

```bash
# Compilation TypeScript
npm run build

# Tests unitaires
npm run test

# Test manuel endpoint
curl -w "@curl-format.txt" http://localhost:3001/api/catalog/equipementiers
```

#### 4.4. Vérifier pas de régression

```bash
# Comparer output avant/après
node backend/compare-outputs.js --endpoint /api/catalog/equipementiers

# Lancer tous les tests
npm run test:e2e
```

### Checklist implémentation

- [ ] Code compilé sans erreurs
- [ ] Tests unitaires passent
- [ ] Tests E2E passent
- [ ] Logs monitoring ajoutés
- [ ] Documentation inline (JSDoc)
- [ ] Pas de credentials hardcodés
- [ ] Rollback plan défini

### Outputs
- ✅ Code implémenté et testé
- ✅ PR créée avec description détaillée
- ✅ Tests automatisés ajoutés

**Durée estimée** : 2-8 heures (selon complexité)

---

## Phase 5: Validation ✅

### Objectif
Mesurer gains réels et confirmer aucune régression

### Actions

#### 5.1. Déployer sur staging

```bash
# Merge PR après review
git checkout main
git pull origin main
git merge perf/fix-homepage-load-time

# Déployer staging
npm run deploy:staging
```

#### 5.2. Tests de charge

```bash
# Test avec outil diagnostic
tail -f logs/nest.log | node backend/diagnose-performance.js

# Ou tests manuels répétés
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://staging.app.com/
done
```

#### 5.3. Comparer métriques avant/après

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| Homepage load | 15-20s | 3-5s | **-70%** |
| Équipementiers ×6 | 1.2s | 0.2s | **-83%** |
| SEO cached | 5-13s | <100ms | **-98%** |
| Cache hit rate | <30% | >70% | **+133%** |

#### 5.4. Validation business

- [ ] **Fonctionnel** : Toutes les features fonctionnent
- [ ] **Performance** : Gains mesurables confirmés
- [ ] **Stabilité** : Aucune erreur logs 500
- [ ] **SEO** : Content identique (pas de régression)

#### 5.5. Monitoring production

```bash
# Activer feature flag progressif
ENABLE_CACHE_REDIS=true # 10% traffic
ENABLE_CACHE_REDIS=true # 50% traffic
ENABLE_CACHE_REDIS=true # 100% traffic

# Surveiller métriques Grafana
# - Response time P50/P95/P99
# - Error rate
# - Cache hit rate
# - DB query count
```

### Rollback si problème

```bash
# Désactiver feature flag
ENABLE_CACHE_REDIS=false

# Ou rollback deploy
git revert HEAD
npm run deploy:production
```

### Outputs
- ✅ Gains validés production (métriques avant/après)
- ✅ Aucune régression détectée
- ✅ Monitoring alertes configurées

**Durée estimée** : 1-2 heures

---

## Phase 6: Documentation 📚

### Objectif
Capitaliser learnings pour incidents futurs

### Actions

#### 6.1. Créer post-mortem

**Template** : `.spec/reports/incidents/incident-YYYY-MM-DD-homepage-slow.md`

```markdown
# Incident: Homepage Slow (17 Nov 2025)

## Timeline
- 09:00: Détection (support client)
- 09:30: Diagnostic (logs analysés)
- 11:00: Cause racine (6 appels dupliqués)
- 14:00: Correctifs implémentés
- 16:00: Validation production

## Root Cause
Frontend useEffect sans dépendances → infinite loop

## Solutions Applied
1. Cache Redis TTL 1h (-83%)
2. Parallélisation queries (-70%)
3. Fix useEffect deps

## Learnings
- ✅ Diagnostic script très utile
- ✅ Quick wins > optimisations complexes
- ❌ Monitoring insuffisant (détection tardive)

## Action Items
- [ ] Ajouter alertes P95 > 3s
- [ ] ESLint rule exhaustive-deps enforced
```

#### 6.2. Mettre à jour documentation

- **ADR** : Créer ADR si décision architecture (ex: ADR-003 Cache Redis)
- **README** : Ajouter section troubleshooting
- **Runbook** : Enrichir procédures opérationnelles

#### 6.3. Partager avec l'équipe

- [ ] Présentation démo (show & tell)
- [ ] Update wiki/confluence
- [ ] Slack announcement avec métriques
- [ ] Retex rétrospective sprint

### Outputs
- ✅ Post-mortem incident documenté
- ✅ ADR créés (si décisions architecture)
- ✅ Runbook mis à jour
- ✅ Équipe informée

**Durée estimée** : 30-60 minutes

---

## 🛠️ Outils recommandés

### Diagnostic
- **Script maison** : `backend/diagnose-performance.js`
- **Logs** : `tail -f logs/nest.log`
- **DB profiler** : Supabase Dashboard > SQL Editor > EXPLAIN ANALYZE
- **Redis CLI** : `redis-cli INFO stats`
- **APM** : New Relic, Datadog (si disponible)

### Monitoring
- **Grafana** : Dashboards performance
- **Prometheus** : Métriques custom
- **Sentry** : Error tracking
- **Logs structurés** : Winston avec format JSON

### Tests
- **cURL** : Tests manuels avec timings
- **k6** : Tests de charge
- **Playwright** : Tests E2E avec performance metrics
- **Jest** : Tests unitaires services

---

## 📋 Checklist complète

### Avant de commencer
- [ ] Incident confirmé (logs + métriques)
- [ ] Priorité assignée (P0-P3)
- [ ] Owner responsable défini
- [ ] Branche Git créée

### Pendant diagnostic
- [ ] Logs analysés (patterns identifiés)
- [ ] Queries DB profilées (EXPLAIN ANALYZE)
- [ ] Cache stats vérifiés (hit rate)
- [ ] Cause racine documentée

### Pendant implémentation
- [ ] Quick wins priorisés (impact matrix)
- [ ] Code implémenté + testé
- [ ] PR créée + reviewed
- [ ] Tests automatisés ajoutés

### Pendant validation
- [ ] Déployé staging
- [ ] Métriques avant/après comparées
- [ ] Aucune régression fonctionnelle
- [ ] Feature flag production progressive

### Après résolution
- [ ] Post-mortem rédigé
- [ ] ADR créés (si applicable)
- [ ] Monitoring alertes configurées
- [ ] Équipe informée (démo/wiki)

---

## 🎯 Success Criteria

Un workflow est réussi si :

- ✅ **Détection rapide** : < 30min incident → diagnostic
- ✅ **Fix rapide** : < 4h diagnostic → production (P0/P1)
- ✅ **Gains mesurables** : Métriques avant/après documentées
- ✅ **Zero régression** : Tests automatisés passent
- ✅ **Documentation** : Post-mortem + ADR créés
- ✅ **Learnings partagés** : Équipe informée + runbook updaté

---

## 📚 Références

- [PERFORMANCE-OPTIMIZATIONS.md](../../PERFORMANCE-OPTIMIZATIONS.md)
- [ADR-003: Cache Redis Multi-Niveaux](../architecture/003-cache-redis-multi-levels.md)
- [ADR-004: SEO Switches Migration](../architecture/004-seo-switches-migration-php-ts.md)
- [Diagnostic Script](../../backend/diagnose-performance.js)
- [Incident Homepage 17 Nov 2025](../reports/incidents/incident-2025-11-17-homepage-slow.md) *(à créer)*

---

## 🔄 Change Log

### v1.0.0 (2025-11-17)

- Workflow initial formalisé suite incident homepage
- 6 phases définies (Détection → Documentation)
- Templates et checklists ajoutés
- Outils recommandés listés
