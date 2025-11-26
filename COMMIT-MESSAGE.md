feat(database-types): Optimisation massive des tables hardcodées

## 🎯 Objectif
Réduire les tables hardcodées en créant un package centralisé
avec type-safety et autocomplete

## 📊 Résultats
- Tables hardcodées : 500+ → 102 (-79%)
- Services optimisés : 69 → 98 (+42%)
- Tables dans package : 66 → 83 (+17)
- Erreurs TypeScript : 0 ✅

## ✨ Changements Principaux

### Package @repo/database-types
- Ajout de 17 nouvelles tables (blog, SEO, analytics)
- 83 tables totales avec types complets
- Convention claire : `TABLES.nom_table`

### Backend Services (98 fichiers)
- Remplacement des strings hardcodées par TABLES.*
- Ajout des imports `@repo/database-types`
- Autocomplete et type-safety sur toutes les requêtes

### Corrections
- ✅ `marques` → `TABLES.auto_marque`
- ✅ `seo_family_gamme_car_switch` → `TABLES.seo_family_gamme_car_switch`
- ✅ Tous les préfixes `___` et `__` gérés correctement

### Documentation
- OPTIMISATION-TABLES-SUMMARY.md : Résumé complet
- TABLES-INVALIDES.md : Liste des tables à vérifier
- Commentaires inline pour cas limites

## 🔴 Tables Hardcodées Restantes (102)
- 69 externes/système (intentionnel)
- 33 invalides/à vérifier (documenté)

## 🎯 Bénéfices
- 🚀 Autocomplete sur tous les noms de tables
- 🛡️ Type-safety : erreurs détectées à la compilation
- 📚 Documentation automatique
- 🔍 Refactoring sécurisé
- 📉 -79% de code hardcodé

## ✅ Tests
- ✅ Compilation backend : 0 erreurs
- ✅ Package database-types : build OK
- ✅ 98 services utilisent TABLES

Breaking Changes: None
Migration: Aucune action requise
