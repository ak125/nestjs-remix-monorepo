# 🚀 Guide de Démarrage - Agents IA

Ce guide vous aide à démarrer avec le système d'agents IA du monorepo.

## 📦 Installation

```bash
cd ai-agents
npm install
npm run build
```

## 🎯 Premier Test - Agent Cartographe

### Option 1 : Via npm scripts (recommandé)

```bash
# Exécuter le Cartographe seul
npm run agent:cartographe

# Exécuter tous les agents via le driver
npm run agent:driver
```

### Option 2 : Via CLI

```bash
# Lister tous les agents disponibles
npx ts-node src/cli/audit.ts list

# Exécuter un agent spécifique
npx ts-node src/cli/audit.ts agent cartographe

# Exécuter tous les agents
npx ts-node src/cli/audit.ts all
```

### Option 3 : Via commande directe

```bash
# Cartographe seul
npx ts-node src/agents/cartographe-monorepo.agent.ts

# Driver complet
npx ts-node src/core/ai-driver.ts
```

## 📊 Résultats Attendus

Après l'exécution du Cartographe, vous trouverez dans `ai-agents/reports/` :

```
reports/
├── monorepo-map.json           # Carte complète du monorepo
├── heatmap.json                # Top 50 fichiers (JSON)
├── heatmap.md                  # Top 50 fichiers (Markdown)
├── cartographe-summary.md      # Résumé de l'analyse
├── audit-report.json           # Rapport complet (JSON)
└── audit-report.md             # Rapport complet (Markdown)
```

## 📈 Exemple de Sortie Console

```
🚀 [Cartographe Monorepo] Démarrage de l'analyse...
📂 Scan des fichiers...
✅ 1234 fichiers trouvés
📊 Analyse des workspaces...
✅ 5 workspaces analysés
🔥 Génération de la heatmap...
✅ Top 50 fichiers identifiés
📈 Calcul des KPIs...
✅ 7 KPIs calculés
💾 Carte sauvegardée: reports/monorepo-map.json
💾 Heatmap sauvegardée: reports/heatmap.json
💾 Rapport heatmap sauvegardé: reports/heatmap.md
💾 Résumé sauvegardé: reports/cartographe-summary.md
✅ [Cartographe Monorepo] Analyse terminée en 2345ms
```

## 🔍 Interpréter les Résultats

### Monorepo Map (monorepo-map.json)

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "totalFiles": 1234,
  "totalSize": 50000000,
  "totalLines": 123456,
  "workspaces": [
    {
      "name": "frontend",
      "path": "frontend",
      "type": "frontend",
      "fileCount": 567,
      "totalSize": 25000000,
      "totalLines": 67890,
      "categories": {
        "source": 400,
        "test": 100,
        "config": 50,
        "other": 17
      }
    }
  ],
  "files": [...]
}
```

### KPIs Importants

1. **Couverture Workspaces** : Doit être à 100%
2. **Dérive de Poids** : Doit rester ≤ ±5%
3. **Fichiers Volumineux** : Surveiller les fichiers > 500KB
4. **Taille Totale** : Suivre l'évolution

## 🔧 Configuration

Modifiez `src/config/agents.config.ts` pour personnaliser :

```typescript
export const config: DriverConfig = {
  rootPath: '/workspaces/nestjs-remix-monorepo',
  outputPath: '/workspaces/nestjs-remix-monorepo/ai-agents/reports',
  parallel: false,
  reportFormat: 'both',
  agents: [
    {
      type: 'cartographe',
      enabled: true,
      options: {
        includeNodeModules: false,  // Inclure node_modules ?
        includeDist: false,          // Inclure dist/build ?
        topFilesLimit: 50,           // Nombre de fichiers dans la heatmap
        weightDriftThreshold: 5,     // Seuil de dérive en %
      },
    },
  ],
};
```

## 📅 Utilisation Récurrente

### Audit Hebdomadaire

Ajoutez à votre routine :

```bash
# Lundi matin - Audit complet
cd ai-agents && npm run agent:driver

# Comparer avec la semaine précédente
# Vérifier la dérive de poids dans audit-report.md
```

### Intégration CI/CD

Ajoutez dans votre pipeline :

```yaml
# .github/workflows/audit.yml
name: Audit Monorepo

on:
  schedule:
    - cron: '0 0 * * 1' # Chaque lundi à minuit
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd ai-agents && npm install
      - run: cd ai-agents && npm run agent:driver
      - uses: actions/upload-artifact@v3
        with:
          name: audit-reports
          path: ai-agents/reports/
```

## 🎯 Prochaines Étapes

1. ✅ Exécuter le premier audit
2. ✅ Consulter les rapports générés
3. 🔄 Identifier les points d'amélioration
4. 📊 Suivre l'évolution hebdomadaire
5. 🚀 Ajouter d'autres agents selon vos besoins

## 🐛 Dépannage

### Erreur : "Cannot find module"

```bash
cd ai-agents
npm install
npm run build
```

### Aucun fichier trouvé

Vérifiez que `rootPath` dans `agents.config.ts` pointe vers le bon dossier.

### Erreurs de permissions

```bash
chmod +x ai-agents/src/cli/*.ts
```

## 📚 Ressources

- [Liste complète des agents](./AGENTS-LIST.md)
- [Documentation des types](./src/types/index.ts)
- [Configuration avancée](./src/config/agents.config.ts)

## 🤝 Support

Pour toute question ou problème :
1. Consultez les rapports d'erreur dans `reports/`
2. Vérifiez les logs de console
3. Créez une issue avec les détails
