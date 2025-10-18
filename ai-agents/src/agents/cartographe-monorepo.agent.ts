import { IAgent, AgentResult, AgentStatus, MonorepoMap, Heatmap, KPI } from '../types';
import { FileScanner } from '../utils/file-scanner';
import { HeatmapGenerator } from '../utils/heatmap-generator';
import { KPICalculator } from '../utils/kpi-calculator';
import { config } from '../config/agents.config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Agent Cartographe Monorepo
 * 
 * Fonction : Inventorier toute l'arborescence, mesurer tailles/volumes, produire une heatmap.
 * Périmètre : frontend (Remix), backend (NestJS), packages, configs.
 * 
 * Livrables :
 * - Monorepo Map (chemin, type, taille, lignes, statut)
 * - Heatmap poids (top 50 fichiers)
 * - KPI : couverture 100% workspaces, dérive poids ≤ ±5%/semaine
 */
export class CartographeMonorepoAgent implements IAgent {
  name = 'Cartographe Monorepo';
  type = 'cartographe' as const;
  description = 'Inventorier l\'arborescence du monorepo et générer des métriques';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private scanner: FileScanner;
  private heatmapGenerator: HeatmapGenerator;
  private kpiCalculator: KPICalculator;

  constructor() {
    const agentConfig = config.agents.find(a => a.type === 'cartographe');
    const options = agentConfig?.options || {};

    this.scanner = new FileScanner(config.rootPath, {
      includeNodeModules: options.includeNodeModules ?? false,
      includeDist: options.includeDist ?? false,
    });

    this.heatmapGenerator = new HeatmapGenerator();
    this.kpiCalculator = new KPICalculator();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'running';

    try {
      console.log(`🚀 [${this.name}] Démarrage de l'analyse...`);

      // 1. Scanner tous les fichiers
      console.log('📂 Scan des fichiers...');
      const files = await this.scanner.scanAll();
      console.log(`✅ ${files.length} fichiers trouvés`);

      // 2. Grouper par workspace
      console.log('📊 Analyse des workspaces...');
      const filesByWorkspace = this.scanner.groupByWorkspace(files);
      const workspaces = Array.from(filesByWorkspace.entries()).map(([name, files]) =>
        this.scanner.createWorkspaceInfo(name, files)
      );
      console.log(`✅ ${workspaces.length} workspaces analysés`);

      // 3. Créer la carte du monorepo
      const monorepoMap: MonorepoMap = {
        timestamp: new Date(),
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalLines: files.reduce((sum, f) => sum + (f.lines || 0), 0),
        workspaces,
        files,
      };

      // 4. Générer la heatmap
      console.log('🔥 Génération de la heatmap...');
      const agentConfig = config.agents.find(a => a.type === 'cartographe');
      const topFilesLimit = agentConfig?.options?.topFilesLimit ?? 50;
      const heatmap = this.heatmapGenerator.generate(files, topFilesLimit);
      console.log(`✅ Top ${heatmap.topFiles.length} fichiers identifiés`);

      // 5. Calculer les KPIs
      console.log('📈 Calcul des KPIs...');
      const kpis = this.kpiCalculator.calculateAll(files, workspaces);
      console.log(`✅ ${kpis.length} KPIs calculés`);

      // 6. Sauvegarder les résultats
      await this.saveResults(monorepoMap, heatmap);

      const duration = Date.now() - startTime;
      this.status = 'completed';

      console.log(`✅ [${this.name}] Analyse terminée en ${duration}ms`);

      return {
        agentName: this.name,
        agentType: this.type,
        status: 'success',
        timestamp: new Date(),
        duration,
        data: {
          monorepoMap,
          heatmap,
        },
        kpis,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.status = 'error';

      console.error(`❌ [${this.name}] Erreur:`, error);

      return {
        agentName: this.name,
        agentType: this.type,
        status: 'error',
        timestamp: new Date(),
        duration,
        data: null,
        errors: [error instanceof Error ? error.message : String(error)],
        kpis: [],
      };
    }
  }

  /**
   * Sauvegarder les résultats dans des fichiers
   */
  private async saveResults(monorepoMap: MonorepoMap, heatmap: Heatmap): Promise<void> {
    const outputDir = config.outputPath;

    // Créer le dossier de sortie s'il n'existe pas
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Sauvegarder la carte du monorepo
    const mapPath = path.join(outputDir, 'monorepo-map.json');
    await fs.promises.writeFile(mapPath, JSON.stringify(monorepoMap, null, 2));
    console.log(`💾 Carte sauvegardée: ${mapPath}`);

    // Sauvegarder la heatmap (JSON)
    const heatmapPath = path.join(outputDir, 'heatmap.json');
    await fs.promises.writeFile(heatmapPath, JSON.stringify(heatmap, null, 2));
    console.log(`💾 Heatmap sauvegardée: ${heatmapPath}`);

    // Sauvegarder la heatmap (Markdown)
    const heatmapMdPath = path.join(outputDir, 'heatmap.md');
    const heatmapMd = this.heatmapGenerator.generateMarkdownReport(heatmap);
    await fs.promises.writeFile(heatmapMdPath, heatmapMd);
    console.log(`💾 Rapport heatmap sauvegardé: ${heatmapMdPath}`);

    // Générer un résumé
    const summaryPath = path.join(outputDir, 'cartographe-summary.md');
    const summary = this.generateSummary(monorepoMap, heatmap);
    await fs.promises.writeFile(summaryPath, summary);
    console.log(`💾 Résumé sauvegardé: ${summaryPath}`);
  }

  /**
   * Générer un résumé markdown
   */
  private generateSummary(monorepoMap: MonorepoMap, heatmap: Heatmap): string {
    let summary = '# 📊 Résumé - Cartographe Monorepo\n\n';
    summary += `**Date**: ${monorepoMap.timestamp.toISOString()}\n\n`;

    // Statistiques globales
    summary += '## 📈 Statistiques Globales\n\n';
    summary += `- **Fichiers totaux**: ${monorepoMap.totalFiles.toLocaleString()}\n`;
    summary += `- **Taille totale**: ${this.heatmapGenerator.formatSize(monorepoMap.totalSize)}\n`;
    summary += `- **Lignes totales**: ${monorepoMap.totalLines.toLocaleString()}\n`;
    summary += `- **Workspaces**: ${monorepoMap.workspaces.length}\n\n`;

    // Par workspace
    summary += '## 🗂️ Répartition par Workspace\n\n';
    summary += '| Workspace | Fichiers | Taille | Lignes | Type |\n';
    summary += '|-----------|----------|--------|--------|------|\n';
    
    for (const ws of monorepoMap.workspaces) {
      summary += `| ${ws.name} | ${ws.fileCount} | ${this.heatmapGenerator.formatSize(ws.totalSize)} | ${ws.totalLines.toLocaleString()} | ${ws.type} |\n`;
    }

    summary += '\n';

    // Top 10 fichiers
    summary += '## 🔥 Top 10 Fichiers les Plus Volumineux\n\n';
    summary += '| Rang | Fichier | Taille | Workspace |\n';
    summary += '|------|---------|--------|------------|\n';

    for (const entry of heatmap.topFiles.slice(0, 10)) {
      summary += `| ${entry.rank} | \`${entry.path}\` | ${this.heatmapGenerator.formatSize(entry.size)} | ${entry.workspace} |\n`;
    }

    return summary;
  }
}

// Exécution directe si ce fichier est lancé
if (require.main === module) {
  const agent = new CartographeMonorepoAgent();
  agent.execute().then(result => {
    console.log('\n📋 Résultat:', result.status);
    console.log('⏱️  Durée:', result.duration, 'ms');
    console.log('📊 KPIs:', result.kpis.length);
  });
}
