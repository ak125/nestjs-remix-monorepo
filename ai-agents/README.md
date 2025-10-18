# 🤖 AI Agents - Système d'Audit et d'Amélioration Monorepo

Ce système d'agents IA permet d'auditer, analyser et améliorer automatiquement le monorepo NestJS/Remix.

## 🎯 Architecture

### Driver IA (Orchestrateur)
Le driver IA coordonne l'exécution de tous les agents et agrège leurs résultats.

### Agents disponibles

#### 1. 📊 Cartographe Monorepo (Audit & Structure)
**Fonction** : Inventorier toute l'arborescence, mesurer tailles/volumes, produire une heatmap.

**Périmètre** : 
- Frontend (Remix)
- Backend (NestJS)
- Packages partagés
- Configurations

**Livrables** :
- Monorepo Map (chemin, type, taille, lignes, statut)
- Heatmap des fichiers les plus volumineux (top 50)
- KPI : couverture 100% workspaces, dérive poids ≤ ±5%/semaine

## 📦 Installation

```bash
cd ai-agents
npm install
npm run build
```

## 🚀 Utilisation

### Exécuter le driver IA complet
```bash
npm run agent:driver
```

### Exécuter un agent spécifique
```bash
# Cartographe Monorepo
npm run agent:cartographe
```

### Audit complet avec rapport
```bash
npm run audit:full
```

### Générer un rapport
```bash
npm run report:generate
```

## 📊 Rapports générés

Les rapports sont générés dans le dossier `reports/` :
- `monorepo-map.json` - Cartographie complète
- `heatmap.json` - Top 50 fichiers les plus volumineux
- `kpi-report.json` - Indicateurs de performance
- `audit-summary.md` - Résumé en markdown

## 🔧 Configuration

La configuration des agents se trouve dans `src/config/agents.config.ts`.

## 📈 KPI Suivis

- **Couverture** : 100% des workspaces scannés
- **Dérive de poids** : ≤ ±5% par semaine
- **Fichiers volumineux** : Top 50 identifiés
- **Lignes de code** : Par workspace et global
