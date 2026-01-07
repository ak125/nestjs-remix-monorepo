---
title: "SpecKit Workflow: Checklist"
status: approved
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
tags: [speckit, workflow, quality, checklist]
priority: high
---

# ✅ SpecKit Workflow: Checklist

> **Générer des checklists qualité exhaustives pour validation avant, pendant, et après implémentation.**

Ce workflow transforme les exigences (spec + plan + tasks) en checklists actionnables pour garantir la qualité.

---

## 🎯 Objectif

Créer des checklists multi-niveaux :
1. ✅ **Pre-Implementation** : Validation avant de coder
2. ✅ **During Implementation** : Suivi qualité continu
3. ✅ **Pre-Review** : Auto-vérification avant PR
4. ✅ **Acceptance Testing** : Tests en langage naturel
5. ✅ **Production Readiness** : Validation avant déploiement

---

## 📋 Prérequis

**Avant d'utiliser `/speckit.checklist`** :
- ✅ Spec approuvée (via `/speckit.specify`)
- ✅ Plan technique complet (via `/speckit.plan`)
- ✅ Tasks définies (via `/speckit.tasks`)
- ✅ Analyse effectuée (via `/speckit.analyze`)

---

## 🚀 Processus

### Étape 1 : Générer les Checklists

**Commande** :
```bash
# Créer checklist depuis template
cp .spec/templates/checklist-template.md .spec/checklists/mon-feature-checklist.md
```

---

## 📝 Template Checklist Complet

```markdown
---
title: "Checklist: [Nom Feature]"
status: draft
version: 0.1.0
created: YYYY-MM-DD
updated: YYYY-MM-DD
relates-to:
  - ../features/mon-feature.md
  - ../plans/mon-feature-plan.md
  - ../tasks/mon-feature-tasks.md
---

# Checklist : [Nom Feature]

## 📋 Contexte

**Feature** : [Lien spec](../features/mon-feature.md)  
**Plan** : [Lien plan](../plans/mon-feature-plan.md)  
**Tasks** : [Lien tasks](../tasks/mon-feature-tasks.md)  
**Date Création** : YYYY-MM-DD

---

## 🔵 Phase 1 : Pre-Implementation Checklist

> **Objectif** : Valider que tout est prêt avant de coder

### Documentation

- [ ] Spec fonctionnelle approuvée (status: `approved`)
- [ ] Plan technique approuvé (status: `approved`)
- [ ] Tasks définies avec estimations
- [ ] Analyse effectuée (gaps identifiés et résolus)
- [ ] ADRs référencés si décisions architecture

### Environnement

- [ ] Branch feature créée : `git checkout -b feat/mon-feature`
- [ ] Database locale prête (Supabase local running)
- [ ] Accès Supabase configuré (env vars)
- [ ] Redis local running (si requis pour cache)
- [ ] Dependencies installées : `npm install`

### Validation Technique

- [ ] Stack technique validée (NestJS 10, Remix, Supabase)
- [ ] Patterns architecture identifiés (SupabaseBaseService, etc.)
- [ ] Dépendances npm disponibles
- [ ] Migrations DB préparées (SQL scripts)

### Équipe

- [ ] PR draft créée (GitHub)
- [ ] Assigné(e) : [Nom développeur]
- [ ] Reviewer(s) identifié(s) : [Noms]
- [ ] Estimation communiquée : [X heures]

---

## 🟢 Phase 2 : Implementation Checklist

> **Objectif** : Suivre qualité pendant développement

### Phase 2.1 : Database & Migrations

- [ ] ✅ Migration SQL créée : `supabase/migrations/YYYYMMDD_create_mon_feature_table.sql`
- [ ] ✅ Table créée avec toutes colonnes (id, user_id, fields, timestamps)
- [ ] ✅ Contraintes définies (PRIMARY KEY, FOREIGN KEYs, NOT NULL, UNIQUE)
- [ ] ✅ Indexes créés (user_id, status, created_at)
- [ ] ✅ RLS policies activées (SELECT, INSERT, UPDATE, DELETE)
- [ ] ✅ Trigger `updated_at` créé
- [ ] ✅ Comments SQL ajoutés (table + colonnes)
- [ ] ✅ Migration testée localement : `supabase db reset --local`
- [ ] ✅ Rollback script préparé (si besoin)
- [ ] ✅ Migration committed : `git add migrations/`

### Phase 2.2 : Backend - Data Layer

- [ ] ✅ Data Service créé : `backend/src/database/services/mon-feature-data.service.ts`
- [ ] ✅ Hérite de `SupabaseBaseService`
- [ ] ✅ Constructor avec injection `SUPABASE_CLIENT`
- [ ] ✅ Méthodes CRUD héritées fonctionnelles
- [ ] ✅ Méthodes custom implémentées (findByUserId, etc.)
- [ ] ✅ TypeScript strict mode OK (pas d'erreurs compilation)
- [ ] ✅ Tests unitaires Data Service créés (`*.service.spec.ts`)
- [ ] ✅ Coverage ≥ 80% Data Service : `npm test -- --coverage`
- [ ] ✅ Entity TypeScript définie : `entities/mon-feature.entity.ts`

### Phase 2.3 : Backend - Business Logic

- [ ] ✅ DTOs Zod créés : `dto/create-*.dto.ts`, `dto/update-*.dto.ts`, `dto/*-response.dto.ts`
- [ ] ✅ Validation Zod stricte (rejette inputs invalides)
- [ ] ✅ Service métier créé : `mon-feature.service.ts`
- [ ] ✅ Méthodes business implémentées (create, findAll, findOne, update, remove)
- [ ] ✅ Validation ownership (user ne peut accéder qu'à ses données)
- [ ] ✅ Gestion erreurs (NotFoundException, ForbiddenException, ConflictException)
- [ ] ✅ Logs structurés ajoutés (`this.logger.log()`)
- [ ] ✅ Tests unitaires Service métier créés
- [ ] ✅ Coverage ≥ 80% Service métier
- [ ] ✅ Controller REST créé : `mon-feature.controller.ts`
- [ ] ✅ Endpoints définis (POST, GET, GET/:id, PATCH/:id, DELETE/:id)
- [ ] ✅ Guards appliqués (`@UseGuards(JwtAuthGuard)`)
- [ ] ✅ Validation DTOs active (`ZodValidationPipe`)
- [ ] ✅ Swagger decorators ajoutés (`@ApiOperation`, `@ApiResponse`)
- [ ] ✅ Tests unitaires Controller créés
- [ ] ✅ Coverage ≥ 60% Controller
- [ ] ✅ Module NestJS créé : `mon-feature.module.ts`
- [ ] ✅ Imports/Providers/Exports corrects
- [ ] ✅ Module enregistré dans `AppModule`
- [ ] ✅ App démarre sans erreur : `npm run start:dev`

### Phase 2.4 : Tests d'Intégration

- [ ] ✅ Tests intégration créés : `mon-feature.integration.spec.ts`
- [ ] ✅ Tests avec vraie DB (Supabase test instance)
- [ ] ✅ POST → item créé en DB
- [ ] ✅ GET → item récupéré de DB
- [ ] ✅ PATCH → item mis à jour en DB
- [ ] ✅ DELETE → soft delete en DB
- [ ] ✅ RLS policies validées (user A ≠ user B)
- [ ] ✅ Cleanup DB automatique (afterEach)
- [ ] ✅ Tests E2E créés : `test/mon-feature.e2e.spec.ts`
- [ ] ✅ User flow CRUD complet testé
- [ ] ✅ Permissions testées (isolation users)
- [ ] ✅ Erreurs testées (404, 403, 400)

### Phase 2.5 : Frontend (Remix)

- [ ] ✅ Layout route créé : `frontend/app/routes/mon-feature.tsx`
- [ ] ✅ Route index (liste) créée : `mon-feature._index.tsx`
- [ ] ✅ Loader fetch API implémenté
- [ ] ✅ Pagination fonctionnelle (query params)
- [ ] ✅ Filtres implémentés (status, sort)
- [ ] ✅ Route new (création) créée : `mon-feature.new.tsx`
- [ ] ✅ Action POST implémentée
- [ ] ✅ Formulaire validé (Zod client-side)
- [ ] ✅ Redirect après création
- [ ] ✅ Toast notification success
- [ ] ✅ Route detail créée : `mon-feature.$id.tsx`
- [ ] ✅ Loader fetch item implémenté
- [ ] ✅ Erreurs 404/403 gérées
- [ ] ✅ Route edit créée : `mon-feature.$id.edit.tsx`
- [ ] ✅ Formulaire pré-rempli
- [ ] ✅ Action PATCH implémentée
- [ ] ✅ Action DELETE implémentée (avec modal confirmation)
- [ ] ✅ Optimistic UI pour delete

### Phase 2.6 : Composants UI

- [ ] ✅ Composant `MonFeatureCard` créé
- [ ] ✅ Composant `MonFeatureForm` créé (réutilisable create/edit)
- [ ] ✅ Composant `MonFeatureFilters` créé
- [ ] ✅ Tous composants TypeScript typés
- [ ] ✅ Composants responsive (mobile-first)
- [ ] ✅ Accessibilité WCAG AA (aria-labels, keyboard nav)
- [ ] ✅ Dark mode supporté (via design tokens)

### Phase 2.7 : Performance & Cache (Optionnel)

- [ ] ✅ Cache Redis implémenté (findAll avec TTL 5min)
- [ ] ✅ Invalidation cache (create, update, delete)
- [ ] ✅ Queries DB optimisées (EXPLAIN ANALYZE < 50ms)
- [ ] ✅ Indexes utilisés (vérification EXPLAIN)
- [ ] ✅ Select spécifiques (pas de `select('*')`)
- [ ] ✅ Pagination via `range()` plutôt qu'offset

---

## 🟡 Phase 3 : Pre-Review Checklist

> **Objectif** : Auto-vérification avant demande de review

### Code Quality

- [ ] ✅ ESLint passes : `npm run lint`
- [ ] ✅ Prettier format : `npm run format`
- [ ] ✅ TypeScript strict OK : `npm run type-check`
- [ ] ✅ Pas de `@ts-ignore` ou `any` injustifiés
- [ ] ✅ Pas de console.log oubliés (utiliser logger)
- [ ] ✅ Imports triés et organisés
- [ ] ✅ Pas de code commenté inutile

### Tests

- [ ] ✅ Tous tests passants : `npm test`
- [ ] ✅ Coverage objectifs atteints :
  - `npm test -- --coverage`
  - Services ≥ 80%
  - Controllers ≥ 60%
- [ ] ✅ Tests E2E passants : `npm run test:e2e`
- [ ] ✅ Pas de tests skipped (`it.skip`, `describe.skip`) sauf justifié

### Documentation

- [ ] ✅ JSDoc ajouté sur fonctions publiques
- [ ] ✅ README module créé : `backend/src/modules/mon-feature/README.md`
- [ ] ✅ Exemples curl fournis dans README
- [ ] ✅ OpenAPI spec générée : `.spec/apis/mon-feature-api.yaml`
- [ ] ✅ Swagger UI accessible : `http://localhost:3000/api/docs`
- [ ] ✅ Changelog mis à jour : `.spec/features/mon-feature.md` (section Change Log)

### Git & PR

- [ ] ✅ Commits atomiques (1 commit = 1 changement logique)
- [ ] ✅ Messages de commit conventionnels :
  - `feat: add mon-feature CRUD endpoints`
  - `test: add mon-feature integration tests`
  - `docs: update mon-feature README`
- [ ] ✅ Pas de secrets committés (API keys, passwords)
- [ ] ✅ `.gitignore` à jour si nouveaux fichiers générés
- [ ] ✅ PR description complète (template rempli)
- [ ] ✅ PR liée à issue/spec : "Closes #123"
- [ ] ✅ Screenshots/GIFs ajoutés (si UI change)

### Sécurité

- [ ] ✅ Validation inputs (Zod DTOs)
- [ ] ✅ Authentication requise (JwtAuthGuard)
- [ ] ✅ Authorization vérifiée (ownership checks)
- [ ] ✅ RLS policies testées
- [ ] ✅ Pas de SQL injection possible (Supabase query builder)
- [ ] ✅ Pas de XSS possible (sanitization HTML si nécessaire)
- [ ] ✅ Rate limiting considéré (si endpoint public)

### Performance

- [ ] ✅ Pas de N+1 queries
- [ ] ✅ Indexes DB utilisés
- [ ] ✅ Cache implémenté si pertinent
- [ ] ✅ Pagination sur listes > 50 items
- [ ] ✅ Images optimisées (si UI)
- [ ] ✅ Bundle size acceptable (vérifier Vite build)

---

## 🟣 Phase 4 : Acceptance Testing Checklist

> **Objectif** : Tests en langage naturel pour validation fonctionnelle

### Tests Utilisateur en Langage Naturel

**Format** : `GIVEN [contexte] WHEN [action] THEN [résultat attendu]`

#### Scénario 1 : Création d'un item

**Test 1.1 : Création réussie**
```
GIVEN un utilisateur connecté sur /mon-feature/new
WHEN il remplit le formulaire (field1: "Test", field2: 42) et soumet
THEN l'item est créé en DB
  AND il est redirigé vers /mon-feature
  AND une notification "Item créé" s'affiche
  AND l'item apparaît dans la liste
```
- [ ] ✅ Test manuel passant
- [ ] ✅ Test E2E automatique passant

**Test 1.2 : Validation erreur**
```
GIVEN un utilisateur connecté sur /mon-feature/new
WHEN il soumet le formulaire avec field1 vide
THEN une erreur "field1 est requis" s'affiche
  AND le formulaire n'est PAS soumis
  AND aucun item n'est créé en DB
```
- [ ] ✅ Test manuel passant
- [ ] ✅ Test unitaire DTO validation passant

**Test 1.3 : Doublon détecté**
```
GIVEN un utilisateur avec un item existant (field1: "Unique")
WHEN il tente de créer un nouvel item avec field1: "Unique"
THEN une erreur 409 "Item already exists" est retournée
  AND aucun doublon n'est créé en DB
```
- [ ] ✅ Test intégration passant (contrainte UNIQUE)

#### Scénario 2 : Lecture de la liste

**Test 2.1 : Liste affichée**
```
GIVEN un utilisateur connecté avec 3 items existants
WHEN il navigue vers /mon-feature
THEN les 3 items s'affichent dans la liste
  AND chaque item affiche field1, field2, status, createdAt
  AND les items sont triés par date (plus récent en premier)
```
- [ ] ✅ Test manuel passant
- [ ] ✅ Test E2E passant

**Test 2.2 : Pagination**
```
GIVEN un utilisateur avec 25 items existants
WHEN il navigue vers /mon-feature?page=1&limit=20
THEN 20 items s'affichent
  AND un bouton "Page suivante" est visible
WHEN il clique "Page suivante"
THEN les 5 items restants s'affichent (page 2)
```
- [ ] ✅ Test manuel passant
- [ ] ✅ Test intégration pagination passant

**Test 2.3 : Filtres**
```
GIVEN un utilisateur avec 10 items (5 "active", 5 "inactive")
WHEN il sélectionne filtre status="active"
THEN seulement les 5 items "active" s'affichent
  AND l'URL contient ?status=active
```
- [ ] ✅ Test manuel passant

#### Scénario 3 : Mise à jour

**Test 3.1 : Mise à jour réussie**
```
GIVEN un utilisateur sur /mon-feature/{id}/edit
WHEN il modifie field1 de "Old" à "New" et soumet
THEN l'item est mis à jour en DB
  AND il est redirigé vers /mon-feature/{id}
  AND la nouvelle valeur "New" s'affiche
  AND une notification "Item mis à jour" s'affiche
```
- [ ] ✅ Test manuel passant
- [ ] ✅ Test E2E passant

**Test 3.2 : Modification non autorisée**
```
GIVEN un utilisateur A connecté
  AND un item créé par utilisateur B
WHEN utilisateur A tente PATCH /api/mon-feature/{id-de-B}
THEN une erreur 403 "Forbidden" est retournée
  AND l'item de B n'est PAS modifié
```
- [ ] ✅ Test intégration RLS passant
- [ ] ✅ Test E2E permissions passant

#### Scénario 4 : Suppression

**Test 4.1 : Suppression réussie**
```
GIVEN un utilisateur sur /mon-feature/{id}
WHEN il clique "Supprimer"
  AND confirme dans la modal
THEN l'item est soft deleted (deleted_at renseigné)
  AND il est redirigé vers /mon-feature
  AND l'item n'apparaît plus dans la liste
  AND une notification "Item supprimé" s'affiche
```
- [ ] ✅ Test manuel passant
- [ ] ✅ Test E2E passant

**Test 4.2 : Annulation suppression**
```
GIVEN un utilisateur sur /mon-feature/{id}
WHEN il clique "Supprimer"
  AND clique "Annuler" dans la modal
THEN la modal se ferme
  AND l'item n'est PAS supprimé
  AND il reste sur /mon-feature/{id}
```
- [ ] ✅ Test manuel passant

#### Scénario 5 : Sécurité & Permissions

**Test 5.1 : Authentication requise**
```
GIVEN un utilisateur NON connecté
WHEN il tente d'accéder /api/mon-feature
THEN une erreur 401 "Unauthorized" est retournée
  AND il est redirigé vers /login
```
- [ ] ✅ Test E2E passant

**Test 5.2 : Isolation users**
```
GIVEN un utilisateur A avec 5 items
  AND un utilisateur B avec 3 items
WHEN utilisateur A fait GET /api/mon-feature
THEN seulement les 5 items de A sont retournés
  AND aucun item de B n'est visible
```
- [ ] ✅ Test intégration RLS passant

#### Scénario 6 : Performance

**Test 6.1 : Temps de réponse < 100ms**
```
GIVEN un utilisateur connecté
WHEN il fait GET /api/mon-feature (avec cache chaud)
THEN le temps de réponse est < 100ms P95
```
- [ ] ✅ Load testing (k6) passant : `npm run test:load`

**Test 6.2 : Charge 1000 req/s**
```
GIVEN une instance backend déployée
WHEN 1000 requêtes/seconde GET /api/mon-feature
THEN le serveur répond sans erreur 5xx
  AND le temps de réponse reste < 200ms P95
```
- [ ] ✅ Load testing (k6) passant : `npm run test:load`

---

## 🔴 Phase 5 : Production Readiness Checklist

> **Objectif** : Validation finale avant déploiement production

### Infrastructure

- [ ] ✅ Migrations DB testées en staging
- [ ] ✅ Rollback script testé
- [ ] ✅ Indexes créés en production (via migration)
- [ ] ✅ RLS policies actives en production
- [ ] ✅ Redis configuré (si requis)
- [ ] ✅ Variables d'environnement configurées :
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `JWT_SECRET`
  - `REDIS_URL` (si cache)

### Monitoring

- [ ] ✅ Logs backend configurés (Vector + Grafana)
- [ ] ✅ Métriques Prometheus exposées :
  - `mon_feature_created_total`
  - `mon_feature_request_duration_seconds`
  - `mon_feature_errors_total`
- [ ] ✅ Alertes configurées (Grafana) :
  - Taux erreur > 1%
  - Latence P95 > 200ms
  - Disponibilité < 99.5%
- [ ] ✅ Dashboards Grafana créés (queries/s, latency, errors)

### Sécurité

- [ ] ✅ Audit sécurité effectué (npm audit)
- [ ] ✅ Dépendances à jour (npm outdated)
- [ ] ✅ Secrets rotés si nécessaire
- [ ] ✅ Rate limiting activé (Throttler NestJS)
- [ ] ✅ CORS configuré correctement
- [ ] ✅ Headers sécurité (Helmet.js)

### Documentation

- [ ] ✅ README production à jour
- [ ] ✅ Runbook créé (comment déployer, rollback, debug)
- [ ] ✅ API documentation publiée (Swagger)
- [ ] ✅ Release notes rédigées
- [ ] ✅ Changelog mis à jour

### Tests Production

- [ ] ✅ Smoke tests staging passants :
  - GET /health → 200
  - POST /api/mon-feature → 201 (avec auth)
  - GET /api/mon-feature → 200
- [ ] ✅ Load testing staging passant (1000 req/s)
- [ ] ✅ Tests performance staging OK (< 100ms P95)
- [ ] ✅ Tests sécurité staging OK (pas de faille détectée)

### Déploiement

- [ ] ✅ PR merged dans `main`
- [ ] ✅ CI/CD pipeline green (tests + build)
- [ ] ✅ Déploiement staging réussi
- [ ] ✅ Validation métier en staging (Product Owner)
- [ ] ✅ Déploiement production planifié (date/heure)
- [ ] ✅ Rollback plan documenté
- [ ] ✅ On-call developer identifié

### Post-Déploiement

- [ ] ✅ Migrations DB appliquées en production (vérifiées)
- [ ] ✅ Smoke tests production passants
- [ ] ✅ Métriques production surveillées (30min post-deploy)
- [ ] ✅ Pas d'alertes critiques
- [ ] ✅ Feedback users collecté (premiers retours)
- [ ] ✅ Hotfix plan prêt si nécessaire

---

## 📊 Résumé des Checklists

| Phase | Objectif | Checklist Items | Critère Succès |
|-------|----------|-----------------|----------------|
| 1️⃣ Pre-Implementation | Validation préparation | ~15 items | 100% complétés |
| 2️⃣ Implementation | Qualité développement | ~80 items | 100% complétés |
| 3️⃣ Pre-Review | Auto-vérification | ~25 items | 100% complétés |
| 4️⃣ Acceptance Testing | Validation fonctionnelle | ~15 scénarios | 100% passants |
| 5️⃣ Production Readiness | Validation finale | ~30 items | 100% complétés |

**Total** : ~165 checks qualité

---

## 🎯 Utilisation des Checklists

### Pendant l'Implémentation

1. Cocher items au fur et à mesure
2. Committer régulièrement checklist mise à jour
3. Bloquer sur items non complétés avant phase suivante

### Avant Review

1. Compléter Phase 3 (Pre-Review) à 100%
2. Auto-review avec checklist
3. Corriger problèmes identifiés
4. Demander review seulement si checklist 100%

### Pendant Review

1. Reviewer vérifie checklist remplie
2. Reviewer valide échantillon items critiques
3. Reviewer effectue tests acceptance aléatoires

### Avant Production

1. Phase 5 (Production Readiness) à 100%
2. Sign-off Product Owner
3. Sign-off Tech Lead
4. Déploiement autorisé

---

## 🔗 Prochaines Étapes

Après avoir complété `/speckit.checklist` :

1. **Utiliser checklist pendant implémentation**
2. **`/speckit.implement`** : Commencer implémentation guidée
3. **Auto-review avec checklist Phase 3**
4. **Demander review équipe**
5. **Déployer après Phase 5 complète**

---

## 📚 Ressources

- [Constitution du Projet](../constitution.md)
- [Spec Fonctionnelle](../features/mon-feature.md)
- [Plan Technique](../plans/mon-feature-plan.md)
- [Tasks](../tasks/mon-feature-tasks.md)
- [Testing Best Practices](../guides/testing-best-practices.md)

---

**Note** : Cette checklist est exhaustive. Adapter selon contexte feature (ex: skip cache si non requis).
```

---

## 🔄 Génération Automatique

**Script utilitaire** (optionnel) :

```bash
#!/bin/bash
# .spec/scripts/generate-checklist.sh

FEATURE_NAME=$1

if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: ./generate-checklist.sh <feature-name>"
  exit 1
fi

SPEC_FILE=".spec/features/${FEATURE_NAME}.md"
CHECKLIST_FILE=".spec/checklists/${FEATURE_NAME}-checklist.md"

if [ ! -f "$SPEC_FILE" ]; then
  echo "❌ Spec file not found: $SPEC_FILE"
  exit 1
fi

echo "🔄 Generating checklist for $FEATURE_NAME..."

# Extraire exigences RF-X de la spec
RFS=$(grep -E '^### RF-[0-9]+:' "$SPEC_FILE" | sed 's/### /- [ ] /')

# Générer checklist depuis template
cp .spec/templates/checklist-template.md "$CHECKLIST_FILE"

# Remplacer placeholder par exigences extraites
sed -i "s/{{REQUIREMENTS}}/$RFS/g" "$CHECKLIST_FILE"

echo "✅ Checklist generated: $CHECKLIST_FILE"
```

**Usage** :
```bash
chmod +x .spec/scripts/generate-checklist.sh
.spec/scripts/generate-checklist.sh mon-feature
```

---

## 📈 Métriques Qualité

**Indicateurs à tracker** :

- **Completion Rate** : % checklist items complétés avant review
- **Defect Escape Rate** : % bugs trouvés en review (malgré checklist)
- **Time to Review** : Durée review réduite si checklist complète
- **Production Incidents** : Incidents corrélés à items checklist skippés

**Objectifs** :
- ✅ Completion Rate ≥ 95% avant review
- ✅ Defect Escape Rate < 5%
- ✅ Time to Review -30% (vs sans checklist)

---

**Note** : Checklist est un guide, pas un carcan. Adapter selon contexte feature.
