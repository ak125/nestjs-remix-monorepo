# AI Agents - Liste des Agents IA

Ce document décrit la liste complète des agents IA disponibles pour l'audit et l'amélioration du monorepo.

## 🎯 Architecture

```
┌─────────────────────────────────────────┐
│         Driver IA (Orchestrateur)       │
│  Coordonne et agrège tous les agents    │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
┌───────────────┐    ┌───────────────┐
│  Agent 1      │    │  Agent 2      │
│  Cartographe  │    │  À venir...   │
└───────────────┘    └───────────────┘
```

## 📋 Liste des Agents

### 1. 📊 Cartographe Monorepo ✅ IMPLÉMENTÉ

**Catégorie** : Audit & Amélioration Monorepo  
**Noyau** : Audit/Structure  
**Version** : 1.0.0

#### Fonction
Inventorier toute l'arborescence, mesurer tailles/volumes, produire une heatmap.

#### Périmètre
- Frontend (Remix)
- Backend (NestJS)
- Packages partagés
- Configurations

#### Livrables
- **Monorepo Map** : Cartographie complète (chemin, type, taille, lignes, statut)
- **Heatmap** : Top 50 fichiers les plus volumineux
- **KPI** :
  - Couverture 100% workspaces
  - Dérive poids ≤ ±5%/semaine
  - Nombre de fichiers totaux
  - Taille totale du monorepo
  - Lignes de code totales

#### Fichiers générés
```
reports/
├── monorepo-map.json          # Carte complète du monorepo
├── heatmap.json               # Heatmap en format JSON
├── heatmap.md                 # Heatmap en format Markdown
└── cartographe-summary.md     # Résumé de l'analyse
```

---

### 2. 🔧 Optimiseur de Code 🚧 À IMPLÉMENTER

**Catégorie** : Audit & Amélioration Monorepo  
**Noyau** : Performance/Optimisation  
**Statut** : À venir

#### Fonction
Analyser le code pour identifier les opportunités d'optimisation.

#### Périmètre
- Code dupliqué
- Imports inutilisés
- Dead code
- Patterns anti-performants

#### Livrables prévus
- Rapport de duplication
- Liste des imports à nettoyer
- Suggestions d'optimisation
- Score de qualité du code

---

### 3. 🔒 Auditeur de Sécurité 🚧 À IMPLÉMENTER

**Catégorie** : Audit & Amélioration Monorepo  
**Noyau** : Sécurité  
**Statut** : À venir

#### Fonction
Scanner le code pour identifier les vulnérabilités de sécurité.

#### Périmètre
- Dépendances vulnérables
- Code non sécurisé
- Secrets exposés
- Configuration de sécurité

#### Livrables prévus
- Rapport de vulnérabilités
- Score de sécurité
- Plan de remédiation

---

### 4. 📦 Gestionnaire de Dépendances 🚧 À IMPLÉMENTER

**Catégorie** : Audit & Amélioration Monorepo  
**Noyau** : Dépendances  
**Statut** : À venir

#### Fonction
Analyser et optimiser les dépendances du monorepo.

#### Périmètre
- Dépendances obsolètes
- Dépendances dupliquées
- Versions incompatibles
- Taille des node_modules

#### Livrables prévus
- Graphe de dépendances
- Suggestions de mise à jour
- Opportunités de dédoublonnage

---

### 5. 📈 Analyseur de Performance 🚧 À IMPLÉMENTER

**Catégorie** : Audit & Amélioration Monorepo  
**Noyau** : Performance  
**Statut** : À venir

#### Fonction
Mesurer et analyser les performances du build et du runtime.

#### Périmètre
- Temps de build
- Taille des bundles
- Performance du runtime
- Temps de démarrage

#### Livrables prévus
- Rapport de performance
- Goulots d'étranglement identifiés
- Suggestions d'amélioration

---

### 6. 📝 Générateur de Documentation 🚧 À IMPLÉMENTER

**Catégorie** : Audit & Amélioration Monorepo  
**Noyau** : Documentation  
**Statut** : À venir

#### Fonction
Générer et maintenir la documentation du monorepo.

#### Périmètre
- Documentation API
- README des packages
- Guides de contribution
- Architecture

#### Livrables prévus
- Documentation complète
- Diagrammes d'architecture
- Guides d'utilisation

---

### 7. 🧪 Analyseur de Tests 🚧 À IMPLÉMENTER

**Catégorie** : Audit & Amélioration Monorepo  
**Noyau** : Tests/Qualité  
**Statut** : À venir

#### Fonction
Analyser la couverture et la qualité des tests.

#### Périmètre
- Couverture de code
- Tests manquants
- Tests obsolètes
- Performance des tests

#### Livrables prévus
- Rapport de couverture
- Gaps de tests identifiés
- Suggestions de tests

---

## 🚀 Utilisation

### Exécuter tous les agents
```bash
cd ai-agents
npm install
npm run agent:driver
```

### Exécuter un agent spécifique
```bash
# Cartographe
npm run agent:cartographe

# Autres agents (à venir)
# npm run agent:optimizer
# npm run agent:security
```

### Via CLI
```bash
# Tous les agents
npm run audit:full

# Agent spécifique
ts-node src/cli/audit.ts agent cartographe

# Lister les agents
ts-node src/cli/audit.ts list
```

## 📊 Rapports

Tous les rapports sont générés dans le dossier `reports/` avec :
- Format JSON pour l'intégration
- Format Markdown pour la lecture
- KPIs détaillés
- Horodatage et traçabilité

## 🔄 Roadmap

1. ✅ **Phase 1** : Cartographe Monorepo (Implémenté)
2. 🚧 **Phase 2** : Optimiseur de Code (En cours de planification)
3. 🚧 **Phase 3** : Auditeur de Sécurité (En cours de planification)
4. 🚧 **Phase 4** : Gestionnaire de Dépendances (Planifié)
5. 🚧 **Phase 5** : Analyseur de Performance (Planifié)
6. 🚧 **Phase 6** : Générateur de Documentation (Planifié)
7. 🚧 **Phase 7** : Analyseur de Tests (Planifié)

## 🤝 Contribution

Pour ajouter un nouvel agent :

1. Créer une classe qui implémente `IAgent`
2. L'enregistrer dans le `AIDriver`
3. Ajouter la configuration dans `agents.config.ts`
4. Documenter dans cette liste

## 📚 Documentation

- [README principal](./README.md)
- [Types et interfaces](./src/types/index.ts)
- [Configuration](./src/config/agents.config.ts)
