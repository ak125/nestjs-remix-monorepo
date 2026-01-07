---
title: "SpecKit Workflow: Analyze"
status: approved
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
tags: [speckit, workflow, analysis, quality]
priority: high
---

# 🔍 SpecKit Workflow: Analyze

> **Vérifier la cohérence entre spec, plan technique, et tasks avant implémentation.**

Ce workflow détecte les incohérences, gaps, et risques pour garantir une implémentation sans surprises.

---

## 🎯 Objectif

Valider la qualité et cohérence de la trilogie **Spec → Plan → Tasks** :
1. ✅ **Complétude** : Rien n'a été oublié
2. ✅ **Cohérence** : Pas de contradictions
3. ✅ **Faisabilité** : Objectifs réalistes
4. ✅ **Sécurité** : Risques identifiés
5. ✅ **Performance** : Budgets respectés

---

## 📋 Prérequis

**Avant d'utiliser `/speckit.analyze`** :
- ✅ Spec fonctionnelle approuvée (via `/speckit.specify`)
- ✅ Plan technique complet (via `/speckit.plan`)
- ✅ Tasks définies (via `/speckit.tasks`)

---

## 🚀 Processus

### Étape 1 : Préparer l'analyse

**Documents requis** :
- `.spec/features/mon-feature.md` (spec)
- `.spec/plans/mon-feature-plan.md` (plan)
- `.spec/tasks/mon-feature-tasks.md` (tasks)

**Checklist préparation** :
- [ ] Tous les documents existent
- [ ] Statut : `approved` (spec + plan) ou `draft` (tasks)
- [ ] Versions à jour

---

### Étape 2 : Analyse de Cohérence

#### 📊 Matrice de Traçabilité

**Objectif** : Vérifier que chaque exigence spec → plan → task.

| ID Exigence | Spec | Plan | Tasks | Status |
|-------------|------|------|-------|--------|
| RF-1 | ✅ | ✅ | ✅ | OK |
| RF-2 | ✅ | ✅ | ❌ | **MISSING TASKS** |
| RF-3 | ✅ | ❌ | ❌ | **MISSING PLAN + TASKS** |
| NF-1 (Perf) | ✅ | ✅ | ⚠️ | **INCOMPLETE** |

**Actions** :
1. Lister toutes les exigences fonctionnelles (RF-X) de la spec
2. Vérifier que chaque RF a une section correspondante dans le plan
3. Vérifier que chaque section plan a des tasks associées
4. Identifier gaps

**Template d'analyse** :

```markdown
### Matrice de Traçabilité

#### Exigences Fonctionnelles

**RF-1: Gestion des items de wishlist**
- ✅ **Spec** : Section "Exigences Fonctionnelles > RF-1"
- ✅ **Plan** : Section "API Endpoints > POST /api/wishlist/items"
- ✅ **Tasks** : Phase 3, Task 3.4 (Controller), Task 3.2 (Service create)
- **Status** : ✅ Complet

**RF-2: Notifications de prix**
- ✅ **Spec** : Section "Exigences Fonctionnelles > RF-2"
- ✅ **Plan** : Section "Intégrations > Job Cron"
- ❌ **Tasks** : **MANQUANT - Aucune task pour job cron**
- **Status** : ❌ Incomplet
- **Action requise** : Ajouter Task 9.1 "Créer job cron notifications"

**RF-3: Partage de wishlist**
- ✅ **Spec** : Section "Exigences Fonctionnelles > RF-3" (Could-have, phase 2)
- ⚠️ **Plan** : Mention "Phase 2 uniquement"
- ⚠️ **Tasks** : Non inclus (attendu)
- **Status** : ⚠️ Déféré (OK pour phase 1)

#### Exigences Non-Fonctionnelles

**NF-1: Performance < 100ms P95**
- ✅ **Spec** : Section "Exigences Non-Fonctionnelles > Performance"
- ✅ **Plan** : Section "Performance > Objectifs"
- ⚠️ **Tasks** : Phase 7 (Cache), mais pas de task "Load Testing"
- **Status** : ⚠️ Incomplet
- **Action requise** : Ajouter Task 7.3 "Load testing & benchmarks"

**NF-2: Sécurité (RLS + Guards)**
- ✅ **Spec** : Section "Exigences Non-Fonctionnelles > Sécurité"
- ✅ **Plan** : Section "Sécurité > RLS Policies + Guards"
- ✅ **Tasks** : Phase 1 Task 1.2 (RLS), Phase 3 Task 3.4 (Guards)
- **Status** : ✅ Complet

**NF-3: Accessibilité WCAG AA**
- ✅ **Spec** : Section "Exigences Non-Fonctionnelles > Accessibilité"
- ❌ **Plan** : **MANQUANT - Pas de section accessibilité frontend**
- ❌ **Tasks** : **MANQUANT - Pas de tâche audit a11y**
- **Status** : ❌ Incomplet
- **Action requise** : Ajouter section Plan "Accessibilité Frontend" + Task 6.4 "Audit a11y composants"
```

---

#### 🔗 Vérification des Dépendances

**Objectif** : S'assurer que toutes les dépendances entre modules sont identifiées.

**Checklist** :

**Dépendances Internes** :
- [ ] Tous les modules NestJS dépendants listés dans plan ?
- [ ] Services externes utilisés documentés ?
- [ ] Data services (Supabase) identifiés ?

**Exemple** :
```markdown
### Analyse des Dépendances

**Modules Backend** :
- ✅ `AuthModule` : Documenté (guards JWT)
- ✅ `CacheModule` : Documenté (Redis optionnel)
- ✅ `DatabaseModule` : Documenté (Supabase client)
- ⚠️ `EmailModule` : **MANQUANT - Notifications RF-2 nécessitent emails**
  - **Action** : Ajouter `EmailModule` dans plan + Task 9.2 "Email templates"

**Data Services** :
- ✅ `MonFeatureDataService` : Créé (Task 2.1)
- ✅ `UserDataService` : Existant (pour foreign key `user_id`)
- ❌ `ProductDataService` : **MANQUANT - RF-2 notifications prix nécessite produits**
  - **Action** : Ajouter intégration `ProductDataService` dans plan

**APIs Externes** :
- ✅ Aucune API externe (confirmé)
```

---

#### 📐 Cohérence Data Models

**Objectif** : Vérifier que les modèles de données sont cohérents entre spec, plan, et code.

**Checklist** :
- [ ] Schéma Supabase (plan) correspond aux champs spec ?
- [ ] TypeScript interfaces (plan) correspondent au schéma SQL ?
- [ ] DTOs (plan) correspondent aux interfaces ?
- [ ] Relations DB documentées ?

**Exemple** :
```markdown
### Analyse Data Models

**Spec → Plan** :
- ✅ Champ `field1` : Spec (max 255 chars) = Plan (`VARCHAR(255)`)
- ✅ Champ `field2` : Spec (integer) = Plan (`INTEGER`)
- ❌ Champ `field3` : Spec (object) ≠ Plan (`TEXT`)
  - **Problème** : Plan utilise `TEXT` au lieu de `JSONB`
  - **Action** : Corriger plan : `field3 JSONB`

**Plan SQL → TypeScript** :
- ✅ `id UUID` → `id: string`
- ✅ `user_id UUID` → `userId: string`
- ⚠️ `status VARCHAR(50)` → `status: string`
  - **Amélioration** : Utiliser type enum `'active' | 'inactive' | 'archived'`

**DTOs → Entity** :
- ✅ `CreateMonFeatureDto` contient subset de `MonFeature` (OK)
- ⚠️ `UpdateMonFeatureDto` permet modification `userId`
  - **Sécurité** : `userId` ne devrait PAS être modifiable
  - **Action** : Exclure `userId` de `UpdateMonFeatureDto`
```

---

#### 🌐 Cohérence API Endpoints

**Objectif** : Vérifier que les endpoints API correspondent aux user stories.

**Checklist** :
- [ ] Chaque user story a un endpoint API ?
- [ ] Méthodes HTTP appropriées (POST, GET, PATCH, DELETE) ?
- [ ] Query params documentés (filters, pagination) ?
- [ ] Responses documentées (status codes, body) ?

**Exemple** :
```markdown
### Analyse API Endpoints

**User Story 1: Ajouter produit à wishlist**
- ✅ Endpoint : `POST /api/wishlist/items`
- ✅ Auth : Required (JwtAuthGuard)
- ✅ Request Body : `CreateWishlistItemDto`
- ✅ Response : 201 + item créé

**User Story 2: Voir ma wishlist**
- ✅ Endpoint : `GET /api/wishlist`
- ✅ Query params : `page`, `limit`, `status`
- ⚠️ **MANQUANT** : Filter par `addedAt` (date range)
  - **Spec** : "Produits triés par date d'ajout (récents en premier)"
  - **Plan** : Sort par `createdAt` mais pas de filter date range
  - **Action** : Ajouter query param `addedAfter`, `addedBefore` dans plan

**User Story 3: Retirer produit**
- ✅ Endpoint : `DELETE /api/wishlist/items/:id`
- ✅ Confirmation : Mentionnée dans spec UI, mais pas d'endpoint "soft confirm"
- ✅ Optimistic UI : Frontend only (OK)
```

---

### Étape 3 : Analyse de Complétude

#### ✅ Checklist des Sections Obligatoires

**Spec** :
- [ ] Overview (contexte, objectif, bénéfices)
- [ ] User stories (≥ 2 stories avec critères d'acceptation)
- [ ] Exigences fonctionnelles (RF-X)
- [ ] Exigences non-fonctionnelles (performance, sécurité, a11y)
- [ ] Data requirements (modèles)
- [ ] Testing requirements (stratégie)
- [ ] Risques & mitigations

**Plan** :
- [ ] Architecture (modules, services, controllers)
- [ ] Data models (SQL migrations, TypeScript interfaces)
- [ ] API endpoints (routes, DTOs, validations)
- [ ] Intégrations (modules internes, APIs externes)
- [ ] Testing strategy (unitaires, intégration, E2E)
- [ ] Performance (objectifs, cache, optimisations)
- [ ] Sécurité (auth, authz, validation)

**Tasks** :
- [ ] Phases d'implémentation (DB → Backend → Frontend)
- [ ] Tasks granulaires (1-4h max)
- [ ] Critères d'acceptation par task
- [ ] Estimations de durée
- [ ] Dépendances entre tasks

---

#### 🔍 Détection de Gaps

**Template d'analyse** :

```markdown
### Gaps Identifiés

#### Gaps Critiques (Blockers)

**GAP-1: Migration DB manquante pour relation N:M**
- **Localisation** : Plan > Data Models
- **Problème** : Spec mentionne "wishlist partagée entre users" mais pas de table de jonction `wishlist_shares`
- **Impact** : Impossible d'implémenter RF-3 (partage)
- **Action** : Ajouter table `wishlist_shares(id, wishlist_id, shared_with_user_id)` dans plan
- **Priorité** : 🔴 Critique

**GAP-2: Tests E2E permissions manquants**
- **Localisation** : Tasks > Phase 4
- **Problème** : Pas de task pour tester isolation users (user A ne voit pas wishlist user B)
- **Impact** : Risque de faille sécurité en production
- **Action** : Ajouter Task 4.3 "Tests E2E permissions & isolation"
- **Priorité** : 🔴 Critique

#### Gaps Non-Critiques (Améliorations)

**GAP-3: Documentation Swagger incomplète**
- **Localisation** : Tasks > Phase 8
- **Problème** : Task 8.1 mentionne "Exporter Swagger" mais pas de task "Enrichir Swagger avec exemples"
- **Impact** : Documentation API moins utilisable
- **Action** : Clarifier Task 8.1 pour inclure exemples
- **Priorité** : 🟡 Medium

**GAP-4: Monitoring métriques business**
- **Localisation** : Plan > Monitoring
- **Problème** : Logs techniques OK, mais pas de métriques business (ex: nombre de wishlists créées/jour)
- **Impact** : Pas de visibilité métier
- **Action** : Ajouter Task 7.3 "Instrumentation métriques business (Prometheus)"
- **Priorité** : 🟢 Low (can defer)
```

---

### Étape 4 : Analyse de Risques

#### ⚠️ Identification des Risques Techniques

**Catégories** :
1. **Risques Data** : Migrations, performances DB
2. **Risques Intégration** : Dépendances modules, APIs
3. **Risques Performance** : Cache, scalabilité
4. **Risques Sécurité** : Auth, authz, validation

**Template d'analyse** :

```markdown
### Analyse des Risques

#### Risques Identifiés

**RISQUE-1: Performance query `GET /wishlist` sans cache**
- **Description** : Spec demande < 100ms P95, mais pas de cache prévu
- **Probabilité** : 🔴 Haute (query DB directe)
- **Impact** : 🔴 High (SLA performance non respecté)
- **Mitigation (Plan)** : Section Performance > Cache Redis
- **Mitigation (Tasks)** : Phase 7 Task 7.1 "Implémenter Cache Redis"
- **Status** : ✅ Mitigé

**RISQUE-2: Race condition sur création doublon wishlist item**
- **Description** : User clique 2x rapidement → 2 items identiques créés
- **Probabilité** : 🟡 Moyenne
- **Impact** : 🟡 Medium (UX dégradée)
- **Mitigation (Plan)** : ❌ **MANQUANT - Pas de contrainte UNIQUE(user_id, product_id)**
- **Action** : Ajouter dans Plan : `UNIQUE INDEX idx_unique_user_product ON wishlist(user_id, product_id)`
- **Status** : ❌ Non mitigé

**RISQUE-3: Wishlist volumineuse (1000+ items) ralentit page**
- **Description** : Spec ne limite pas nombre d'items, pagination peut être insuffisante
- **Probabilité** : 🟢 Faible
- **Impact** : 🟡 Medium
- **Mitigation (Spec)** : Mentionné dans "Risques & Mitigations"
- **Mitigation (Plan)** : Pagination + cache
- **Status** : ✅ Mitigé

**RISQUE-4: Produit supprimé du catalogue → wishlist item orphelin**
- **Description** : Foreign key `product_id` pointe vers produit inexistant
- **Probabilité** : 🟡 Moyenne
- **Impact** : 🟡 Medium (erreurs affichage)
- **Mitigation (Spec)** : Mentionné ("soft delete produits, cleanup job mensuel")
- **Mitigation (Plan)** : ❌ **MANQUANT - Pas de section "Cleanup Job"**
- **Action** : Ajouter dans Plan : Job cron `cleanupOrphanedWishlistItems()`
- **Status** : ⚠️ Partiellement mitigé
```

---

#### 🧪 Analyse Coverage Tests

**Objectif** : Vérifier que la stratégie de tests couvre tous les cas critiques.

**Checklist** :
- [ ] Tests unitaires : ≥ 80% services, ≥ 60% controllers ?
- [ ] Tests intégration : Tous les endpoints API ?
- [ ] Tests E2E : User flows nominaux + erreurs ?
- [ ] Tests performance : Load testing prévu ?
- [ ] Tests sécurité : Permissions, validation inputs ?

**Exemple** :
```markdown
### Analyse Coverage Tests

**Tests Unitaires** :
- ✅ Service : 15 tests (create, findAll, findOne, update, remove + erreurs)
- ✅ Controller : 10 tests (endpoints + validation)
- ✅ Coverage estimé : 85% services, 70% controllers (objectifs dépassés ✅)

**Tests Intégration** :
- ✅ Task 4.1 : POST/GET/PATCH/DELETE avec vraie DB
- ⚠️ **MANQUANT** : Tests avec différents rôles users (admin vs user normal)
  - **Action** : Clarifier Task 4.1 pour inclure tests rôles

**Tests E2E** :
- ✅ Task 4.2 : CRUD cycle complet
- ✅ Permissions : User A ≠ User B
- ❌ **MANQUANT** : Tests browser (frontend E2E avec Playwright)
  - **Action** : Ajouter Task 5.7 "E2E frontend Playwright"

**Tests Performance** :
- ⚠️ Phase 7 Task 7.2 "Optimiser queries" mais pas de benchmarks
- ❌ **MANQUANT** : Load testing (objectif 1000 req/s)
  - **Action** : Ajouter Task 7.3 "Load testing (k6 ou Artillery)"

**Tests Sécurité** :
- ✅ RLS policies : Task 1.2 "Tester policies"
- ⚠️ Validation inputs : Implicit (Zod DTOs) mais pas de test dédié fuzzing
```

---

### Étape 5 : Analyse de Faisabilité

#### 📅 Vérification des Estimations

**Objectif** : Valider que les estimations de durée sont réalistes.

**Checklist** :
- [ ] Durée totale cohérente avec complexité feature ?
- [ ] Estimations par task réalistes (1-4h max) ?
- [ ] Buffer prévu pour imprévus ?
- [ ] Dépendances critiques path identifié ?

**Exemple** :
```markdown
### Analyse Faisabilité

**Estimation Totale (Tasks)** : 35-50h

**Benchmark Projet** :
- Feature similaire récente : "Product Reviews" → 42h réelles
- Complexité équivalente (CRUD + permissions + cache)
- **Conclusion** : Estimation réaliste ✅

**Estimations par Phase** :
- Phase 1 (DB) : 2-4h → ✅ Réaliste (migrations simples)
- Phase 2 (Data Layer) : 4-6h → ✅ Réaliste (pattern connu)
- Phase 3 (API) : 6-8h → ⚠️ **Risque** : 6 tasks en 8h max = 1.3h/task (tight)
  - **Recommandation** : Ajouter buffer +2h (total 8-10h)
- Phase 5 (Frontend) : 8-12h → ✅ Réaliste (6 routes Remix)
- Phase 7 (Performance) : 2-3h → ⚠️ Si load testing inclus, prévoir +1h

**Buffer Global** :
- Estimation : 35-50h
- Imprévus estimés : 20% (7-10h)
- **Total avec buffer** : 42-60h
- **Recommandation** : Communiquer 50-60h à l'équipe

**Chemin Critique** :
```
Phase 1 (DB, 4h) → Phase 2 (Data, 6h) → Phase 3 (API, 10h) → Phase 4 (Tests, 4h) → Deploy (1h)
Total chemin critique : ~25h
```
- **Conclusion** : Parallélisation Phase 5/6/7 économise ~15h ✅
```

---

#### 🔧 Vérification des Prérequis Techniques

**Checklist** :
- [ ] Stack technique utilisée est celle du projet ?
- [ ] Patterns respectent architecture existante ?
- [ ] Dépendances npm/packages disponibles ?
- [ ] Environnement dev configuré ?

**Exemple** :
```markdown
### Prérequis Techniques

**Stack Technique** :
- ✅ NestJS 10.x : Plan utilise `@nestjs/*` (OK)
- ✅ Supabase Direct : Plan utilise `SupabaseBaseService` (OK, conforme ADR-001)
- ✅ Remix : Plan routes Remix (OK)
- ✅ Zod : DTOs avec Zod (OK)

**Patterns Architecture** :
- ✅ Module Pattern : `MonFeatureModule` (OK)
- ✅ Service Pattern : `MonFeatureService` (OK)
- ✅ Repository Pattern : `SupabaseBaseService` (OK, conforme ADR-001)
- ✅ DTO Pattern : Zod validation (OK)

**Dépendances** :
- ✅ `@nestjs/common`, `@nestjs/core` : Existantes
- ✅ `@supabase/supabase-js` : Existant
- ✅ `zod` : Existant
- ⚠️ `ioredis` : Requis pour Phase 7 (cache Redis)
  - **Action** : Vérifier `ioredis` dans `package.json` ou installer

**Environnement Dev** :
- ✅ Supabase local : `supabase start` fonctionne
- ✅ PostgreSQL : Via Supabase
- ⚠️ Redis : Optionnel (Phase 7), mais pas dans `docker-compose.dev.yml` ?
  - **Action** : Vérifier `docker-compose.redis.yml` ou ajouter service
```

---

### Étape 6 : Rapport d'Analyse

**Template de rapport** :

```markdown
---
title: "Analyse: [Nom Feature]"
date: YYYY-MM-DD
status: draft
relates-to:
  - ../features/mon-feature.md
  - ../plans/mon-feature-plan.md
  - ../tasks/mon-feature-tasks.md
---

# Rapport d'Analyse : [Nom Feature]

## 📊 Résumé Exécutif

**Status Global** : 🟡 **À corriger avant implémentation**

- **Cohérence** : 🟢 Bonne (90%)
- **Complétude** : 🟡 Moyenne (75% - gaps identifiés)
- **Faisabilité** : 🟢 Réaliste (estimations validées)
- **Risques** : 🟡 Moyens (2 risques non mitigés)

**Actions Critiques Requises** : 3  
**Actions Recommandées** : 5  
**Durée Estimée** : 50-60h (incluant buffer 20%)

---

## ✅ Points Forts

1. ✅ Architecture bien définie (modules, services, controllers)
2. ✅ Data models cohérents (SQL ↔ TypeScript)
3. ✅ Tests coverage objectifs clairs (80%/60%)
4. ✅ Patterns projet respectés (SupabaseBaseService, Zod DTOs)
5. ✅ Documentation complète (spec + plan + tasks)

---

## ⚠️ Problèmes Identifiés

### Critiques (Blockers)

#### 🔴 CRITIQUE-1: Contrainte UNIQUE manquante (race condition)
**Localisation** : Plan > Data Models > Schema SQL  
**Problème** : Pas de contrainte `UNIQUE(user_id, product_id)` → doublons possibles  
**Impact** : 🔴 HIGH - Bug en production  
**Action** : Ajouter dans migration :
```sql
CREATE UNIQUE INDEX idx_unique_user_product 
  ON wishlist(user_id, product_id) 
  WHERE deleted_at IS NULL;
```

#### 🔴 CRITIQUE-2: Tests E2E permissions manquants
**Localisation** : Tasks > Phase 4  
**Problème** : Pas de task pour tester isolation users  
**Impact** : 🔴 HIGH - Faille sécurité potentielle  
**Action** : Ajouter Task 4.3 "Tests E2E permissions & RLS"

#### 🔴 CRITIQUE-3: Job cleanup produits orphelins manquant
**Localisation** : Plan > Intégrations  
**Problème** : Spec mentionne "cleanup job mensuel" mais pas dans plan/tasks  
**Impact** : 🔴 MEDIUM - Data integrity  
**Action** : Ajouter section Plan "Background Jobs" + Task 9.1 "Cron cleanup"

### Non-Critiques (Améliorations)

#### 🟡 AMÉLIORATION-1: Load testing manquant
**Localisation** : Tasks > Phase 7  
**Problème** : Objectif "1000 req/s" mais pas de task load testing  
**Impact** : 🟡 MEDIUM - Performance non validée  
**Action** : Ajouter Task 7.3 "Load testing (k6)"

#### 🟡 AMÉLIORATION-2: Métriques business manquantes
**Localisation** : Plan > Monitoring  
**Problème** : Logs techniques OK, mais pas de métriques métier  
**Impact** : 🟢 LOW - Visibilité business limitée  
**Action** : Ajouter métriques Prometheus (wishlist_created_total, etc.)

---

## 📋 Matrice de Traçabilité

| Exigence | Spec | Plan | Tasks | Status |
|----------|------|------|-------|--------|
| RF-1: CRUD wishlist | ✅ | ✅ | ✅ | ✅ Complet |
| RF-2: Notifications prix | ✅ | ✅ | ❌ | ❌ Tasks manquantes |
| RF-3: Partage wishlist | ✅ | ⚠️ | ⚠️ | ⚠️ Phase 2 (OK) |
| NF-1: Performance < 100ms | ✅ | ✅ | ⚠️ | ⚠️ Load testing manquant |
| NF-2: Sécurité RLS | ✅ | ✅ | ✅ | ✅ Complet |
| NF-3: Accessibilité WCAG | ✅ | ❌ | ❌ | ❌ Section manquante |

**Coverage** : 4/6 exigences complètes (67%)

---

## 🛡️ Analyse des Risques

### Risques Critiques

| ID | Description | Probabilité | Impact | Mitigation | Status |
|----|-------------|-------------|--------|------------|--------|
| R-1 | Race condition doublons | 🔴 Haute | 🔴 High | Contrainte UNIQUE | ❌ À ajouter |
| R-2 | Produits orphelins | 🟡 Moyenne | 🟡 Medium | Cleanup job | ❌ À ajouter |
| R-3 | Performance sans cache | 🔴 Haute | 🔴 High | Redis cache | ✅ Prévu (Phase 7) |

### Risques Mineurs

| ID | Description | Probabilité | Impact | Mitigation | Status |
|----|-------------|-------------|--------|------------|--------|
| R-4 | Wishlist volumineuse | 🟢 Faible | 🟡 Medium | Pagination + cache | ✅ Prévu |
| R-5 | Load non testé | 🟡 Moyenne | 🟡 Medium | Load testing | ⚠️ À ajouter |

---

## 📊 Complétude

**Spec** : 95% ✅  
**Plan** : 85% 🟡 (sections accessibilité + jobs manquantes)  
**Tasks** : 80% 🟡 (tasks RF-2, NF-3, load testing manquantes)

---

## ⏱️ Faisabilité

**Estimation Tasks** : 35-50h  
**Buffer Imprévus** : +10h (20%)  
**Total Recommandé** : **50-60h**

**Chemin Critique** : 25h (DB → Data → API → Tests → Deploy)  
**Parallélisation** : Économie ~15h (Frontend + UI + Perf en parallèle)

---

## ✅ Recommandations

### Actions Immédiates (Avant Implémentation)

1. 🔴 **URGENT** : Ajouter contrainte `UNIQUE(user_id, product_id)` dans migration
2. 🔴 **URGENT** : Ajouter Task 4.3 "Tests E2E permissions"
3. 🔴 **URGENT** : Ajouter section Plan "Background Jobs" + cleanup cron

### Actions Recommandées

4. 🟡 Ajouter Task 7.3 "Load testing (k6)" pour valider objectif 1000 req/s
5. 🟡 Ajouter section Plan "Accessibilité Frontend" (WCAG AA)
6. 🟡 Clarifier Task 4.1 pour inclure tests multi-rôles (admin vs user)
7. 🟢 Ajouter métriques business Prometheus (optionnel)

### Validation Finale

- [ ] Toutes les actions critiques (1-3) complétées
- [ ] Plan & Tasks mis à jour
- [ ] Review équipe effectuée
- [ ] Estimations validées (50-60h communiqué)

---

## 🔗 Conclusion

**Status** : 🟡 **GO avec corrections**

La feature est globalement bien spécifiée et planifiée, mais **3 actions critiques** doivent être complétées avant de commencer l'implémentation :
1. Contrainte UNIQUE (race condition)
2. Tests E2E permissions (sécurité)
3. Cleanup job (data integrity)

**Timeline** :
- Corrections critiques : 1-2h
- Review finale : 30min
- **Prêt pour implémentation** : J+1

---

**Analysé par** : [Votre nom]  
**Date** : 2025-11-18  
**Version** : 1.0
```

---

## 🔄 Workflow Itératif

### Si Problèmes Critiques Détectés

1. **Bloquer implémentation** : Ne PAS commencer avant corrections
2. **Mise à jour documents** : Corriger plan et/ou tasks
3. **Re-analyse** : Relancer `/speckit.analyze` après corrections
4. **Review équipe** : Valider corrections avant GO

### Si Améliorations Suggérées

1. **Évaluer priorité** : Critique vs Nice-to-have
2. **Décision équipe** : Inclure maintenant ou phase 2 ?
3. **Update backlog** : Créer issues GitHub pour phase 2

---

## 🎯 Critères de Validation

**Une analyse est complète si** :
- ✅ Matrice de traçabilité remplie (toutes exigences mappées)
- ✅ Gaps identifiés et documentés
- ✅ Risques analysés avec mitigations
- ✅ Tests coverage validé
- ✅ Estimations validées
- ✅ Actions correctives définies

**Une analyse est positive ("GO") si** :
- ✅ Aucun problème critique bloquant
- ✅ Tous les risques critiques mitigés
- ✅ Estimations réalistes
- ✅ Coverage tests suffisant (≥ 80%/60%)

---

## 🔗 Prochaines Étapes

Après avoir complété `/speckit.analyze` :

1. **Corriger problèmes critiques** : Mettre à jour plan/tasks
2. **`/speckit.checklist`** : Générer checklists qualité
3. **Review équipe** : Valider avant GO implémentation
4. **`/speckit.implement`** : Commencer implémentation

---

## 📚 Ressources

- [Constitution du Projet](../constitution.md)
- [Spec Fonctionnelle](../features/mon-feature.md)
- [Plan Technique](../plans/mon-feature-plan.md)
- [Tasks](../tasks/mon-feature-tasks.md)
- [ADRs](../architecture/decisions/)

---

**Note** : Cette analyse doit être effectuée AVANT toute implémentation pour éviter refactoring coûteux.
