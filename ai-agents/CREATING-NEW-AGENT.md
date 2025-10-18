# 🛠️ Guide de Création d'un Nouvel Agent

Ce guide explique comment créer un nouvel agent IA pour le système.

## 📋 Étapes de Création

### 1. Dupliquer le Template

```bash
cd ai-agents/src/agents
cp template.agent.ts mon-nouvel-agent.agent.ts
```

### 2. Personnaliser l'Agent

Éditez `mon-nouvel-agent.agent.ts` :

```typescript
export class MonNouvelAgent implements IAgent {
  name = 'Mon Nouvel Agent';
  type = 'mon-agent' as const;
  description = 'Description de ce que fait l\'agent';
  version = '1.0.0';

  // ... reste du code
}
```

### 3. Implémenter la Logique

Complétez les méthodes :

```typescript
private async collectData(): Promise<any> {
  // Votre logique de collecte
  const scanner = new FileScanner(config.rootPath);
  const files = await scanner.scanAll();
  return files;
}

private async analyze(data: any): Promise<any> {
  // Votre logique d'analyse
  const results = data.map(/* ... */);
  return results;
}

private calculateKPIs(analysis: any): any[] {
  // Vos KPIs
  return [
    {
      name: 'Mon KPI',
      value: 42,
      unit: '%',
      threshold: { target: 50 },
      status: 'ok',
    },
  ];
}
```

### 4. Enregistrer dans le Driver

Éditez `src/core/ai-driver.ts` :

```typescript
import { MonNouvelAgent } from '../agents/mon-nouvel-agent.agent';

private registerAgents(): void {
  // ... agents existants
  
  // Votre nouvel agent
  const monAgent = new MonNouvelAgent();
  this.agents.set('mon-agent', monAgent);
}
```

### 5. Ajouter la Configuration

Éditez `src/config/agents.config.ts` :

```typescript
export const config: DriverConfig = {
  // ...
  agents: [
    // ... agents existants
    {
      type: 'mon-agent',
      enabled: true,
      options: {
        // Options spécifiques à votre agent
        maxItems: 100,
        threshold: 50,
      },
    },
  ],
};
```

### 6. Ajouter le Script NPM

Éditez `package.json` :

```json
{
  "scripts": {
    "agent:mon-agent": "ts-node src/agents/mon-nouvel-agent.agent.ts"
  }
}
```

### 7. Documenter dans AGENTS-LIST.md

Ajoutez votre agent à la liste :

```markdown
### X. 🎯 Mon Nouvel Agent ✅ IMPLÉMENTÉ

**Catégorie** : Catégorie de l'agent
**Noyau** : Noyau principal
**Version** : 1.0.0

#### Fonction
Description détaillée de la fonction.

#### Périmètre
- Item 1
- Item 2

#### Livrables
- Rapport X
- Données Y
- KPI Z
```

## 🧪 Tester l'Agent

### Test Direct

```bash
npm run agent:mon-agent
```

### Test via Driver

```bash
npm run agent:driver
```

### Test via CLI

```bash
npx ts-node src/cli/audit.ts agent mon-agent
```

## 📊 Structure de Données Recommandée

### Résultat de l'Agent

```typescript
interface MonAgentResult {
  timestamp: Date;
  summary: {
    total: number;
    processed: number;
    errors: number;
  };
  details: Array<{
    item: string;
    status: 'ok' | 'warning' | 'error';
    message?: string;
  }>;
  recommendations: string[];
}
```

### KPIs Standards

```typescript
const kpis = [
  {
    name: 'Taux de Réussite',
    value: 95,
    unit: '%',
    threshold: { target: 90 },
    status: 'ok',
  },
  {
    name: 'Éléments Traités',
    value: 150,
    status: 'ok',
  },
];
```

## 💡 Bonnes Pratiques

### 1. Logging Cohérent

```typescript
console.log(`🚀 [${this.name}] Démarrage...`);
console.log('📊 Collecte des données...');
console.log('✅ ${count} items collectés');
console.log('❌ Erreur:', error);
console.log(`✅ [${this.name}] Terminé en ${duration}ms`);
```

### 2. Gestion des Erreurs

```typescript
try {
  // Logique principale
} catch (error) {
  console.error(`❌ [${this.name}] Erreur:`, error);
  return {
    // ... résultat avec erreur
    status: 'error',
    errors: [error instanceof Error ? error.message : String(error)],
  };
}
```

### 3. Sauvegarde des Résultats

```typescript
private async saveResults(data: any): Promise<void> {
  const outputDir = config.outputPath;
  await fs.promises.mkdir(outputDir, { recursive: true });

  // JSON
  const jsonPath = path.join(outputDir, 'mon-agent-results.json');
  await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2));

  // Markdown
  const mdPath = path.join(outputDir, 'mon-agent-report.md');
  const markdown = this.generateMarkdown(data);
  await fs.promises.writeFile(mdPath, markdown);
}
```

### 4. Génération de Rapports Markdown

```typescript
private generateMarkdown(data: any): string {
  let md = `# 📊 Rapport - ${this.name}\n\n`;
  md += `**Date**: ${new Date().toISOString()}\n\n`;
  md += `## Résumé\n\n`;
  // ... contenu
  return md;
}
```

## 🔍 Checklist de Création

- [ ] Template dupliqué et renommé
- [ ] Classe implémente `IAgent`
- [ ] Méthodes principales implémentées
- [ ] Agent enregistré dans `AIDriver`
- [ ] Configuration ajoutée
- [ ] Script npm ajouté
- [ ] Tests effectués
- [ ] Documentation ajoutée
- [ ] Types TypeScript mis à jour si nécessaire
- [ ] KPIs définis et calculés
- [ ] Rapports générés (JSON + Markdown)

## 📚 Ressources

- [Interface IAgent](../src/types/index.ts)
- [Exemple complet](../src/agents/cartographe-monorepo.agent.ts)
- [Configuration](../src/config/agents.config.ts)
- [Driver IA](../src/core/ai-driver.ts)

## 🆘 Aide

Si vous rencontrez des difficultés :

1. Consultez l'agent Cartographe comme référence
2. Vérifiez les types dans `src/types/index.ts`
3. Testez d'abord avec des données mockées
4. Ajoutez des logs pour déboguer
