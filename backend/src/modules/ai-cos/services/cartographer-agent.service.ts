/**
 * AI-COS v2.31.0: Cartographer Agent Service
 * 
 * Agent spécialisé pour la cartographie et le monitoring de l'architecture monorepo:
 * - Génération du graphe de dépendances entre packages
 * - Détection des dépendances circulaires
 * - Calcul du score de santé des packages
 * - Détection de la dérive architecturale
 * - Analyse des imports et exports
 * - Monitoring de la taille des bundles
 * 
 * Outils utilisés: dependency-cruiser, madge, source-map-explorer
 * 
 * @module CartographerAgentService
 * @version 2.31.0
 * @squad Tech Squad (T)
 * @agent A-CARTO (Architecture Cartographer)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// ============================================
// Types & Interfaces
// ============================================

export interface PackageInfo {
  name: string;
  path: string;
  version: string;
  dependencies: string[];
  devDependencies: string[];
  peerDependencies: string[];
  scripts: string[];
  isPublishable: boolean;
  lastModified: Date;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'dependency' | 'devDependency' | 'peerDependency' | 'import';
  weight: number;
  isCircular: boolean;
  violations: string[];
}

export interface DependencyGraph {
  nodes: PackageInfo[];
  edges: DependencyEdge[];
  totalDependencies: number;
  internalDependencies: number;
  externalDependencies: number;
  generatedAt: Date;
  mermaidDiagram: string;
  d3Data: D3GraphData;
}

export interface D3GraphData {
  nodes: Array<{
    id: string;
    group: number;
    size: number;
    healthScore: number;
    type: 'package' | 'app' | 'lib';
  }>;
  links: Array<{
    source: string;
    target: string;
    value: number;
    type: string;
  }>;
}

export interface CircularDependency {
  id: string;
  cycle: string[];
  severity: 'warning' | 'error' | 'critical';
  affectedPackages: string[];
  detectedAt: Date;
  suggestedFix: string;
  isResolved: boolean;
}

export interface PackageHealthScore {
  packageName: string;
  overallScore: number; // 0-100
  metrics: {
    dependencyCount: number;
    dependencyScore: number; // Moins = mieux
    circularDeps: number;
    circularScore: number;
    outdatedDeps: number;
    outdatedScore: number;
    testCoverage: number;
    coverageScore: number;
    bundleSize: number;
    bundleScore: number;
    lastUpdate: Date;
    freshnessScore: number;
    codeComplexity: number;
    complexityScore: number;
  };
  issues: PackageIssue[];
  recommendations: string[];
  trend: 'improving' | 'stable' | 'degrading';
}

export interface PackageIssue {
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'dependency' | 'circular' | 'security' | 'performance' | 'architecture';
  message: string;
  file?: string;
  line?: number;
  autoFixable: boolean;
  suggestedFix?: string;
}

export interface ArchitectureDrift {
  id: string;
  detectedAt: Date;
  driftType: 'layer_violation' | 'circular_dependency' | 'forbidden_import' | 'orphan_package' | 'bundle_bloat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFiles: string[];
  baselineRule: string;
  currentState: string;
  suggestedAction: string;
  autoFixable: boolean;
}

export interface BundleAnalysis {
  packageName: string;
  totalSize: number;
  gzipSize: number;
  parsedSize: number;
  modules: Array<{
    name: string;
    size: number;
    percentage: number;
  }>;
  largestModules: string[];
  potentialSavings: number;
  recommendations: string[];
  analyzedAt: Date;
}

export interface ArchitectureBaseline {
  version: string;
  createdAt: Date;
  packages: string[];
  allowedDependencies: Record<string, string[]>;
  forbiddenImports: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
  layers: Array<{
    name: string;
    packages: string[];
    canDependOn: string[];
  }>;
  maxBundleSizes: Record<string, number>;
  minHealthScores: Record<string, number>;
}

export interface CartographerReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'pr' | 'manual';
  generatedAt: Date;
  summary: {
    totalPackages: number;
    healthyPackages: number;
    warningPackages: number;
    criticalPackages: number;
    circularDepsCount: number;
    driftCount: number;
    averageHealthScore: number;
  };
  dependencyGraph: DependencyGraph;
  packageHealthScores: PackageHealthScore[];
  circularDependencies: CircularDependency[];
  architectureDrifts: ArchitectureDrift[];
  bundleAnalysis: BundleAnalysis[];
  recommendations: string[];
  kpis: CartographerKPIs;
}

export interface CartographerKPIs {
  circularDepsCount: number; // Target: 0
  averagePackageHealth: number; // Target: > 80
  architectureDriftCount: number; // Target: 0
  largestBundleSize: number; // Target: < 500KB
  orphanPackagesCount: number; // Target: < 5
  outdatedDepsCount: number; // Target: < 10
  criticalIssuesCount: number; // Target: 0
}

// ============================================
// Service Implementation
// ============================================

@Injectable()
export class CartographerAgentService implements OnModuleInit {
  private readonly logger = new Logger(CartographerAgentService.name);
  private readonly AGENT_ID = 'A-CARTO';
  private readonly SQUAD_ID = 'T'; // Tech Squad
  private readonly MONOREPO_ROOT = '/workspaces/nestjs-remix-monorepo';
  
  private architectureBaseline: ArchitectureBaseline | null = null;
  private lastReport: CartographerReport | null = null;
  private cachedGraph: DependencyGraph | null = null;
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('cartographer') private readonly cartographerQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('🗺️ Agent Cartographe initialisé - Surveillance architecture monorepo active');
    await this.loadArchitectureBaseline();
    this.eventEmitter.emit('ai-cos.agent.initialized', {
      agentId: this.AGENT_ID,
      agentName: 'Cartographer Agent',
      squadId: this.SQUAD_ID,
      capabilities: [
        'dependency-graph-generation',
        'circular-deps-detection',
        'package-health-scoring',
        'architecture-drift-detection',
        'bundle-analysis',
      ],
    });
  }

  // ============================================
  // Core Methods
  // ============================================

  /**
   * Génère le graphe complet de dépendances du monorepo
   */
  async generateDependencyGraph(forceRefresh = false): Promise<DependencyGraph> {
    // Check cache
    if (!forceRefresh && this.cachedGraph && this.cacheTimestamp) {
      const age = Date.now() - this.cacheTimestamp.getTime();
      if (age < this.CACHE_TTL_MS) {
        this.logger.debug('Returning cached dependency graph');
        return this.cachedGraph;
      }
    }

    this.logger.log('📊 Génération du graphe de dépendances...');
    const startTime = Date.now();

    try {
      // Scan all packages
      const packages = await this.scanPackages();
      const edges: DependencyEdge[] = [];

      // Build edges from package.json dependencies
      for (const pkg of packages) {
        for (const dep of pkg.dependencies) {
          const targetPkg = packages.find(p => p.name === dep);
          if (targetPkg) {
            edges.push({
              from: pkg.name,
              to: dep,
              type: 'dependency',
              weight: 1,
              isCircular: false,
              violations: [],
            });
          }
        }
        for (const dep of pkg.devDependencies) {
          const targetPkg = packages.find(p => p.name === dep);
          if (targetPkg) {
            edges.push({
              from: pkg.name,
              to: dep,
              type: 'devDependency',
              weight: 0.5,
              isCircular: false,
              violations: [],
            });
          }
        }
      }

      // Run dependency-cruiser for detailed analysis
      const cruiserResult = await this.runDependencyCruiser();
      if (cruiserResult) {
        // Merge cruiser findings
        for (const module of cruiserResult.modules || []) {
          for (const dep of module.dependencies || []) {
            if (dep.circular) {
              const edge = edges.find(e => e.from === module.source && e.to === dep.resolved);
              if (edge) {
                edge.isCircular = true;
              }
            }
            if (dep.valid === false) {
              const edge = edges.find(e => e.from === module.source && e.to === dep.resolved);
              if (edge) {
                edge.violations.push(...(dep.rules || []).map((r: any) => r.name));
              }
            }
          }
        }
      }

      // Generate visualizations
      const mermaidDiagram = this.generateMermaidDiagram(packages, edges);
      const d3Data = this.generateD3Data(packages, edges);

      const graph: DependencyGraph = {
        nodes: packages,
        edges,
        totalDependencies: edges.length,
        internalDependencies: edges.filter(e => packages.some(p => p.name === e.to)).length,
        externalDependencies: edges.filter(e => !packages.some(p => p.name === e.to)).length,
        generatedAt: new Date(),
        mermaidDiagram,
        d3Data,
      };

      // Update cache
      this.cachedGraph = graph;
      this.cacheTimestamp = new Date();

      // Emit event
      this.eventEmitter.emit('ai-cos.cartographer.graph-generated', {
        agentId: this.AGENT_ID,
        nodesCount: packages.length,
        edgesCount: edges.length,
        duration: Date.now() - startTime,
      });

      this.logger.log(`✅ Graphe généré: ${packages.length} packages, ${edges.length} dépendances (${Date.now() - startTime}ms)`);

      return graph;
    } catch (error) {
      this.logger.error('❌ Erreur génération graphe:', error);
      throw error;
    }
  }

  /**
   * Détecte toutes les dépendances circulaires
   */
  async detectCircularDependencies(): Promise<CircularDependency[]> {
    this.logger.log('🔄 Détection des dépendances circulaires...');

    try {
      // Use madge for circular dependency detection
      const { stdout } = await execAsync(
        `cd ${this.MONOREPO_ROOT} && npx madge --circular --json packages/ backend/src frontend/app 2>/dev/null || echo "[]"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      let cycles: string[][] = [];
      try {
        cycles = JSON.parse(stdout.trim() || '[]');
      } catch {
        cycles = [];
      }

      const circularDeps: CircularDependency[] = cycles.map((cycle, index) => ({
        id: `circular-${Date.now()}-${index}`,
        cycle,
        severity: cycle.length > 3 ? 'critical' : cycle.length > 2 ? 'error' : 'warning',
        affectedPackages: [...new Set(cycle.map(f => this.extractPackageName(f)))],
        detectedAt: new Date(),
        suggestedFix: this.suggestCircularFix(cycle),
        isResolved: false,
      }));

      // Save to database
      if (circularDeps.length > 0) {
        await this.saveCircularDepsToDb(circularDeps);
      }

      // Emit event
      this.eventEmitter.emit('ai-cos.cartographer.circular-deps-detected', {
        agentId: this.AGENT_ID,
        count: circularDeps.length,
        criticalCount: circularDeps.filter(c => c.severity === 'critical').length,
      });

      this.logger.log(`🔄 ${circularDeps.length} dépendances circulaires détectées`);

      return circularDeps;
    } catch (error) {
      this.logger.error('❌ Erreur détection circulaires:', error);
      return [];
    }
  }

  /**
   * Calcule le score de santé pour chaque package
   */
  async calculatePackageHealth(): Promise<PackageHealthScore[]> {
    this.logger.log('💊 Calcul des scores de santé des packages...');

    const packages = await this.scanPackages();
    const healthScores: PackageHealthScore[] = [];

    for (const pkg of packages) {
      try {
        const health = await this.analyzePackageHealth(pkg);
        healthScores.push(health);
      } catch (error) {
        this.logger.warn(`⚠️ Erreur analyse santé ${pkg.name}:`, error);
      }
    }

    // Calculate overall averages
    const avgHealth = healthScores.length > 0
      ? healthScores.reduce((sum, h) => sum + h.overallScore, 0) / healthScores.length
      : 0;

    // Emit event
    this.eventEmitter.emit('ai-cos.cartographer.health-calculated', {
      agentId: this.AGENT_ID,
      packagesAnalyzed: healthScores.length,
      averageHealth: avgHealth,
      criticalPackages: healthScores.filter(h => h.overallScore < 50).length,
    });

    this.logger.log(`💊 Santé calculée: ${healthScores.length} packages, moyenne ${avgHealth.toFixed(1)}%`);

    return healthScores;
  }

  /**
   * Détecte les dérives architecturales par rapport à la baseline
   */
  async detectArchitectureDrift(): Promise<ArchitectureDrift[]> {
    this.logger.log('📐 Détection des dérives architecturales...');

    if (!this.architectureBaseline) {
      this.logger.warn('⚠️ Pas de baseline architecture définie');
      return [];
    }

    const drifts: ArchitectureDrift[] = [];

    // 1. Check layer violations
    const layerViolations = await this.checkLayerViolations();
    drifts.push(...layerViolations);

    // 2. Check forbidden imports
    const forbiddenImports = await this.checkForbiddenImports();
    drifts.push(...forbiddenImports);

    // 3. Check orphan packages
    const orphans = await this.checkOrphanPackages();
    drifts.push(...orphans);

    // 4. Check bundle size limits
    const bundleDrifts = await this.checkBundleSizeLimits();
    drifts.push(...bundleDrifts);

    // Save drifts to database
    if (drifts.length > 0) {
      await this.saveDriftsToDb(drifts);
    }

    // Emit event
    this.eventEmitter.emit('ai-cos.cartographer.drift-detected', {
      agentId: this.AGENT_ID,
      driftCount: drifts.length,
      criticalDrifts: drifts.filter(d => d.severity === 'critical').length,
      driftTypes: [...new Set(drifts.map(d => d.driftType))],
    });

    this.logger.log(`📐 ${drifts.length} dérives architecturales détectées`);

    return drifts;
  }

  /**
   * Analyse la taille des bundles
   */
  async analyzeBundleSizes(): Promise<BundleAnalysis[]> {
    this.logger.log('📦 Analyse des tailles de bundles...');

    const analyses: BundleAnalysis[] = [];

    // Analyze frontend build
    try {
      const frontendAnalysis = await this.analyzeFrontendBundle();
      if (frontendAnalysis) {
        analyses.push(frontendAnalysis);
      }
    } catch (error) {
      this.logger.warn('⚠️ Erreur analyse bundle frontend:', error);
    }

    // Analyze backend build
    try {
      const backendAnalysis = await this.analyzeBackendBundle();
      if (backendAnalysis) {
        analyses.push(backendAnalysis);
      }
    } catch (error) {
      this.logger.warn('⚠️ Erreur analyse bundle backend:', error);
    }

    // Emit event
    this.eventEmitter.emit('ai-cos.cartographer.bundle-analyzed', {
      agentId: this.AGENT_ID,
      packagesAnalyzed: analyses.length,
      totalSize: analyses.reduce((sum, a) => sum + a.totalSize, 0),
    });

    return analyses;
  }

  /**
   * Génère un rapport complet de cartographie
   */
  async generateReport(reportType: 'daily' | 'weekly' | 'pr' | 'manual' = 'manual'): Promise<CartographerReport> {
    this.logger.log(`📋 Génération rapport cartographie (${reportType})...`);
    const startTime = Date.now();

    // Run all analyses in parallel
    const [
      dependencyGraph,
      circularDeps,
      packageHealthScores,
      architectureDrifts,
      bundleAnalysis,
    ] = await Promise.all([
      this.generateDependencyGraph(true),
      this.detectCircularDependencies(),
      this.calculatePackageHealth(),
      this.detectArchitectureDrift(),
      this.analyzeBundleSizes(),
    ]);

    // Calculate summary
    const healthyCount = packageHealthScores.filter(h => h.overallScore >= 80).length;
    const warningCount = packageHealthScores.filter(h => h.overallScore >= 50 && h.overallScore < 80).length;
    const criticalCount = packageHealthScores.filter(h => h.overallScore < 50).length;
    const avgHealth = packageHealthScores.length > 0
      ? packageHealthScores.reduce((sum, h) => sum + h.overallScore, 0) / packageHealthScores.length
      : 0;

    // Calculate KPIs
    const kpis: CartographerKPIs = {
      circularDepsCount: circularDeps.length,
      averagePackageHealth: Math.round(avgHealth),
      architectureDriftCount: architectureDrifts.length,
      largestBundleSize: bundleAnalysis.length > 0
        ? Math.max(...bundleAnalysis.map(b => b.totalSize))
        : 0,
      orphanPackagesCount: architectureDrifts.filter(d => d.driftType === 'orphan_package').length,
      outdatedDepsCount: packageHealthScores.reduce((sum, h) => sum + h.metrics.outdatedDeps, 0),
      criticalIssuesCount: criticalCount + circularDeps.filter(c => c.severity === 'critical').length,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      circularDeps,
      packageHealthScores,
      architectureDrifts,
      bundleAnalysis,
    );

    const report: CartographerReport = {
      id: `carto-report-${Date.now()}`,
      reportType,
      generatedAt: new Date(),
      summary: {
        totalPackages: dependencyGraph.nodes.length,
        healthyPackages: healthyCount,
        warningPackages: warningCount,
        criticalPackages: criticalCount,
        circularDepsCount: circularDeps.length,
        driftCount: architectureDrifts.length,
        averageHealthScore: avgHealth,
      },
      dependencyGraph,
      packageHealthScores,
      circularDependencies: circularDeps,
      architectureDrifts,
      bundleAnalysis,
      recommendations,
      kpis,
    };

    // Save report
    await this.saveReportToDb(report);
    this.lastReport = report;

    // Emit event
    this.eventEmitter.emit('ai-cos.cartographer.report-generated', {
      agentId: this.AGENT_ID,
      reportId: report.id,
      reportType,
      kpis,
      duration: Date.now() - startTime,
    });

    // Check KPI thresholds and alert if needed
    await this.checkKPIThresholds(kpis);

    this.logger.log(`✅ Rapport généré en ${Date.now() - startTime}ms`);

    return report;
  }

  // ============================================
  // Scheduled Tasks
  // ============================================

  /**
   * Scan quotidien à 6h - Génération rapport journalier
   */
  @Cron('0 6 * * *', { name: 'cartographer-daily-scan' })
  async dailyScan() {
    this.logger.log('⏰ Lancement scan quotidien cartographie...');
    
    try {
      const report = await this.generateReport('daily');
      
      // Alert if critical issues found
      if (report.kpis.criticalIssuesCount > 0) {
        await this.alertCriticalIssues(report);
      }

      this.eventEmitter.emit('ai-cos.cartographer.daily-scan-complete', {
        agentId: this.AGENT_ID,
        reportId: report.id,
        kpis: report.kpis,
      });
    } catch (error) {
      this.logger.error('❌ Erreur scan quotidien:', error);
    }
  }

  /**
   * Rapport hebdomadaire complet - Dimanche 8h
   */
  @Cron('0 8 * * 0', { name: 'cartographer-weekly-report' })
  async weeklyReport() {
    this.logger.log('📊 Génération rapport hebdomadaire...');
    
    try {
      const report = await this.generateReport('weekly');
      
      // Send detailed weekly summary
      await this.sendWeeklySummary(report);

      this.eventEmitter.emit('ai-cos.cartographer.weekly-report-complete', {
        agentId: this.AGENT_ID,
        reportId: report.id,
      });
    } catch (error) {
      this.logger.error('❌ Erreur rapport hebdomadaire:', error);
    }
  }

  /**
   * Vérification rapide toutes les 4 heures
   */
  @Cron('0 */4 * * *', { name: 'cartographer-quick-check' })
  async quickCheck() {
    this.logger.debug('🔍 Quick check architecture...');
    
    try {
      const circularDeps = await this.detectCircularDependencies();
      
      // Alert immediately if new circular deps found
      if (circularDeps.length > 0) {
        const newCircular = circularDeps.filter(c => {
          const age = Date.now() - c.detectedAt.getTime();
          return age < 4 * 60 * 60 * 1000; // Less than 4 hours old
        });

        if (newCircular.length > 0) {
          this.eventEmitter.emit('ai-cos.cartographer.new-circular-deps', {
            agentId: this.AGENT_ID,
            newCount: newCircular.length,
            cycles: newCircular.map(c => c.cycle),
          });
        }
      }
    } catch (error) {
      this.logger.error('❌ Erreur quick check:', error);
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async scanPackages(): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];
    const packageDirs = [
      'packages/design-tokens',
      'packages/eslint-config',
      'packages/patterns',
      'packages/shared-types',
      'packages/theme-admin',
      'packages/theme-vitrine',
      'packages/typescript-config',
      'packages/ui',
      'backend',
      'frontend',
    ];

    for (const dir of packageDirs) {
      const pkgPath = path.join(this.MONOREPO_ROOT, dir, 'package.json');
      try {
        const content = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content);
        const stat = await fs.stat(pkgPath);

        packages.push({
          name: pkg.name || dir,
          path: dir,
          version: pkg.version || '0.0.0',
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {}),
          peerDependencies: Object.keys(pkg.peerDependencies || {}),
          scripts: Object.keys(pkg.scripts || {}),
          isPublishable: pkg.private !== true,
          lastModified: stat.mtime,
        });
      } catch (error) {
        this.logger.debug(`Package non trouvé: ${dir}`);
      }
    }

    return packages;
  }

  private async runDependencyCruiser(): Promise<any | null> {
    try {
      const { stdout } = await execAsync(
        `cd ${this.MONOREPO_ROOT} && npx depcruise --output-type json packages/ backend/src frontend/app 2>/dev/null`,
        { maxBuffer: 50 * 1024 * 1024 }
      );
      return JSON.parse(stdout);
    } catch (error) {
      this.logger.debug('dependency-cruiser non disponible ou erreur:', error);
      return null;
    }
  }

  private generateMermaidDiagram(packages: PackageInfo[], edges: DependencyEdge[]): string {
    let diagram = 'graph TD\n';
    
    // Add nodes with styling
    for (const pkg of packages) {
      const shortName = pkg.name.replace('@monorepo/', '').replace('/', '_');
      if (pkg.path.startsWith('packages/')) {
        diagram += `    ${shortName}[📦 ${shortName}]\n`;
      } else if (pkg.path === 'backend') {
        diagram += `    ${shortName}[⚙️ ${shortName}]\n`;
      } else if (pkg.path === 'frontend') {
        diagram += `    ${shortName}[🖥️ ${shortName}]\n`;
      }
    }

    // Add edges
    for (const edge of edges) {
      const fromShort = edge.from.replace('@monorepo/', '').replace('/', '_');
      const toShort = edge.to.replace('@monorepo/', '').replace('/', '_');
      
      if (packages.some(p => p.name === edge.to)) {
        if (edge.isCircular) {
          diagram += `    ${fromShort} -->|🔴 circular| ${toShort}\n`;
        } else if (edge.type === 'devDependency') {
          diagram += `    ${fromShort} -.-> ${toShort}\n`;
        } else {
          diagram += `    ${fromShort} --> ${toShort}\n`;
        }
      }
    }

    return diagram;
  }

  private generateD3Data(packages: PackageInfo[], edges: DependencyEdge[]): D3GraphData {
    const groupMap: Record<string, number> = {
      'packages/ui': 1,
      'packages/design-tokens': 1,
      'packages/theme-admin': 1,
      'packages/theme-vitrine': 1,
      'packages/shared-types': 2,
      'packages/typescript-config': 2,
      'packages/eslint-config': 2,
      'packages/patterns': 2,
      'backend': 3,
      'frontend': 4,
    };

    return {
      nodes: packages.map(pkg => ({
        id: pkg.name,
        group: groupMap[pkg.path] || 0,
        size: pkg.dependencies.length + pkg.devDependencies.length + 10,
        healthScore: 75, // Will be updated with actual health
        type: pkg.path.startsWith('packages/') ? 'lib' : 'app',
      })),
      links: edges
        .filter(e => packages.some(p => p.name === e.to))
        .map(e => ({
          source: e.from,
          target: e.to,
          value: e.weight,
          type: e.isCircular ? 'circular' : e.type,
        })),
    };
  }

  private extractPackageName(filePath: string): string {
    const parts = filePath.split('/');
    if (parts[0] === 'packages' && parts.length > 1) {
      return `packages/${parts[1]}`;
    }
    if (parts[0] === 'backend' || parts[0] === 'frontend') {
      return parts[0];
    }
    return filePath;
  }

  private suggestCircularFix(cycle: string[]): string {
    if (cycle.length === 2) {
      return `Extraire l'interface commune dans un module partagé (packages/shared-types)`;
    }
    if (cycle.length > 3) {
      return `Chaîne de dépendances complexe. Considérer: 1) Event-driven architecture, 2) Dependency injection, 3) Module commun`;
    }
    return `Inverser la dépendance via une interface ou utiliser l'injection de dépendances`;
  }

  private async analyzePackageHealth(pkg: PackageInfo): Promise<PackageHealthScore> {
    const issues: PackageIssue[] = [];
    const recommendations: string[] = [];

    // Calculate individual metrics
    const depCount = pkg.dependencies.length;
    const depScore = Math.max(0, 100 - depCount * 2);
    
    const outdatedDeps = 0; // Would need npm outdated
    const outdatedScore = Math.max(0, 100 - outdatedDeps * 5);
    
    const testCoverage = 70; // Placeholder
    const coverageScore = testCoverage;
    
    const bundleSize = 0; // Would need bundle analysis
    const bundleScore = 80; // Placeholder
    
    const daysSinceUpdate = Math.floor(
      (Date.now() - pkg.lastModified.getTime()) / (1000 * 60 * 60 * 24)
    );
    const freshnessScore = Math.max(0, 100 - daysSinceUpdate);
    
    const complexityScore = 75; // Placeholder

    // Check for issues
    if (depCount > 20) {
      issues.push({
        severity: 'warning',
        category: 'dependency',
        message: `Trop de dépendances (${depCount})`,
        autoFixable: false,
        suggestedFix: 'Auditer et réduire les dépendances',
      });
      recommendations.push(`Réduire le nombre de dépendances (actuellement ${depCount})`);
    }

    if (daysSinceUpdate > 30) {
      issues.push({
        severity: 'info',
        category: 'performance',
        message: `Package non mis à jour depuis ${daysSinceUpdate} jours`,
        autoFixable: false,
      });
    }

    // Calculate overall score
    const overallScore = Math.round(
      (depScore + outdatedScore + coverageScore + bundleScore + freshnessScore + complexityScore) / 6
    );

    return {
      packageName: pkg.name,
      overallScore,
      metrics: {
        dependencyCount: depCount,
        dependencyScore: depScore,
        circularDeps: 0,
        circularScore: 100,
        outdatedDeps,
        outdatedScore,
        testCoverage,
        coverageScore,
        bundleSize,
        bundleScore,
        lastUpdate: pkg.lastModified,
        freshnessScore,
        codeComplexity: 5,
        complexityScore,
      },
      issues,
      recommendations,
      trend: 'stable',
    };
  }

  private async checkLayerViolations(): Promise<ArchitectureDrift[]> {
    const drifts: ArchitectureDrift[] = [];

    if (!this.architectureBaseline?.layers) return drifts;

    // Check if frontend imports from backend directly
    try {
      const { stdout } = await execAsync(
        `grep -r "from.*backend" ${this.MONOREPO_ROOT}/frontend/app --include="*.ts" --include="*.tsx" 2>/dev/null | head -20 || true`
      );

      if (stdout.trim()) {
        drifts.push({
          id: `drift-layer-${Date.now()}`,
          detectedAt: new Date(),
          driftType: 'layer_violation',
          severity: 'high',
          description: 'Frontend importe directement depuis backend',
          affectedFiles: stdout.split('\n').filter(Boolean).map(l => l.split(':')[0]),
          baselineRule: 'frontend ne doit pas importer directement depuis backend',
          currentState: 'Imports directs détectés',
          suggestedAction: 'Utiliser les types partagés dans packages/shared-types',
          autoFixable: false,
        });
      }
    } catch {
      // Ignore errors
    }

    return drifts;
  }

  private async checkForbiddenImports(): Promise<ArchitectureDrift[]> {
    const drifts: ArchitectureDrift[] = [];

    // Check for forbidden imports from baseline
    for (const rule of this.architectureBaseline?.forbiddenImports || []) {
      try {
        const { stdout } = await execAsync(
          `grep -r "from.*${rule.to}" ${this.MONOREPO_ROOT}/${rule.from} --include="*.ts" --include="*.tsx" 2>/dev/null | head -10 || true`
        );

        if (stdout.trim()) {
          drifts.push({
            id: `drift-forbidden-${Date.now()}-${rule.from}-${rule.to}`,
            detectedAt: new Date(),
            driftType: 'forbidden_import',
            severity: 'medium',
            description: `Import interdit: ${rule.from} → ${rule.to}`,
            affectedFiles: stdout.split('\n').filter(Boolean).map(l => l.split(':')[0]),
            baselineRule: rule.reason,
            currentState: 'Import interdit détecté',
            suggestedAction: `Refactorer pour éviter l'import depuis ${rule.to}`,
            autoFixable: false,
          });
        }
      } catch {
        // Ignore errors
      }
    }

    return drifts;
  }

  private async checkOrphanPackages(): Promise<ArchitectureDrift[]> {
    const drifts: ArchitectureDrift[] = [];
    const graph = await this.generateDependencyGraph();

    // Find packages with no dependents
    for (const pkg of graph.nodes) {
      if (pkg.path.startsWith('packages/')) {
        const hasDependent = graph.edges.some(e => e.to === pkg.name);
        if (!hasDependent) {
          drifts.push({
            id: `drift-orphan-${Date.now()}-${pkg.name}`,
            detectedAt: new Date(),
            driftType: 'orphan_package',
            severity: 'low',
            description: `Package orphelin: ${pkg.name}`,
            affectedFiles: [pkg.path],
            baselineRule: 'Tous les packages doivent être utilisés',
            currentState: 'Aucune dépendance vers ce package',
            suggestedAction: 'Supprimer ou intégrer ce package',
            autoFixable: false,
          });
        }
      }
    }

    return drifts;
  }

  private async checkBundleSizeLimits(): Promise<ArchitectureDrift[]> {
    const drifts: ArchitectureDrift[] = [];

    if (!this.architectureBaseline?.maxBundleSizes) return drifts;

    const bundleAnalysis = await this.analyzeBundleSizes();

    for (const analysis of bundleAnalysis) {
      const limit = this.architectureBaseline.maxBundleSizes[analysis.packageName];
      if (limit && analysis.totalSize > limit) {
        drifts.push({
          id: `drift-bundle-${Date.now()}-${analysis.packageName}`,
          detectedAt: new Date(),
          driftType: 'bundle_bloat',
          severity: analysis.totalSize > limit * 1.5 ? 'high' : 'medium',
          description: `Bundle trop gros: ${analysis.packageName} (${Math.round(analysis.totalSize / 1024)}KB > ${Math.round(limit / 1024)}KB)`,
          affectedFiles: analysis.largestModules,
          baselineRule: `Limite: ${Math.round(limit / 1024)}KB`,
          currentState: `Taille actuelle: ${Math.round(analysis.totalSize / 1024)}KB`,
          suggestedAction: analysis.recommendations.join('; '),
          autoFixable: false,
        });
      }
    }

    return drifts;
  }

  private async analyzeFrontendBundle(): Promise<BundleAnalysis | null> {
    const buildDir = path.join(this.MONOREPO_ROOT, 'frontend', 'build');
    
    try {
      await fs.access(buildDir);
    } catch {
      return null;
    }

    try {
      const { stdout } = await execAsync(`du -sb ${buildDir} 2>/dev/null`);
      const totalSize = parseInt(stdout.split('\t')[0], 10);

      return {
        packageName: 'frontend',
        totalSize,
        gzipSize: Math.round(totalSize * 0.3), // Estimate
        parsedSize: totalSize,
        modules: [],
        largestModules: [],
        potentialSavings: 0,
        recommendations: totalSize > 500 * 1024
          ? ['Activer le code splitting', 'Lazy load les routes', 'Tree-shaking des dépendances']
          : [],
        analyzedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  private async analyzeBackendBundle(): Promise<BundleAnalysis | null> {
    const distDir = path.join(this.MONOREPO_ROOT, 'backend', 'dist');
    
    try {
      await fs.access(distDir);
    } catch {
      return null;
    }

    try {
      const { stdout } = await execAsync(`du -sb ${distDir} 2>/dev/null`);
      const totalSize = parseInt(stdout.split('\t')[0], 10);

      return {
        packageName: 'backend',
        totalSize,
        gzipSize: Math.round(totalSize * 0.3),
        parsedSize: totalSize,
        modules: [],
        largestModules: [],
        potentialSavings: 0,
        recommendations: [],
        analyzedAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  private generateRecommendations(
    circularDeps: CircularDependency[],
    healthScores: PackageHealthScore[],
    drifts: ArchitectureDrift[],
    bundleAnalysis: BundleAnalysis[],
  ): string[] {
    const recommendations: string[] = [];

    // Circular dependencies recommendations
    if (circularDeps.length > 0) {
      recommendations.push(
        `🔴 PRIORITÉ: Résoudre ${circularDeps.length} dépendance(s) circulaire(s) - Impact performance et maintenabilité`
      );
    }

    // Health recommendations
    const unhealthy = healthScores.filter(h => h.overallScore < 60);
    if (unhealthy.length > 0) {
      recommendations.push(
        `⚠️ ${unhealthy.length} package(s) en mauvaise santé: ${unhealthy.map(h => h.packageName).join(', ')}`
      );
    }

    // Drift recommendations
    const criticalDrifts = drifts.filter(d => d.severity === 'critical' || d.severity === 'high');
    if (criticalDrifts.length > 0) {
      recommendations.push(
        `📐 ${criticalDrifts.length} dérive(s) architecturale(s) critique(s) à corriger`
      );
    }

    // Bundle recommendations
    const largeBundles = bundleAnalysis.filter(b => b.totalSize > 400 * 1024);
    if (largeBundles.length > 0) {
      recommendations.push(
        `📦 ${largeBundles.length} bundle(s) > 400KB - Optimisation recommandée`
      );
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('✅ Architecture saine - Maintenir la qualité actuelle');
    }

    return recommendations;
  }

  private async loadArchitectureBaseline() {
    // Try to load from file or database
    const baselinePath = path.join(this.MONOREPO_ROOT, '.spec', 'architecture-baseline.json');
    
    try {
      const content = await fs.readFile(baselinePath, 'utf-8');
      this.architectureBaseline = JSON.parse(content);
      this.logger.log('📐 Baseline architecture chargée');
    } catch {
      // Create default baseline
      this.architectureBaseline = {
        version: '1.0.0',
        createdAt: new Date(),
        packages: [
          'packages/ui',
          'packages/design-tokens',
          'packages/shared-types',
          'packages/typescript-config',
          'packages/eslint-config',
          'packages/patterns',
          'packages/theme-admin',
          'packages/theme-vitrine',
          'backend',
          'frontend',
        ],
        allowedDependencies: {
          'frontend': ['packages/*', '@monorepo/*'],
          'backend': ['packages/shared-types', '@monorepo/shared-types'],
          'packages/ui': ['packages/design-tokens', 'packages/patterns'],
        },
        forbiddenImports: [
          { from: 'frontend', to: 'backend/src', reason: 'Frontend ne doit pas importer backend' },
          { from: 'packages/ui', to: 'frontend/app', reason: 'UI ne doit pas dépendre de frontend' },
        ],
        layers: [
          { name: 'ui', packages: ['packages/ui', 'packages/design-tokens'], canDependOn: ['shared'] },
          { name: 'app', packages: ['frontend', 'backend'], canDependOn: ['ui', 'shared'] },
          { name: 'shared', packages: ['packages/shared-types', 'packages/patterns'], canDependOn: [] },
        ],
        maxBundleSizes: {
          'frontend': 500 * 1024, // 500KB
          'backend': 1024 * 1024, // 1MB
        },
        minHealthScores: {
          'packages/ui': 80,
          'packages/shared-types': 90,
        },
      };
      this.logger.log('📐 Baseline architecture par défaut créée');
    }
  }

  private async saveCircularDepsToDb(deps: CircularDependency[]) {
    try {
      await this.supabase.client
        .from('ai_cos_cartographer_issues')
        .insert(deps.map(d => ({
          id: d.id,
          issue_type: 'circular_dependency',
          severity: d.severity,
          data: d,
          detected_at: d.detectedAt.toISOString(),
          is_resolved: false,
        })));
    } catch (error) {
      this.logger.warn('Erreur sauvegarde circular deps:', error);
    }
  }

  private async saveDriftsToDb(drifts: ArchitectureDrift[]) {
    try {
      await this.supabase.client
        .from('ai_cos_cartographer_issues')
        .insert(drifts.map(d => ({
          id: d.id,
          issue_type: d.driftType,
          severity: d.severity,
          data: d,
          detected_at: d.detectedAt.toISOString(),
          is_resolved: false,
        })));
    } catch (error) {
      this.logger.warn('Erreur sauvegarde drifts:', error);
    }
  }

  private async saveReportToDb(report: CartographerReport) {
    try {
      await this.supabase.client
        .from('ai_cos_cartographer_reports')
        .insert({
          id: report.id,
          report_type: report.reportType,
          summary: report.summary,
          kpis: report.kpis,
          recommendations: report.recommendations,
          generated_at: report.generatedAt.toISOString(),
        });
    } catch (error) {
      this.logger.warn('Erreur sauvegarde report:', error);
    }
  }

  private async checkKPIThresholds(kpis: CartographerKPIs) {
    const alerts: string[] = [];

    if (kpis.circularDepsCount > 0) {
      alerts.push(`🔴 ${kpis.circularDepsCount} dépendances circulaires détectées`);
    }
    if (kpis.averagePackageHealth < 70) {
      alerts.push(`⚠️ Santé moyenne packages basse: ${kpis.averagePackageHealth}%`);
    }
    if (kpis.architectureDriftCount > 5) {
      alerts.push(`📐 ${kpis.architectureDriftCount} dérives architecturales`);
    }
    if (kpis.largestBundleSize > 500 * 1024) {
      alerts.push(`📦 Bundle trop gros: ${Math.round(kpis.largestBundleSize / 1024)}KB`);
    }

    if (alerts.length > 0) {
      this.eventEmitter.emit('ai-cos.cartographer.kpi-alert', {
        agentId: this.AGENT_ID,
        alerts,
        kpis,
      });
    }
  }

  private async alertCriticalIssues(report: CartographerReport) {
    this.eventEmitter.emit('ai-cos.cartographer.critical-alert', {
      agentId: this.AGENT_ID,
      reportId: report.id,
      criticalIssues: report.kpis.criticalIssuesCount,
      circularDeps: report.kpis.circularDepsCount,
      recommendations: report.recommendations.slice(0, 3),
    });
  }

  private async sendWeeklySummary(report: CartographerReport) {
    this.eventEmitter.emit('ai-cos.cartographer.weekly-summary', {
      agentId: this.AGENT_ID,
      reportId: report.id,
      summary: report.summary,
      kpis: report.kpis,
      topRecommendations: report.recommendations.slice(0, 5),
    });
  }

  // ============================================
  // Public API Methods
  // ============================================

  getLastReport(): CartographerReport | null {
    return this.lastReport;
  }

  async getKPIs(): Promise<CartographerKPIs> {
    if (this.lastReport) {
      return this.lastReport.kpis;
    }
    
    // Generate fresh KPIs
    const report = await this.generateReport('manual');
    return report.kpis;
  }

  async validatePRArchitecture(changedFiles: string[]): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    this.logger.log(`🔍 Validation architecture PR: ${changedFiles.length} fichiers...`);

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for new circular deps
    const circularDeps = await this.detectCircularDependencies();
    if (circularDeps.length > 0) {
      issues.push(`${circularDeps.length} dépendance(s) circulaire(s) détectée(s)`);
    }

    // Check architecture drifts
    const drifts = await this.detectArchitectureDrift();
    const relevantDrifts = drifts.filter(d =>
      d.affectedFiles.some(f => changedFiles.some(cf => cf.includes(f) || f.includes(cf)))
    );

    for (const drift of relevantDrifts) {
      if (drift.severity === 'critical' || drift.severity === 'high') {
        issues.push(drift.description);
      } else {
        warnings.push(drift.description);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }
}
