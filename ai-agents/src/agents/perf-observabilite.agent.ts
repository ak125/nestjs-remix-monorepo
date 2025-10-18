/**
 * Agent 10 : Perf & Observabilité
 * 
 * Fonction : Surveiller la performance et établir une baseline
 * 
 * Périmètre : 
 * - Backend NestJS (API endpoints, Prisma queries)
 * - Frontend Remix (loaders, bundles)
 * - Cache Redis (hit rate, latency)
 * - Build & Deploy (temps, taille)
 * 
 * Livrables :
 * - Baseline de performance complète
 * - Identification des bottlenecks
 * - KPIs de monitoring continu
 * - Recommandations d'optimisation
 */

import { 
  IAgent, 
  AgentResult, 
  AgentStatus,
  KPI,
} from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PerformanceMetrics {
  backend: BackendMetrics;
  frontend: FrontendMetrics;
  cache: CacheMetrics;
  build: BuildMetrics;
}

interface BackendMetrics {
  endpoints: EndpointMetric[];
  database: DatabaseMetric;
  averageResponseTime: number;
  errorRate: number;
}

interface EndpointMetric {
  path: string;
  method: string;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestCount: number;
  errorCount: number;
  slowestQuery?: string;
}

interface DatabaseMetric {
  totalQueries: number;
  avgQueryTime: number;
  slowQueries: Array<{ query: string; time: number }>;
  connectionPoolSize: number;
}

interface FrontendMetrics {
  routes: RouteMetric[];
  bundles: BundleMetric[];
  webVitals: WebVitals;
}

interface RouteMetric {
  path: string;
  loaderTime: number;
  dataSize: number;
  cacheable: boolean;
}

interface BundleMetric {
  name: string;
  size: number;
  gzipSize: number;
  modules: number;
}

interface WebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  avgLatency: number;
  memoryUsage: number;
  keysCount: number;
  evictedKeys: number;
}

interface BuildMetrics {
  totalTime: number;
  backendBuildTime: number;
  frontendBuildTime: number;
  artifactSize: number;
  nodeModulesSize: number;
}

interface PerformanceReport {
  timestamp: Date;
  metrics: PerformanceMetrics;
  bottlenecks: Bottleneck[];
  recommendations: Recommendation[];
  baseline: BaselineComparison;
}

interface Bottleneck {
  category: 'backend' | 'frontend' | 'cache' | 'build';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  impact: string;
  metrics: Record<string, number>;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  estimatedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

interface BaselineComparison {
  exists: boolean;
  previousTimestamp?: Date;
  changes?: Record<string, { previous: number; current: number; delta: number }>;
}

export class PerfObservabiliteAgent implements IAgent {
  name = 'Perf & Observabilité';
  type = 'perf-observabilite' as const;
  description = 'Surveille la performance et établit une baseline avant upgrades';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private rootPath: string;

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
   * Exécuter l'analyse de performance
   */
  async execute(): Promise<AgentResult> {
    console.log('\n🔍 Perf & Observabilité - Analyse en cours...');
    const startTime = Date.now();
    this.status = 'running';

    try {
      // Collecter les métriques
      console.log('   📊 Collecte des métriques backend...');
      const backendMetrics = await this.collectBackendMetrics();

      console.log('   📊 Collecte des métriques frontend...');
      const frontendMetrics = await this.collectFrontendMetrics();

      console.log('   📊 Collecte des métriques cache...');
      const cacheMetrics = await this.collectCacheMetrics();

      console.log('   📊 Collecte des métriques build...');
      const buildMetrics = await this.collectBuildMetrics();

      const metrics: PerformanceMetrics = {
        backend: backendMetrics,
        frontend: frontendMetrics,
        cache: cacheMetrics,
        build: buildMetrics,
      };

      // Analyser et identifier les bottlenecks
      console.log('   🔍 Identification des bottlenecks...');
      const bottlenecks = this.identifyBottlenecks(metrics);

      // Générer des recommandations
      console.log('   💡 Génération des recommandations...');
      const recommendations = this.generateRecommendations(metrics, bottlenecks);

      // Comparer avec baseline existante
      const baseline = await this.compareWithBaseline(metrics);

      const report: PerformanceReport = {
        timestamp: new Date(),
        metrics,
        bottlenecks,
        recommendations,
        baseline,
      };

      // Sauvegarder les rapports
      await this.saveReports(report);

      // Calculer les KPIs
      const kpis = this.calculateKPIs(report);

      const duration = Date.now() - startTime;
      this.status = 'idle';

      console.log(`   ✅ Analyse terminée en ${duration}ms`);
      console.log(`   📊 ${bottlenecks.length} bottlenecks identifiés`);
      console.log(`   💡 ${recommendations.length} recommandations générées`);

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
   * Collecter les métriques backend
   */
  private async collectBackendMetrics(): Promise<BackendMetrics> {
    // TODO: Analyser les logs NestJS, fichiers de service, etc.
    // Pour l'instant, on fait une analyse statique du code

    const backendPath = path.join(this.rootPath, 'backend/src');
    
    // Compter les endpoints
    const endpoints = await this.analyzeEndpoints(backendPath);
    
    // Analyser les queries Prisma
    const database = await this.analyzeDatabaseUsage(backendPath);

    return {
      endpoints,
      database,
      averageResponseTime: 0, // À mesurer en production
      errorRate: 0, // À mesurer en production
    };
  }

  /**
   * Analyser les endpoints API
   */
  private async analyzeEndpoints(backendPath: string): Promise<EndpointMetric[]> {
    const endpoints: EndpointMetric[] = [];
    
    // Chercher les controllers
    const { stdout } = await execAsync(
      `find ${backendPath} -name "*.controller.ts" -type f`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    const controllerFiles = stdout.trim().split('\n').filter(Boolean);

    for (const file of controllerFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Détecter les décorateurs HTTP (@Get, @Post, etc.)
      const httpMethods = ['Get', 'Post', 'Put', 'Delete', 'Patch'];
      
      for (const method of httpMethods) {
        const regex = new RegExp(`@${method}\\(['"](.*?)['"]\\)`, 'g');
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          const routePath = match[1] || '/';
          endpoints.push({
            path: routePath,
            method: method.toUpperCase(),
            avgLatency: 0, // À mesurer
            p95Latency: 0,
            p99Latency: 0,
            requestCount: 0,
            errorCount: 0,
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Analyser l'utilisation de la base de données
   */
  private async analyzeDatabaseUsage(backendPath: string): Promise<DatabaseMetric> {
    // Compter les queries Prisma
    const { stdout } = await execAsync(
      `grep -r "prisma\\." ${backendPath} --include="*.ts" | wc -l`,
      { maxBuffer: 10 * 1024 * 1024 }
    ).catch(() => ({ stdout: '0' }));

    const queryCount = parseInt(stdout.trim()) || 0;

    return {
      totalQueries: queryCount,
      avgQueryTime: 0, // À mesurer
      slowQueries: [],
      connectionPoolSize: 10, // Valeur par défaut Prisma
    };
  }

  /**
   * Collecter les métriques frontend
   */
  private async collectFrontendMetrics(): Promise<FrontendMetrics> {
    const frontendPath = path.join(this.rootPath, 'frontend');
    
    const routes = await this.analyzeRemixRoutes(frontendPath);
    const bundles = await this.analyzeBundles(frontendPath);

    return {
      routes,
      bundles,
      webVitals: {
        lcp: 0, // À mesurer en production
        fid: 0,
        cls: 0,
        ttfb: 0,
      },
    };
  }

  /**
   * Analyser les routes Remix
   */
  private async analyzeRemixRoutes(frontendPath: string): Promise<RouteMetric[]> {
    const routes: RouteMetric[] = [];
    const routesPath = path.join(frontendPath, 'app/routes');

    if (!fs.existsSync(routesPath)) {
      return routes;
    }

    const files = await execAsync(
      `find ${routesPath} -name "*.tsx" -o -name "*.ts"`,
      { maxBuffer: 10 * 1024 * 1024 }
    ).then(r => r.stdout.trim().split('\n').filter(Boolean));

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const hasLoader = content.includes('export const loader') || content.includes('export async function loader');
      
      routes.push({
        path: path.basename(file, path.extname(file)),
        loaderTime: 0, // À mesurer
        dataSize: 0,
        cacheable: content.includes('Cache-Control'),
      });
    }

    return routes;
  }

  /**
   * Analyser les bundles
   */
  private async analyzeBundles(frontendPath: string): Promise<BundleMetric[]> {
    const buildPath = path.join(frontendPath, 'build/client');
    
    if (!fs.existsSync(buildPath)) {
      return [];
    }

    const bundles: BundleMetric[] = [];
    const files = fs.readdirSync(buildPath, { recursive: true }) as string[];

    for (const file of files) {
      if (file.endsWith('.js')) {
        const fullPath = path.join(buildPath, file);
        const stats = fs.statSync(fullPath);
        
        bundles.push({
          name: file,
          size: stats.size,
          gzipSize: Math.floor(stats.size * 0.3), // Estimation
          modules: 0,
        });
      }
    }

    return bundles;
  }

  /**
   * Collecter les métriques cache Redis
   */
  private async collectCacheMetrics(): Promise<CacheMetrics> {
    // TODO: Se connecter à Redis et récupérer les stats réelles
    // Pour l'instant, valeurs par défaut

    return {
      hitRate: 0,
      missRate: 0,
      avgLatency: 0,
      memoryUsage: 0,
      keysCount: 0,
      evictedKeys: 0,
    };
  }

  /**
   * Collecter les métriques de build
   */
  private async collectBuildMetrics(): Promise<BuildMetrics> {
    const backendDist = path.join(this.rootPath, 'backend/dist');
    const frontendBuild = path.join(this.rootPath, 'frontend/build');
    const nodeModules = path.join(this.rootPath, 'node_modules');

    const getDirectorySize = async (dir: string): Promise<number> => {
      if (!fs.existsSync(dir)) return 0;
      
      const { stdout } = await execAsync(`du -sb ${dir} | cut -f1`).catch(() => ({ stdout: '0' }));
      return parseInt(stdout.trim()) || 0;
    };

    const backendSize = await getDirectorySize(backendDist);
    const frontendSize = await getDirectorySize(frontendBuild);
    const nodeModulesSize = await getDirectorySize(nodeModules);

    return {
      totalTime: 0, // À mesurer lors du build
      backendBuildTime: 0,
      frontendBuildTime: 0,
      artifactSize: backendSize + frontendSize,
      nodeModulesSize,
    };
  }

  /**
   * Identifier les bottlenecks
   */
  private identifyBottlenecks(metrics: PerformanceMetrics): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Bundles trop gros
    const largeBundles = metrics.frontend.bundles.filter(b => b.size > 500 * 1024);
    if (largeBundles.length > 0) {
      bottlenecks.push({
        category: 'frontend',
        severity: 'warning',
        description: `${largeBundles.length} bundles JavaScript > 500KB`,
        impact: 'Temps de chargement initial élevé',
        metrics: {
          largestBundle: Math.max(...largeBundles.map(b => b.size)),
          totalSize: largeBundles.reduce((sum, b) => sum + b.size, 0),
        },
      });
    }

    // Trop de routes sans cache
    const uncachedRoutes = metrics.frontend.routes.filter(r => !r.cacheable);
    if (uncachedRoutes.length > metrics.frontend.routes.length * 0.7) {
      bottlenecks.push({
        category: 'frontend',
        severity: 'info',
        description: `${uncachedRoutes.length} routes sans cache HTTP`,
        impact: 'Requêtes répétées non optimisées',
        metrics: {
          uncachedCount: uncachedRoutes.length,
          totalRoutes: metrics.frontend.routes.length,
        },
      });
    }

    // node_modules trop gros
    if (metrics.build.nodeModulesSize > 500 * 1024 * 1024) {
      bottlenecks.push({
        category: 'build',
        severity: 'warning',
        description: 'node_modules > 500MB',
        impact: 'Temps de build et déploiement élevés',
        metrics: {
          size: metrics.build.nodeModulesSize,
        },
      });
    }

    return bottlenecks;
  }

  /**
   * Générer des recommandations
   */
  private generateRecommendations(
    metrics: PerformanceMetrics,
    bottlenecks: Bottleneck[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Bundles
    if (bottlenecks.some(b => b.category === 'frontend' && b.description.includes('bundles'))) {
      recommendations.push({
        priority: 'high',
        category: 'Frontend',
        title: 'Optimiser la taille des bundles JavaScript',
        description: 'Utiliser code splitting, lazy loading, et tree shaking',
        estimatedImpact: 'Réduction de 30-40% du temps de chargement initial',
        effort: 'medium',
      });
    }

    // Cache
    if (bottlenecks.some(b => b.description.includes('sans cache'))) {
      recommendations.push({
        priority: 'medium',
        category: 'Frontend',
        title: 'Implémenter le cache HTTP pour les loaders Remix',
        description: 'Ajouter Cache-Control headers sur les loaders stables',
        estimatedImpact: 'Réduction de 50% des requêtes API répétées',
        effort: 'low',
      });
    }

    // node_modules
    if (bottlenecks.some(b => b.description.includes('node_modules'))) {
      recommendations.push({
        priority: 'low',
        category: 'Build',
        title: 'Nettoyer les dépendances inutilisées',
        description: 'Utiliser depcheck pour identifier et supprimer les packages inutilisés',
        estimatedImpact: 'Réduction de 20% du temps de build',
        effort: 'low',
      });
    }

    // Recommandations générales
    recommendations.push({
      priority: 'high',
      category: 'Monitoring',
      title: 'Mettre en place un monitoring APM',
      description: 'Intégrer Sentry, DataDog, ou New Relic pour mesures réelles',
      estimatedImpact: 'Visibilité complète sur la performance en production',
      effort: 'medium',
    });

    return recommendations;
  }

  /**
   * Comparer avec la baseline existante
   */
  private async compareWithBaseline(metrics: PerformanceMetrics): Promise<BaselineComparison> {
    const baselinePath = path.join(
      this.rootPath,
      'ai-agents/reports/perf-baseline.json'
    );

    if (!fs.existsSync(baselinePath)) {
      // Sauvegarder comme première baseline
      fs.writeFileSync(baselinePath, JSON.stringify(metrics, null, 2));
      
      return {
        exists: false,
      };
    }

    // Comparer avec baseline existante
    const previousMetrics = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as PerformanceMetrics;

    const changes: Record<string, { previous: number; current: number; delta: number }> = {};

    // Comparer quelques métriques clés
    const bundleSize = metrics.frontend.bundles.reduce((sum, b) => sum + b.size, 0);
    const prevBundleSize = previousMetrics.frontend.bundles.reduce((sum, b) => sum + b.size, 0);
    
    if (bundleSize > 0 && prevBundleSize > 0) {
      changes['bundleSize'] = {
        previous: prevBundleSize,
        current: bundleSize,
        delta: ((bundleSize - prevBundleSize) / prevBundleSize) * 100,
      };
    }

    return {
      exists: true,
      previousTimestamp: new Date(), // TODO: parser du fichier
      changes,
    };
  }

  /**
   * Calculer les KPIs
   */
  private calculateKPIs(report: PerformanceReport): KPI[] {
    const kpis: KPI[] = [];

    // Bottlenecks critiques
    const criticalBottlenecks = report.bottlenecks.filter(b => b.severity === 'critical').length;
    kpis.push({
      name: 'Bottlenecks critiques',
      value: criticalBottlenecks,
      unit: 'issues',
      status: criticalBottlenecks === 0 ? 'ok' : 'critical',
    });

    // Bundles size
    const totalBundleSize = report.metrics.frontend.bundles.reduce((sum, b) => sum + b.size, 0);
    kpis.push({
      name: 'Taille bundles JS',
      value: Math.round(totalBundleSize / 1024),
      unit: 'KB',
      status: totalBundleSize < 1024 * 1024 ? 'ok' : 'warning',
    });

    // Routes avec cache
    const cachedRoutes = report.metrics.frontend.routes.filter(r => r.cacheable).length;
    const cacheRate = (cachedRoutes / Math.max(report.metrics.frontend.routes.length, 1)) * 100;
    kpis.push({
      name: 'Taux de cache HTTP',
      value: Math.round(cacheRate),
      unit: '%',
      status: cacheRate > 50 ? 'ok' : 'warning',
    });

    return kpis;
  }

  /**
   * Générer un résumé
   */
  private generateSummary(report: PerformanceReport): string {
    const critical = report.bottlenecks.filter(b => b.severity === 'critical').length;
    const warnings = report.bottlenecks.filter(b => b.severity === 'warning').length;
    
    return `Performance baseline: ${critical} bottlenecks critiques, ${warnings} warnings, ${report.recommendations.length} recommandations`;
  }

  /**
   * Sauvegarder les rapports
   */
  private async saveReports(report: PerformanceReport): Promise<void> {
    const reportsDir = path.join(this.rootPath, 'ai-agents/reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // JSON
    const jsonPath = path.join(reportsDir, 'perf-observabilite.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Markdown
    const mdPath = path.join(reportsDir, 'perf-observabilite.md');
    const markdown = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, markdown);

    console.log(`   💾 Rapport JSON: ${jsonPath}`);
    console.log(`   💾 Rapport MD: ${mdPath}`);
  }

  /**
   * Générer le rapport Markdown
   */
  private generateMarkdownReport(report: PerformanceReport): string {
    let md = `# 📊 Rapport Performance & Observabilité\n\n`;
    md += `**Date**: ${report.timestamp.toISOString()}\n\n`;
    md += `---\n\n`;

    // Résumé
    md += `## 📈 Résumé\n\n`;
    md += `- **Bottlenecks identifiés**: ${report.bottlenecks.length}\n`;
    md += `- **Recommandations**: ${report.recommendations.length}\n`;
    md += `- **Baseline**: ${report.baseline.exists ? 'Comparison disponible' : 'Première baseline établie'}\n\n`;

    // Métriques Backend
    md += `## 🔧 Backend (NestJS)\n\n`;
    md += `- **Endpoints API**: ${report.metrics.backend.endpoints.length}\n`;
    md += `- **Queries Prisma**: ${report.metrics.backend.database.totalQueries}\n`;
    md += `- **Pool connections**: ${report.metrics.backend.database.connectionPoolSize}\n\n`;

    // Métriques Frontend
    md += `## 🎨 Frontend (Remix)\n\n`;
    md += `- **Routes**: ${report.metrics.frontend.routes.length}\n`;
    md += `- **Bundles JS**: ${report.metrics.frontend.bundles.length}\n`;
    const totalBundleSize = report.metrics.frontend.bundles.reduce((s, b) => s + b.size, 0);
    md += `- **Taille totale bundles**: ${(totalBundleSize / 1024 / 1024).toFixed(2)} MB\n\n`;

    // Top 5 plus gros bundles
    if (report.metrics.frontend.bundles.length > 0) {
      md += `### 📦 Top 5 Bundles les plus gros\n\n`;
      const sorted = [...report.metrics.frontend.bundles].sort((a, b) => b.size - a.size).slice(0, 5);
      sorted.forEach((bundle, i) => {
        md += `${i + 1}. **${bundle.name}**: ${(bundle.size / 1024).toFixed(2)} KB\n`;
      });
      md += `\n`;
    }

    // Bottlenecks
    if (report.bottlenecks.length > 0) {
      md += `## ⚠️ Bottlenecks Identifiés\n\n`;
      report.bottlenecks.forEach((bottleneck, i) => {
        const icon = bottleneck.severity === 'critical' ? '🔴' : bottleneck.severity === 'warning' ? '🟡' : '🔵';
        md += `### ${icon} ${i + 1}. ${bottleneck.description}\n\n`;
        md += `- **Catégorie**: ${bottleneck.category}\n`;
        md += `- **Impact**: ${bottleneck.impact}\n`;
        md += `- **Métriques**:\n`;
        Object.entries(bottleneck.metrics).forEach(([key, value]) => {
          md += `  - ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}\n`;
        });
        md += `\n`;
      });
    }

    // Recommandations
    if (report.recommendations.length > 0) {
      md += `## 💡 Recommandations\n\n`;
      report.recommendations.forEach((rec, i) => {
        const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        md += `### ${priorityIcon} ${i + 1}. ${rec.title}\n\n`;
        md += `- **Catégorie**: ${rec.category}\n`;
        md += `- **Priorité**: ${rec.priority}\n`;
        md += `- **Effort**: ${rec.effort}\n`;
        md += `- **Description**: ${rec.description}\n`;
        md += `- **Impact estimé**: ${rec.estimatedImpact}\n\n`;
      });
    }

    // Métriques build
    md += `## 🏗️ Build & Deploy\n\n`;
    md += `- **Taille artifacts**: ${(report.metrics.build.artifactSize / 1024 / 1024).toFixed(2)} MB\n`;
    md += `- **node_modules**: ${(report.metrics.build.nodeModulesSize / 1024 / 1024).toFixed(2)} MB\n\n`;

    // Baseline comparison
    if (report.baseline.exists && report.baseline.changes) {
      md += `## 📊 Comparaison avec Baseline\n\n`;
      Object.entries(report.baseline.changes).forEach(([metric, change]) => {
        const arrow = change.delta > 0 ? '📈' : change.delta < 0 ? '📉' : '➡️';
        md += `- **${metric}**: ${arrow} ${change.delta.toFixed(2)}% (${change.previous} → ${change.current})\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
    md += `*Rapport généré par Agent 10: Perf & Observabilité*\n`;

    return md;
  }
}
