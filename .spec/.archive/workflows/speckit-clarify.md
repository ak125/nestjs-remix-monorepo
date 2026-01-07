---
title: "SpecKit Workflow: Clarify"
status: approved
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
tags: [speckit, workflow, clarification, questions]
priority: high
---

# ❓ SpecKit Workflow: Clarify

> **Poser des questions sur ce qui manque ou est flou dans ta spec.**

Ce workflow aide à identifier les zones d'ombre, ambiguïtés et informations manquantes dans une spécification avant de passer à la planification technique.

---

## 🎯 Objectif

Éviter les erreurs coûteuses d'implémentation en clarifiant :
- ✅ **Ambiguïtés** : Ce qui peut être interprété de plusieurs façons
- ✅ **Lacunes** : Informations manquantes critiques
- ✅ **Contradictions** : Exigences incompatibles
- ✅ **Edge cases** : Scénarios limites non couverts
- ✅ **Dépendances** : Liens avec d'autres modules/features non explicités

---

## 📋 Quand utiliser ce workflow ?

**Utiliser `/speckit.clarify` quand** :
- ✅ Spec draft terminée, avant review finale
- ✅ Review équipe identifie des points flous
- ✅ Avant `/speckit.plan` (recommandé)
- ✅ Doute sur faisabilité technique

**Ne PAS utiliser si** :
- ❌ Spec clairement incomplète (retour à `/speckit.specify`)
- ❌ Clarifications triviales (commenter directement la spec)

---

## 🚀 Processus

### Étape 1 : Lecture Critique de la Spec

**Auto-questionnaire** :

#### Compréhension Générale
- [ ] Puis-je expliquer l'objectif de la feature en 1 phrase ?
- [ ] Comprends-je qui sont les utilisateurs cibles ?
- [ ] La valeur métier est-elle claire ?

#### User Stories
- [ ] Chaque user story a-t-elle des critères d'acceptation testables ?
- [ ] Les scénarios d'erreur sont-ils couverts ?
- [ ] Les edge cases sont-ils identifiés ?

#### Exigences Fonctionnelles
- [ ] Chaque exigence est-elle priorisée (MoSCoW) ?
- [ ] Puis-je imaginer comment tester chaque exigence ?
- [ ] Y a-t-il des contradictions entre exigences ?

#### Exigences Non-Fonctionnelles
- [ ] Les objectifs de performance sont-ils réalistes ?
- [ ] Les contraintes de sécurité sont-elles spécifiées ?
- [ ] Les besoins de scalabilité sont-ils clairs ?

#### Data Requirements
- [ ] Les modèles de données sont-ils complets ?
- [ ] Les relations entre entités sont-elles définies ?
- [ ] Les contraintes de validation sont-elles spécifiées ?

#### Dépendances
- [ ] Les dépendances avec autres modules sont-elles identifiées ?
- [ ] Les APIs externes nécessaires sont-elles listées ?
- [ ] L'impact sur le système existant est-il évalué ?

---

### Étape 2 : Générer des Questions de Clarification

**Template de questions** :

```markdown
# Questions de Clarification - [Nom Feature]

## 🔴 Bloquant (Must Answer)

### Q1: [Sujet]
**Question** : [Question précise]

**Contexte** : [Pourquoi c'est important]

**Impact si non résolu** : [Risque]

**Options possibles** :
- A) [Option 1]
- B) [Option 2]
- C) [Option 3]

---

### Q2: [Sujet]
[Répéter format]

---

## 🟠 Important (Should Answer)

### Q3: [Sujet]
[Format similaire]

---

## 🟢 Nice to Have (Could Answer)

### Q4: [Sujet]
[Format similaire]
```

---

### Étape 3 : Catégories de Questions Types

#### A. Questions sur le Scope

**Exemples** :
```markdown
### Q: Périmètre de la feature
**Question** : La feature doit-elle supporter les utilisateurs non connectés (guest) ?

**Contexte** : Spec mentionne "utilisateur connecté" mais pas de guest flow.

**Impact si non résolu** : Sous-estimation effort (guest session management).

**Options** :
- A) Connecté uniquement (simple)
- B) Guest + persistance à la connexion (moyen)
- C) Guest full-featured (complexe)
```

#### B. Questions sur les Edge Cases

**Exemples** :
```markdown
### Q: Comportement limite wishlist
**Question** : Y a-t-il un nombre maximum d'items dans une wishlist ?

**Contexte** : Spec ne mentionne pas de limite.

**Impact si non résolu** : Risque performance si wishlist illimitée.

**Options** :
- A) Pas de limite (risqué)
- B) Limite soft (warning à 100 items)
- C) Limite hard (max 500 items)
```

#### C. Questions sur les Comportements

**Exemples** :
```markdown
### Q: Produit en wishlist supprimé
**Question** : Que se passe-t-il si un produit en wishlist est supprimé du catalogue ?

**Contexte** : Spec ne couvre pas ce cas.

**Impact si non résolu** : Items orphelins, erreurs UI.

**Options** :
- A) Cascade delete (item wishlist supprimé)
- B) Soft delete (item marqué "indisponible")
- C) Archive (item visible mais non actionnable)
```

#### D. Questions sur les Dépendances

**Exemples** :
```markdown
### Q: Intégration avec module Promo
**Question** : Si un produit en wishlist a une promo, doit-on afficher le prix promo ?

**Contexte** : Spec ne mentionne pas le module promo.

**Impact si non résolu** : UX incohérente (prix différent page produit vs wishlist).

**Options** :
- A) Toujours prix catalogue (simple mais UX dégradée)
- B) Prix promo si applicable (requiert intégration)
- C) Les deux (prix barré + prix promo)
```

#### E. Questions sur la Performance

**Exemples** :
```markdown
### Q: Stratégie de cache wishlist
**Question** : Comment cacher la wishlist pour performance ?

**Contexte** : Spec dit "< 100ms P95" mais pas de stratégie cache.

**Impact si non résolu** : Objectif performance non atteignable.

**Options** :
- A) Cache Redis TTL 5min (bon compromis)
- B) Cache Redis TTL 1h + invalidation manuelle (complexe)
- C) Pas de cache (risque perf)
```

#### F. Questions sur la Sécurité

**Exemples** :
```markdown
### Q: Rate limiting wishlist
**Question** : Doit-on limiter le nombre d'ajouts à la wishlist par minute ?

**Contexte** : Spec ne mentionne pas de rate limiting.

**Impact si non résolu** : Risque abus (spam API).

**Options** :
- A) Rate limit global (10 req/min par IP)
- B) Rate limit par user (20 ajouts/min)
- C) Pas de rate limit (risqué)
```

---

### Étape 4 : Prioriser les Questions

**Framework MoSCoW** :

| Priorité | Critère | Action |
|----------|---------|--------|
| **🔴 Must** | Bloquant pour implémentation | Réponse obligatoire |
| **🟠 Should** | Important mais workaround possible | Réponse recommandée |
| **🟢 Could** | Nice-to-have, décision technique OK | Réponse optionnelle |
| **⚪ Won't** | Hors scope ou phase future | Documenter pour plus tard |

---

### Étape 5 : Documenter les Questions

**Format Markdown** :

```markdown
---
title: "Clarification Questions - [Feature Name]"
status: draft
version: 0.1.0
authors: [Votre nom]
created: 2025-11-18
updated: 2025-11-18
tags: [clarification, questions]
relates-to:
  - ../features/[feature-name].md
---

# Questions de Clarification - [Feature Name]

> Questions identifiées lors de la review de la spec [feature-name].

---

## 🔴 Bloquant (Must Answer)

### Q1: [Sujet]
**Question** : [Question précise]

**Contexte** : [Section de la spec concernée]

**Impact si non résolu** : [Risque]

**Options possibles** :
- A) [Option 1] - Pros: [...] Cons: [...]
- B) [Option 2] - Pros: [...] Cons: [...]
- C) [Option 3] - Pros: [...] Cons: [...]

**Recommandation** : [Votre avis si applicable]

**Décision** : [À remplir après discussion]

---

## 🟠 Important (Should Answer)

[Répéter format]

---

## 🟢 Nice to Have (Could Answer)

[Répéter format]

---

## ⚪ Hors Scope (Won't Address Now)

### Q: [Sujet]
**Question** : [Question]

**Raison hors scope** : [Justification]

**Traçabilité** : Issue #XXX créée pour phase future

---

## 📝 Résumé des Décisions

| # | Question | Décision | Rationale |
|---|----------|----------|-----------|
| Q1 | [Sujet] | [Option choisie] | [Raison] |
| Q2 | [Sujet] | [Option choisie] | [Raison] |

---

## 🔄 Actions de Suivi

- [ ] Mettre à jour spec [feature-name].md avec décisions
- [ ] Créer ADR si décision architecturale majeure
- [ ] Créer issues pour questions hors scope (phase future)
- [ ] Planifier meeting si questions nécessitent discussion équipe

---

## 🔗 Related Documents

- **Spec Feature** : [../features/[feature-name].md](../features/[feature-name].md)
- **Architecture** : [../architecture/decisions/XXX.md] (si applicable)
```

---

### Étape 6 : Organiser Session de Clarification

**Format Meeting** :

#### Avant le Meeting
1. Partager document de questions (minimum 24h avant)
2. Inviter stakeholders pertinents :
   - Product Owner (scope, priorités)
   - Tech Lead (faisabilité, architecture)
   - Designer (UX/UI)
   - QA (testing, edge cases)

#### Pendant le Meeting
**Agenda (45min)** :
1. **Intro (5min)** : Contexte de la spec, objectif du meeting
2. **Questions Bloquantes (20min)** : Discuter et décider
3. **Questions Importantes (15min)** : Discuter et décider
4. **Questions Nice-to-Have (5min)** : Si temps permet
5. **Wrap-up (5min)** : Récap décisions, actions de suivi

**Facilitator Tips** :
- ⏰ Timeboxer chaque question (5min max)
- ✅ Noter décisions en temps réel
- 🚫 Ne pas débattre implémentation (c'est pour `/speckit.plan`)
- 🎯 Focus sur le "quoi" pas le "comment"

#### Après le Meeting
1. Finaliser document avec décisions
2. Mettre à jour spec feature avec clarifications
3. Créer ADR si décision architecturale majeure
4. Créer issues pour questions hors scope

---

## 📊 Exemple Complet

### Exemple : Clarification "Product Wishlist"

```markdown
---
title: "Clarification Questions - Product Wishlist"
status: completed
version: 1.0.0
authors: [Backend Team]
created: 2025-11-18
updated: 2025-11-18
tags: [clarification, wishlist]
relates-to:
  - ../features/product-wishlist.md
---

# Questions de Clarification - Product Wishlist

> Questions identifiées lors de la review de la spec product-wishlist.

---

## 🔴 Bloquant (Must Answer)

### Q1: Support utilisateurs non connectés (guest)
**Question** : La wishlist doit-elle supporter les utilisateurs non connectés ?

**Contexte** : Spec section "User Stories" mentionne uniquement "utilisateur connecté".

**Impact si non résolu** : Sous-estimation effort si guest support requis.

**Options possibles** :
- A) **Connecté uniquement** - Pros: Simple, sécurisé. Cons: Friction UX.
- B) **Guest + migration à la connexion** - Pros: Meilleure UX. Cons: Complexité (localStorage, merge logic).
- C) **Guest full-featured** - Pros: UX optimale. Cons: Très complexe.

**Recommandation** : Option B (guest + migration) pour meilleure conversion.

**Décision** : ✅ **Option A adoptée** (connecté uniquement pour MVP, guest en phase 2).

---

### Q2: Limite nombre d'items
**Question** : Y a-t-il un nombre maximum d'items dans une wishlist ?

**Contexte** : Spec ne mentionne pas de limite.

**Impact si non résolu** : Risque performance page /wishlist, abus API.

**Options possibles** :
- A) **Pas de limite** - Pros: Simplicité. Cons: Risque perf/abus.
- B) **Limite soft (warning à 100)** - Pros: Flexibilité. Cons: Complexité.
- C) **Limite hard (max 500)** - Pros: Protection. Cons: UX dégradée si atteinte.

**Recommandation** : Option C (max 500 items).

**Décision** : ✅ **Option C adoptée** (hard limit 500 items).

---

### Q3: Produit supprimé du catalogue
**Question** : Que se passe-t-il si un produit en wishlist est supprimé du catalogue ?

**Contexte** : Spec ne couvre pas ce cas, mais probable (produits obsolètes).

**Impact si non résolu** : Items orphelins, erreurs 404 en UI.

**Options possibles** :
- A) **Cascade delete** - Pros: DB propre. Cons: Perte data user.
- B) **Soft delete (marqué indisponible)** - Pros: Traçabilité. Cons: Cleanup nécessaire.
- C) **Archive (visible non actionnable)** - Pros: Transparence. Cons: UI complexe.

**Recommandation** : Option B (soft delete).

**Décision** : ✅ **Option B adoptée** (soft delete + cleanup job mensuel).

---

## 🟠 Important (Should Answer)

### Q4: Intégration module Promo
**Question** : Doit-on afficher le prix promo dans la wishlist si applicable ?

**Contexte** : Spec ne mentionne pas le module promo existant.

**Impact si non résolu** : UX incohérente (prix différent page produit vs wishlist).

**Options possibles** :
- A) **Prix catalogue uniquement** - Pros: Simple. Cons: UX dégradée.
- B) **Prix promo si applicable** - Pros: UX cohérente. Cons: Dépendance module promo.
- C) **Prix barré + promo** - Pros: UX optimale. Cons: Complexité UI.

**Recommandation** : Option C (meilleure UX).

**Décision** : ✅ **Option C adoptée** (prix barré + promo).

---

### Q5: Notifications de prix (RF-2)
**Question** : Comment gérer les préférences de notification (opt-in/opt-out) ?

**Contexte** : RF-2 mentionne notifications mais pas les préférences.

**Impact si non résolu** : RGPD non conforme (spam).

**Options possibles** :
- A) **Opt-in par défaut** - Pros: Engagement. Cons: Risque RGPD.
- B) **Opt-out par défaut** - Pros: RGPD safe. Cons: Moins d'engagement.
- C) **Demander à l'ajout** - Pros: Consentement explicite. Cons: Friction UX.

**Recommandation** : Option B (opt-out, RGPD compliant).

**Décision** : ✅ **Option B adoptée** (opt-out par défaut, page préférences).

---

## 🟢 Nice to Have (Could Answer)

### Q6: Trier les items wishlist
**Question** : L'utilisateur peut-il trier/réorganiser les items de sa wishlist ?

**Contexte** : Spec dit "triés par date d'ajout" mais pas de customisation.

**Impact si non résolu** : UX limitée mais non bloquant.

**Options possibles** :
- A) **Tri fixe (date d'ajout)** - Pros: Simple. Cons: UX basique.
- B) **Tri multi-critères** - Pros: Flexibilité. Cons: Complexité.
- C) **Drag & drop manuel** - Pros: UX optimale. Cons: Très complexe.

**Recommandation** : Option A pour MVP, B en phase 2.

**Décision** : ✅ **Option A adoptée** (tri fixe MVP).

---

## ⚪ Hors Scope (Won't Address Now)

### Q7: Partage de wishlist (RF-3)
**Question** : Format du lien de partage ? Auth requise pour viewer ?

**Contexte** : RF-3 déjà marqué "Could-have phase 2" dans spec.

**Raison hors scope** : Feature non prioritaire MVP.

**Traçabilité** : Issue #234 créée pour phase 2.

---

## 📝 Résumé des Décisions

| # | Question | Décision | Rationale |
|---|----------|----------|-----------|
| Q1 | Support guest | Connecté uniquement (MVP) | Simplicité MVP, guest phase 2 |
| Q2 | Limite items | Max 500 items | Protection perf + abus |
| Q3 | Produit supprimé | Soft delete + cleanup | Traçabilité + DB propre |
| Q4 | Intégration promo | Prix barré + promo | UX cohérente |
| Q5 | Notifs préférences | Opt-out par défaut | RGPD compliant |
| Q6 | Tri items | Date d'ajout (fixe MVP) | Simplicité MVP |
| Q7 | Partage wishlist | Phase 2 | Non prioritaire |

---

## 🔄 Actions de Suivi

- [x] Mettre à jour spec product-wishlist.md avec décisions Q1-Q6
- [x] Créer ADR-005 : Stratégie soft delete produits
- [x] Créer issue #234 : Feature partage wishlist (phase 2)
- [x] Créer issue #235 : Feature tri wishlist personnalisé (phase 2)
- [ ] Planifier meeting Design pour UI prix barré + promo (Q4)

---

## 🔗 Related Documents

- **Spec Feature** : [../features/product-wishlist.md](../features/product-wishlist.md)
- **ADR** : [../architecture/decisions/005-soft-delete-strategy.md](../architecture/decisions/005-soft-delete-strategy.md)
```

---

## 🎯 Checklist de Sortie

Avant de passer à `/speckit.plan`, vérifier :

**Clarifications** :
- [ ] Toutes questions bloquantes (🔴) résolues
- [ ] Toutes questions importantes (🟠) résolues ou décision "phase future"
- [ ] Questions nice-to-have (🟢) discutées ou documentées

**Documentation** :
- [ ] Document de clarification complet
- [ ] Spec feature mise à jour avec décisions
- [ ] ADRs créés si décisions architecturales majeures
- [ ] Issues créées pour features hors scope

**Consensus** :
- [ ] Stakeholders (product + tech) alignés sur décisions
- [ ] Pas de blocage ou désaccord majeur non résolu
- [ ] Critères d'acceptation mis à jour si nécessaire

---

## 🔗 Prochaines Étapes

Après `/speckit.clarify` :

1. **Mettre à jour la spec** avec toutes les clarifications
2. **Créer ADRs** si décisions architecturales majeures
3. **`/speckit.plan`** : Transformer spec clarifiée en plan technique
4. **`/speckit.tasks`** : Découper plan en tâches concrètes
5. **`/speckit.analyze`** : Vérifier cohérence spec/plan/tasks
6. **`/speckit.implement`** : Implémenter les tâches

---

## 📚 Ressources

- [Constitution du Projet](./../constitution.md)
- [Workflow Specify](./speckit-specify.md)
- [Workflow Plan](./speckit-plan.md)
- [MoSCoW Prioritization](https://en.wikipedia.org/wiki/MoSCoW_method)

---

**Note** : La clarification est itérative. N'hésitez pas à re-clarifier après `/speckit.plan` si de nouvelles questions émergent.
