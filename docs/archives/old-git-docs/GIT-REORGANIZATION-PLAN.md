# 🗂️ Plan de Réorganisation Git Repository

**Date**: 5 octobre 2025  
**Branche actuelle**: `refactor/payments-consolidation`  
**Problème**: 42 branches locales + 38 branches remote = désorganisation totale

---

## 📊 État Actuel

### Problèmes Identifiés

1. **Trop de branches** (80 au total)
   - 42 branches locales
   - 38 branches remote
   - Beaucoup sont mergées ou obsolètes

2. **Nomenclature incohérente**
   - `main`, `01`, `02`, `03-styling`, `04-authentication`, `05-build-app` (ancien système)
   - `feature/*`, `refactor/*`, `fix/*` (nouveau système)
   - Branches sans préfixe: `admin`, `blog`, `home`, `layout`, etc.

3. **Branches obsolètes**
   - `gpt5`, `optimisation`, `performance-boost`
   - `blogv2`, `indexv2`
   - Beaucoup de duplicatas: `order` vs `order-consolidation` vs `order-consolidation-new`

4. **178 commits d'avance** sur `main`
   - La branche `refactor/payments-consolidation` a 178 commits non mergés
   - `main` est probablement en retard sur le développement actuel

---

## 🎯 Objectifs

1. ✅ **Nettoyer** toutes les branches obsolètes
2. ✅ **Standardiser** la nomenclature
3. ✅ **Merger** les travaux terminés dans `main`
4. ✅ **Réorganiser** avec une structure claire
5. ✅ **Rétablir** le CI/CD runner

---

## 📋 Plan d'Action (4 étapes)

### 🔴 ÉTAPE 1: Sauvegarde et Audit

```bash
# 1. Créer une branche de sauvegarde complète
git checkout main
git pull origin main
git checkout -b backup/pre-cleanup-$(date +%Y%m%d)
git push origin backup/pre-cleanup-$(date +%Y%m%d)

# 2. Créer un rapport de toutes les branches
git branch -a > docs/git-branches-audit.txt
git log --oneline --graph --all --decorate -100 > docs/git-history-audit.txt

# 3. Identifier les branches mergées
git branch --merged main > docs/git-merged-branches.txt
git branch --no-merged main > docs/git-active-branches.txt
```

**Livrable**: Backup complet + 4 fichiers d'audit

---

### 🟡 ÉTAPE 2: Triage des Branches

#### 2.1 Branches à MERGER immédiatement (Travail terminé)

```bash
# Ces branches ont du code validé et testé à 100%
git checkout main
git merge refactor/payments-consolidation  # ✅ 12 commits, 100/100
git merge refactor/orders-cleanup          # ✅ 17 commits, 99.7/100
git merge refactor/user-module-dto-cleanup # À vérifier
git push origin main
```

#### 2.2 Branches à GARDER (Travail en cours)

```bash
# Renommer avec nomenclature standardisée
git branch -m dashboard-consolidation-new feature/dashboard-consolidation
git branch -m products-consolidation-new feature/products-consolidation
git branch -m support-module feature/support-module
git branch -m user-consolidation feature/user-consolidation
git branch -m config-module-enhancement feature/config-module
```

#### 2.3 Branches à SUPPRIMER (Obsolètes/Mergées)

```bash
# Anciennes branches numérotées (remplacées par main)
git branch -D 404 admin backoffice blog blogv2 commercial
git branch -D home layout gpt5 optimisation optimisation-selective

# Branches de test ou temporaires
git branch -D performance-boost

# Duplicatas
git branch -D order-consolidation order-consolidation-new
# (garder feature/orders-cleanup si besoin)

# Anciennes features mergées
git branch -D feature/blog-cleanup
git branch -D feature/homepage-cleanup
git branch -D feature/routes-pieces-cleanup
```

#### 2.4 Nettoyage Remote

```bash
# Supprimer les branches remote obsolètes
git push origin --delete 03-styling
git push origin --delete 04-authentication
git push origin --delete build-app
git push origin --delete cart
git push origin --delete develop
git push origin --delete order
git push origin --delete payments
git push origin --delete service-commercial

# Nettoyer les références locales
git fetch --prune
git remote prune origin
```

---

### 🟢 ÉTAPE 3: Nouvelle Structure Standardisée

#### 3.1 Convention de Nommage

```
main                          → Branche principale (production-ready)
develop                       → Branche de développement (si nécessaire)

feature/<nom>                 → Nouvelles fonctionnalités
  ├─ feature/dashboard-consolidation
  ├─ feature/products-consolidation
  ├─ feature/support-module
  └─ feature/user-consolidation

refactor/<nom>                → Refactoring de code existant
  ├─ refactor/catalog-optimization
  └─ refactor/vehicle-pages

fix/<nom>                     → Corrections de bugs
  └─ fix/search-sorting

release/<version>             → Préparation releases
  └─ release/v1.0.0

hotfix/<nom>                  → Corrections urgentes production
  └─ hotfix/payment-callback
```

#### 3.2 Branches Finales Recommandées

```bash
# Branches permanentes
main
develop (optionnel)

# Branches actives de développement
feature/dashboard-consolidation
feature/products-consolidation
feature/support-module
feature/user-consolidation
feature/catalog-optimization
feature/vehicle-pages

# Branches de maintenance
fix/search-sorting
```

**Total visé**: **8-10 branches max** (vs 80 actuellement)

---

### 🔵 ÉTAPE 4: Rétablir le CI/CD Runner

#### 4.1 Vérifier la configuration GitHub Actions

```bash
# Vérifier les workflows
ls -la .github/workflows/

# Tester localement
npm run test
npm run build
```

#### 4.2 Mettre à jour `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: 
      - main
      - develop
      - 'feature/**'
      - 'refactor/**'
      - 'fix/**'
  pull_request:
    branches: 
      - main
      - develop

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: cd backend && npm test
      - name: Run audit
        run: cd backend && ./audit-payments-quality.sh

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build frontend
        run: cd frontend && npm run build
```

#### 4.3 Configurer les Branch Protection Rules

Sur GitHub → Settings → Branches → Add rule:

```
Branch name pattern: main

☑ Require a pull request before merging
  ☑ Require approvals (1)
☑ Require status checks to pass before merging
  ☑ test-backend
  ☑ test-frontend
☑ Require branches to be up to date before merging
☑ Include administrators
```

---

## 🔄 Script Automatisé de Nettoyage

Créer `scripts/cleanup-git-branches.sh`:

```bash
#!/bin/bash

echo "🧹 Nettoyage des branches Git..."

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Sauvegarde
echo -e "${YELLOW}📦 Création backup...${NC}"
git checkout main
git checkout -b "backup/cleanup-$(date +%Y%m%d-%H%M%S)"
git push origin "backup/cleanup-$(date +%Y%m%d-%H%M%S)"

# 2. Retour sur main
git checkout main

# 3. Liste des branches à supprimer
OBSOLETE_BRANCHES=(
  "404"
  "admin"
  "backoffice"
  "blog"
  "blogv2"
  "commercial"
  "gpt5"
  "home"
  "layout"
  "optimisation"
  "optimisation-selective"
  "performance-boost"
)

# 4. Suppression locale
echo -e "${RED}🗑️  Suppression branches locales obsolètes...${NC}"
for branch in "${OBSOLETE_BRANCHES[@]}"; do
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch -D "$branch"
    echo "  ✓ Supprimé: $branch"
  fi
done

# 5. Suppression remote
echo -e "${RED}🌐 Suppression branches remote obsolètes...${NC}"
for branch in "${OBSOLETE_BRANCHES[@]}"; do
  if git ls-remote --heads origin "$branch" | grep -q "$branch"; then
    git push origin --delete "$branch" 2>/dev/null
    echo "  ✓ Supprimé remote: $branch"
  fi
done

# 6. Nettoyage
git fetch --prune
git remote prune origin

# 7. Résumé
echo ""
echo -e "${GREEN}✅ Nettoyage terminé !${NC}"
echo ""
echo "Branches locales restantes:"
git branch | wc -l
echo ""
echo "Branches remote restantes:"
git branch -r | wc -l
```

---

## 📅 Planning d'Exécution

| Étape | Durée | Risque | Priorité |
|-------|-------|--------|----------|
| 1. Sauvegarde + Audit | 15 min | ⚠️ Faible | 🔴 Urgent |
| 2. Merger branches terminées | 30 min | ⚠️⚠️ Moyen | 🔴 Urgent |
| 3. Supprimer branches obsolètes | 20 min | ⚠️ Faible | 🟡 Important |
| 4. Renommer branches actives | 15 min | ⚠️ Faible | 🟡 Important |
| 5. Rétablir CI/CD | 30 min | ⚠️⚠️ Moyen | 🔴 Urgent |
| 6. Documentation | 20 min | ⚠️ Faible | 🟢 Normal |

**Durée totale estimée**: 2h10

---

## ✅ Checklist de Validation

Avant de considérer la réorganisation terminée:

- [ ] Backup créé et pushé
- [ ] `refactor/payments-consolidation` mergée dans `main`
- [ ] `refactor/orders-cleanup` mergée dans `main`
- [ ] Moins de 15 branches locales
- [ ] Moins de 20 branches remote
- [ ] Toutes les branches suivent la nomenclature `prefix/name`
- [ ] CI/CD pipeline fonctionne
- [ ] Tests passent sur `main`
- [ ] Documentation à jour
- [ ] Branch protection rules configurées

---

## 🚀 Commandes Rapides

```bash
# Voir l'état actuel
git branch | wc -l                    # Nombre branches locales
git branch -r | wc -l                 # Nombre branches remote
git branch --merged main              # Branches mergées
git branch --no-merged main           # Branches actives

# Merger travail terminé
git checkout main
git merge refactor/payments-consolidation
git merge refactor/orders-cleanup
git push origin main

# Supprimer toutes les branches mergées (DANGER)
git branch --merged main | grep -v "main" | xargs git branch -d

# Nettoyer remote
git fetch --prune
git remote prune origin
```

---

## 📞 Besoin d'Aide ?

Si tu veux que je t'aide à exécuter ce plan étape par étape, dis-moi simplement:

1. **"Execute step 1"** → Je crée le backup et l'audit
2. **"Execute step 2"** → Je merge les branches terminées
3. **"Execute step 3"** → Je nettoie les branches obsolètes
4. **"Execute step 4"** → Je rétablis le CI/CD

---

## 📊 Résultat Attendu

**Avant**:
- 🔴 42 branches locales
- 🔴 38 branches remote
- 🔴 Nomenclature incohérente
- 🔴 Runner cassé

**Après**:
- ✅ 8-10 branches locales
- ✅ 10-15 branches remote
- ✅ Nomenclature standardisée (`feature/`, `refactor/`, `fix/`)
- ✅ Runner fonctionnel
- ✅ Main à jour avec Orders + Payments
- ✅ Documentation claire

---

**Status**: 📝 Plan prêt à exécuter  
**Prochaine action**: Attendre validation avant de commencer
