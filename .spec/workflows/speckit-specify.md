---
title: "SpecKit Workflow: Specify"
status: approved
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
tags: [speckit, workflow, specification, features]
priority: high
---

# 📝 SpecKit Workflow: Specify

> **Définir ce que tu veux construire : besoin métier, user stories, contraintes fonctionnelles.**

Ce workflow guide la création de spécifications fonctionnelles claires et complètes pour de nouvelles features.

---

## 🎯 Objectif

Transformer une idée ou un besoin métier en une spécification structurée qui pourra être :
1. ✅ **Comprise** par tous (dev, product, business)
2. ✅ **Challengée** via `/speckit.clarify`
3. ✅ **Planifiée** via `/speckit.plan`
4. ✅ **Implémentée** via `/speckit.implement`

---

## 📋 Quand utiliser ce workflow ?

**Utiliser `/speckit.specify` quand** :
- ✅ Nouvelle feature à développer
- ✅ Changement fonctionnel majeur
- ✅ Besoin métier à formaliser
- ✅ User story à détailler

**Ne PAS utiliser si** :
- ❌ Simple bug fix (utiliser issue GitHub)
- ❌ Refactoring technique pur (utiliser ADR)
- ❌ Configuration mineure

---

## 🚀 Processus

### Étape 1 : Identifier le besoin

**Questions à se poser** :
- Quel problème résolvons-nous ?
- Pour qui ? (utilisateurs finaux, admins, système)
- Quelle est la valeur métier ?
- Quelles sont les contraintes ?

**Template de brainstorm** :
```markdown
## Contexte
[Description du contexte métier]

## Problème
[Quel problème / pain point résolvons-nous ?]

## Acteurs
- **Utilisateur final** : [description]
- **Admin** : [description]
- **Système** : [description]

## Objectifs Métier
1. [Objectif quantifiable 1]
2. [Objectif quantifiable 2]
3. [Objectif quantifiable 3]

## Contraintes
- **Technique** : [ex: compatibilité mobile]
- **Métier** : [ex: réglementaire]
- **Performance** : [ex: temps de réponse]
```

---

### Étape 2 : Créer la spécification

**Commande** :
```bash
# Créer une nouvelle spec depuis le template
cp .spec/templates/feature-template.md .spec/features/mon-feature.md
```

**Template à remplir** :

```markdown
---
title: "[Nom de la Feature]"
status: draft
version: 0.1.0
authors: [Votre nom]
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [domain, priority]
priority: [low|medium|high|critical]
relates-to:
  - ../architecture/decisions/XXX.md (si applicable)
---

# [Nom de la Feature]

## 📋 Overview

### Contexte
[Pourquoi cette feature ? Quel est le contexte métier ?]

### Objectif
[Que voulons-nous accomplir ?]

### Bénéfices Attendus
- **Utilisateurs** : [bénéfice utilisateur]
- **Business** : [bénéfice métier]
- **Technique** : [bénéfice technique]

### Métriques de Succès
- [KPI 1] : [objectif chiffré]
- [KPI 2] : [objectif chiffré]

---

## 👥 User Stories

### Story 1: [Titre]
**En tant que** [acteur],  
**Je veux** [action],  
**Afin de** [bénéfice].

**Critères d'acceptation** :
- [ ] Critère 1
- [ ] Critère 2
- [ ] Critère 3

**Scénarios** :

**Scénario nominal** :
1. [Étape 1]
2. [Étape 2]
3. [Résultat attendu]

**Scénario d'erreur** :
1. [Étape 1]
2. [Erreur]
3. [Message/comportement attendu]

### Story 2: [Titre]
[Répéter le format ci-dessus]

---

## ⚙️ Exigences Fonctionnelles

### RF-1: [Nom de l'exigence]
**Description** : [Description détaillée]

**Priorité** : [Must-have | Should-have | Could-have | Won't-have]

**Critères de validation** :
- [ ] Critère 1
- [ ] Critère 2

### RF-2: [Nom de l'exigence]
[Répéter]

---

## 🔒 Exigences Non-Fonctionnelles

### Performance
- **Temps de réponse** : [objectif, ex: < 200ms P95]
- **Débit** : [objectif, ex: 1000 req/s]
- **Charge** : [objectif, ex: 10k utilisateurs simultanés]

### Sécurité
- **Authentication** : [ex: JWT requis]
- **Authorization** : [ex: role-based]
- **Validation** : [ex: Zod schema]
- **Audit** : [ex: logs d'activité]

### Scalabilité
- **Horizontal** : [ex: stateless, cache distribué]
- **Vertical** : [ex: optimisation queries]

### Accessibilité
- **WCAG** : [niveau AA/AAA]
- **Mobile** : [support responsive]
- **I18n** : [langues supportées]

---

## 🔌 Intégrations

### APIs Externes
- **[Nom API]** : [usage, endpoints]

### Modules Internes
- **[Module 1]** : [dépendance, raison]
- **[Module 2]** : [dépendance, raison]

### Data Sources
- **Database** : [tables/collections]
- **Cache** : [stratégie Redis]
- **Search** : [index Meilisearch]

---

## 🗂️ Data Requirements

### Modèles de Données

#### Entity: [NomEntity]
```typescript
interface Entity {
  id: string;
  field1: type;
  field2: type;
  createdAt: Date;
  updatedAt: Date;
}
```

**Contraintes** :
- `id` : UUID v4, unique
- `field1` : [contrainte, ex: max 255 chars]

**Indexes** :
- Primary: `id`
- Secondary: `field1`

### Relations
```
Entity1 --1:N--> Entity2
Entity2 --N:1--> Entity3
```

---

## 🧪 Testing Requirements

### Tests Unitaires
- [ ] Services métier
- [ ] Validation DTOs
- [ ] Business logic

### Tests d'Intégration
- [ ] Controllers + Services
- [ ] Database interactions
- [ ] External APIs

### Tests E2E
- [ ] User flow nominal
- [ ] User flow erreur
- [ ] Edge cases

### Tests de Performance
- [ ] Load testing (objectif : X req/s)
- [ ] Stress testing
- [ ] Endurance testing (1h+)

---

## 🚨 Risques & Mitigations

### Risque 1: [Description]
- **Impact** : [High|Medium|Low]
- **Probabilité** : [High|Medium|Low]
- **Mitigation** : [Stratégie]

### Risque 2: [Description]
[Répéter]

---

## 📅 Contraintes & Limitations

### Contraintes Temporelles
- **Deadline** : [date]
- **Phases** : [phases de delivery]

### Contraintes Techniques
- **Compatibilité** : [ex: browsers, Node version]
- **Dependencies** : [dépendances critiques]

### Limitations Connues
- [Limitation 1]
- [Limitation 2]

---

## 🔗 Related Documents

- **Architecture** : [Lien ADR si applicable]
- **API Spec** : [Lien OpenAPI si créé]
- **Type Schemas** : [Lien schemas Zod]
- **Design** : [Lien Figma/maquettes]

---

## 📈 Implementation Status

- [ ] Spec draft complète
- [ ] Spec reviewed
- [ ] Spec approved
- [ ] Plan technique créé (`/speckit.plan`)
- [ ] Tasks définies (`/speckit.tasks`)
- [ ] Implémentation en cours
- [ ] Tests passants
- [ ] Déployé en staging
- [ ] Déployé en production
- [ ] Métriques validées

---

## 📝 Notes

[Notes additionnelles, discussions, décisions prises]

---

## 🔄 Change Log

### Version 0.1.0 (YYYY-MM-DD)
- Création initiale de la spec
```

---

### Étape 3 : Compléter les sections

**Ordre recommandé** :

1. **Overview** : Contexte, objectif, bénéfices
2. **User Stories** : Acteurs, actions, critères d'acceptation
3. **Exigences Fonctionnelles** : RF détaillées avec priorités
4. **Exigences Non-Fonctionnelles** : Performance, sécurité, etc.
5. **Data Requirements** : Modèles, relations, contraintes
6. **Testing Requirements** : Stratégie de tests
7. **Risques & Mitigations** : Identifier risques et plans B
8. **Related Documents** : Liens vers autres specs/docs

---

### Étape 4 : Valider la complétude

**Checklist de validation** :

**Metadata** :
- [ ] `title` clair et concis
- [ ] `status: draft`
- [ ] `version: 0.1.0`
- [ ] `authors` renseigné
- [ ] `created` et `updated` dates valides
- [ ] `tags` pertinents

**Contenu** :
- [ ] Overview complet (contexte, objectif, bénéfices)
- [ ] Au moins 2 user stories avec critères d'acceptation
- [ ] Exigences fonctionnelles priorisées (MoSCoW)
- [ ] Exigences non-fonctionnelles définies
- [ ] Data requirements spécifiés
- [ ] Testing strategy définie
- [ ] Risques identifiés avec mitigations

**Qualité** :
- [ ] Pas d'ambiguïté dans les descriptions
- [ ] Critères d'acceptation testables
- [ ] Exemples concrets fournis
- [ ] Diagrammes si nécessaire (flows, data models)

---

### Étape 5 : Passer en review

**Commande** :
```bash
# Créer une PR avec la spec
git checkout -b spec/mon-feature
git add .spec/features/mon-feature.md
git commit -m "spec: add mon-feature specification"
git push origin spec/mon-feature

# Ouvrir PR sur GitHub
gh pr create --title "Spec: Mon Feature" --body "Nouvelle spec pour mon-feature"
```

**Dans la PR** :
```markdown
## Type
- [x] Specification (feature)

## Description
Spec complète pour la feature [nom].

## Checklist
- [x] Template complet
- [x] User stories avec critères d'acceptation
- [x] Exigences fonctionnelles/non-fonctionnelles
- [x] Data requirements
- [x] Testing strategy
- [x] Risques identifiés

## Prochaines étapes
1. Review de la spec par l'équipe
2. `/speckit.clarify` pour questions
3. `/speckit.plan` pour architecture technique
```

**Review Process** :
1. Minimum 1 reviewer (product + tech)
2. Discussion sur points flous
3. Utiliser `/speckit.clarify` si nécessaire
4. Itérer jusqu'à consensus
5. Merge et passer `status: review` → `approved`

---

## 📊 Exemple Complet

### Exemple : Spec "Product Wishlist"

```markdown
---
title: "Product Wishlist Management"
status: approved
version: 1.0.0
authors: [Product Team, Backend Team]
created: 2025-11-18
updated: 2025-11-18
tags: [e-commerce, wishlist, users, high]
priority: high
relates-to:
  - ../architecture/decisions/001-supabase-direct.md
---

# Product Wishlist Management

## 📋 Overview

### Contexte
Actuellement, les utilisateurs ne peuvent pas sauvegarder des produits pour plus tard. Ils doivent soit acheter immédiatement, soit perdre le produit.

### Objectif
Permettre aux utilisateurs de créer et gérer une liste de souhaits (wishlist) de produits pour faciliter les achats futurs.

### Bénéfices Attendus
- **Utilisateurs** : Sauvegarder produits d'intérêt, planifier achats
- **Business** : Augmenter conversions, analyser intérêts produits
- **Technique** : Réutiliser patterns existants (cart module)

### Métriques de Succès
- **Taux d'adoption** : 30% des utilisateurs créent une wishlist (3 mois)
- **Conversion** : 15% des items en wishlist → achetés (6 mois)
- **Engagement** : 5+ items par wishlist en moyenne

---

## 👥 User Stories

### Story 1: Ajouter un produit à la wishlist
**En tant qu'** utilisateur connecté,  
**Je veux** ajouter un produit à ma wishlist,  
**Afin de** le retrouver facilement plus tard.

**Critères d'acceptation** :
- [ ] Bouton "Ajouter à la wishlist" visible sur page produit
- [ ] Feedback visuel immédiat (toast notification)
- [ ] Produit apparaît dans page "/wishlist"
- [ ] Icône cœur plein si déjà dans wishlist

**Scénario nominal** :
1. Utilisateur navigue vers page produit
2. Clique sur bouton "Ajouter à la wishlist" (icône cœur)
3. Toast "Produit ajouté à votre wishlist" s'affiche
4. Icône cœur devient pleine
5. Compteur wishlist header +1

**Scénario d'erreur (non connecté)** :
1. Utilisateur non connecté clique sur "Ajouter à wishlist"
2. Modal "Connectez-vous pour sauvegarder vos produits" s'affiche
3. Boutons "Se connecter" / "S'inscrire"

### Story 2: Voir ma wishlist
**En tant qu'** utilisateur connecté,  
**Je veux** voir tous mes produits en wishlist,  
**Afin de** décider quoi acheter.

**Critères d'acceptation** :
- [ ] Page "/wishlist" accessible depuis header
- [ ] Liste de tous les produits ajoutés
- [ ] Prix, disponibilité, image affichés
- [ ] Bouton "Ajouter au panier" par produit
- [ ] Bouton "Retirer de la wishlist"

**Scénario nominal** :
1. Utilisateur clique sur icône wishlist dans header
2. Redirigé vers "/wishlist"
3. Grille de produits en wishlist affichée
4. Produits triés par date d'ajout (récents en premier)

### Story 3: Retirer un produit de la wishlist
**En tant qu'** utilisateur,  
**Je veux** retirer un produit de ma wishlist,  
**Afin de** garder seulement ce qui m'intéresse.

**Critères d'acceptation** :
- [ ] Bouton "Retirer" sur chaque produit (/wishlist)
- [ ] Confirmation avant suppression
- [ ] Produit retiré instantanément (optimistic UI)
- [ ] Toast "Produit retiré"

---

## ⚙️ Exigences Fonctionnelles

### RF-1: Gestion des items de wishlist
**Description** : CRUD complet sur les items de wishlist.

**Priorité** : Must-have

**Critères de validation** :
- [ ] Create: POST /api/wishlist/items
- [ ] Read: GET /api/wishlist
- [ ] Delete: DELETE /api/wishlist/items/:id
- [ ] Pas de duplicatas (1 produit = 1 item max)

### RF-2: Notifications de prix
**Description** : Notifier utilisateur si prix baisse.

**Priorité** : Should-have

**Critères de validation** :
- [ ] Job cron quotidien check prix
- [ ] Email si baisse > 10%
- [ ] Option opt-out dans préférences

### RF-3: Partage de wishlist
**Description** : Partager wishlist via lien public.

**Priorité** : Could-have (phase 2)

---

## 🔒 Exigences Non-Fonctionnelles

### Performance
- **Temps de réponse** : < 100ms P95 (GET /wishlist)
- **Charge** : Support 1000 req/s
- **Cache** : Redis TTL 5min

### Sécurité
- **Authentication** : JWT requis (JwtAuthGuard)
- **Authorization** : Utilisateur accède seulement à SA wishlist
- **Validation** : Zod schema sur tous les DTOs

---

## 🗂️ Data Requirements

### Modèle de Données

#### Entity: WishlistItem
```typescript
interface WishlistItem {
  id: string;              // UUID v4
  userId: string;          // UUID v4 (foreign key users)
  productId: string;       // UUID v4 (foreign key products)
  addedAt: Date;           // Timestamp ajout
  priceAtAdd: number;      // Prix au moment de l'ajout (pour notifs)
}
```

**Contraintes** :
- `userId` + `productId` : unique ensemble (pas de duplicatas)
- `priceAtAdd` : decimal(10,2), non null

**Indexes** :
- Primary: `id`
- Unique: `(userId, productId)`
- Index: `userId` (pour GET /wishlist)

### Relations
```
User --1:N--> WishlistItem
Product --1:N--> WishlistItem
```

---

## 🧪 Testing Requirements

### Tests Unitaires
- [ ] WishlistService.addItem()
- [ ] WishlistService.removeItem()
- [ ] WishlistService.getWishlist()
- [ ] Validation DTOs (AddWishlistItemDto)

### Tests d'Intégration
- [ ] POST /api/wishlist/items → DB insert
- [ ] GET /api/wishlist → DB query + cache
- [ ] DELETE /api/wishlist/items/:id → DB delete

### Tests E2E
- [ ] User flow: Login → Ajouter produit → Voir wishlist → Retirer
- [ ] Edge case: Ajouter produit déjà en wishlist (erreur)
- [ ] Edge case: Non connecté tente d'ajouter (401)

---

## 🚨 Risques & Mitigations

### Risque 1: Wishlist très volumineuse (1000+ items)
- **Impact** : Medium (performance page /wishlist)
- **Probabilité** : Low
- **Mitigation** : Pagination (50 items/page), cache Redis

### Risque 2: Produit supprimé du catalogue
- **Impact** : Medium (item wishlist orphelin)
- **Probabilité** : Medium
- **Mitigation** : Soft delete produits, cleanup job mensuel

---

## 🔗 Related Documents

- **Architecture** : [ADR-001: Supabase Direct](../architecture/decisions/001-supabase-direct.md)
- **Type Schemas** : `.spec/types/wishlist.schema.ts` (à créer)

---

## 📈 Implementation Status

- [x] Spec draft complète
- [x] Spec reviewed
- [x] Spec approved
- [ ] Plan technique créé
- [ ] Tasks définies
- [ ] Implémentation en cours
- [ ] Tests passants
- [ ] Déployé en staging
- [ ] Déployé en production
- [ ] Métriques validées

---

## 🔄 Change Log

### Version 1.0.0 (2025-11-18)
- Spec approuvée après review équipe
- Ajout RF-2 (notifications prix)
- RF-3 (partage) repoussé en phase 2
```

---

## 🔗 Prochaines Étapes

Après avoir complété `/speckit.specify` :

1. **`/speckit.clarify`** : Poser questions sur points flous
2. **`/speckit.plan`** : Créer plan technique d'implémentation
3. **`/speckit.tasks`** : Découper en tâches concrètes
4. **`/speckit.analyze`** : Vérifier cohérence spec/plan/tasks
5. **`/speckit.implement`** : Générer code et tests

---

## 📚 Ressources

- [Template Feature](./../templates/feature-template.md)
- [Constitution du Projet](./../constitution.md)
- [Spec-Driven Development](https://github.com/github/spec-kit)
- [User Story Best Practices](https://www.mountaingoatsoftware.com/agile/user-stories)

---

**Note** : Ce workflow est itératif. N'hésitez pas à revenir en arrière et affiner la spec après `/speckit.clarify` ou feedback équipe.
