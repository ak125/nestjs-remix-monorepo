---
title: "Guide de Maintenance SpecKit"
status: stable
version: 1.0.0
---

# Guide de Maintenance SpecKit

## Vue d'Ensemble

SpecKit est une **méthodologie manuelle** de gestion de spécifications. Elle nécessite discipline et rigueur pour maintenir la cohérence entre spécifications et code au fil de l'évolution du projet.

> ⚠️ **IMPORTANT**: SpecKit n'est **PAS** un outil automatique de synchronisation code ↔ spec.
> C'est une **approche documentaire structurée** qui repose sur l'engagement des équipes.

## 🎯 Objectifs de Couverture

| Catégorie | Cible | Tolérance |
|-----------|-------|-----------|
| **Modules Backend** | ≥ 90% | Acceptable: 80% |
| **Routes Majeures** | 100% | Critique: features utilisateurs |
| **Workflows SpecKit** | 100% | Tous les workflows doivent exister |
| **Score Global** | ≥ 90% | Minimum qualité projet |

## 🔄 Workflows de Maintenance

### 1️⃣ Nouvelle Feature (Spec → Code)

**Déclencheur**: Nouvelle demande fonctionnelle

```bash
# Étape 1: Spécifier
cd .spec/workflows
# Suivre speckit-specify.md pour créer .spec/features/nouvelle-feature.md

# Étape 2: Clarifier (si ambiguïtés détectées)
# Suivre speckit-clarify.md pour affiner la spec

# Étape 3: Planifier
# Suivre speckit-plan.md pour architecture technique

# Étape 4: Décomposer en tâches
# Suivre speckit-tasks.md pour granularité implémentable

# Étape 5: Analyser cohérence
# Suivre speckit-analyze.md pour vérifier spec/plan/tasks

# Étape 6: Générer checklists qualité
# Suivre speckit-checklist.md pour 5 phases de checks

# Étape 7: Implémenter
# Suivre speckit-implement.md pour templates code

# Étape 8: Valider
bash .spec/scripts/check-coverage.sh
```

**Responsabilités**:
- **Product Owner**: Rédige spec (specify)
- **Tech Lead**: Crée plan technique, valide faisabilité
- **Dev**: Suit workflow implementation, écrit code
- **Reviewer**: Vérifie spec ↔ code cohérence en PR

---

### 2️⃣ Modification de Code Existant (Code → Spec)

**Déclencheur**: Changement dans code d'une feature documentée

```bash
# 1. Identifier la spec concernée
grep -r "RF-XXX" .spec/features/  # Chercher exigence impactée

# 2. Mettre à jour la spec AVANT ou EN PARALLÈLE du code
# JAMAIS APRÈS (risque d'oubli)

# 3. Dans la PR:
# - Commit 1: Update spec (.spec/features/xxx.md)
# - Commit 2-N: Code changes (backend/ ou frontend/)

# 4. Checklist reviewer:
# □ Spec mise à jour ?
# □ Plan technique ajusté si architecture change ?
# □ Tests mis à jour ?
# □ ADR créée si décision majeure ?
```

**Cas particuliers**:

| Cas | Action Spec | Exemple |
|-----|-------------|---------|
| **Bugfix mineur** | Pas de MAJ spec (si comportement inchangé) | Fix typo, refacto interne |
| **Bugfix majeur** | MAJ section "Comportement" dans spec | Correction logique métier |
| **Refacto technique** | MAJ plan si architecture change | Migration service → RPC |
| **Nouveau champ DB** | MAJ spec (RF-XXX-Data) + plan (migrations) | Ajout colonne `user.phone` |
| **Changement UI** | MAJ wireframes/maquettes dans spec | Nouvelle couleur CTA |

---

### 3️⃣ Suppression de Feature (Code → Spec)

**Déclencheur**: Retrait fonctionnalité obsolète

```bash
# 1. Archiver la spec (ne pas supprimer historique)
mkdir -p .spec/archive
git mv .spec/features/old-feature.md .spec/archive/

# 2. Ajouter entête d'archivage
cat > .spec/archive/old-feature.md << 'HEADER'
# ⚠️ SPEC ARCHIVÉE - $(date +%Y-%m-%d)

**Raison**: [Expliquer pourquoi feature supprimée]
**PR suppression**: #XXX

---
HEADER

# 3. Nettoyer code en conséquence
# 4. Vérifier aucune dépendance cassée
```

---

## 🔍 Processus d'Audit (Trimestriel)

### Checklist Audit Complet

```bash
# 1. Vérifier couverture
bash .spec/scripts/check-coverage.sh > audit-$(date +%Y%m%d).log

# 2. Identifier écarts code ↔ spec
for spec in .spec/features/*.md; do
  module=$(basename "$spec" .md)
  echo "🔍 Audit: $module"
  
  # Chercher références RF-XXX dans code
  grep -r "RF-$module" backend/ frontend/ || echo "⚠️ Aucune référence trouvée"
done

# 3. Vérifier specs orphelines (spec existe mais code supprimé)
for spec in .spec/features/*.md; do
  module=$(basename "$spec" .md)
  if [ ! -d "backend/src/modules/$module" ]; then
    echo "⚠️ Spec orpheline détectée: $spec"
    echo "   → Vérifier si feature supprimée (archiver)"
  fi
done

# 4. Vérifier ADRs cohérentes
ls -lh .spec/adr/*.md  # Toutes les décisions documentées ?

# 5. Générer rapport
cat audit-$(date +%Y%m%d).log
```

### Indicateurs de Qualité

| Indicateur | Formule | Cible |
|------------|---------|-------|
| **Coverage Specs** | `specs_count / modules_count * 100` | ≥ 90% |
| **Specs Orphelines** | `specs sans code correspondant` | 0 |
| **Code Non-Spécifié** | `modules sans spec` | < 10% |
| **Age Moyen Spec** | `jours depuis dernière MAJ` | < 90 jours |
| **Ratio Spec/ADR** | `ADRs / specs_majeures` | ≥ 30% |

---

## 👥 Rôles & Responsabilités

### Product Owner (PO)

- ✅ Rédiger specs fonctionnelles (specify workflow)
- ✅ Prioriser features dans backlog
- ✅ Valider acceptation (checklist acceptation)
- ❌ N'écrit PAS le plan technique ni les tasks

### Tech Lead

- ✅ Créer plan technique (plan workflow)
- ✅ Décomposer en tasks estimées (tasks workflow)
- ✅ Analyser faisabilité (analyze workflow)
- ✅ Reviewer cohérence spec ↔ code
- ✅ Maintenir ADRs

### Développeur

- ✅ Suivre workflow implement
- ✅ Coder en référençant RF-XXX dans commits
- ✅ Mettre à jour spec si changement découvert en dev
- ✅ Auto-checklist pre-review avant PR

### Reviewer (PR)

- ✅ Vérifier spec mise à jour
- ✅ Checker traceability RF-XXX → code
- ✅ Valider tests couvrent exigences
- ✅ Approuver uniquement si spec ↔ code cohérents

---

## 🔧 Outils d'Automatisation

### Script de Couverture

```bash
# Lancer vérification
bash .spec/scripts/check-coverage.sh

# En CI/CD (optionnel)
# .github/workflows/spec-coverage.yml
name: Spec Coverage Check
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check Spec Coverage
        run: bash .spec/scripts/check-coverage.sh
```

### Pre-Commit Hook (optionnel)

```bash
# .git/hooks/pre-commit
#!/bin/bash
# Vérifier si commit touche backend/ ou frontend/

CHANGED_CODE=$(git diff --cached --name-only | grep -E '^(backend|frontend)/')

if [ -n "$CHANGED_CODE" ]; then
  echo "⚠️ Code modifié détecté. Spec mise à jour ?"
  echo ""
  echo "Fichiers modifiés:"
  echo "$CHANGED_CODE" | sed 's/^/  - /'
  echo ""
  echo "Checklist:"
  echo "  □ Spec correspondante mise à jour dans .spec/features/"
  echo "  □ Plan technique ajusté si nécessaire"
  echo "  □ Tests mis à jour"
  echo ""
  read -p "Continuer le commit ? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

---

## 📝 Cas Spéciaux

### Hotfix en Production

```bash
# 1. Corriger code rapidement (priorité uptime)
# 2. Créer spec a posteriori si comportement métier change
# 3. Documenter dans ADR si décision architecturale prise sous contrainte

# Exemple ADR hotfix:
# .spec/adr/YYYYMMDD-hotfix-payment-timeout.md
# Context: Production payment gateway timeout 30s → users frustrated
# Decision: Reduce to 10s + add retry logic
# Consequences: Better UX, need monitoring increase
```

### POC / Expérimentation

```bash
# Option 1: Pas de spec (si POC jetable)
# - Créer branche feat/poc-xxx
# - Code sans spec
# - Si validé → réécrire avec spec complète

# Option 2: Spec légère (si POC destiné à prod)
# - .spec/poc/xxx.md (format light)
# - Si validé → migrer vers .spec/features/xxx.md complet
```

### Refactoring Massif

```bash
# 1. Créer ADR expliquant refacto
# .spec/adr/YYYYMMDD-refactor-supabase-direct.md

# 2. Mettre à jour specs impactées
grep -l "Prisma" .spec/features/*.md  # Identifier specs concernées
# → MAJ toutes les specs mentionnant ancienne architecture

# 3. Mettre à jour plan/tasks si architecture change

# 4. Migration progressive avec feature flags
```

---

## �� Anti-Patterns à Éviter

| ❌ Anti-Pattern | ✅ Bonne Pratique |
|----------------|-------------------|
| Coder puis documenter plus tard | Spec AVANT ou PENDANT dev, JAMAIS APRÈS |
| Spec obsolète jamais mise à jour | MAJ spec dans même PR que changement code |
| Spec trop vague ("améliorer UX") | Spec précise avec critères acceptation mesurables |
| Copier-coller spec d'une autre feature | Adapter contexte projet (400k produits, B2B+B2C) |
| Ignorer audit trimestriel | Planifier audit dans calendrier équipe |
| Specs orphelines non archivées | Archiver systématiquement dans .spec/archive/ |
| Reviewer qui n'ouvre pas les specs | Bloquer PR si spec non fournie/mise à jour |

---

## 📊 Métriques de Succès

### KPIs Projet (Mesure Santé SpecKit)

```bash
# 1. Coverage Rate
COVERAGE=$(bash .spec/scripts/check-coverage.sh | grep "Score Global" | awk '{print $3}')

# 2. Spec Age (dernière MAJ)
for spec in .spec/features/*.md; do
  LAST_COMMIT=$(git log -1 --format="%cr" -- "$spec")
  echo "$(basename $spec): $LAST_COMMIT"
done

# 3. PR Rejection Rate (cause: spec manquante)
# Tracker manuellement dans PR comments
```

**Cibles Santé**:
- Coverage ≥ 90%
- Aucune spec > 6 mois sans MAJ
- < 5% PRs rejetées pour raison spec

---

## 🆘 Support

### Ressources

- **Constitution**: `.spec/constitution.md` - Standards projet
- **Workflows**: `.spec/workflows/*.md` - 7 workflows détaillés
- **Exemples**: `.spec/features/*.md` - 23 specs existantes
- **ADRs**: `.spec/adr/*.md` - Décisions architecturales

### Contact

- **Questions méthodologie**: Tech Lead
- **Questions outils**: DevOps
- **Suggestions amélioration**: Ouvrir issue GitHub avec label `spec-kit`

---

## 🔄 Historique des MAJ

| Date | Version | Changements |
|------|---------|-------------|
| 2025-11-18 | 1.0 | Création guide initial |

---

**Dernière révision**: 2025-11-18
**Mainteneur**: Tech Lead
**Review cycle**: Trimestriel
