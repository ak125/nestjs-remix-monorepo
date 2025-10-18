/**
 * Agent 5 : Upgrade NestJS Analyzer
 * 
 * Fonction : Analyser la compatibilité NestJS 10 → 11 et générer un plan de migration
 * 
 * Périmètre : 
 * - Backend NestJS (src/)
 * - Dependencies package.json
 * - Configuration nest-cli.json
 * 
 * Livrables :
 * - Version actuelle détectée
 * - Breaking changes identifiés
 * - Liste des fichiers à modifier
 * - Plan de migration étape par étape
 * - Scripts de migration automatisés
 */

import { 
  IAgent, 
  AgentResult, 
  AgentStatus,
  KPI,
} from '../types';
import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface NestJSVersion {
  current: string;
  target: string;
  major: number;
  minor: number;
  patch: number;
}

interface BreakingChange {
  id: string;
  category: 'deprecation' | 'removal' | 'behavior-change' | 'api-change';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedFiles: string[];
  detectionPattern: string;
  migrationSteps: string[];
  automatable: boolean;
}

interface DependencyAnalysis {
  package: string;
  currentVersion: string;
  requiredVersion: string;
  compatible: boolean;
  needsUpdate: boolean;
  breakingChanges: string[];
}

interface MigrationPlan {
  timestamp: Date;
  version: NestJSVersion;
  breakingChanges: BreakingChange[];
  dependencies: DependencyAnalysis[];
  migrationSteps: MigrationStep[];
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  automationCoverage: number; // % de migration automatisable
}

interface MigrationStep {
  order: number;
  title: string;
  description: string;
  commands: string[];
  manualActions: string[];
  estimatedTime: string;
  rollbackPlan: string;
}

interface UpgradeReport {
  timestamp: Date;
  version: NestJSVersion;
  plan: MigrationPlan;
  stats: UpgradeStats;
  recommendations: UpgradeRecommendation[];
}

interface UpgradeStats {
  totalFiles: number;
  affectedFiles: number;
  breakingChanges: number;
  deprecations: number;
  dependenciesToUpdate: number;
  estimatedEffort: string;
}

interface UpgradeRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  effort: string;
}

export class UpgradeNestJSAgent implements IAgent {
  name = 'Upgrade NestJS';
  type = 'upgrade-nestjs' as const;
  description = 'Analyse la compatibilité NestJS 10→11 et génère un plan de migration';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private rootPath: string;
  private backendPath: string;
  private project!: Project;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.backendPath = path.join(rootPath, 'backend');
  }

  /**
   * Obtenir le statut actuel
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Exécuter l'analyse d'upgrade
   */
  async execute(): Promise<AgentResult> {
    console.log('\n🔍 Upgrade NestJS - Analyse en cours...');
    const startTime = Date.now();
    this.status = 'running';

    try {
      // Détecter version actuelle
      console.log('   📦 Détection version NestJS...');
      const version = this.detectNestJSVersion();
      console.log(`   ✓ Version actuelle: ${version.current} → cible: ${version.target}`);

      // Initialiser projet TypeScript
      console.log('   📂 Initialisation projet TypeScript...');
      this.initializeProject();

      // Analyser les breaking changes
      console.log('   🔍 Analyse des breaking changes...');
      const breakingChanges = await this.analyzeBreakingChanges();
      console.log(`   ✓ ${breakingChanges.length} breaking changes détectés`);

      // Analyser les dépendances
      console.log('   📚 Analyse des dépendances...');
      const dependencies = this.analyzeDependencies();
      console.log(`   ✓ ${dependencies.filter(d => d.needsUpdate).length} dépendances à mettre à jour`);

      // Générer le plan de migration
      console.log('   📋 Génération du plan de migration...');
      const plan = this.generateMigrationPlan(version, breakingChanges, dependencies);

      // Calculer les statistiques
      const stats = this.calculateStats(breakingChanges, dependencies);

      // Générer des recommandations
      console.log('   💡 Génération des recommandations...');
      const recommendations = this.generateRecommendations(plan, stats);

      const report: UpgradeReport = {
        timestamp: new Date(),
        version,
        plan,
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
      console.log(`   🔴 ${breakingChanges.filter(bc => bc.severity === 'critical').length} breaking changes critiques`);
      console.log(`   📦 ${dependencies.filter(d => d.needsUpdate).length} dépendances à mettre à jour`);

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
   * Détecter la version actuelle de NestJS
   */
  private detectNestJSVersion(): NestJSVersion {
    const packageJsonPath = path.join(this.backendPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const currentVersion = packageJson.dependencies['@nestjs/core'] || 
                          packageJson.dependencies['@nestjs/common'] ||
                          '10.0.0';

    // Extraire version numérique
    const versionMatch = currentVersion.match(/(\d+)\.(\d+)\.(\d+)/);
    const major = versionMatch ? parseInt(versionMatch[1]) : 10;
    const minor = versionMatch ? parseInt(versionMatch[2]) : 0;
    const patch = versionMatch ? parseInt(versionMatch[3]) : 0;

    return {
      current: currentVersion.replace(/[\^~]/, ''),
      target: '11.0.0',
      major,
      minor,
      patch,
    };
  }

  /**
   * Initialiser le projet ts-morph
   */
  private initializeProject(): void {
    const tsconfigPath = path.join(this.backendPath, 'tsconfig.json');
    
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: true,
    });

    // Ajouter les fichiers source
    this.project.addSourceFilesAtPaths(path.join(this.backendPath, 'src/**/*.ts'));
  }

  /**
   * Analyser les breaking changes
   */
  private async analyzeBreakingChanges(): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];

    // Breaking changes connus NestJS 10 → 11
    const knownBreakingChanges = this.getNestJS11BreakingChanges();

    for (const bc of knownBreakingChanges) {
      const affectedFiles = await this.findAffectedFiles(bc.detectionPattern);
      
      if (affectedFiles.length > 0) {
        breakingChanges.push({
          ...bc,
          affectedFiles: affectedFiles.map(f => path.relative(this.rootPath, f)),
        });
      }
    }

    return breakingChanges;
  }

  /**
   * Liste des breaking changes NestJS 11
   */
  private getNestJS11BreakingChanges(): Omit<BreakingChange, 'affectedFiles'>[] {
    return [
      {
        id: 'BC001',
        category: 'deprecation',
        severity: 'high',
        title: '@nestjs/platform-express version requirement',
        description: 'Express 5.x est maintenant requis (au lieu de 4.x)',
        detectionPattern: 'express',
        migrationSteps: [
          'Mettre à jour @nestjs/platform-express vers ^11.0.0',
          'Vérifier les middlewares Express compatibles v5',
          'Tester les routes et middlewares',
        ],
        automatable: true,
      },
      {
        id: 'BC002',
        category: 'api-change',
        severity: 'medium',
        title: 'HttpService signature change',
        description: 'HttpService utilise maintenant Axios 1.x (breaking changes)',
        detectionPattern: 'HttpService',
        migrationSteps: [
          'Mettre à jour @nestjs/axios vers ^3.0.0',
          'Vérifier les appels HTTP (axiosRef.request → this.httpService.request)',
          'Adapter les interceptors Axios',
        ],
        automatable: false,
      },
      {
        id: 'BC003',
        category: 'removal',
        severity: 'critical',
        title: 'Deprecated decorators removed',
        description: '@UsePipes() legacy behavior removed, use new syntax',
        detectionPattern: '@UsePipes',
        migrationSteps: [
          'Remplacer @UsePipes(new ValidationPipe()) par @UsePipes(ValidationPipe)',
          'Vérifier tous les pipes personnalisés',
        ],
        automatable: true,
      },
      {
        id: 'BC004',
        category: 'behavior-change',
        severity: 'medium',
        title: 'Exception filters execution order',
        description: 'Ordre d\'exécution des exception filters modifié',
        detectionPattern: '@Catch',
        migrationSteps: [
          'Vérifier les exception filters globaux',
          'Tester l\'ordre d\'exécution des filters',
          'Ajuster les priorités si nécessaire',
        ],
        automatable: false,
      },
      {
        id: 'BC005',
        category: 'deprecation',
        severity: 'high',
        title: 'Microservices transport changes',
        description: 'Certains transports microservices ont changé de package',
        detectionPattern: 'ClientProxy|@nestjs/microservices',
        migrationSteps: [
          'Vérifier les imports de transports (Redis, MQTT, etc.)',
          'Mettre à jour les configurations de transport',
          'Tester les connexions microservices',
        ],
        automatable: false,
      },
      {
        id: 'BC006',
        category: 'api-change',
        severity: 'low',
        title: 'Testing module improvements',
        description: 'TestingModule.createTestingModule() API légèrement modifiée',
        detectionPattern: 'Test.createTestingModule',
        migrationSteps: [
          'Vérifier les tests unitaires',
          'Adapter les mocks si nécessaire',
        ],
        automatable: false,
      },
    ];
  }

  /**
   * Trouver les fichiers affectés par un breaking change
   */
  private async findAffectedFiles(pattern: string): Promise<string[]> {
    const affectedFiles: string[] = [];
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      const content = sourceFile.getFullText();
      
      // Recherche simple par pattern
      if (content.includes(pattern)) {
        affectedFiles.push(sourceFile.getFilePath());
      }
    }

    return affectedFiles;
  }

  /**
   * Analyser les dépendances
   */
  private analyzeDependencies(): DependencyAnalysis[] {
    const packageJsonPath = path.join(this.backendPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const nestDeps = [
      '@nestjs/core',
      '@nestjs/common',
      '@nestjs/platform-express',
      '@nestjs/config',
      '@nestjs/typeorm',
      '@nestjs/swagger',
      '@nestjs/jwt',
      '@nestjs/passport',
      '@nestjs/axios',
      '@nestjs/microservices',
      '@nestjs/websockets',
      '@nestjs/schedule',
    ];

    const dependencies: DependencyAnalysis[] = [];

    for (const dep of nestDeps) {
      const currentVersion = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
      
      if (currentVersion) {
        const compatible = this.isCompatibleWithNestJS11(dep, currentVersion);
        
        dependencies.push({
          package: dep,
          currentVersion: currentVersion.replace(/[\^~]/, ''),
          requiredVersion: '^11.0.0',
          compatible,
          needsUpdate: !compatible,
          breakingChanges: compatible ? [] : ['Mise à jour vers v11 requise'],
        });
      }
    }

    return dependencies;
  }

  /**
   * Vérifier la compatibilité d'une dépendance avec NestJS 11
   */
  private isCompatibleWithNestJS11(packageName: string, version: string): boolean {
    const versionMatch = version.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) return false;

    const major = parseInt(versionMatch[1]);
    
    // NestJS 11 nécessite toutes les dépendances @nestjs en v11
    return major >= 11;
  }

  /**
   * Générer le plan de migration
   */
  private generateMigrationPlan(
    version: NestJSVersion,
    breakingChanges: BreakingChange[],
    dependencies: DependencyAnalysis[]
  ): MigrationPlan {
    const steps: MigrationStep[] = [];

    // Étape 1: Backup
    steps.push({
      order: 1,
      title: 'Backup et préparation',
      description: 'Créer une branche de migration et backup',
      commands: [
        'git checkout -b upgrade/nestjs-11',
        'npm run test', // Valider que tout fonctionne avant
      ],
      manualActions: [
        'Vérifier que tous les tests passent',
        'Commiter tous les changements en cours',
      ],
      estimatedTime: '10 minutes',
      rollbackPlan: 'git checkout main && git branch -D upgrade/nestjs-11',
    });

    // Étape 2: Mise à jour des dépendances
    const depsToUpdate = dependencies.filter(d => d.needsUpdate);
    if (depsToUpdate.length > 0) {
      steps.push({
        order: 2,
        title: `Mise à jour des dépendances NestJS (${depsToUpdate.length} packages)`,
        description: 'Mettre à jour tous les packages @nestjs vers v11',
        commands: depsToUpdate.map(d => `npm install ${d.package}@^11.0.0`),
        manualActions: [
          'Vérifier package-lock.json pour conflits',
          'Exécuter npm install pour résoudre peer dependencies',
        ],
        estimatedTime: '15 minutes',
        rollbackPlan: 'git checkout package.json package-lock.json && npm install',
      });
    }

    // Étape 3: Corrections breaking changes critiques
    const criticalChanges = breakingChanges.filter(bc => bc.severity === 'critical');
    if (criticalChanges.length > 0) {
      steps.push({
        order: 3,
        title: `Corriger breaking changes critiques (${criticalChanges.length})`,
        description: 'Appliquer les corrections obligatoires',
        commands: criticalChanges
          .filter(bc => bc.automatable)
          .map(bc => `# Auto-fix: ${bc.title}`),
        manualActions: criticalChanges
          .filter(bc => !bc.automatable)
          .flatMap(bc => bc.migrationSteps),
        estimatedTime: `${criticalChanges.length * 30} minutes`,
        rollbackPlan: 'git checkout src/',
      });
    }

    // Étape 4: Corrections breaking changes non-critiques
    const nonCriticalChanges = breakingChanges.filter(bc => bc.severity !== 'critical');
    if (nonCriticalChanges.length > 0) {
      steps.push({
        order: 4,
        title: `Corriger autres breaking changes (${nonCriticalChanges.length})`,
        description: 'Appliquer les corrections recommandées',
        commands: [],
        manualActions: nonCriticalChanges.flatMap(bc => bc.migrationSteps),
        estimatedTime: `${nonCriticalChanges.length * 20} minutes`,
        rollbackPlan: 'git checkout src/',
      });
    }

    // Étape 5: Tests
    steps.push({
      order: 5,
      title: 'Validation et tests',
      description: 'Exécuter tous les tests et vérifier la compilation',
      commands: [
        'npm run build',
        'npm run test',
        'npm run test:e2e',
      ],
      manualActions: [
        'Vérifier les logs de démarrage',
        'Tester les endpoints critiques manuellement',
        'Vérifier les websockets si utilisés',
      ],
      estimatedTime: '30 minutes',
      rollbackPlan: 'Analyser les erreurs et corriger ou rollback complet',
    });

    // Calculer le niveau de risque
    const criticalCount = breakingChanges.filter(bc => bc.severity === 'critical').length;
    const riskLevel: MigrationPlan['riskLevel'] = 
      criticalCount >= 3 ? 'critical' :
      criticalCount >= 2 ? 'high' :
      breakingChanges.length >= 4 ? 'medium' : 'low';

    // Calculer l'automation coverage
    const automatableCount = breakingChanges.filter(bc => bc.automatable).length;
    const automationCoverage = breakingChanges.length > 0 
      ? Math.round((automatableCount / breakingChanges.length) * 100)
      : 100;

    // Estimer la durée totale
    const totalMinutes = steps.reduce((sum, step) => {
      const match = step.estimatedTime.match(/(\d+)/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
    const estimatedDuration = totalMinutes >= 60 
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}min`
      : `${totalMinutes} minutes`;

    return {
      timestamp: new Date(),
      version,
      breakingChanges,
      dependencies,
      migrationSteps: steps,
      estimatedDuration,
      riskLevel,
      automationCoverage,
    };
  }

  /**
   * Calculer les statistiques
   */
  private calculateStats(
    breakingChanges: BreakingChange[],
    dependencies: DependencyAnalysis[]
  ): UpgradeStats {
    const sourceFiles = this.project.getSourceFiles();
    const affectedFilesSet = new Set(
      breakingChanges.flatMap(bc => bc.affectedFiles)
    );

    const criticalCount = breakingChanges.filter(bc => bc.severity === 'critical').length;
    const highCount = breakingChanges.filter(bc => bc.severity === 'high').length;
    const totalEffortMinutes = 
      criticalCount * 30 + 
      highCount * 20 + 
      (breakingChanges.length - criticalCount - highCount) * 15 +
      dependencies.filter(d => d.needsUpdate).length * 5 +
      60; // Tests

    const hours = Math.floor(totalEffortMinutes / 60);
    const minutes = totalEffortMinutes % 60;

    return {
      totalFiles: sourceFiles.length,
      affectedFiles: affectedFilesSet.size,
      breakingChanges: breakingChanges.length,
      deprecations: breakingChanges.filter(bc => bc.category === 'deprecation').length,
      dependenciesToUpdate: dependencies.filter(d => d.needsUpdate).length,
      estimatedEffort: `${hours}h ${minutes}min`,
    };
  }

  /**
   * Générer des recommandations
   */
  private generateRecommendations(
    plan: MigrationPlan,
    stats: UpgradeStats
  ): UpgradeRecommendation[] {
    const recommendations: UpgradeRecommendation[] = [];

    // Recommandation selon le niveau de risque
    if (plan.riskLevel === 'critical' || plan.riskLevel === 'high') {
      recommendations.push({
        priority: 'high',
        category: 'Stratégie',
        title: 'Migration progressive recommandée',
        description: `Niveau de risque ${plan.riskLevel}. Prévoir une migration en plusieurs étapes avec tests intensifs entre chaque étape.`,
        effort: '2-3 jours',
      });
    }

    // Tests
    recommendations.push({
      priority: 'high',
      category: 'Tests',
      title: 'Augmenter la couverture de tests avant migration',
      description: 'Ajouter des tests E2E pour les endpoints critiques pour valider la migration.',
      effort: '1-2 jours',
    });

    // Automation
    if (plan.automationCoverage < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'Automation',
        title: 'Développer des scripts de migration',
        description: `Seulement ${plan.automationCoverage}% de la migration est automatisable. Créer des scripts pour automatiser les corrections répétitives.`,
        effort: '1 jour',
      });
    }

    // Documentation
    recommendations.push({
      priority: 'medium',
      category: 'Documentation',
      title: 'Documenter les changements post-migration',
      description: 'Créer un guide des nouveaux patterns NestJS 11 pour l\'équipe.',
      effort: '2-3 heures',
    });

    return recommendations;
  }

  /**
   * Calculer les KPIs
   */
  private calculateKPIs(report: UpgradeReport): KPI[] {
    const kpis: KPI[] = [];

    // Breaking changes critiques
    const criticalCount = report.plan.breakingChanges.filter(
      bc => bc.severity === 'critical'
    ).length;
    kpis.push({
      name: 'Breaking changes critiques',
      value: criticalCount,
      unit: 'changes',
      status: criticalCount === 0 ? 'ok' : criticalCount <= 2 ? 'warning' : 'critical',
    });

    // Dépendances obsolètes
    const outdatedCount = report.plan.dependencies.filter(d => d.needsUpdate).length;
    kpis.push({
      name: 'Dépendances à mettre à jour',
      value: outdatedCount,
      unit: 'packages',
      status: outdatedCount === 0 ? 'ok' : outdatedCount <= 5 ? 'warning' : 'critical',
    });

    // Automation coverage
    kpis.push({
      name: 'Automation coverage',
      value: report.plan.automationCoverage,
      unit: '%',
      status: report.plan.automationCoverage >= 70 ? 'ok' : report.plan.automationCoverage >= 40 ? 'warning' : 'critical',
    });

    return kpis;
  }

  /**
   * Sauvegarder les rapports
   */
  private async saveReports(report: UpgradeReport): Promise<void> {
    const reportsDir = path.join(this.rootPath, 'ai-agents/reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // JSON
    const jsonPath = path.join(reportsDir, 'upgrade-nestjs.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Markdown
    const mdPath = path.join(reportsDir, 'upgrade-nestjs.md');
    const markdown = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, markdown);

    // Script de migration
    const scriptPath = path.join(reportsDir, 'migrate-nestjs-11.sh');
    const script = this.generateMigrationScript(report.plan);
    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');

    console.log(`   💾 Rapport JSON: ${jsonPath}`);
    console.log(`   💾 Rapport MD: ${mdPath}`);
    console.log(`   💾 Script migration: ${scriptPath}`);
  }

  /**
   * Générer le rapport Markdown
   */
  private generateMarkdownReport(report: UpgradeReport): string {
    let md = `# 🚀 Plan de Migration NestJS ${report.version.current} → ${report.version.target}\n\n`;
    md += `**Date**: ${report.timestamp.toISOString()}\n\n`;
    md += `---\n\n`;

    // Version
    md += `## 📦 Version\n\n`;
    md += `- **Actuelle**: ${report.version.current}\n`;
    md += `- **Cible**: ${report.version.target}\n`;
    md += `- **Niveau de risque**: ${report.plan.riskLevel.toUpperCase()}\n`;
    md += `- **Durée estimée**: ${report.plan.estimatedDuration}\n`;
    md += `- **Automation**: ${report.plan.automationCoverage}%\n\n`;

    // Statistiques
    md += `## 📊 Statistiques\n\n`;
    md += `- **Fichiers totaux**: ${report.stats.totalFiles}\n`;
    md += `- **Fichiers affectés**: ${report.stats.affectedFiles}\n`;
    md += `- **Breaking changes**: ${report.stats.breakingChanges}\n`;
    md += `  - Critiques: ${report.plan.breakingChanges.filter(bc => bc.severity === 'critical').length}\n`;
    md += `  - High: ${report.plan.breakingChanges.filter(bc => bc.severity === 'high').length}\n`;
    md += `  - Medium: ${report.plan.breakingChanges.filter(bc => bc.severity === 'medium').length}\n`;
    md += `- **Dépendances à mettre à jour**: ${report.stats.dependenciesToUpdate}\n`;
    md += `- **Effort estimé**: ${report.stats.estimatedEffort}\n\n`;

    // Breaking changes
    if (report.plan.breakingChanges.length > 0) {
      md += `## 🔴 Breaking Changes (${report.plan.breakingChanges.length})\n\n`;
      
      const critical = report.plan.breakingChanges.filter(bc => bc.severity === 'critical');
      const high = report.plan.breakingChanges.filter(bc => bc.severity === 'high');
      const others = report.plan.breakingChanges.filter(bc => bc.severity !== 'critical' && bc.severity !== 'high');

      if (critical.length > 0) {
        md += `### 🔴 Critiques (${critical.length})\n\n`;
        critical.forEach((bc, i) => {
          md += `#### ${i + 1}. ${bc.title}\n\n`;
          md += `- **ID**: ${bc.id}\n`;
          md += `- **Catégorie**: ${bc.category}\n`;
          md += `- **Description**: ${bc.description}\n`;
          md += `- **Fichiers affectés**: ${bc.affectedFiles.length}\n`;
          md += `- **Automatisable**: ${bc.automatable ? 'Oui' : 'Non'}\n\n`;
          md += `**Migration**:\n`;
          bc.migrationSteps.forEach(step => md += `- ${step}\n`);
          md += `\n`;
        });
      }

      if (high.length > 0) {
        md += `### 🟠 High Priority (${high.length})\n\n`;
        high.forEach((bc, i) => {
          md += `#### ${i + 1}. ${bc.title}\n\n`;
          md += `- **Description**: ${bc.description}\n`;
          md += `- **Fichiers affectés**: ${bc.affectedFiles.length}\n\n`;
        });
      }
    }

    // Dépendances
    if (report.plan.dependencies.filter(d => d.needsUpdate).length > 0) {
      md += `## 📦 Dépendances à Mettre à Jour\n\n`;
      md += `| Package | Actuelle | Requise | Status |\n`;
      md += `|---------|----------|---------|--------|\n`;
      report.plan.dependencies
        .filter(d => d.needsUpdate)
        .forEach(dep => {
          md += `| \`${dep.package}\` | ${dep.currentVersion} | ${dep.requiredVersion} | ❌ |\n`;
        });
      md += `\n`;
    }

    // Plan de migration
    md += `## 📋 Plan de Migration\n\n`;
    report.plan.migrationSteps.forEach(step => {
      md += `### Étape ${step.order}: ${step.title}\n\n`;
      md += `**Description**: ${step.description}\n\n`;
      md += `**Durée estimée**: ${step.estimatedTime}\n\n`;
      
      if (step.commands.length > 0) {
        md += `**Commandes**:\n\`\`\`bash\n`;
        step.commands.forEach(cmd => md += `${cmd}\n`);
        md += `\`\`\`\n\n`;
      }
      
      if (step.manualActions.length > 0) {
        md += `**Actions manuelles**:\n`;
        step.manualActions.forEach(action => md += `- ${action}\n`);
        md += `\n`;
      }
      
      md += `**Rollback**: ${step.rollbackPlan}\n\n`;
    });

    // Recommandations
    if (report.recommendations.length > 0) {
      md += `## 💡 Recommandations\n\n`;
      report.recommendations.forEach((rec, i) => {
        const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        md += `### ${icon} ${i + 1}. ${rec.title}\n\n`;
        md += `- **Catégorie**: ${rec.category}\n`;
        md += `- **Priorité**: ${rec.priority}\n`;
        md += `- **Description**: ${rec.description}\n`;
        md += `- **Effort**: ${rec.effort}\n\n`;
      });
    }

    md += `---\n\n`;
    md += `*Rapport généré par Agent 5: Upgrade NestJS*\n`;

    return md;
  }

  /**
   * Générer un script de migration
   */
  private generateMigrationScript(plan: MigrationPlan): string {
    let script = `#!/bin/bash\n`;
    script += `# Script de migration NestJS ${plan.version.current} → ${plan.version.target}\n`;
    script += `# Généré automatiquement par Agent 5\n`;
    script += `# Date: ${plan.timestamp.toISOString()}\n\n`;
    script += `set -e  # Exit on error\n\n`;
    script += `echo "🚀 Migration NestJS ${plan.version.current} → ${plan.version.target}"\n`;
    script += `echo "⚠️  Niveau de risque: ${plan.riskLevel}"\n`;
    script += `echo "⏱️  Durée estimée: ${plan.estimatedDuration}"\n`;
    script += `echo ""\n\n`;

    plan.migrationSteps.forEach(step => {
      script += `echo "▶️  Étape ${step.order}: ${step.title}"\n`;
      script += `echo "───────────────────────────────────────"\n\n`;

      if (step.commands.length > 0) {
        step.commands.forEach(cmd => {
          if (!cmd.startsWith('#')) {
            script += `${cmd}\n`;
          }
        });
        script += `\n`;
      }

      if (step.manualActions.length > 0) {
        script += `echo "⚠️  Actions manuelles requises:"\n`;
        step.manualActions.forEach(action => {
          script += `echo "  - ${action}"\n`;
        });
        script += `read -p "Appuyez sur Entrée pour continuer..."\n\n`;
      }

      script += `echo "✅ Étape ${step.order} terminée"\n`;
      script += `echo ""\n\n`;
    });

    script += `echo "🎉 Migration terminée avec succès!"\n`;
    script += `echo "📝 Consultez le rapport complet: ai-agents/reports/upgrade-nestjs.md"\n`;

    return script;
  }
}
