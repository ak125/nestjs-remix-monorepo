---
title: "SpecKit Workflow: Tasks"
status: approved
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
tags: [speckit, workflow, tasks, implementation]
priority: high
---

# ✅ SpecKit Workflow: Tasks

> **Décomposer le plan technique en tâches concrètes implémentables.**

Ce workflow transforme un plan technique approuvé en checklist détaillée de tâches pour l'implémentation.

---

## 🎯 Objectif

Créer une liste de tâches actionnables :
1. ✅ **Granularité** : Tâches de 1-4h max
2. ✅ **Séquençage** : Ordre d'implémentation logique
3. ✅ **Traçabilité** : Liens vers spec + plan
4. ✅ **Testabilité** : Critères d'acceptation clairs
5. ✅ **Assignabilité** : Tâches parallélisables identifiées

---

## 📋 Prérequis

**Avant d'utiliser `/speckit.tasks`** :
- ✅ Plan technique créé via `/speckit.plan`
- ✅ Plan approuvé (status: `approved`)
- ✅ Architecture validée
- ✅ Data models définis

---

## 🚀 Processus

### Étape 1 : Analyser le plan technique

**Questions à se poser** :
- Quelles sont les dépendances entre composants ?
- Quel ordre d'implémentation minimise les blocages ?
- Quelles tâches peuvent être parallélisées ?
- Quels sont les risques techniques ?

**Checklist d'analyse** :
- [ ] Modules backend identifiés
- [ ] Migrations DB comprises
- [ ] Endpoints API listés
- [ ] Routes frontend comprises
- [ ] Tests identifiés

---

### Étape 2 : Créer la task list

**Commande** :
```bash
# Créer task list depuis template
cp .spec/templates/tasks-template.md .spec/tasks/mon-feature-tasks.md
```

**Template de tasks** :

```markdown
---
title: "Tasks: [Nom Feature]"
status: draft
version: 0.1.0
authors: [Votre nom]
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [tasks, implementation]
relates-to:
  - ../plans/mon-feature-plan.md
  - ../features/mon-feature.md
---

# Tasks : [Nom Feature]

## 📋 Contexte

### Plan Référencé
- **Plan** : [Lien](../plans/mon-feature-plan.md)
- **Spec** : [Lien](../features/mon-feature.md)
- **Status** : approved

### Estimation Globale
- **Complexité** : [Low|Medium|High|Very High]
- **Durée estimée** : [X jours/semaines]
- **Nombre de tâches** : [N]

---

## 🎯 Phases d'Implémentation

### Phase 1️⃣ : Database & Migrations (Pré-requis)
**Durée estimée** : 2-4h  
**Blocage** : Bloque toutes les autres phases

#### Task 1.1: Créer migration Supabase
**Description** : Créer table `mon_feature_table` avec schéma complet

**Fichiers** :
- `supabase/migrations/YYYYMMDD_create_mon_feature_table.sql`

**Actions** :
- [ ] Créer table avec colonnes (`id`, `user_id`, `field1`, `field2`, `status`, timestamps)
- [ ] Ajouter contraintes (`PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`)
- [ ] Créer indexes (`idx_mon_feature_user_id`, `idx_mon_feature_status`, `idx_mon_feature_created_at`)
- [ ] Ajouter commentaires SQL sur table et colonnes
- [ ] Tester migration en local : `supabase db reset --local`

**Critères d'acceptation** :
- [ ] Table créée avec toutes les colonnes
- [ ] Indexes créés et performants (EXPLAIN ANALYZE)
- [ ] Migration réversible (rollback script disponible)
- [ ] Contraintes validées (essai d'insertion invalide échoue)

**Estimation** : 1h

---

#### Task 1.2: Configurer RLS Policies
**Description** : Activer Row Level Security sur `mon_feature_table`

**Fichiers** :
- Même migration que 1.1

**Actions** :
- [ ] Activer RLS : `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Créer policy SELECT (users voient seulement leurs données)
- [ ] Créer policy INSERT (users créent seulement sous leur user_id)
- [ ] Créer policy UPDATE (users modifient seulement leurs données)
- [ ] Créer policy DELETE (users suppriment seulement leurs données)
- [ ] Tester policies avec différents `auth.uid()`

**Critères d'acceptation** :
- [ ] RLS activé
- [ ] 4 policies créées (SELECT, INSERT, UPDATE, DELETE)
- [ ] Tests manuels : user A ne voit pas données user B
- [ ] Tests manuels : user A ne peut pas modifier données user B

**Estimation** : 1h

---

#### Task 1.3: Créer trigger updated_at
**Description** : Auto-update `updated_at` sur modifications

**Fichiers** :
- Même migration que 1.1

**Actions** :
- [ ] Créer fonction `set_updated_at()` si pas existante
- [ ] Créer trigger `BEFORE UPDATE` sur `mon_feature_table`
- [ ] Tester : UPDATE devrait modifier `updated_at` automatiquement

**Critères d'acceptation** :
- [ ] Trigger créé et actif
- [ ] `updated_at` se met à jour sur chaque UPDATE
- [ ] `updated_at` ne change PAS sur SELECT ou INSERT

**Estimation** : 30min

---

### Phase 2️⃣ : Backend Core (Data Layer)
**Durée estimée** : 4-6h  
**Dépendance** : Phase 1 terminée

#### Task 2.1: Créer Data Service
**Description** : Implémenter `MonFeatureDataService` héritant de `SupabaseBaseService`

**Fichiers** :
- `backend/src/database/services/mon-feature-data.service.ts`

**Actions** :
- [ ] Créer classe `MonFeatureDataService extends SupabaseBaseService`
- [ ] Constructor avec injection `SUPABASE_CLIENT`
- [ ] Appeler `super(supabaseClient, 'mon_feature_table')`
- [ ] Implémenter méthodes custom :
  - `findByUserId(userId: string): Promise<MonFeature[]>`
  - `findByStatus(userId: string, status: string): Promise<MonFeature[]>`
  - `softDelete(id: string): Promise<void>`

**Critères d'acceptation** :
- [ ] Classe créée avec `@Injectable()`
- [ ] Méthodes CRUD héritées fonctionnelles (via `SupabaseBaseService`)
- [ ] Méthodes custom implémentées et testées
- [ ] Queries optimisées (utilise indexes)

**Estimation** : 2h

---

#### Task 2.2: Tests Unitaires Data Service
**Description** : Tester `MonFeatureDataService` avec mocks Supabase

**Fichiers** :
- `backend/src/database/services/mon-feature-data.service.spec.ts`

**Actions** :
- [ ] Setup test module avec mock `SUPABASE_CLIENT`
- [ ] Tester `findByUserId()` : retourne items filtrés par user_id
- [ ] Tester `findByStatus()` : retourne items filtrés par status
- [ ] Tester `softDelete()` : met à jour `deleted_at`
- [ ] Tester erreurs (item not found, DB error)
- [ ] Vérifier coverage : ≥ 80%

**Critères d'acceptation** :
- [ ] Tests passants : `npm test mon-feature-data.service.spec.ts`
- [ ] Coverage ≥ 80% (services)
- [ ] Tous les edge cases couverts

**Estimation** : 1.5h

---

#### Task 2.3: Créer Entities TypeScript
**Description** : Définir interface `MonFeature` et types associés

**Fichiers** :
- `backend/src/modules/mon-feature/entities/mon-feature.entity.ts`

**Actions** :
- [ ] Créer interface `MonFeature` avec tous les champs
- [ ] Créer type `MonFeatureStatus = 'active' | 'inactive' | 'archived'`
- [ ] Exporter types

**Critères d'acceptation** :
- [ ] Interface compile sans erreur (TypeScript strict)
- [ ] Tous les champs DB mappés
- [ ] Types réutilisables dans service/controller

**Estimation** : 30min

---

### Phase 3️⃣ : Backend API (Business Logic)
**Durée estimée** : 6-8h  
**Dépendance** : Phase 2 terminée

#### Task 3.1: Créer DTOs avec Zod
**Description** : Définir DTOs validés avec Zod pour API

**Fichiers** :
- `backend/src/modules/mon-feature/dto/create-mon-feature.dto.ts`
- `backend/src/modules/mon-feature/dto/update-mon-feature.dto.ts`
- `backend/src/modules/mon-feature/dto/mon-feature-response.dto.ts`
- `backend/src/modules/mon-feature/dto/filters.dto.ts`

**Actions** :
- [ ] **CreateMonFeatureDto** : schema Zod avec `field1` (required, max 255), `field2` (optional, int), `field3` (optional, object)
- [ ] **UpdateMonFeatureDto** : partial de CreateDto + `status` (optional)
- [ ] **MonFeatureResponseDto** : type de réponse API
- [ ] **FiltersDto** : query params (`status`, `page`, `limit`, `sortBy`, `sortOrder`)
- [ ] Exporter schemas et types inférés

**Critères d'acceptation** :
- [ ] Tous les DTOs définis avec Zod
- [ ] Validation stricte (rejette inputs invalides)
- [ ] Types TypeScript inférés correctement
- [ ] Documentation JSDoc sur chaque schema

**Estimation** : 1.5h

---

#### Task 3.2: Créer Service Métier
**Description** : Implémenter `MonFeatureService` avec business logic

**Fichiers** :
- `backend/src/modules/mon-feature/mon-feature.service.ts`

**Actions** :
- [ ] Créer classe `MonFeatureService` avec `@Injectable()`
- [ ] Injecter `MonFeatureDataService`, `CacheService` (optionnel)
- [ ] Implémenter méthodes :
  - `create(userId: string, dto: CreateMonFeatureDto): Promise<MonFeature>`
  - `findAll(userId: string, filters?: FiltersDto): Promise<PaginatedResponse<MonFeature>>`
  - `findOne(userId: string, id: string): Promise<MonFeature>`
  - `update(userId: string, id: string, dto: UpdateMonFeatureDto): Promise<MonFeature>`
  - `remove(userId: string, id: string): Promise<void>`
- [ ] Ajouter validation métier (ex: vérifier ownership avant update/delete)
- [ ] Ajouter gestion erreurs (NotFoundException, ForbiddenException)
- [ ] (Optionnel) Implémenter cache Redis pour `findAll()`

**Critères d'acceptation** :
- [ ] Toutes les méthodes implémentées
- [ ] Business logic validée (ownership checks)
- [ ] Erreurs custom appropriées
- [ ] Logs structurés (`this.logger.log()`)

**Estimation** : 3h

---

#### Task 3.3: Tests Unitaires Service Métier
**Description** : Tester `MonFeatureService` avec mocks

**Fichiers** :
- `backend/src/modules/mon-feature/mon-feature.service.spec.ts`

**Actions** :
- [ ] Setup test module avec mocks (`MonFeatureDataService`, `CacheService`)
- [ ] Tester `create()` : item créé correctement
- [ ] Tester `create()` erreur : duplicate field1 → ConflictException
- [ ] Tester `findAll()` : retourne liste paginée
- [ ] Tester `findOne()` : retourne item si owner
- [ ] Tester `findOne()` erreur : pas owner → ForbiddenException
- [ ] Tester `update()` : item mis à jour
- [ ] Tester `remove()` : soft delete effectué
- [ ] Vérifier coverage : ≥ 80%

**Critères d'acceptation** :
- [ ] Tests passants : `npm test mon-feature.service.spec.ts`
- [ ] Coverage ≥ 80% (services)
- [ ] Tous les cas nominaux et erreurs couverts

**Estimation** : 2h

---

#### Task 3.4: Créer Controller REST
**Description** : Implémenter `MonFeatureController` avec endpoints API

**Fichiers** :
- `backend/src/modules/mon-feature/mon-feature.controller.ts`

**Actions** :
- [ ] Créer classe `MonFeatureController` avec `@Controller('mon-feature')`
- [ ] Ajouter `@UseGuards(JwtAuthGuard)` (authentication requise)
- [ ] Implémenter endpoints :
  - `POST /api/mon-feature` → `create(@Body() dto, @Req() req)`
  - `GET /api/mon-feature` → `findAll(@Query() filters, @Req() req)`
  - `GET /api/mon-feature/:id` → `findOne(@Param('id') id, @Req() req)`
  - `PATCH /api/mon-feature/:id` → `update(@Param('id') id, @Body() dto, @Req() req)`
  - `DELETE /api/mon-feature/:id` → `remove(@Param('id') id, @Req() req)`
- [ ] Ajouter validation DTOs avec `ZodValidationPipe`
- [ ] Ajouter Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)

**Critères d'acceptation** :
- [ ] Tous les endpoints définis
- [ ] Guards appliqués (JWT required)
- [ ] Validation DTOs active
- [ ] Swagger doc générée automatiquement
- [ ] Status codes appropriés (201, 200, 204, 404, 403)

**Estimation** : 2h

---

#### Task 3.5: Tests Unitaires Controller
**Description** : Tester `MonFeatureController` avec mocks

**Fichiers** :
- `backend/src/modules/mon-feature/mon-feature.controller.spec.ts`

**Actions** :
- [ ] Setup test module avec mock `MonFeatureService`
- [ ] Tester `POST /` : appelle service.create() avec userId + dto
- [ ] Tester `GET /` : appelle service.findAll() avec userId + filters
- [ ] Tester `GET /:id` : appelle service.findOne()
- [ ] Tester `PATCH /:id` : appelle service.update()
- [ ] Tester `DELETE /:id` : appelle service.remove()
- [ ] Tester validation : DTO invalide → 400
- [ ] Vérifier coverage : ≥ 60% (controllers)

**Critères d'acceptation** :
- [ ] Tests passants : `npm test mon-feature.controller.spec.ts`
- [ ] Coverage ≥ 60% (controllers)
- [ ] Tous les endpoints testés

**Estimation** : 1.5h

---

#### Task 3.6: Créer Module NestJS
**Description** : Définir `MonFeatureModule` avec imports/providers/exports

**Fichiers** :
- `backend/src/modules/mon-feature/mon-feature.module.ts`

**Actions** :
- [ ] Créer `@Module()` decorator
- [ ] Imports : `ConfigModule`, `AuthModule`, `DatabaseModule`, `CacheModule` (optionnel)
- [ ] Controllers : `[MonFeatureController]`
- [ ] Providers : `[MonFeatureService, MonFeatureDataService]`
- [ ] Exports : `[MonFeatureService]` (si réutilisé par autres modules)
- [ ] Enregistrer module dans `AppModule`

**Critères d'acceptation** :
- [ ] Module compile sans erreur
- [ ] Dépendances injectées correctement
- [ ] Module importé dans `AppModule`
- [ ] App démarre : `npm run start:dev`

**Estimation** : 30min

---

### Phase 4️⃣ : Tests d'Intégration
**Durée estimée** : 3-4h  
**Dépendance** : Phase 3 terminée

#### Task 4.1: Tests Intégration Backend
**Description** : Tester interaction Controller ↔ Service ↔ DB

**Fichiers** :
- `backend/src/modules/mon-feature/mon-feature.integration.spec.ts`

**Actions** :
- [ ] Setup test avec vraie DB (Supabase test instance)
- [ ] Tester POST → item créé en DB
- [ ] Tester GET → item récupéré de DB
- [ ] Tester PATCH → item mis à jour en DB
- [ ] Tester DELETE → soft delete en DB
- [ ] Nettoyer DB après chaque test

**Critères d'acceptation** :
- [ ] Tests passants avec vraie DB
- [ ] Données persistées correctement
- [ ] RLS policies respectées
- [ ] Cleanup DB automatique (afterEach)

**Estimation** : 2h

---

#### Task 4.2: Tests E2E User Flow
**Description** : Tester user flow complet (CRUD cycle)

**Fichiers** :
- `backend/test/mon-feature.e2e.spec.ts`

**Actions** :
- [ ] Setup app E2E avec auth
- [ ] Tester flow : Login → Create → Read → Update → Delete
- [ ] Tester permissions : user A ne peut pas modifier item de user B
- [ ] Tester erreurs : item not found, unauthorized, validation errors

**Critères d'acceptation** :
- [ ] Tests E2E passants
- [ ] User flow complet validé
- [ ] Permissions testées (isolation users)
- [ ] Erreurs gérées correctement

**Estimation** : 2h

---

### Phase 5️⃣ : Frontend (Remix)
**Durée estimée** : 8-12h  
**Dépendance** : Phase 3 terminée (API dispo)

#### Task 5.1: Créer Layout Route
**Description** : Créer route layout `mon-feature.tsx`

**Fichiers** :
- `frontend/app/routes/mon-feature.tsx`

**Actions** :
- [ ] Créer composant layout avec navigation
- [ ] Ajouter breadcrumb
- [ ] Ajouter `<Outlet />` pour nested routes
- [ ] Gérer erreurs avec `ErrorBoundary`

**Critères d'acceptation** :
- [ ] Layout affiche correctement
- [ ] Navigation fonctionnelle
- [ ] ErrorBoundary catch erreurs

**Estimation** : 1h

---

#### Task 5.2: Route Index (Liste)
**Description** : Créer `mon-feature._index.tsx` (liste items)

**Fichiers** :
- `frontend/app/routes/mon-feature._index.tsx`

**Actions** :
- [ ] Implémenter `loader()` : fetch `GET /api/mon-feature`
- [ ] Gérer pagination (query params)
- [ ] Afficher liste items avec composant `<MonFeatureCard>`
- [ ] Ajouter filtres (status)
- [ ] Ajouter bouton "Créer"
- [ ] Gérer états vides

**Critères d'acceptation** :
- [ ] Liste affiche items de l'utilisateur
- [ ] Pagination fonctionnelle
- [ ] Filtres appliqués correctement
- [ ] Loading states gérés

**Estimation** : 3h

---

#### Task 5.3: Route New (Création)
**Description** : Créer `mon-feature.new.tsx` (formulaire création)

**Fichiers** :
- `frontend/app/routes/mon-feature.new.tsx`

**Actions** :
- [ ] Implémenter `action()` : POST `/api/mon-feature`
- [ ] Créer formulaire avec validation (Zod client-side)
- [ ] Afficher erreurs validation
- [ ] Redirect après succès vers `/mon-feature`
- [ ] Toast notification "Item créé"

**Critères d'acceptation** :
- [ ] Formulaire soumission fonctionnelle
- [ ] Validation client-side + server-side
- [ ] Redirect après création
- [ ] Toast success affiché

**Estimation** : 2.5h

---

#### Task 5.4: Route Detail (Lecture)
**Description** : Créer `mon-feature.$id.tsx` (détail item)

**Fichiers** :
- `frontend/app/routes/mon-feature.$id.tsx`

**Actions** :
- [ ] Implémenter `loader()` : fetch `GET /api/mon-feature/:id`
- [ ] Afficher toutes les données item
- [ ] Gérer 404 (item not found)
- [ ] Gérer 403 (forbidden)
- [ ] Ajouter boutons "Éditer" et "Supprimer"

**Critères d'acceptation** :
- [ ] Détail affiché correctement
- [ ] Erreurs 404/403 gérées
- [ ] Boutons actions fonctionnels

**Estimation** : 2h

---

#### Task 5.5: Route Edit (Édition)
**Description** : Créer `mon-feature.$id.edit.tsx` (formulaire édition)

**Fichiers** :
- `frontend/app/routes/mon-feature.$id.edit.tsx`

**Actions** :
- [ ] Implémenter `loader()` : fetch item pour pré-remplir form
- [ ] Implémenter `action()` : PATCH `/api/mon-feature/:id`
- [ ] Formulaire pré-rempli avec données existantes
- [ ] Validation + gestion erreurs
- [ ] Redirect après succès vers détail

**Critères d'acceptation** :
- [ ] Formulaire pré-rempli
- [ ] Mise à jour fonctionnelle
- [ ] Redirect après update
- [ ] Toast success affiché

**Estimation** : 2.5h

---

#### Task 5.6: Action Delete
**Description** : Implémenter suppression item

**Fichiers** :
- `frontend/app/routes/mon-feature.$id.tsx` (ajouter action DELETE)

**Actions** :
- [ ] Implémenter `action()` : DELETE `/api/mon-feature/:id`
- [ ] Modal confirmation avant suppression
- [ ] Optimistic UI (retirer item immédiatement)
- [ ] Redirect après succès vers liste

**Critères d'acceptation** :
- [ ] Modal confirmation affichée
- [ ] DELETE fonctionnel
- [ ] Optimistic UI correct
- [ ] Redirect après delete

**Estimation** : 1.5h

---

### Phase 6️⃣ : Composants UI
**Durée estimée** : 4-6h  
**Parallélisable avec Phase 5**

#### Task 6.1: Composant MonFeatureCard
**Description** : Carte affichant résumé item

**Fichiers** :
- `frontend/app/components/mon-feature/MonFeatureCard.tsx`

**Actions** :
- [ ] Créer composant stateless
- [ ] Props : `item: MonFeature`, `onEdit?: () => void`, `onDelete?: () => void`
- [ ] Afficher field1, field2, status, dates
- [ ] Boutons actions (conditionnels)
- [ ] Responsive (mobile-first)

**Critères d'acceptation** :
- [ ] Composant s'affiche correctement
- [ ] Props typées (TypeScript)
- [ ] Responsive
- [ ] Accessible (WCAG AA)

**Estimation** : 1.5h

---

#### Task 6.2: Composant MonFeatureForm
**Description** : Formulaire réutilisable (create + edit)

**Fichiers** :
- `frontend/app/components/mon-feature/MonFeatureForm.tsx`

**Actions** :
- [ ] Créer composant formulaire
- [ ] Props : `defaultValues?: Partial<MonFeature>`, `onSubmit: (data) => void`
- [ ] Validation Zod client-side
- [ ] Affichage erreurs inline
- [ ] Loading state pendant soumission

**Critères d'acceptation** :
- [ ] Formulaire réutilisable (create/edit)
- [ ] Validation fonctionnelle
- [ ] UX optimale (focus, erreurs inline)

**Estimation** : 2h

---

#### Task 6.3: Composant MonFeatureFilters
**Description** : Filtres pour liste items

**Fichiers** :
- `frontend/app/components/mon-feature/MonFeatureFilters.tsx`

**Actions** :
- [ ] Créer composant filtres
- [ ] Props : `onFilterChange: (filters) => void`
- [ ] Filter par status (dropdown)
- [ ] Sort by (dropdown)
- [ ] Responsive

**Critères d'acceptation** :
- [ ] Filtres appliqués correctement
- [ ] URL query params synchronisés
- [ ] Responsive

**Estimation** : 1.5h

---

### Phase 7️⃣ : Performance & Cache
**Durée estimée** : 2-3h  
**Optionnel selon besoin**

#### Task 7.1: Implémenter Cache Redis
**Description** : Cache pour `findAll()` sur backend

**Fichiers** :
- `backend/src/modules/mon-feature/mon-feature.service.ts`

**Actions** :
- [ ] Ajouter cache dans `findAll()` (TTL 5min)
- [ ] Invalider cache sur `create()`, `update()`, `remove()`
- [ ] Tester hit/miss ratio
- [ ] Logs cache hits/misses

**Critères d'acceptation** :
- [ ] Cache fonctionnel
- [ ] Invalidation correcte
- [ ] Performance améliorée (mesure avant/après)

**Estimation** : 2h

---

#### Task 7.2: Optimiser Queries DB
**Description** : Vérifier performance queries Supabase

**Actions** :
- [ ] `EXPLAIN ANALYZE` sur queries principales
- [ ] Vérifier utilisation indexes
- [ ] Optimiser `select()` (pas de `select('*')`)
- [ ] Pagination via `range()` plutôt qu'offset

**Critères d'acceptation** :
- [ ] Queries < 50ms P95
- [ ] Indexes utilisés (EXPLAIN)
- [ ] Pagination optimisée

**Estimation** : 1h

---

### Phase 8️⃣ : Documentation & Déploiement
**Durée estimée** : 2-3h

#### Task 8.1: Documentation API (OpenAPI)
**Description** : Générer spec OpenAPI

**Fichiers** :
- `.spec/apis/mon-feature-api.yaml`

**Actions** :
- [ ] Exporter Swagger JSON depuis NestJS
- [ ] Convertir en YAML
- [ ] Ajouter exemples requests/responses
- [ ] Publier dans `.spec/apis/`

**Critères d'acceptation** :
- [ ] Spec OpenAPI complète
- [ ] Exemples fournis
- [ ] Accessible via `/api/docs` (Swagger UI)

**Estimation** : 1h

---

#### Task 8.2: README Module
**Description** : Documenter module pour équipe

**Fichiers** :
- `backend/src/modules/mon-feature/README.md`

**Actions** :
- [ ] Overview module
- [ ] Architecture (services, controllers)
- [ ] Endpoints API
- [ ] Exemples usage
- [ ] Tests (comment run)

**Critères d'acceptation** :
- [ ] README complet
- [ ] Exemples curl fournis
- [ ] Instructions tests

**Estimation** : 1h

---

#### Task 8.3: Déploiement Staging
**Description** : Déployer feature en staging

**Actions** :
- [ ] Merger PR dans `develop`
- [ ] Trigger CI/CD vers staging
- [ ] Exécuter migrations Supabase
- [ ] Vérifier endpoints API
- [ ] Smoke tests manuels

**Critères d'acceptation** :
- [ ] Feature déployée en staging
- [ ] Migrations appliquées
- [ ] Endpoints fonctionnels
- [ ] Smoke tests passants

**Estimation** : 1h

---

## 📊 Tableau Récapitulatif

| Phase | Tâches | Durée | Dépendances | Parallélisable |
|-------|--------|-------|-------------|----------------|
| 1️⃣ Database | 3 | 2-4h | - | Non |
| 2️⃣ Data Layer | 3 | 4-6h | Phase 1 | Non |
| 3️⃣ API | 6 | 6-8h | Phase 2 | Non |
| 4️⃣ Tests Intégration | 2 | 3-4h | Phase 3 | Non |
| 5️⃣ Frontend | 6 | 8-12h | Phase 3 | Partiellement |
| 6️⃣ Composants UI | 3 | 4-6h | - | Oui (avec Phase 5) |
| 7️⃣ Performance | 2 | 2-3h | Phase 3 | Oui |
| 8️⃣ Doc & Deploy | 3 | 2-3h | Toutes | Partiellement |

**Total** : 28 tâches, ~35-50h

---

## 🎯 Stratégie de Parallélisation

### Tâches Parallélisables
- **Phase 6** (Composants UI) peut commencer dès que spécifications claires (parallèle Phase 5)
- **Phase 7** (Performance) peut commencer après Phase 3 (API fonctionnelle)
- **Task 8.1/8.2** (Documentation) peuvent commencer tôt

### Séquence Critique (Bloquante)
```
Phase 1 (DB) → Phase 2 (Data Layer) → Phase 3 (API) → Phase 4 (Tests) → Phase 8.3 (Deploy)
```

**Durée minimale avec parallélisation** : ~25-35h (économie ~30%)

---

## ✅ Checklist Globale

**Avant de commencer** :
- [ ] Plan technique approuvé
- [ ] Environnement dev configuré
- [ ] Accès Supabase configuré
- [ ] Branch feature créée

**Pendant l'implémentation** :
- [ ] Commits fréquents (atomic commits)
- [ ] Tests passants à chaque phase
- [ ] Code review continue (PR par phase)
- [ ] Documentation au fur et à mesure

**Après implémentation** :
- [ ] Tous les tests passants (unit + integration + E2E)
- [ ] Coverage objectifs atteints (80% services, 60% controllers)
- [ ] Documentation complète (README, OpenAPI)
- [ ] Feature déployée en staging
- [ ] Smoke tests manuels validés
- [ ] Métriques de performance vérifiées

---

## 🔗 Prochaines Étapes

Après avoir complété `/speckit.tasks` :

1. **`/speckit.analyze`** : Vérifier cohérence spec/plan/tasks
2. **`/speckit.checklist`** : Générer checklists qualité
3. **`/speckit.implement`** : Commencer implémentation avec tasks définies

---

## 📚 Ressources

- [Constitution du Projet](../constitution.md)
- [Plan Technique](../plans/mon-feature-plan.md)
- [Spec Fonctionnelle](../features/mon-feature.md)
- [Testing Best Practices](../guides/testing-best-practices.md)

---

**Note** : Cette task list doit être validée par l'équipe avant implémentation. Ajuster estimations selon contexte réel.
