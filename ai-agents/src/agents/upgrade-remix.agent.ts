/**
 * Agent 6 : Upgrade Remix Analyzer
 * 
 * Fonction : Analyser la compatibilité Remix 2.x et préparer l'upgrade
 * 
 * Périmètre : 
 * - Frontend Remix (app/)
 * - Dependencies @remix-run/*
 * - Configuration vite.config.ts, remix.config
 * 
 * Livrables :
 * - Version actuelle détectée
 * - Breaking changes identifiés (v2→v3 ou v2.x→v2.latest)
 * - Liste des routes à migrer
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

interface RemixVersion {
  current: string;
  target: string;
  major: number;
  minor: number;
  patch: number;
}

interface RemixBreakingChange {
  id: string;
  category: 'loader' | 'action' | 'meta' | 'routing' | 'api' | 'config';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedFiles: string[];
  detectionPattern: string;
  migrationSteps: string[];
  automatable: boolean;
  codeExample?: {
    before: string;
    after: string;
  };
}

interface RouteAnalysis {
  routePath: string;
  hasLoader: boolean;
  hasAction: boolean;
  hasMeta: boolean;
  usesOldLoaderSignature: boolean;
  usesOldActionSignature: boolean;
  usesOldMetaSignature: boolean;
  needsMigration: boolean;
}

interface RemixDependencyAnalysis {
  package: string;
  currentVersion: string;
  requiredVersion: string;
  compatible: boolean;
  needsUpdate: boolean;
}

interface RemixMigrationPlan {
  timestamp: Date;
  version: RemixVersion;
  breakingChanges: RemixBreakingChange[];
  routes: RouteAnalysis[];
  dependencies: RemixDependencyAnalysis[];
  migrationSteps: RemixMigrationStep[];
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  automationCoverage: number;
}

interface RemixMigrationStep {
  order: number;
  title: string;
  description: string;
  commands: string[];
  manualActions: string[];
  estimatedTime: string;
  rollbackPlan: string;
}

interface RemixUpgradeReport {
  timestamp: Date;
  version: RemixVersion;
  plan: RemixMigrationPlan;
  stats: RemixUpgradeStats;
  recommendations: RemixRecommendation[];
}

interface RemixUpgradeStats {
  totalRoutes: number;
  affectedRoutes: number;
  breakingChanges: number;
  oldLoaderCount: number;
  oldActionCount: number;
  oldMetaCount: number;
  dependenciesToUpdate: number;
  estimatedEffort: string;
}

interface RemixRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  effort: string;
}

export class UpgradeRemixAgent implements IAgent {
  name = 'Upgrade Remix';
  type = 'upgrade-remix' as const;
  description = 'Analyse la compatibilité Remix 2.x et génère un plan de migration';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private rootPath: string;
  private frontendPath: string;
  private project!: Project;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.frontendPath = path.join(rootPath, 'frontend');
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
    console.log('\n🔍 Upgrade Remix - Analyse en cours...');
    const startTime = Date.now();
    this.status = 'running';

    try {
      // Détecter version actuelle
      console.log('   📦 Détection version Remix...');
      const version = this.detectRemixVersion();
      console.log(`   ✓ Version actuelle: ${version.current} → cible: ${version.target}`);

      // Initialiser projet TypeScript
      console.log('   📂 Initialisation projet TypeScript...');
      this.initializeProject();

      // Analyser les routes
      console.log('   🛣️  Analyse des routes Remix...');
      const routes = await this.analyzeRoutes();
      console.log(`   ✓ ${routes.length} routes analysées`);

      // Analyser les breaking changes
      console.log('   🔍 Analyse des breaking changes...');
      const breakingChanges = await this.analyzeBreakingChanges(routes);
      console.log(`   ✓ ${breakingChanges.length} breaking changes détectés`);

      // Analyser les dépendances
      console.log('   📚 Analyse des dépendances...');
      const dependencies = this.analyzeDependencies();
      console.log(`   ✓ ${dependencies.filter(d => d.needsUpdate).length} dépendances à mettre à jour`);

      // Générer le plan de migration
      console.log('   📋 Génération du plan de migration...');
      const plan = this.generateMigrationPlan(version, breakingChanges, routes, dependencies);

      // Calculer les statistiques
      const stats = this.calculateStats(routes, breakingChanges, dependencies);

      // Générer des recommandations
      console.log('   💡 Génération des recommandations...');
      const recommendations = this.generateRecommendations(plan, stats);

      const report: RemixUpgradeReport = {
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
      console.log(`   🛣️  ${routes.filter(r => r.needsMigration).length} routes à migrer`);
      console.log(`   🔴 ${breakingChanges.filter(bc => bc.severity === 'critical').length} breaking changes critiques`);

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
   * Détecter la version actuelle de Remix
   */
  private detectRemixVersion(): RemixVersion {
    const packageJsonPath = path.join(this.frontendPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const currentVersion = packageJson.dependencies['@remix-run/react'] || 
                          packageJson.dependencies['@remix-run/node'] ||
                          '2.15.0';

    // Extraire version numérique
    const versionMatch = currentVersion.match(/(\d+)\.(\d+)\.(\d+)/);
    const major = versionMatch ? parseInt(versionMatch[1]) : 2;
    const minor = versionMatch ? parseInt(versionMatch[2]) : 15;
    const patch = versionMatch ? parseInt(versionMatch[3]) : 0;

    // Déterminer la version cible (Remix 2.latest stable ou 3.x si disponible)
    const target = major === 2 ? '2.17.0' : '3.0.0';

    return {
      current: currentVersion.replace(/[\^~]/, ''),
      target,
      major,
      minor,
      patch,
    };
  }

  /**
   * Initialiser le projet ts-morph
   */
  private initializeProject(): void {
    const tsconfigPath = path.join(this.frontendPath, 'tsconfig.json');
    
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: true,
    });

    // Ajouter les fichiers source
    this.project.addSourceFilesAtPaths(path.join(this.frontendPath, 'app/**/*.{ts,tsx}'));
  }

  /**
   * Analyser les routes Remix
   */
  private async analyzeRoutes(): Promise<RouteAnalysis[]> {
    const routesDir = path.join(this.frontendPath, 'app/routes');
    const routes: RouteAnalysis[] = [];

    if (!fs.existsSync(routesDir)) {
      return routes;
    }

    const routeFiles = this.project.getSourceFiles()
      .filter(sf => sf.getFilePath().includes('/routes/'));

    for (const sourceFile of routeFiles) {
      const routePath = path.relative(routesDir, sourceFile.getFilePath());
      
      const analysis: RouteAnalysis = {
        routePath,
        hasLoader: this.hasExport(sourceFile, 'loader'),
        hasAction: this.hasExport(sourceFile, 'action'),
        hasMeta: this.hasExport(sourceFile, 'meta'),
        usesOldLoaderSignature: this.usesOldLoaderSignature(sourceFile),
        usesOldActionSignature: this.usesOldActionSignature(sourceFile),
        usesOldMetaSignature: this.usesOldMetaSignature(sourceFile),
        needsMigration: false,
      };

      analysis.needsMigration = 
        analysis.usesOldLoaderSignature ||
        analysis.usesOldActionSignature ||
        analysis.usesOldMetaSignature;

      routes.push(analysis);
    }

    return routes;
  }

  /**
   * Vérifier si un export existe
   */
  private hasExport(sourceFile: SourceFile, exportName: string): boolean {
    const exportDeclarations = sourceFile.getExportedDeclarations();
    return exportDeclarations.has(exportName);
  }

  /**
   * Vérifier si le loader utilise l'ancienne signature
   */
  private usesOldLoaderSignature(sourceFile: SourceFile): boolean {
    const content = sourceFile.getFullText();
    
    // Remix v2: loader({ request, params, context })
    // Patterns à détecter:
    // - LoaderArgs (deprecated)
    // - LoaderFunction (deprecated)
    
    return content.includes('LoaderArgs') || 
           content.includes('LoaderFunction') ||
           /export\s+(const|function)\s+loader\s*\(\s*\{\s*request\s*,\s*params\s*\}/.test(content);
  }

  /**
   * Vérifier si l'action utilise l'ancienne signature
   */
  private usesOldActionSignature(sourceFile: SourceFile): boolean {
    const content = sourceFile.getFullText();
    
    return content.includes('ActionArgs') || 
           content.includes('ActionFunction');
  }

  /**
   * Vérifier si meta utilise l'ancienne signature
   */
  private usesOldMetaSignature(sourceFile: SourceFile): boolean {
    const content = sourceFile.getFullText();
    
    // Remix v1: meta() returns array
    // Remix v2: meta() returns array or MetaDescriptor[]
    // Check for old pattern
    
    return content.includes('MetaFunction') && 
           !content.includes('V2_MetaFunction');
  }

  /**
   * Analyser les breaking changes
   */
  private async analyzeBreakingChanges(routes: RouteAnalysis[]): Promise<RemixBreakingChange[]> {
    const breakingChanges: RemixBreakingChange[] = [];

    // Breaking changes Remix 2.15 → 2.17 ou 2.x → 3.x
    const knownBreakingChanges = this.getRemixBreakingChanges();

    for (const bc of knownBreakingChanges) {
      let affectedFiles: string[] = [];

      if (bc.category === 'loader' || bc.category === 'action') {
        affectedFiles = routes
          .filter(r => {
            if (bc.category === 'loader') return r.usesOldLoaderSignature;
            if (bc.category === 'action') return r.usesOldActionSignature;
            return false;
          })
          .map(r => `app/routes/${r.routePath}`);
      } else {
        affectedFiles = await this.findAffectedFiles(bc.detectionPattern);
      }

      if (affectedFiles.length > 0) {
        breakingChanges.push({
          ...bc,
          affectedFiles,
        });
      }
    }

    return breakingChanges;
  }

  /**
   * Liste des breaking changes Remix
   */
  private getRemixBreakingChanges(): Omit<RemixBreakingChange, 'affectedFiles'>[] {
    return [
      {
        id: 'RMX001',
        category: 'loader',
        severity: 'high',
        title: 'LoaderArgs et LoaderFunction deprecated',
        description: 'Utiliser LoaderFunctionArgs depuis @remix-run/node',
        detectionPattern: 'LoaderArgs|LoaderFunction',
        migrationSteps: [
          'Remplacer LoaderArgs par LoaderFunctionArgs',
          'Import depuis @remix-run/node',
          'Adapter le type de retour (TypedResponse)',
        ],
        automatable: true,
        codeExample: {
          before: `import { LoaderArgs, json } from '@remix-run/node';
export async function loader({ request, params }: LoaderArgs) {
  return json({ data });
}`,
          after: `import { LoaderFunctionArgs, json } from '@remix-run/node';
export async function loader({ request, params }: LoaderFunctionArgs) {
  return json({ data });
}`,
        },
      },
      {
        id: 'RMX002',
        category: 'action',
        severity: 'high',
        title: 'ActionArgs et ActionFunction deprecated',
        description: 'Utiliser ActionFunctionArgs depuis @remix-run/node',
        detectionPattern: 'ActionArgs|ActionFunction',
        migrationSteps: [
          'Remplacer ActionArgs par ActionFunctionArgs',
          'Import depuis @remix-run/node',
          'Adapter le type de retour',
        ],
        automatable: true,
        codeExample: {
          before: `import { ActionArgs, json } from '@remix-run/node';
export async function action({ request }: ActionArgs) {
  return json({ success: true });
}`,
          after: `import { ActionFunctionArgs, json } from '@remix-run/node';
export async function action({ request }: ActionFunctionArgs) {
  return json({ success: true });
}`,
        },
      },
      {
        id: 'RMX003',
        category: 'meta',
        severity: 'medium',
        title: 'Meta function V1 deprecated',
        description: 'Utiliser V2_MetaFunction ou la nouvelle signature',
        detectionPattern: 'MetaFunction',
        migrationSteps: [
          'Remplacer MetaFunction par V2_MetaFunction',
          'Adapter le retour (array → MetaDescriptor[])',
        ],
        automatable: false,
      },
      {
        id: 'RMX004',
        category: 'routing',
        severity: 'low',
        title: 'Flat routes convention',
        description: 'Remix 2.x utilise flat routes par défaut',
        detectionPattern: 'routes/',
        migrationSteps: [
          'Vérifier la structure des routes',
          'Migrer vers flat routes si nécessaire',
        ],
        automatable: false,
      },
      {
        id: 'RMX005',
        category: 'api',
        severity: 'medium',
        title: 'useTransition → useNavigation',
        description: 'useTransition renommé en useNavigation',
        detectionPattern: 'useTransition',
        migrationSteps: [
          'Remplacer useTransition par useNavigation',
          'Adapter les propriétés (state, type, location)',
        ],
        automatable: true,
        codeExample: {
          before: `import { useTransition } from '@remix-run/react';
const transition = useTransition();
if (transition.state === 'submitting') { ... }`,
          after: `import { useNavigation } from '@remix-run/react';
const navigation = useNavigation();
if (navigation.state === 'submitting') { ... }`,
        },
      },
      {
        id: 'RMX006',
        category: 'config',
        severity: 'low',
        title: 'remix.config.js → vite.config.ts',
        description: 'Remix 2.x utilise Vite par défaut',
        detectionPattern: 'remix.config',
        migrationSteps: [
          'Vérifier vite.config.ts existe',
          'Migrer config depuis remix.config.js si présent',
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
      
      if (content.includes(pattern)) {
        affectedFiles.push(
          path.relative(this.frontendPath, sourceFile.getFilePath())
        );
      }
    }

    return affectedFiles;
  }

  /**
   * Analyser les dépendances
   */
  private analyzeDependencies(): RemixDependencyAnalysis[] {
    const packageJsonPath = path.join(this.frontendPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const remixDeps = [
      '@remix-run/node',
      '@remix-run/react',
      '@remix-run/serve',
      '@remix-run/dev',
      '@remix-run/eslint-config',
    ];

    const dependencies: RemixDependencyAnalysis[] = [];
    const targetVersion = '2.17.0'; // Latest stable v2

    for (const dep of remixDeps) {
      const currentVersion = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
      
      if (currentVersion) {
        const compatible = this.isCompatibleVersion(currentVersion, targetVersion);
        
        dependencies.push({
          package: dep,
          currentVersion: currentVersion.replace(/[\^~]/, ''),
          requiredVersion: `^${targetVersion}`,
          compatible,
          needsUpdate: !compatible,
        });
      }
    }

    return dependencies;
  }

  /**
   * Vérifier la compatibilité d'une version
   */
  private isCompatibleVersion(current: string, target: string): boolean {
    const currentMatch = current.match(/(\d+)\.(\d+)\.(\d+)/);
    const targetMatch = target.match(/(\d+)\.(\d+)\.(\d+)/);
    
    if (!currentMatch || !targetMatch) return false;

    const currentVersion = parseInt(currentMatch[1]) * 10000 + 
                          parseInt(currentMatch[2]) * 100 + 
                          parseInt(currentMatch[3]);
    const targetVersion = parseInt(targetMatch[1]) * 10000 + 
                         parseInt(targetMatch[2]) * 100 + 
                         parseInt(targetMatch[3]);

    return currentVersion >= targetVersion;
  }

  /**
   * Générer le plan de migration
   */
  private generateMigrationPlan(
    version: RemixVersion,
    breakingChanges: RemixBreakingChange[],
    routes: RouteAnalysis[],
    dependencies: RemixDependencyAnalysis[]
  ): RemixMigrationPlan {
    const steps: RemixMigrationStep[] = [];

    // Étape 1: Backup
    steps.push({
      order: 1,
      title: 'Backup et préparation',
      description: 'Créer une branche de migration et backup',
      commands: [
        'git checkout -b upgrade/remix-2.17',
        'npm run build',
        'npm run test',
      ],
      manualActions: [
        'Vérifier que le build fonctionne',
        'Vérifier que les tests passent',
      ],
      estimatedTime: '10 minutes',
      rollbackPlan: 'git checkout main && git branch -D upgrade/remix-2.17',
    });

    // Étape 2: Mise à jour des dépendances
    const depsToUpdate = dependencies.filter(d => d.needsUpdate);
    if (depsToUpdate.length > 0) {
      steps.push({
        order: 2,
        title: `Mise à jour des dépendances Remix (${depsToUpdate.length} packages)`,
        description: 'Mettre à jour tous les packages @remix-run',
        commands: depsToUpdate.map(d => `npm install ${d.package}@${d.requiredVersion}`),
        manualActions: [
          'Vérifier package-lock.json',
          'Exécuter npm install',
        ],
        estimatedTime: '10 minutes',
        rollbackPlan: 'git checkout package.json package-lock.json && npm install',
      });
    }

    // Étape 3: Migration des routes
    const routesToMigrate = routes.filter(r => r.needsMigration);
    if (routesToMigrate.length > 0) {
      steps.push({
        order: 3,
        title: `Migration des routes (${routesToMigrate.length} routes)`,
        description: 'Migrer loaders, actions, meta vers nouvelle signature',
        commands: [],
        manualActions: [
          'Remplacer LoaderArgs → LoaderFunctionArgs',
          'Remplacer ActionArgs → ActionFunctionArgs',
          'Remplacer MetaFunction → V2_MetaFunction si nécessaire',
          'Adapter les imports depuis @remix-run/node',
        ],
        estimatedTime: `${routesToMigrate.length * 5} minutes`,
        rollbackPlan: 'git checkout app/routes/',
      });
    }

    // Étape 4: Migration API hooks
    const apiChanges = breakingChanges.filter(bc => bc.category === 'api');
    if (apiChanges.length > 0) {
      steps.push({
        order: 4,
        title: 'Migration des hooks API',
        description: 'Remplacer useTransition → useNavigation',
        commands: [],
        manualActions: apiChanges.flatMap(bc => bc.migrationSteps),
        estimatedTime: '20 minutes',
        rollbackPlan: 'git checkout app/',
      });
    }

    // Étape 5: Tests
    steps.push({
      order: 5,
      title: 'Validation et tests',
      description: 'Vérifier que tout fonctionne',
      commands: [
        'npm run build',
        'npm run typecheck',
        'npm run test',
      ],
      manualActions: [
        'Tester les routes principales manuellement',
        'Vérifier les loaders/actions',
        'Vérifier le hot-reload dev',
      ],
      estimatedTime: '30 minutes',
      rollbackPlan: 'Analyser erreurs et corriger ou rollback',
    });

    // Calculer risque et automation
    const criticalCount = breakingChanges.filter(bc => bc.severity === 'critical').length;
    const highCount = breakingChanges.filter(bc => bc.severity === 'high').length;
    const riskLevel: RemixMigrationPlan['riskLevel'] = 
      criticalCount >= 2 ? 'critical' :
      criticalCount >= 1 || highCount >= 3 ? 'high' :
      highCount >= 1 ? 'medium' : 'low';

    const automatableCount = breakingChanges.filter(bc => bc.automatable).length;
    const automationCoverage = breakingChanges.length > 0 
      ? Math.round((automatableCount / breakingChanges.length) * 100)
      : 100;

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
      routes,
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
    routes: RouteAnalysis[],
    breakingChanges: RemixBreakingChange[],
    dependencies: RemixDependencyAnalysis[]
  ): RemixUpgradeStats {
    const routesToMigrate = routes.filter(r => r.needsMigration);
    const oldLoaderCount = routes.filter(r => r.usesOldLoaderSignature).length;
    const oldActionCount = routes.filter(r => r.usesOldActionSignature).length;
    const oldMetaCount = routes.filter(r => r.usesOldMetaSignature).length;

    const highCount = breakingChanges.filter(bc => bc.severity === 'high').length;
    const totalEffortMinutes = 
      highCount * 20 + 
      (breakingChanges.length - highCount) * 10 +
      routesToMigrate.length * 5 +
      dependencies.filter(d => d.needsUpdate).length * 3 +
      40; // Tests

    const hours = Math.floor(totalEffortMinutes / 60);
    const minutes = totalEffortMinutes % 60;

    return {
      totalRoutes: routes.length,
      affectedRoutes: routesToMigrate.length,
      breakingChanges: breakingChanges.length,
      oldLoaderCount,
      oldActionCount,
      oldMetaCount,
      dependenciesToUpdate: dependencies.filter(d => d.needsUpdate).length,
      estimatedEffort: `${hours}h ${minutes}min`,
    };
  }

  /**
   * Générer des recommandations
   */
  private generateRecommendations(
    plan: RemixMigrationPlan,
    stats: RemixUpgradeStats
  ): RemixRecommendation[] {
    const recommendations: RemixRecommendation[] = [];

    // Tests
    recommendations.push({
      priority: 'high',
      category: 'Tests',
      title: 'Ajouter tests pour les routes migrées',
      description: `${stats.affectedRoutes} routes nécessitent migration. Ajouter des tests pour valider loaders/actions.`,
      effort: '1-2 jours',
    });

    // Type safety
    if (stats.oldLoaderCount > 0 || stats.oldActionCount > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Type Safety',
        title: 'Utiliser TypedResponse pour type-safety',
        description: 'Profiter de la migration pour améliorer le typing des loaders/actions avec TypedResponse.',
        effort: '2-3 heures',
      });
    }

    // Documentation
    recommendations.push({
      priority: 'medium',
      category: 'Documentation',
      title: 'Documenter les nouveaux patterns Remix',
      description: 'Créer un guide des patterns Remix 2.x pour l\'équipe.',
      effort: '1-2 heures',
    });

    // Performance
    if (plan.routes.length > 50) {
      recommendations.push({
        priority: 'medium',
        category: 'Performance',
        title: 'Optimiser les loaders avec defer()',
        description: 'Profiter de la migration pour implémenter defer() sur les routes lentes.',
        effort: '3-4 heures',
      });
    }

    return recommendations;
  }

  /**
   * Calculer les KPIs
   */
  private calculateKPIs(report: RemixUpgradeReport): KPI[] {
    const kpis: KPI[] = [];

    // Routes à migrer
    kpis.push({
      name: 'Routes à migrer',
      value: report.stats.affectedRoutes,
      unit: 'routes',
      status: report.stats.affectedRoutes === 0 ? 'ok' : 
              report.stats.affectedRoutes <= 10 ? 'warning' : 'critical',
    });

    // Breaking changes HIGH
    const highCount = report.plan.breakingChanges.filter(bc => bc.severity === 'high').length;
    kpis.push({
      name: 'Breaking changes HIGH',
      value: highCount,
      unit: 'changes',
      status: highCount === 0 ? 'ok' : highCount <= 2 ? 'warning' : 'critical',
    });

    // Automation coverage
    kpis.push({
      name: 'Automation coverage',
      value: report.plan.automationCoverage,
      unit: '%',
      status: report.plan.automationCoverage >= 60 ? 'ok' : 'warning',
    });

    return kpis;
  }

  /**
   * Sauvegarder les rapports
   */
  private async saveReports(report: RemixUpgradeReport): Promise<void> {
    const reportsDir = path.join(this.rootPath, 'ai-agents/reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // JSON
    const jsonPath = path.join(reportsDir, 'upgrade-remix.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Markdown
    const mdPath = path.join(reportsDir, 'upgrade-remix.md');
    const markdown = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, markdown);

    // Script de migration
    const scriptPath = path.join(reportsDir, 'migrate-remix-2.17.sh');
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
  private generateMarkdownReport(report: RemixUpgradeReport): string {
    let md = `# 🚀 Plan de Migration Remix ${report.version.current} → ${report.version.target}\n\n`;
    md += `**Date**: ${report.timestamp.toISOString()}\n\n`;
    md += `---\n\n`;

    // Version & Stats
    md += `## 📦 Version & Statistiques\n\n`;
    md += `- **Version actuelle**: ${report.version.current}\n`;
    md += `- **Version cible**: ${report.version.target}\n`;
    md += `- **Niveau de risque**: ${report.plan.riskLevel.toUpperCase()}\n`;
    md += `- **Durée estimée**: ${report.plan.estimatedDuration}\n`;
    md += `- **Automation**: ${report.plan.automationCoverage}%\n\n`;

    md += `### 📊 Statistiques\n\n`;
    md += `- **Routes totales**: ${report.stats.totalRoutes}\n`;
    md += `- **Routes à migrer**: ${report.stats.affectedRoutes}\n`;
    md += `  - Loaders obsolètes: ${report.stats.oldLoaderCount}\n`;
    md += `  - Actions obsolètes: ${report.stats.oldActionCount}\n`;
    md += `  - Meta obsolètes: ${report.stats.oldMetaCount}\n`;
    md += `- **Breaking changes**: ${report.stats.breakingChanges}\n`;
    md += `- **Dépendances à MAJ**: ${report.stats.dependenciesToUpdate}\n`;
    md += `- **Effort estimé**: ${report.stats.estimatedEffort}\n\n`;

    // Breaking changes avec exemples
    if (report.plan.breakingChanges.length > 0) {
      md += `## 🔴 Breaking Changes\n\n`;
      
      report.plan.breakingChanges.forEach((bc, i) => {
        const icon = bc.severity === 'critical' ? '🔴' : 
                     bc.severity === 'high' ? '🟠' : 
                     bc.severity === 'medium' ? '🟡' : '🟢';
        
        md += `### ${icon} ${i + 1}. ${bc.title}\n\n`;
        md += `- **ID**: ${bc.id}\n`;
        md += `- **Catégorie**: ${bc.category}\n`;
        md += `- **Sévérité**: ${bc.severity}\n`;
        md += `- **Fichiers affectés**: ${bc.affectedFiles.length}\n`;
        md += `- **Automatisable**: ${bc.automatable ? 'Oui ✅' : 'Non ⚠️'}\n\n`;
        md += `**Description**: ${bc.description}\n\n`;
        
        if (bc.codeExample) {
          md += `**Exemple de migration**:\n\n`;
          md += `Avant:\n\`\`\`typescript\n${bc.codeExample.before}\n\`\`\`\n\n`;
          md += `Après:\n\`\`\`typescript\n${bc.codeExample.after}\n\`\`\`\n\n`;
        }
      });
    }

    // Routes à migrer
    if (report.stats.affectedRoutes > 0) {
      md += `## 🛣️ Routes à Migrer (${report.stats.affectedRoutes})\n\n`;
      md += `| Route | Loader | Action | Meta |\n`;
      md += `|-------|--------|--------|------|\n`;
      
      const routesToMigrate = report.plan.routes.filter(r => r.needsMigration);
      routesToMigrate.slice(0, 20).forEach(route => {
        const loader = route.usesOldLoaderSignature ? '⚠️' : '✅';
        const action = route.usesOldActionSignature ? '⚠️' : '✅';
        const meta = route.usesOldMetaSignature ? '⚠️' : '✅';
        md += `| \`${route.routePath}\` | ${loader} | ${action} | ${meta} |\n`;
      });
      
      if (routesToMigrate.length > 20) {
        md += `\n*...et ${routesToMigrate.length - 20} routes supplémentaires*\n`;
      }
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
    md += `*Rapport généré par Agent 6: Upgrade Remix*\n`;

    return md;
  }

  /**
   * Générer un script de migration
   */
  private generateMigrationScript(plan: RemixMigrationPlan): string {
    let script = `#!/bin/bash\n`;
    script += `# Script de migration Remix ${plan.version.current} → ${plan.version.target}\n`;
    script += `# Généré automatiquement par Agent 6\n\n`;
    script += `set -e\n\n`;
    script += `echo "🚀 Migration Remix ${plan.version.current} → ${plan.version.target}"\n`;
    script += `echo "⚠️  Niveau de risque: ${plan.riskLevel}"\n\n`;

    plan.migrationSteps.forEach(step => {
      script += `echo "▶️  Étape ${step.order}: ${step.title}"\n`;
      if (step.commands.length > 0) {
        step.commands.forEach(cmd => script += `${cmd}\n`);
      }
      if (step.manualActions.length > 0) {
        script += `echo "⚠️  Actions manuelles requises"\n`;
        script += `read -p "Continuer? (y/n): " continue\n`;
        script += `[[ "$continue" != "y" ]] && exit 1\n`;
      }
      script += `echo "✅ Étape ${step.order} terminée"\n\n`;
    });

    script += `echo "🎉 Migration terminée!"\n`;
    return script;
  }
}
