/**
 * Agent 4 : Graphe d'Imports & Cycles
 * 
 * Fonction : Détecter les cycles d'imports et le dead code
 * 
 * Périmètre : 
 * - Frontend Remix (app/)
 * - Backend NestJS (src/)
 * - Packages partagés (packages/)
 * 
 * Livrables :
 * - Graphe de dépendances complet
 * - Liste des cycles détectés (imports circulaires)
 * - Dead code (fichiers jamais importés)
 * - Visualisation Mermaid du graphe
 * - Recommandations de refactoring
 */

import { 
  IAgent, 
  AgentResult, 
  AgentStatus,
  KPI,
} from '../types';
import { Project, SourceFile } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

interface ImportGraphNode {
  filePath: string;
  relativePath: string;
  imports: string[];
  importedBy: string[];
  isEntryPoint: boolean;
  category: 'frontend' | 'backend' | 'package' | 'test';
}

interface ImportCycle {
  files: string[];
  length: number;
  severity: 'critical' | 'warning';
}

interface DeadCodeFile {
  filePath: string;
  relativePath: string;
  category: string;
  size: number;
  reason: string;
}

interface GraphReport {
  timestamp: Date;
  graph: Map<string, ImportGraphNode>;
  cycles: ImportCycle[];
  deadCode: DeadCodeFile[];
  stats: GraphStats;
  recommendations: GraphRecommendation[];
}

interface GraphStats {
  totalFiles: number;
  totalImports: number;
  avgImportsPerFile: number;
  maxImportsPerFile: number;
  cycleCount: number;
  deadCodeCount: number;
  entryPoints: number;
}

interface GraphRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedImpact: string;
}

export class GrapheImportsCyclesAgent implements IAgent {
  name = 'Graphe Imports & Cycles';
  type = 'graphe-imports' as const;
  description = 'Détecte les cycles d\'imports et le dead code';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private rootPath: string;
  private project!: Project;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Obtenir le statut actuel
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Exécuter l'analyse du graphe d'imports
   */
  async execute(): Promise<AgentResult> {
    console.log('\n🔍 Graphe Imports & Cycles - Analyse en cours...');
    const startTime = Date.now();
    this.status = 'running';

    try {
      // Initialiser ts-morph project
      console.log('   📦 Initialisation du projet TypeScript...');
      this.initializeProject();

      // Construire le graphe d'imports
      console.log('   🕸️  Construction du graphe d\'imports...');
      const graph = await this.buildImportGraph();

      // Détecter les cycles
      console.log('   🔄 Détection des cycles d\'imports...');
      const cycles = this.detectCycles(graph);

      // Identifier le dead code
      console.log('   🗑️  Identification du dead code...');
      const deadCode = this.findDeadCode(graph);

      // Calculer les statistiques
      const stats = this.calculateStats(graph, cycles, deadCode);

      // Générer des recommandations
      console.log('   💡 Génération des recommandations...');
      const recommendations = this.generateRecommendations(cycles, deadCode, stats);

      const report: GraphReport = {
        timestamp: new Date(),
        graph,
        cycles,
        deadCode,
        stats,
        recommendations,
      };

      // Sauvegarder les rapports
      await this.saveReports(report);

      // Calculer les KPIs
      const kpis = this.calculateKPIs(report);

      const duration = Date.now() - startTime;
      this.status = 'idle';

      console.log(`   ✅ Analyse terminée en ${duration}ms`);
      console.log(`   🔄 ${cycles.length} cycles détectés`);
      console.log(`   🗑️  ${deadCode.length} fichiers dead code`);

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
      const duration = Date.now() - startTime;
      this.status = 'error';

      console.error('   ❌ Erreur lors de l\'analyse:', error);

      return {
        agentName: this.name,
        agentType: this.type,
        status: 'error',
        timestamp: new Date(),
        duration,
        errors: [error instanceof Error ? error.message : String(error)],
        data: null,
        kpis: [],
      };
    }
  }

  /**
   * Initialiser le projet ts-morph
   */
  private initializeProject(): void {
    this.project = new Project({
      tsConfigFilePath: path.join(this.rootPath, 'frontend/tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });

    // Ajouter les fichiers source
    const patterns = [
      path.join(this.rootPath, 'frontend/app/**/*.{ts,tsx}'),
      path.join(this.rootPath, 'backend/src/**/*.ts'),
      path.join(this.rootPath, 'packages/*/src/**/*.ts'),
    ];

    patterns.forEach(pattern => {
      this.project.addSourceFilesAtPaths(pattern);
    });
  }

  /**
   * Construire le graphe d'imports
   */
  private async buildImportGraph(): Promise<Map<string, ImportGraphNode>> {
    const graph = new Map<string, ImportGraphNode>();
    const sourceFiles = this.project.getSourceFiles();

    // Phase 1: Créer tous les nœuds
    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      const relativePath = path.relative(this.rootPath, filePath);

      const node: ImportGraphNode = {
        filePath,
        relativePath,
        imports: [],
        importedBy: [],
        isEntryPoint: this.isEntryPoint(relativePath),
        category: this.categorizeFile(relativePath),
      };

      graph.set(filePath, node);
    }

    // Phase 2: Résoudre les imports
    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      const node = graph.get(filePath)!;

      const importDeclarations = sourceFile.getImportDeclarations();

      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        
        // Résoudre le chemin absolu
        const resolvedPath = this.resolveImportPath(filePath, moduleSpecifier);
        
        if (resolvedPath && graph.has(resolvedPath)) {
          node.imports.push(resolvedPath);
          graph.get(resolvedPath)!.importedBy.push(filePath);
        }
      }
    }

    return graph;
  }

  /**
   * Déterminer si un fichier est un point d'entrée
   */
  private isEntryPoint(relativePath: string): boolean {
    const entryPatterns = [
      /^frontend\/app\/root\.tsx$/,
      /^frontend\/app\/entry\.(client|server)\.tsx$/,
      /^frontend\/app\/routes\/.+\.(ts|tsx)$/,
      /^backend\/src\/main(\.server)?\.ts$/,
      /^backend\/src\/.*\.module\.ts$/,
    ];

    return entryPatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * Catégoriser un fichier
   */
  private categorizeFile(relativePath: string): 'frontend' | 'backend' | 'package' | 'test' {
    if (relativePath.includes('.test.') || relativePath.includes('.spec.')) {
      return 'test';
    }
    if (relativePath.startsWith('frontend/')) return 'frontend';
    if (relativePath.startsWith('backend/')) return 'backend';
    if (relativePath.startsWith('packages/')) return 'package';
    return 'frontend';
  }

  /**
   * Résoudre un chemin d'import
   */
  private resolveImportPath(fromFile: string, moduleSpecifier: string): string | null {
    // Imports relatifs
    if (moduleSpecifier.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      let resolved = path.resolve(fromDir, moduleSpecifier);

      // Essayer avec extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        const testPath = resolved + ext;
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }
    }

    // Imports absolus (depuis packages)
    if (moduleSpecifier.startsWith('@monorepo/') || moduleSpecifier.startsWith('~')) {
      // TODO: Résoudre via tsconfig paths
      return null;
    }

    // Imports npm (ignorer)
    return null;
  }

  /**
   * Détecter les cycles d'imports (algorithme DFS)
   */
  private detectCycles(graph: Map<string, ImportGraphNode>): ImportCycle[] {
    const cycles: ImportCycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (filePath: string): void => {
      visited.add(filePath);
      recursionStack.add(filePath);
      currentPath.push(filePath);

      const node = graph.get(filePath);
      if (!node) return;

      for (const importPath of node.imports) {
        if (!visited.has(importPath)) {
          dfs(importPath);
        } else if (recursionStack.has(importPath)) {
          // Cycle détecté!
          const cycleStart = currentPath.indexOf(importPath);
          const cycleFiles = currentPath.slice(cycleStart);
          
          // Éviter les doublons (même cycle différent point de départ)
          const cycleKey = [...cycleFiles].sort().join('|');
          if (!cycles.some(c => [...c.files].sort().join('|') === cycleKey)) {
            cycles.push({
              files: cycleFiles,
              length: cycleFiles.length,
              severity: cycleFiles.length <= 3 ? 'critical' : 'warning',
            });
          }
        }
      }

      currentPath.pop();
      recursionStack.delete(filePath);
    };

    // Parcourir tous les nœuds
    for (const filePath of graph.keys()) {
      if (!visited.has(filePath)) {
        dfs(filePath);
      }
    }

    return cycles;
  }

  /**
   * Identifier le dead code
   */
  private findDeadCode(graph: Map<string, ImportGraphNode>): DeadCodeFile[] {
    const deadCode: DeadCodeFile[] = [];

    for (const [filePath, node] of graph.entries()) {
      // Un fichier est dead code si :
      // 1. Il n'est jamais importé
      // 2. Ce n'est pas un point d'entrée
      // 3. Ce n'est pas un fichier de test
      
      if (
        node.importedBy.length === 0 &&
        !node.isEntryPoint &&
        node.category !== 'test'
      ) {
        const stats = fs.statSync(filePath);
        
        deadCode.push({
          filePath,
          relativePath: node.relativePath,
          category: node.category,
          size: stats.size,
          reason: 'Jamais importé, pas un point d\'entrée',
        });
      }
    }

    return deadCode.sort((a, b) => b.size - a.size);
  }

  /**
   * Calculer les statistiques
   */
  private calculateStats(
    graph: Map<string, ImportGraphNode>,
    cycles: ImportCycle[],
    deadCode: DeadCodeFile[]
  ): GraphStats {
    const nodes = Array.from(graph.values());
    const totalImports = nodes.reduce((sum, n) => sum + n.imports.length, 0);
    const importsPerFile = nodes.map(n => n.imports.length);
    const entryPoints = nodes.filter(n => n.isEntryPoint).length;

    return {
      totalFiles: graph.size,
      totalImports,
      avgImportsPerFile: totalImports / Math.max(graph.size, 1),
      maxImportsPerFile: Math.max(...importsPerFile, 0),
      cycleCount: cycles.length,
      deadCodeCount: deadCode.length,
      entryPoints,
    };
  }

  /**
   * Générer des recommandations
   */
  private generateRecommendations(
    cycles: ImportCycle[],
    deadCode: DeadCodeFile[],
    stats: GraphStats
  ): GraphRecommendation[] {
    const recommendations: GraphRecommendation[] = [];

    // Cycles critiques
    const criticalCycles = cycles.filter(c => c.severity === 'critical');
    if (criticalCycles.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Architecture',
        title: `Résoudre ${criticalCycles.length} cycles d'imports critiques`,
        description: 'Cycles courts (≤3 fichiers) créant des dépendances circulaires fortes',
        affectedFiles: criticalCycles.flatMap(c => c.files.map(f => path.relative(this.rootPath, f))),
        estimatedImpact: 'Amélioration maintenabilité et temps de build',
      });
    }

    // Dead code
    if (deadCode.length > 0) {
      const totalSize = deadCode.reduce((sum, d) => sum + d.size, 0);
      recommendations.push({
        priority: deadCode.length > 10 ? 'high' : 'medium',
        category: 'Nettoyage',
        title: `Supprimer ${deadCode.length} fichiers dead code`,
        description: `${deadCode.length} fichiers jamais importés (${(totalSize / 1024).toFixed(2)} KB)`,
        affectedFiles: deadCode.slice(0, 10).map(d => d.relativePath),
        estimatedImpact: `Réduction ${(totalSize / 1024 / 1024).toFixed(2)} MB du codebase`,
      });
    }

    // Fichiers avec trop d'imports
    if (stats.maxImportsPerFile > 20) {
      recommendations.push({
        priority: 'medium',
        category: 'Refactoring',
        title: 'Fichiers avec trop de dépendances',
        description: `Fichier max: ${stats.maxImportsPerFile} imports (seuil: 20)`,
        affectedFiles: [],
        estimatedImpact: 'Simplification architecture, meilleure séparation des responsabilités',
      });
    }

    return recommendations;
  }

  /**
   * Calculer les KPIs
   */
  private calculateKPIs(report: GraphReport): KPI[] {
    const kpis: KPI[] = [];

    // Cycles d'imports
    kpis.push({
      name: 'Cycles d\'imports',
      value: report.cycles.length,
      unit: 'cycles',
      status: report.cycles.length === 0 ? 'ok' : report.cycles.length <= 5 ? 'warning' : 'critical',
    });

    // Dead code
    kpis.push({
      name: 'Fichiers dead code',
      value: report.deadCode.length,
      unit: 'files',
      status: report.deadCode.length === 0 ? 'ok' : report.deadCode.length <= 10 ? 'warning' : 'critical',
    });

    // Complexité moyenne
    kpis.push({
      name: 'Imports moyens par fichier',
      value: Math.round(report.stats.avgImportsPerFile * 10) / 10,
      unit: 'imports',
      status: report.stats.avgImportsPerFile <= 10 ? 'ok' : 'warning',
    });

    return kpis;
  }

  /**
   * Sauvegarder les rapports
   */
  private async saveReports(report: GraphReport): Promise<void> {
    const reportsDir = path.join(this.rootPath, 'ai-agents/reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // JSON (sans le graphe complet, trop volumineux)
    const jsonPath = path.join(reportsDir, 'graphe-imports.json');
    const jsonData = {
      timestamp: report.timestamp,
      cycles: report.cycles.map(c => ({
        ...c,
        files: c.files.map(f => path.relative(this.rootPath, f)),
      })),
      deadCode: report.deadCode,
      stats: report.stats,
      recommendations: report.recommendations,
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

    // Markdown
    const mdPath = path.join(reportsDir, 'graphe-imports.md');
    const markdown = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, markdown);

    // Mermaid visualization pour cycles
    if (report.cycles.length > 0) {
      const mermaidPath = path.join(reportsDir, 'graphe-imports-cycles.mmd');
      const mermaid = this.generateMermaidDiagram(report.cycles);
      fs.writeFileSync(mermaidPath, mermaid);
      console.log(`   📊 Diagramme Mermaid: ${mermaidPath}`);
    }

    console.log(`   💾 Rapport JSON: ${jsonPath}`);
    console.log(`   💾 Rapport MD: ${mdPath}`);
  }

  /**
   * Générer le rapport Markdown
   */
  private generateMarkdownReport(report: GraphReport): string {
    let md = `# 🕸️ Rapport Graphe d'Imports & Cycles\n\n`;
    md += `**Date**: ${report.timestamp.toISOString()}\n\n`;
    md += `---\n\n`;

    // Statistiques
    md += `## 📊 Statistiques Globales\n\n`;
    md += `- **Fichiers analysés**: ${report.stats.totalFiles}\n`;
    md += `- **Total imports**: ${report.stats.totalImports}\n`;
    md += `- **Moyenne imports/fichier**: ${report.stats.avgImportsPerFile.toFixed(1)}\n`;
    md += `- **Max imports (1 fichier)**: ${report.stats.maxImportsPerFile}\n`;
    md += `- **Points d'entrée**: ${report.stats.entryPoints}\n`;
    md += `- **Cycles détectés**: ${report.stats.cycleCount}\n`;
    md += `- **Dead code**: ${report.stats.deadCodeCount} fichiers\n\n`;

    // Cycles
    if (report.cycles.length > 0) {
      md += `## 🔄 Cycles d'Imports Détectés (${report.cycles.length})\n\n`;
      
      const critical = report.cycles.filter(c => c.severity === 'critical');
      const warnings = report.cycles.filter(c => c.severity === 'warning');

      if (critical.length > 0) {
        md += `### 🔴 Critiques (${critical.length})\n\n`;
        critical.slice(0, 10).forEach((cycle, i) => {
          md += `#### ${i + 1}. Cycle de ${cycle.length} fichiers\n\n`;
          cycle.files.forEach((file, j) => {
            const rel = path.relative(this.rootPath, file);
            md += `${j + 1}. \`${rel}\`\n`;
          });
          md += `\n`;
        });
      }

      if (warnings.length > 0 && warnings.length <= 10) {
        md += `### 🟡 Warnings (${warnings.length})\n\n`;
        warnings.forEach((cycle, i) => {
          md += `${i + 1}. Cycle de ${cycle.length} fichiers: `;
          md += cycle.files.map(f => `\`${path.basename(f)}\``).join(' → ');
          md += `\n`;
        });
        md += `\n`;
      }
    } else {
      md += `## ✅ Aucun Cycle d'Import Détecté\n\n`;
      md += `Excellente architecture sans dépendances circulaires!\n\n`;
    }

    // Dead code
    if (report.deadCode.length > 0) {
      md += `## 🗑️ Dead Code (${report.deadCode.length} fichiers)\n\n`;
      const totalSize = report.deadCode.reduce((s, d) => s + d.size, 0);
      md += `**Taille totale**: ${(totalSize / 1024).toFixed(2)} KB\n\n`;
      
      md += `### Top 20 Fichiers Non Utilisés\n\n`;
      md += `| Fichier | Taille | Catégorie | Raison |\n`;
      md += `|---------|--------|-----------|--------|\n`;
      report.deadCode.slice(0, 20).forEach(file => {
        const name = path.basename(file.relativePath);
        const size = `${(file.size / 1024).toFixed(2)} KB`;
        md += `| \`${name}\` | ${size} | ${file.category} | ${file.reason} |\n`;
      });
      md += `\n`;
    }

    // Recommandations
    if (report.recommendations.length > 0) {
      md += `## 💡 Recommandations (${report.recommendations.length})\n\n`;
      report.recommendations.forEach((rec, i) => {
        const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        md += `### ${icon} ${i + 1}. ${rec.title}\n\n`;
        md += `- **Catégorie**: ${rec.category}\n`;
        md += `- **Priorité**: ${rec.priority}\n`;
        md += `- **Description**: ${rec.description}\n`;
        md += `- **Impact estimé**: ${rec.estimatedImpact}\n`;
        if (rec.affectedFiles.length > 0 && rec.affectedFiles.length <= 5) {
          md += `- **Fichiers concernés**:\n`;
          rec.affectedFiles.forEach(f => md += `  - \`${f}\`\n`);
        } else if (rec.affectedFiles.length > 5) {
          md += `- **Fichiers concernés**: ${rec.affectedFiles.length} fichiers\n`;
        }
        md += `\n`;
      });
    }

    md += `---\n\n`;
    md += `*Rapport généré par Agent 4: Graphe Imports & Cycles*\n`;

    return md;
  }

  /**
   * Générer un diagramme Mermaid des cycles
   */
  private generateMermaidDiagram(cycles: ImportCycle[]): string {
    let mermaid = `graph TD\n\n`;
    mermaid += `%% Cycles d'imports détectés\n\n`;

    cycles.slice(0, 5).forEach((cycle, cycleIndex) => {
      mermaid += `%% Cycle ${cycleIndex + 1}\n`;
      
      cycle.files.forEach((file, i) => {
        const nextFile = cycle.files[(i + 1) % cycle.files.length];
        const nodeId1 = `C${cycleIndex}_N${i}`;
        const nodeId2 = `C${cycleIndex}_N${(i + 1) % cycle.files.length}`;
        const label1 = path.basename(file, path.extname(file));
        const label2 = path.basename(nextFile, path.extname(nextFile));
        
        if (i === 0) {
          mermaid += `  ${nodeId1}["${label1}"]\n`;
        }
        if (i === cycle.files.length - 1) {
          mermaid += `  ${nodeId2}["${label2}"]\n`;
        }
        
        mermaid += `  ${nodeId1} --> ${nodeId2}\n`;
      });
      
      mermaid += `\n`;
    });

    return mermaid;
  }
}
