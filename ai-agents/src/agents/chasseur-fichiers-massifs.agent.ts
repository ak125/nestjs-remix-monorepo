/**
 * Agent 2 : Chasseur de Fichiers Massifs
 * 
 * Fonction : Identifier fichiers trop gros et proposer des scissions minimales
 * 
 * Périmètre : 
 * - Routes Remix (>400 lignes)
 * - Services NestJS (>300 lignes)
 * - TS/TSX général (>500 lignes)
 * 
 * Livrables :
 * - Top 20 fichiers massifs + plan de scission en 2–3 morceaux (UI/Data/Helpers)
 * - KPI : taille cumulée des 10 pires fichiers ↘︎ -25% en 2 sprints
 */

import { IAgent, AgentResult, AgentStatus, MassiveFile, MassiveFilesReport, SplittingPlan, SuggestedSplit } from '../types';
import { FileScanner } from '../utils/file-scanner';
import { ASTAnalyzer, ASTAnalysis } from '../utils/ast-analyzer';
import * as fs from 'fs';
import * as path from 'path';

export class ChasseurFichiersMassifsAgent implements IAgent {
  name = 'Chasseur de Fichiers Massifs';
  type = 'fichiers-massifs' as const;
  description = 'Identifie les fichiers trop volumineux et propose des plans de scission intelligents';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private fileScanner: FileScanner;
  private astAnalyzer: ASTAnalyzer;

  // Seuils configurables
  private thresholds = {
    route: 400,      // lignes pour routes Remix
    service: 300,    // lignes pour services NestJS
    general: 500,    // lignes pour autres TS/TSX
  };

  constructor(private rootPath: string) {
    this.fileScanner = new FileScanner(rootPath);
    this.astAnalyzer = new ASTAnalyzer();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'running';

    try {
      console.log(`\n🔍 ${this.name} - Analyse en cours...`);

      // 1. Scanner tous les fichiers TS/TSX
      const allFiles = await this.fileScanner.scanAll();
      const tsFiles = allFiles.filter((f) => 
        f.extension && ['.ts', '.tsx', '.js', '.jsx'].includes(f.extension)
      );

      console.log(`   📂 ${tsFiles.length} fichiers TypeScript/JavaScript trouvés`);

      // 2. Identifier les fichiers massifs
      const massiveFiles = await this.identifyMassiveFiles(tsFiles);

      console.log(`   ⚠️  ${massiveFiles.length} fichiers massifs détectés`);

      // 3. Générer les plans de scission pour le top 20
      const top20 = massiveFiles.slice(0, 20);
      await this.generateSplittingPlans(top20);

      console.log(`   📋 Plans de scission générés pour ${top20.length} fichiers`);

      // 4. Calculer les métriques
      const report = this.generateReport(tsFiles.length, massiveFiles, top20);

      // 5. Générer les rapports
      await this.saveReports(report, massiveFiles);

      // 6. Calculer les KPIs
      const kpis = this.calculateKPIs(report);

      const duration = Date.now() - startTime;
      this.status = 'completed';

      console.log(`   ✅ Analyse terminée en ${duration}ms`);

      return {
        agentName: this.name,
        agentType: this.type,
        status: 'success',
        timestamp: new Date(),
        duration,
        data: report,
        kpis,
      };
    } catch (error) {
      this.status = 'error';
      const duration = Date.now() - startTime;
      
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
   * Identifier les fichiers massifs selon les seuils
   */
  private async identifyMassiveFiles(files: any[]): Promise<MassiveFile[]> {
    const massiveFiles: MassiveFile[] = [];

    for (const file of files) {
      if (!file.lines) continue;

      const category = this.categorizeFile(file.path);
      const threshold = this.getThreshold(file.path, category);

      if (file.lines > threshold) {
        const isCritical = file.lines > this.thresholds.general;

        massiveFiles.push({
          rank: 0, // Sera calculé après le tri
          path: file.path,
          absolutePath: file.absolutePath,
          size: file.size,
          lines: file.lines,
          workspace: file.workspace,
          category,
          threshold: isCritical ? 'critical' : 'warning',
        });
      }
    }

    // Trier par nombre de lignes décroissant
    massiveFiles.sort((a, b) => b.lines - a.lines);

    // Assigner les rangs
    massiveFiles.forEach((file, index) => {
      file.rank = index + 1;
    });

    return massiveFiles;
  }

  /**
   * Catégoriser un fichier
   */
  private categorizeFile(filePath: string): MassiveFile['category'] {
    const pathLower = filePath.toLowerCase();

    if (pathLower.includes('/routes/') || pathLower.includes('\\routes\\')) {
      return 'route';
    }
    if (pathLower.includes('.service.') || pathLower.includes('/services/')) {
      return 'service';
    }
    if (pathLower.includes('/components/') || pathLower.includes('\\components\\')) {
      return 'component';
    }
    if (pathLower.includes('/utils/') || pathLower.includes('/helpers/')) {
      return 'util';
    }

    return 'other';
  }

  /**
   * Obtenir le seuil approprié
   */
  private getThreshold(filePath: string, category: MassiveFile['category']): number {
    switch (category) {
      case 'route':
        return this.thresholds.route;
      case 'service':
        return this.thresholds.service;
      default:
        return this.thresholds.general;
    }
  }

  /**
   * Générer les plans de scission pour les fichiers massifs
   */
  private async generateSplittingPlans(files: MassiveFile[]): Promise<void> {
    for (const file of files) {
      try {
        const analysis = await this.astAnalyzer.analyzeFile(file.absolutePath);
        
        if (analysis) {
          file.splittingPlan = this.createSplittingPlan(file, analysis);
        }
      } catch (error) {
        console.warn(`   ⚠️  Impossible d'analyser ${file.path}`);
      }
    }
  }

  /**
   * Créer un plan de scission basé sur l'analyse AST
   */
  private createSplittingPlan(file: MassiveFile, analysis: ASTAnalysis): SplittingPlan {
    const splits: SuggestedSplit[] = [];
    const baseName = path.basename(file.path, path.extname(file.path));

    // Stratégie selon la catégorie
    if (file.category === 'route' || file.category === 'component') {
      // Routes/Composants : séparer UI, Data, Hooks
      if (analysis.components.length > 0) {
        splits.push({
          fileName: `${baseName}.tsx`,
          purpose: 'UI',
          estimatedLines: Math.round(file.lines * 0.4),
          description: 'Composants visuels et JSX',
        });
      }

      if (analysis.functions.length > 2) {
        splits.push({
          fileName: `${baseName}.helpers.ts`,
          purpose: 'Helpers',
          estimatedLines: Math.round(file.lines * 0.25),
          description: 'Fonctions utilitaires et logique métier',
        });
      }

      const hooks = analysis.components.flatMap((c) => c.hooks);
      if (hooks.length > 3 || analysis.functions.some((f) => f.name.startsWith('use'))) {
        splits.push({
          fileName: `use${baseName}.ts`,
          purpose: 'Hooks',
          estimatedLines: Math.round(file.lines * 0.2),
          description: 'Hooks personnalisés React',
        });
      }

      if (analysis.interfaces.length > 0 || analysis.types.length > 0) {
        splits.push({
          fileName: `${baseName}.types.ts`,
          purpose: 'Types',
          estimatedLines: Math.round(file.lines * 0.15),
          description: 'Interfaces et types TypeScript',
        });
      }
    } else if (file.category === 'service') {
      // Services : séparer par responsabilité
      splits.push({
        fileName: `${baseName}.service.ts`,
        purpose: 'Services',
        estimatedLines: Math.round(file.lines * 0.3),
        description: 'Service principal (orchestrateur)',
      });

      splits.push({
        fileName: `${baseName}-query.service.ts`,
        purpose: 'Data',
        estimatedLines: Math.round(file.lines * 0.3),
        description: 'Opérations de lecture',
      });

      splits.push({
        fileName: `${baseName}-mutation.service.ts`,
        purpose: 'Data',
        estimatedLines: Math.round(file.lines * 0.25),
        description: 'Opérations d\'écriture (create, update, delete)',
      });

      if (analysis.interfaces.length > 0) {
        splits.push({
          fileName: `${baseName}.types.ts`,
          purpose: 'Types',
          estimatedLines: Math.round(file.lines * 0.15),
          description: 'DTOs et interfaces',
        });
      }
    } else {
      // Autres : séparation générique
      splits.push({
        fileName: `${baseName}.core.ts`,
        purpose: 'Data',
        estimatedLines: Math.round(file.lines * 0.5),
        description: 'Logique principale',
      });

      splits.push({
        fileName: `${baseName}.utils.ts`,
        purpose: 'Helpers',
        estimatedLines: Math.round(file.lines * 0.3),
        description: 'Fonctions utilitaires',
      });

      if (analysis.interfaces.length > 0 || analysis.types.length > 0) {
        splits.push({
          fileName: `${baseName}.types.ts`,
          purpose: 'Types',
          estimatedLines: Math.round(file.lines * 0.2),
          description: 'Types et interfaces',
        });
      }
    }

    // Calculer l'impact
    const filesCreated = splits.length;
    const avgLinesPerFile = Math.round(file.lines / filesCreated);
    
    let maintainabilityGain: 'low' | 'medium' | 'high' = 'low';
    if (file.lines > 1000) maintainabilityGain = 'high';
    else if (file.lines > 600) maintainabilityGain = 'medium';

    return {
      originalFile: file.path,
      suggestedSplits: splits,
      rationale: this.generateRationale(file, analysis),
      estimatedImpact: {
        filesCreated,
        avgLinesPerFile,
        maintainabilityGain,
      },
    };
  }

  /**
   * Générer la justification du plan
   */
  private generateRationale(file: MassiveFile, analysis: ASTAnalysis): string {
    const reasons: string[] = [];

    if (file.lines > 1000) {
      reasons.push(`Fichier très volumineux (${file.lines} lignes)`);
    } else if (file.lines > 500) {
      reasons.push(`Fichier volumineux (${file.lines} lignes)`);
    }

    if (analysis.complexity.hasMultipleResponsibilities) {
      reasons.push('Multiples responsabilités détectées');
    }

    if (analysis.complexity.totalExports > 5) {
      reasons.push(`Trop d'exports (${analysis.complexity.totalExports})`);
    }

    if (analysis.complexity.maxFunctionLength > 100) {
      reasons.push(`Fonctions trop longues (max: ${analysis.complexity.maxFunctionLength} lignes)`);
    }

    if (analysis.components.length > 3) {
      reasons.push(`Plusieurs composants (${analysis.components.length})`);
    }

    if (analysis.classes.length > 1) {
      reasons.push(`Plusieurs classes (${analysis.classes.length})`);
    }

    return reasons.join('; ');
  }

  /**
   * Générer le rapport complet
   */
  private generateReport(
    totalScanned: number,
    allMassive: MassiveFile[],
    top20: MassiveFile[]
  ): MassiveFilesReport {
    const criticalCount = allMassive.filter((f) => f.threshold === 'critical').length;
    const warningCount = allMassive.filter((f) => f.threshold === 'warning').length;

    const top10Size = top20.slice(0, 10).reduce((sum, f) => sum + f.size, 0);
    const top20Size = top20.reduce((sum, f) => sum + f.size, 0);

    const recommendations = this.generateRecommendations(allMassive);

    return {
      timestamp: new Date(),
      totalFilesScanned: totalScanned,
      massiveFilesCount: allMassive.length,
      criticalCount,
      warningCount,
      top20Files: top20,
      cumulativeSize: {
        top10: top10Size,
        top20: top20Size,
      },
      recommendations,
    };
  }

  /**
   * Générer les recommandations
   */
  private generateRecommendations(files: MassiveFile[]): string[] {
    const recommendations: string[] = [];

    if (files.length === 0) {
      recommendations.push('✅ Aucun fichier massif détecté. Excellente structure !');
      return recommendations;
    }

    const critical = files.filter((f) => f.threshold === 'critical');
    if (critical.length > 0) {
      recommendations.push(
        `🔴 URGENT : ${critical.length} fichiers critiques (>500 lignes) nécessitent un refactoring immédiat`
      );
    }

    const routes = files.filter((f) => f.category === 'route');
    if (routes.length > 0) {
      recommendations.push(
        `🟡 ${routes.length} routes volumineuses : extraire hooks, composants et services`
      );
    }

    const services = files.filter((f) => f.category === 'service');
    if (services.length > 0) {
      recommendations.push(
        `🟡 ${services.length} services volumineux : appliquer le principe de responsabilité unique (SRP)`
      );
    }

    recommendations.push(
      `📊 Objectif : réduire la taille cumulée du top 10 de 25% (${this.formatSize(files.slice(0, 10).reduce((s, f) => s + f.size, 0))} actuellement)`
    );

    return recommendations;
  }

  /**
   * Sauvegarder les rapports
   */
  private async saveReports(report: MassiveFilesReport, allFiles: MassiveFile[]): Promise<void> {
    const reportsDir = path.join(this.rootPath, 'ai-agents', 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Rapport JSON
    const jsonPath = path.join(reportsDir, 'fichiers-massifs.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Rapport Markdown
    const mdPath = path.join(reportsDir, 'fichiers-massifs.md');
    const markdown = this.generateMarkdown(report);
    fs.writeFileSync(mdPath, markdown);
  }

  /**
   * Générer le rapport Markdown
   */
  private generateMarkdown(report: MassiveFilesReport): string {
    let md = `# 🔍 Rapport : Chasseur de Fichiers Massifs\n\n`;
    md += `**Date** : ${report.timestamp.toLocaleString('fr-FR')}\n\n`;
    md += `---\n\n`;

    // Résumé
    md += `## 📊 Résumé\n\n`;
    md += `- **Fichiers analysés** : ${report.totalFilesScanned}\n`;
    md += `- **Fichiers massifs** : ${report.massiveFilesCount}\n`;
    md += `  - 🔴 Critiques (>500 lignes) : ${report.criticalCount}\n`;
    md += `  - 🟡 Avertissement (>300 lignes) : ${report.warningCount}\n`;
    md += `- **Taille cumulée top 10** : ${this.formatSize(report.cumulativeSize.top10)}\n`;
    md += `- **Taille cumulée top 20** : ${this.formatSize(report.cumulativeSize.top20)}\n\n`;

    // Recommandations
    md += `## 💡 Recommandations\n\n`;
    report.recommendations.forEach((rec) => {
      md += `- ${rec}\n`;
    });
    md += `\n`;

    // Top 20
    md += `## 🎯 Top 20 Fichiers Massifs\n\n`;
    md += `| Rang | Fichier | Lignes | Taille | Catégorie | Seuil |\n`;
    md += `|------|---------|--------|--------|-----------|-------|\n`;

    report.top20Files.forEach((file) => {
      const icon = file.threshold === 'critical' ? '🔴' : '🟡';
      md += `| ${file.rank} | \`${file.path}\` | ${file.lines} | ${this.formatSize(file.size)} | ${file.category} | ${icon} ${file.threshold} |\n`;
    });
    md += `\n`;

    // Plans de scission
    md += `## 🔧 Plans de Scission Suggérés\n\n`;
    
    report.top20Files.forEach((file) => {
      if (file.splittingPlan) {
        md += `### ${file.rank}. \`${path.basename(file.path)}\` (${file.lines} lignes)\n\n`;
        md += `**Justification** : ${file.splittingPlan.rationale}\n\n`;
        md += `**Impact estimé** :\n`;
        md += `- Fichiers créés : ${file.splittingPlan.estimatedImpact.filesCreated}\n`;
        md += `- Moyenne lignes/fichier : ~${file.splittingPlan.estimatedImpact.avgLinesPerFile}\n`;
        md += `- Gain maintenabilité : ${file.splittingPlan.estimatedImpact.maintainabilityGain}\n\n`;

        md += `**Scissions suggérées** :\n\n`;
        file.splittingPlan.suggestedSplits.forEach((split, idx) => {
          md += `${idx + 1}. **\`${split.fileName}\`** (${split.purpose}) - ~${split.estimatedLines} lignes\n`;
          md += `   - ${split.description}\n\n`;
        });

        md += `---\n\n`;
      }
    });

    return md;
  }

  /**
   * Calculer les KPIs
   */
  private calculateKPIs(report: MassiveFilesReport): any[] {
    const kpis = [];

    // KPI 1 : Nombre de fichiers massifs
    kpis.push({
      name: 'Fichiers massifs',
      value: report.massiveFilesCount,
      unit: 'fichiers',
      status: report.massiveFilesCount === 0 ? 'ok' : report.massiveFilesCount < 15 ? 'warning' : 'critical',
    });

    // KPI 2 : Fichiers critiques
    kpis.push({
      name: 'Fichiers critiques (>500 lignes)',
      value: report.criticalCount,
      unit: 'fichiers',
      threshold: { max: 5 },
      status: report.criticalCount === 0 ? 'ok' : report.criticalCount < 10 ? 'warning' : 'critical',
    });

    // KPI 3 : Taille cumulée top 10
    kpis.push({
      name: 'Taille cumulée top 10',
      value: this.formatSize(report.cumulativeSize.top10),
      unit: '',
      status: 'warning',
    });

    // KPI 4 : Objectif -25%
    const targetSize = Math.round(report.cumulativeSize.top10 * 0.75);
    kpis.push({
      name: 'Objectif taille top 10',
      value: this.formatSize(targetSize),
      unit: '(cible -25%)',
      threshold: { target: targetSize },
      status: 'warning',
    });

    return kpis;
  }

  /**
   * Formater une taille en bytes
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
