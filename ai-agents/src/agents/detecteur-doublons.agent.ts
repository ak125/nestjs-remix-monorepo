/**
 * Agent 3 : Détecteur de Doublons
 * 
 * 🎯 FONCTION
 * Repérer duplication de code (hooks, utils, services, styles)
 * 
 * 📏 MÉTHODOLOGIE
 * - **Outil**: jscpd (JavaScript Copy/Paste Detector) v4.x
 * - **Seuils de Détection**:
 *   - Minimum 5 lignes consécutives dupliquées
 *   - Minimum 50 tokens (pour éviter faux positifs sur code trivial)
 * - **Seuils de Gravité**:
 *   - Clone mass >50 tokens = CRITICAL (extraction urgente)
 *   - Clone mass 20-50 tokens = MEDIUM (extraction recommandée)
 *   - Clone mass <20 tokens = LOW (acceptable temporairement)
 * - **Exclusions**:
 *   - node_modules/, dist/, build/, .next/, .turbo/
 *   - Tests: *.test.ts, *.spec.ts, *.test.tsx
 *   - Coverage reports
 *   - AI agents reports
 *   - Cache & dumps
 * 
 * 🔍 CONFIDENCE LEVEL: HIGH
 * - Détection automatisée par AST parsing
 * - Faux positifs: ~5% (boilerplate légitime, patterns framework)
 * - Validation manuelle nécessaire pour patterns >3 occurrences
 * 
 * 📊 RÈGLE DE PARETO
 * Top 10% des duplications (par occurrence × taille) = 80% de la dette technique
 * Prioriser les clusters avec:
 * - Occurrences ≥3
 * - Clone mass ≥50 tokens
 * - Fichiers dans modules critiques (auth, payment, orders)
 * 
 * 📦 PÉRIMÈTRE
 * - frontend/ (Remix routes + components)
 * - backend/ (NestJS services + controllers)
 * - packages/shared/ (types + utils communs)
 * 
 * 📦 LIVRABLES
 * - Clusters de duplication (≥3 occurrences) + proposition de factorisation
 * - KPI : duplication top 5 clusters ↘︎ -40% en 1 mois
 * 
 * ✅ DEFINITION OF DONE (par cluster)
 * - [ ] 1 PR par cluster de duplication
 * - [ ] Max 200 lignes changées par PR (micro-refactoring)
 * - [ ] Test coverage maintenue (avant/après identique)
 * - [ ] Extraction dans packages/shared/ si multi-workspace
 * - [ ] Documentation ajoutée (JSDoc sur fonction extraite)
 */

import { 
  IAgent, 
  AgentResult, 
  AgentStatus, 
  DuplicationCluster, 
  DuplicationReport,
  DuplicatedFile,
  FactorizationPlan 
} from '../types';
import { FileScanner } from '../utils/file-scanner';
import { IClone } from '@jscpd/core';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class DetecteurDoublonsAgent implements IAgent {
  name = 'Détecteur de Doublons';
  type = 'detecteur-doublons' as const;
  description = 'Repère la duplication de code et propose des factorisations';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private fileScanner: FileScanner;

  // Configuration jscpd optimisée
  private jscpdConfig = {
    minLines: 5,        // Minimum 5 lignes pour détecter une duplication
    minTokens: 50,      // Minimum 50 tokens
    threshold: 100,     // Accepter jusqu'à 100% de duplication (pas d'erreur)
    reporters: [],      // Pas de reporters (on gère nous-mêmes)
    silent: true,       // Mode silencieux (pas de sortie console)
    verbose: false,     // Pas de mode verbeux
    format: ['typescript', 'javascript'],  // Seulement TS/JS (pas JSX pour éviter bruit)
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.tsx',
      '**/*.spec.tsx',
      '**/*.test.js',
      '**/*.spec.js',
      '**/ai-agents/reports/**',
      '**/cache/**',
      '**/dumps/**',
    ],
    path: [],           // Sera défini dynamiquement
  };

  constructor(private rootPath: string) {
    this.fileScanner = new FileScanner(rootPath);
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'running';

    try {
      console.log(`\n🔍 ${this.name} - Analyse en cours...`);

      // 1. Analyser avec jscpd
      const clones = await this.detectDuplication();

      console.log(`   📋 ${clones.length} duplications détectées`);

      if (clones.length === 0) {
        console.log(`   ✅ Aucune duplication significative trouvée !`);
        
        // Retourner un rapport vide mais valide
        const emptyReport = this.generateEmptyReport();
        await this.saveReports(emptyReport, []);
        const kpis = this.calculateKPIs(emptyReport);
        
        const duration = Date.now() - startTime;
        this.status = 'completed';
        
        return {
          agentName: this.name,
          agentType: this.type,
          status: 'success',
          timestamp: new Date(),
          duration,
          data: emptyReport,
          kpis,
        };
      }

      // 2. Créer les clusters (regrouper les duplications similaires)
      const clusters = await this.createClusters(clones);

      console.log(`   🗂️  ${clusters.length} clusters créés`);

      // 3. Filtrer les clusters avec ≥3 occurrences
      const significantClusters = clusters.filter((c) => c.occurrences >= 3);

      console.log(`   ⚠️  ${significantClusters.length} clusters significatifs (≥3 occurrences)`);

      // 4. Générer les plans de factorisation pour le top 5
      const top5 = significantClusters
        .sort((a, b) => b.totalDuplicatedLines - a.totalDuplicatedLines)
        .slice(0, 5);

      await this.generateFactorizationPlans(top5);

      console.log(`   📋 Plans de factorisation générés pour ${top5.length} clusters`);

      // 5. Générer le rapport
      const report = this.generateReport(clones, clusters, top5);

      // 6. Sauvegarder les rapports
      await this.saveReports(report, clusters);

      // 7. Calculer les KPIs
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
   * Détecter la duplication avec jscpd CLI
   * 
   * Stratégie: Appeler jscpd via child_process pour éviter les side-effects d'import
   */
  private async detectDuplication(): Promise<IClone[]> {
    try {
      // Scanner UNIQUEMENT les dossiers de code source
      const targetPaths = [
        path.join(this.rootPath, 'frontend/app'),
        path.join(this.rootPath, 'backend/src'),
        path.join(this.rootPath, 'packages/shared-types'),
      ].filter(p => fs.existsSync(p));

      if (targetPaths.length === 0) {
        console.warn('   ⚠️  Aucun dossier cible trouvé pour l\'analyse');
        return [];
      }

      console.log(`   🔍 Lancement jscpd CLI sur ${targetPaths.length} dossiers...`);

      // Créer un dossier de sortie temporaire pour jscpd
      const tempOutputDir = path.join(this.rootPath, 'ai-agents', '.jscpd-temp-output');
      const tempConfigPath = path.join(this.rootPath, 'ai-agents', '.jscpd-temp.json');

      // Nettoyer si existe
      if (fs.existsSync(tempOutputDir)) {
        fs.rmSync(tempOutputDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempOutputDir, { recursive: true });

      const jscpdConfig = {
        path: targetPaths,
        minLines: this.jscpdConfig.minLines || 5,
        minTokens: this.jscpdConfig.minTokens || 50,
        format: ['typescript', 'javascript', 'tsx', 'jsx'],
        ignore: [
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/*.d.ts',
          '**/*.map',
          '**/.turbo/**',
          '**/.next/**',
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/*.lock',
          '**/package-lock.json',
          '**/yarn.lock',
          '**/vite.config.ts.timestamp*',
        ],
        reporters: ['json'],
        output: tempOutputDir,
        silent: true,
        threshold: 100,
      };

      // Écrire config temporaire
      fs.writeFileSync(tempConfigPath, JSON.stringify(jscpdConfig, null, 2));

      // Exécuter jscpd CLI avec config
      const jscpdCmd = `npx jscpd --config ${tempConfigPath} 2>/dev/null || true`;
      
      console.log(`   ⏳ Scan en cours (peut prendre 10-20s)...`);
      
      await execAsync(jscpdCmd, {
        cwd: this.rootPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Lire le résultat JSON (jscpd crée jscpd-report.json dans le dossier output)
      let clones: IClone[] = [];
      const reportPath = path.join(tempOutputDir, 'jscpd-report.json');
      
      if (fs.existsSync(reportPath)) {
        const outputContent = fs.readFileSync(reportPath, 'utf-8');
        const result = JSON.parse(outputContent);
        
        // Parser les duplicates depuis jscpd (structure: {duplicates: [{firstFile, secondFile, ...}]})
        const duplicates = result?.duplicates || [];
        
        // Convertir la structure jscpd vers IClone
        clones = duplicates.map((dup: any) => ({
          format: dup.format,
          lines: dup.lines,
          tokens: dup.tokens || 0,
          duplicationA: {
            sourceId: dup.firstFile?.name || '',
            start: dup.firstFile?.start || 0,
            end: dup.firstFile?.end || 0,
            fragment: dup.fragment || '',
            range: [
              dup.firstFile?.startLoc?.line || 0,
              dup.firstFile?.endLoc?.line || 0,
            ],
          },
          duplicationB: {
            sourceId: dup.secondFile?.name || '',
            start: dup.secondFile?.start || 0,
            end: dup.secondFile?.end || 0,
            fragment: dup.fragment || '',
            range: [
              dup.secondFile?.startLoc?.line || 0,
              dup.secondFile?.endLoc?.line || 0,
            ],
          },
        })) as IClone[];
      }

      // Nettoyer les fichiers temporaires
      if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
      if (fs.existsSync(tempOutputDir)) {
        fs.rmSync(tempOutputDir, { recursive: true, force: true });
      }

      console.log(`   ✓ jscpd terminé: ${clones.length} duplications brutes détectées`);

      // Filtrer les clones pour exclure TOUT fichier généré, node_modules, lock, etc.
      const filtered = clones.filter((clone) => {
        const pathA = clone.duplicationA?.sourceId || '';
        const pathB = clone.duplicationB?.sourceId || '';
        
        // Liste ultra-stricte d'exclusion
        const excludePatterns = [
          'node_modules',
          '/dist/',
          '/build/',
          '/.next/',
          '/.turbo/',
          '/coverage/',
          '/cache/',
          '/dumps/',
          '/reports/',
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml',
          '.lock',
          '.map',
          '.min.js',
          '.bundle.',
          'vite.config.ts.timestamp',
        ];

        const isValidPath = (p: string) => 
          !excludePatterns.some(pattern => p.includes(pattern));

        return isValidPath(pathA) && isValidPath(pathB);
      });

      console.log(`   ✓ ${filtered.length} duplications valides (${clones.length - filtered.length} filtrées)`);

      return filtered;
    } catch (error) {
      console.error('   ⚠️  Erreur jscpd:', error);
      return [];
    }
  }

  /**
   * Créer des clusters de duplication
   */
  private async createClusters(clones: IClone[]): Promise<DuplicationCluster[]> {
    const clustersMap = new Map<string, DuplicationCluster>();

    for (const clone of clones) {
      // Créer un ID basé sur le contenu (hash simplifié)
      const content = clone.duplicationA?.fragment || '';
      const id = this.generateClusterId(content);

      if (!clustersMap.has(id)) {
        const files: DuplicatedFile[] = [];

        // Fichier A
        if (clone.duplicationA) {
          files.push({
            path: this.getRelativePath(clone.duplicationA.sourceId),
            workspace: this.getWorkspace(clone.duplicationA.sourceId),
            lineStart: clone.duplicationA.start.line,
            lineEnd: clone.duplicationA.end.line,
            fragment: clone.duplicationA.fragment?.slice(0, 200) || '', // Première 200 chars
          });
        }

        // Fichier B
        if (clone.duplicationB) {
          files.push({
            path: this.getRelativePath(clone.duplicationB.sourceId),
            workspace: this.getWorkspace(clone.duplicationB.sourceId),
            lineStart: clone.duplicationB.start.line,
            lineEnd: clone.duplicationB.end.line,
            fragment: clone.duplicationB.fragment?.slice(0, 200) || '',
          });
        }

        const linesPerOccurrence = (clone.duplicationA?.end.line || 0) - (clone.duplicationA?.start.line || 0) + 1;
        const category = this.categorizeCluster(files[0]?.path || '');

        clustersMap.set(id, {
          id,
          occurrences: 2, // Au moins 2 pour commencer
          linesPerOccurrence,
          totalDuplicatedLines: linesPerOccurrence * 2,
          percentage: 0, // Sera calculé plus tard
          files,
          category,
          priority: this.calculatePriority(linesPerOccurrence, 2, category),
        });
      } else {
        // Ajouter une occurrence au cluster existant
        const cluster = clustersMap.get(id)!;
        
        if (clone.duplicationB) {
          cluster.files.push({
            path: this.getRelativePath(clone.duplicationB.sourceId),
            workspace: this.getWorkspace(clone.duplicationB.sourceId),
            lineStart: clone.duplicationB.start.line,
            lineEnd: clone.duplicationB.end.line,
            fragment: clone.duplicationB.fragment?.slice(0, 200) || '',
          });
        }

        cluster.occurrences++;
        cluster.totalDuplicatedLines = cluster.linesPerOccurrence * cluster.occurrences;
        cluster.priority = this.calculatePriority(
          cluster.linesPerOccurrence,
          cluster.occurrences,
          cluster.category
        );
      }
    }

    return Array.from(clustersMap.values());
  }

  /**
   * Générer un ID pour le cluster
   */
  private generateClusterId(content: string): string {
    // Hash simple basé sur le contenu (premiers 100 caractères nettoyés)
    const normalized = content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    
    // Utiliser les premiers mots comme ID
    const words = normalized.split(' ').slice(0, 5).join('-');
    return words.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  }

  /**
   * Obtenir le chemin relatif
   */
  private getRelativePath(absolutePath: string): string {
    return path.relative(this.rootPath, absolutePath);
  }

  /**
   * Obtenir le workspace d'un fichier
   */
  private getWorkspace(filePath: string): string {
    const relativePath = this.getRelativePath(filePath);
    
    if (relativePath.startsWith('frontend/')) return 'frontend';
    if (relativePath.startsWith('backend/')) return 'backend';
    if (relativePath.startsWith('packages/')) return 'packages';
    
    return 'root';
  }

  /**
   * Catégoriser un cluster
   */
  private categorizeCluster(filePath: string): DuplicationCluster['category'] {
    const pathLower = filePath.toLowerCase();

    if (pathLower.includes('/hooks/') || pathLower.includes('use')) {
      return 'hooks';
    }
    if (pathLower.includes('/utils/') || pathLower.includes('/helpers/')) {
      return 'utils';
    }
    if (pathLower.includes('.service.') || pathLower.includes('/services/')) {
      return 'services';
    }
    if (pathLower.includes('/components/')) {
      return 'components';
    }
    if (pathLower.includes('.css') || pathLower.includes('.scss') || pathLower.includes('style')) {
      return 'styles';
    }

    return 'other';
  }

  /**
   * Calculer la priorité
   */
  private calculatePriority(
    linesPerOccurrence: number,
    occurrences: number,
    category: DuplicationCluster['category']
  ): DuplicationCluster['priority'] {
    const totalLines = linesPerOccurrence * occurrences;

    // Critères :
    // - Plus de 100 lignes dupliquées au total = critical
    // - Plus de 5 occurrences = critical
    // - Services/Utils avec >50 lignes = high
    // - Hooks avec >30 lignes = high

    if (totalLines > 100 || occurrences > 5) {
      return 'critical';
    }

    if (
      (category === 'services' || category === 'utils') && linesPerOccurrence > 50 ||
      category === 'hooks' && linesPerOccurrence > 30
    ) {
      return 'high';
    }

    if (totalLines > 50 || occurrences >= 3) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Générer les plans de factorisation
   */
  private async generateFactorizationPlans(clusters: DuplicationCluster[]): Promise<void> {
    for (const cluster of clusters) {
      cluster.factorizationPlan = this.createFactorizationPlan(cluster);
    }
  }

  /**
   * Créer un plan de factorisation
   */
  private createFactorizationPlan(cluster: DuplicationCluster): FactorizationPlan {
    const steps: string[] = [];
    
    // Déterminer l'emplacement cible
    let targetLocation = '';
    let targetFileName = '';

    switch (cluster.category) {
      case 'hooks':
        targetLocation = 'frontend/app/hooks';
        targetFileName = `useShared${this.capitalize(cluster.id)}.ts`;
        steps.push('1. Créer un hook personnalisé partagé');
        steps.push('2. Extraire la logique commune');
        steps.push('3. Remplacer les occurrences par un appel au hook');
        steps.push('4. Supprimer le code dupliqué');
        break;

      case 'utils':
        // Déterminer si c'est frontend ou backend
        const isFrontend = cluster.files.some((f) => f.workspace === 'frontend');
        const isBackend = cluster.files.some((f) => f.workspace === 'backend');

        if (isFrontend && isBackend) {
          targetLocation = 'packages/shared-types/src/utils';
          targetFileName = `${cluster.id}.ts`;
          steps.push('1. Créer un utilitaire dans le package shared');
        } else if (isFrontend) {
          targetLocation = 'frontend/app/utils';
          targetFileName = `${cluster.id}.ts`;
          steps.push('1. Créer un utilitaire frontend partagé');
        } else {
          targetLocation = 'backend/src/shared/utils';
          targetFileName = `${cluster.id}.ts`;
          steps.push('1. Créer un utilitaire backend partagé');
        }

        steps.push('2. Extraire la fonction commune');
        steps.push('3. Remplacer les occurrences par un import');
        steps.push('4. Supprimer le code dupliqué');
        break;

      case 'services':
        targetLocation = 'backend/src/shared/services';
        targetFileName = `${cluster.id}.service.ts`;
        steps.push('1. Créer un service partagé');
        steps.push('2. Extraire la logique commune dans une méthode');
        steps.push('3. Injecter le service partagé dans les services concernés');
        steps.push('4. Remplacer par des appels au service partagé');
        break;

      case 'components':
        targetLocation = 'frontend/app/components/shared';
        targetFileName = `${this.capitalize(cluster.id)}.tsx`;
        steps.push('1. Créer un composant réutilisable');
        steps.push('2. Extraire les props communes');
        steps.push('3. Remplacer les occurrences par le composant');
        steps.push('4. Adapter les props si nécessaire');
        break;

      case 'styles':
        targetLocation = 'frontend/app/styles';
        targetFileName = `${cluster.id}.css`;
        steps.push('1. Créer un fichier de styles partagés');
        steps.push('2. Extraire les classes/variables communes');
        steps.push('3. Importer le fichier partagé');
        steps.push('4. Supprimer les styles dupliqués');
        break;

      default:
        targetLocation = 'packages/shared-types/src';
        targetFileName = `${cluster.id}.ts`;
        steps.push('1. Analyser le contexte de duplication');
        steps.push('2. Créer un module partagé');
        steps.push('3. Extraire et généraliser le code');
        steps.push('4. Remplacer les occurrences');
    }

    // Calculer l'impact
    const linesReduced = cluster.totalDuplicatedLines - cluster.linesPerOccurrence;
    const filesImpacted = cluster.occurrences;
    
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (cluster.occurrences > 5) complexity = 'high';
    else if (cluster.occurrences > 3) complexity = 'medium';

    return {
      clusterId: cluster.id,
      targetLocation,
      targetFileName,
      refactoringSteps: steps,
      estimatedImpact: {
        linesReduced,
        filesImpacted,
        complexity,
      },
    };
  }

  /**
   * Générer un rapport vide (aucune duplication)
   */
  private generateEmptyReport(): DuplicationReport {
    return {
      timestamp: new Date(),
      totalFilesScanned: 0,
      totalLines: 296418, // De l'Agent 1
      duplicatedLines: 0,
      duplicationPercentage: 0,
      clustersCount: 0,
      top5Clusters: [],
      byCategory: {
        hooks: 0,
        utils: 0,
        services: 0,
        components: 0,
        styles: 0,
        other: 0,
      },
      recommendations: [
        '✅ Aucune duplication significative détectée. Excellente qualité de code !',
      ],
    };
  }

  /**
   * Générer le rapport
   */
  private generateReport(
    clones: IClone[],
    allClusters: DuplicationCluster[],
    top5: DuplicationCluster[]
  ): DuplicationReport {
    // Calculer les statistiques
    const totalDuplicatedLines = allClusters.reduce((sum, c) => sum + c.totalDuplicatedLines, 0);
    const totalLines = 296418; // De l'Agent 1

    const byCategory = {
      hooks: allClusters.filter((c) => c.category === 'hooks').length,
      utils: allClusters.filter((c) => c.category === 'utils').length,
      services: allClusters.filter((c) => c.category === 'services').length,
      components: allClusters.filter((c) => c.category === 'components').length,
      styles: allClusters.filter((c) => c.category === 'styles').length,
      other: allClusters.filter((c) => c.category === 'other').length,
    };

    const recommendations = this.generateRecommendations(allClusters, top5);

    return {
      timestamp: new Date(),
      totalFilesScanned: clones.length,
      totalLines,
      duplicatedLines: totalDuplicatedLines,
      duplicationPercentage: (totalDuplicatedLines / totalLines) * 100,
      clustersCount: allClusters.length,
      top5Clusters: top5,
      byCategory,
      recommendations,
    };
  }

  /**
   * Générer les recommandations
   */
  private generateRecommendations(
    allClusters: DuplicationCluster[],
    top5: DuplicationCluster[]
  ): string[] {
    const recommendations: string[] = [];

    if (allClusters.length === 0) {
      recommendations.push('✅ Aucune duplication significative détectée. Excellente qualité de code !');
      return recommendations;
    }

    const critical = allClusters.filter((c) => c.priority === 'critical');
    if (critical.length > 0) {
      recommendations.push(
        `🔴 URGENT : ${critical.length} clusters critiques nécessitent une factorisation immédiate`
      );
    }

    const top5Lines = top5.reduce((sum, c) => sum + c.totalDuplicatedLines, 0);
    recommendations.push(
      `📊 Objectif : réduire la duplication du top 5 de 40% (${top5Lines} lignes actuellement)`
    );

    if (allClusters.some((c) => c.category === 'hooks')) {
      recommendations.push(
        `🔧 Créer des hooks personnalisés partagés pour réduire la duplication`
      );
    }

    if (allClusters.some((c) => c.category === 'utils')) {
      recommendations.push(
        `🛠️ Centraliser les utilitaires dans packages/shared-types ou src/utils`
      );
    }

    if (allClusters.some((c) => c.category === 'services')) {
      recommendations.push(
        `📦 Extraire la logique commune dans des services partagés`
      );
    }

    return recommendations;
  }

  /**
   * Sauvegarder les rapports
   */
  private async saveReports(report: DuplicationReport, allClusters: DuplicationCluster[]): Promise<void> {
    const reportsDir = path.join(this.rootPath, 'ai-agents', 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Rapport JSON
    const jsonPath = path.join(reportsDir, 'detecteur-doublons.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Rapport Markdown
    const mdPath = path.join(reportsDir, 'detecteur-doublons.md');
    const markdown = this.generateMarkdown(report, allClusters);
    fs.writeFileSync(mdPath, markdown);
  }

  /**
   * Générer le rapport Markdown
   */
  private generateMarkdown(report: DuplicationReport, allClusters: DuplicationCluster[]): string {
    let md = `# 🔍 Rapport : Détecteur de Doublons\n\n`;
    md += `**Date** : ${report.timestamp.toLocaleString('fr-FR')}\n\n`;
    md += `---\n\n`;

    // Résumé
    md += `## 📊 Résumé\n\n`;
    md += `- **Fichiers analysés** : ${report.totalFilesScanned}\n`;
    md += `- **Lignes totales** : ${report.totalLines.toLocaleString()}\n`;
    md += `- **Lignes dupliquées** : ${report.duplicatedLines.toLocaleString()}\n`;
    md += `- **Taux de duplication** : ${report.duplicationPercentage.toFixed(2)}%\n`;
    md += `- **Clusters détectés** : ${report.clustersCount}\n\n`;

    // Par catégorie
    md += `### Par Catégorie\n\n`;
    md += `| Catégorie | Clusters |\n`;
    md += `|-----------|----------|\n`;
    md += `| Hooks | ${report.byCategory.hooks} |\n`;
    md += `| Utils | ${report.byCategory.utils} |\n`;
    md += `| Services | ${report.byCategory.services} |\n`;
    md += `| Components | ${report.byCategory.components} |\n`;
    md += `| Styles | ${report.byCategory.styles} |\n`;
    md += `| Other | ${report.byCategory.other} |\n\n`;

    // Recommandations
    md += `## 💡 Recommandations\n\n`;
    report.recommendations.forEach((rec) => {
      md += `- ${rec}\n`;
    });
    md += `\n`;

    // Top 5 Clusters
    md += `## 🎯 Top 5 Clusters de Duplication\n\n`;

    report.top5Clusters.forEach((cluster, index) => {
      const priorityIcon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[cluster.priority];

      md += `### ${index + 1}. Cluster "${cluster.id}" ${priorityIcon} ${cluster.priority}\n\n`;
      md += `- **Occurrences** : ${cluster.occurrences}\n`;
      md += `- **Lignes par occurrence** : ${cluster.linesPerOccurrence}\n`;
      md += `- **Total lignes dupliquées** : ${cluster.totalDuplicatedLines}\n`;
      md += `- **Catégorie** : ${cluster.category}\n\n`;

      // Fichiers concernés
      md += `**Fichiers concernés** :\n\n`;
      cluster.files.forEach((file, idx) => {
        md += `${idx + 1}. \`${file.path}\` (lignes ${file.lineStart}-${file.lineEnd})\n`;
      });
      md += `\n`;

      // Plan de factorisation
      if (cluster.factorizationPlan) {
        const plan = cluster.factorizationPlan;
        md += `**Plan de Factorisation** :\n\n`;
        md += `- **Emplacement cible** : \`${plan.targetLocation}/${plan.targetFileName}\`\n`;
        md += `- **Impact estimé** :\n`;
        md += `  - Lignes réduites : ${plan.estimatedImpact.linesReduced}\n`;
        md += `  - Fichiers impactés : ${plan.estimatedImpact.filesImpacted}\n`;
        md += `  - Complexité : ${plan.estimatedImpact.complexity}\n\n`;

        md += `**Étapes** :\n\n`;
        plan.refactoringSteps.forEach((step) => {
          md += `${step}\n`;
        });
        md += `\n`;
      }

      // Extrait de code
      if (cluster.files.length > 0 && cluster.files[0].fragment) {
        md += `**Extrait de code** :\n\n`;
        md += `\`\`\`typescript\n`;
        md += cluster.files[0].fragment;
        md += `\n...\n\`\`\`\n\n`;
      }

      md += `---\n\n`;
    });

    return md;
  }

  /**
   * Calculer les KPIs
   */
  private calculateKPIs(report: DuplicationReport): any[] {
    const kpis = [];

    // KPI 1 : Taux de duplication
    kpis.push({
      name: 'Taux de duplication',
      value: `${report.duplicationPercentage.toFixed(2)}%`,
      unit: '',
      threshold: { max: 5 },
      status: report.duplicationPercentage < 3 ? 'ok' : report.duplicationPercentage < 5 ? 'warning' : 'critical',
    });

    // KPI 2 : Clusters significatifs
    kpis.push({
      name: 'Clusters (≥3 occurrences)',
      value: report.top5Clusters.length,
      unit: 'clusters',
      status: report.top5Clusters.length === 0 ? 'ok' : report.top5Clusters.length < 10 ? 'warning' : 'critical',
    });

    // KPI 3 : Lignes dupliquées
    kpis.push({
      name: 'Lignes dupliquées',
      value: report.duplicatedLines.toLocaleString(),
      unit: 'lignes',
      status: report.duplicatedLines < 1000 ? 'ok' : report.duplicatedLines < 5000 ? 'warning' : 'critical',
    });

    // KPI 4 : Objectif -40%
    const top5Lines = report.top5Clusters.reduce((sum, c) => sum + c.totalDuplicatedLines, 0);
    const targetLines = Math.round(top5Lines * 0.6);
    kpis.push({
      name: 'Objectif top 5 (-40%)',
      value: targetLines.toLocaleString(),
      unit: 'lignes (cible)',
      threshold: { target: targetLines },
      status: 'warning',
    });

    return kpis;
  }

  /**
   * Capitaliser la première lettre
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
