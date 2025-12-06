/**
 * AI-COS v2.31.0: Dashboard Cartographe Monorepo
 * 
 * Interface de visualisation pour l'Agent Cartographe:
 * - Graphe interactif des dépendances (D3.js / Mermaid)
 * - Tableau de bord des KPIs
 * - Liste des problèmes et dérives
 * - Santé des packages
 * 
 * @route /admin/ai-cos/cartographer
 * @version 2.31.0
 */

import { useState, useEffect, useCallback } from 'react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher, Link } from '@remix-run/react';
import {
  GitBranch,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Layers,
  Box,
  FileCode,
  BarChart3,
  Network,
  Zap,
  Clock,
  ArrowRight,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface KPIs {
  circularDepsCount: number;
  averagePackageHealth: number;
  architectureDriftCount: number;
  largestBundleSize: number;
  orphanPackagesCount: number;
  outdatedDepsCount: number;
  criticalIssuesCount: number;
}

interface PackageHealth {
  packageName: string;
  overallScore: number;
  metrics: {
    dependencyCount: number;
    circularDeps: number;
    outdatedDeps: number;
    testCoverage: number;
    bundleSize: number;
  };
  trend: 'improving' | 'stable' | 'degrading';
  issues: Array<{
    severity: string;
    message: string;
  }>;
}

interface CircularDep {
  id: string;
  cycle: string[];
  severity: 'warning' | 'error' | 'critical';
  suggestedFix: string;
}

interface ArchitectureDrift {
  id: string;
  driftType: string;
  severity: string;
  description: string;
  suggestedAction: string;
}

interface DependencyGraph {
  nodes: Array<{
    name: string;
    path: string;
    dependencies: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    isCircular: boolean;
  }>;
  mermaidDiagram: string;
}

interface LoaderData {
  kpis: KPIs;
  kpiStatus: {
    status: Record<string, 'ok' | 'warning' | 'critical'>;
    overallStatus: 'healthy' | 'warning' | 'critical';
  };
  packageHealth: PackageHealth[];
  circularDeps: CircularDep[];
  drifts: ArchitectureDrift[];
  graph: DependencyGraph;
  lastUpdate: string;
}

// ============================================
// Loader
// ============================================

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  try {
    const [
      kpisRes,
      kpiStatusRes,
      healthRes,
      circularRes,
      driftsRes,
      graphRes,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/ai-cos/cartographer/kpis`).catch(() => null),
      fetch(`${baseUrl}/api/ai-cos/cartographer/kpis/status`).catch(() => null),
      fetch(`${baseUrl}/api/ai-cos/cartographer/package-health`).catch(() => null),
      fetch(`${baseUrl}/api/ai-cos/cartographer/circular-deps`).catch(() => null),
      fetch(`${baseUrl}/api/ai-cos/cartographer/architecture-drift`).catch(() => null),
      fetch(`${baseUrl}/api/ai-cos/cartographer/dependency-graph`).catch(() => null),
    ]);

    // Mock data for development
    const defaultKpis: KPIs = {
      circularDepsCount: 0,
      averagePackageHealth: 82,
      architectureDriftCount: 2,
      largestBundleSize: 384000,
      orphanPackagesCount: 1,
      outdatedDepsCount: 5,
      criticalIssuesCount: 0,
    };

    const defaultHealth: PackageHealth[] = [
      { packageName: '@monorepo/ui', overallScore: 88, metrics: { dependencyCount: 12, circularDeps: 0, outdatedDeps: 1, testCoverage: 75, bundleSize: 128000 }, trend: 'stable', issues: [] },
      { packageName: '@monorepo/design-tokens', overallScore: 95, metrics: { dependencyCount: 2, circularDeps: 0, outdatedDeps: 0, testCoverage: 90, bundleSize: 24000 }, trend: 'improving', issues: [] },
      { packageName: '@monorepo/shared-types', overallScore: 92, metrics: { dependencyCount: 1, circularDeps: 0, outdatedDeps: 0, testCoverage: 100, bundleSize: 8000 }, trend: 'stable', issues: [] },
      { packageName: 'frontend', overallScore: 78, metrics: { dependencyCount: 45, circularDeps: 0, outdatedDeps: 3, testCoverage: 65, bundleSize: 384000 }, trend: 'stable', issues: [{ severity: 'warning', message: 'Bundle size approaching limit' }] },
      { packageName: 'backend', overallScore: 85, metrics: { dependencyCount: 38, circularDeps: 0, outdatedDeps: 1, testCoverage: 72, bundleSize: 256000 }, trend: 'improving', issues: [] },
    ];

    const defaultGraph: DependencyGraph = {
      nodes: [
        { name: '@monorepo/ui', path: 'packages/ui', dependencies: ['@monorepo/design-tokens', '@monorepo/patterns'] },
        { name: '@monorepo/design-tokens', path: 'packages/design-tokens', dependencies: [] },
        { name: '@monorepo/shared-types', path: 'packages/shared-types', dependencies: [] },
        { name: '@monorepo/patterns', path: 'packages/patterns', dependencies: [] },
        { name: 'frontend', path: 'frontend', dependencies: ['@monorepo/ui', '@monorepo/shared-types'] },
        { name: 'backend', path: 'backend', dependencies: ['@monorepo/shared-types'] },
      ],
      edges: [
        { from: '@monorepo/ui', to: '@monorepo/design-tokens', type: 'dependency', isCircular: false },
        { from: '@monorepo/ui', to: '@monorepo/patterns', type: 'dependency', isCircular: false },
        { from: 'frontend', to: '@monorepo/ui', type: 'dependency', isCircular: false },
        { from: 'frontend', to: '@monorepo/shared-types', type: 'dependency', isCircular: false },
        { from: 'backend', to: '@monorepo/shared-types', type: 'dependency', isCircular: false },
      ],
      mermaidDiagram: `graph TD
    ui[📦 ui]
    design-tokens[🎨 design-tokens]
    shared-types[📋 shared-types]
    patterns[🧩 patterns]
    frontend[🖥️ frontend]
    backend[⚙️ backend]
    
    ui --> design-tokens
    ui --> patterns
    frontend --> ui
    frontend --> shared-types
    backend --> shared-types`,
    };

    return json<LoaderData>({
      kpis: kpisRes?.ok ? await kpisRes.json() : defaultKpis,
      kpiStatus: kpiStatusRes?.ok ? await kpiStatusRes.json() : { status: {}, overallStatus: 'healthy' },
      packageHealth: healthRes?.ok ? await healthRes.json() : defaultHealth,
      circularDeps: circularRes?.ok ? await circularRes.json() : [],
      drifts: driftsRes?.ok ? await driftsRes.json() : [],
      graph: graphRes?.ok ? await graphRes.json() : defaultGraph,
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading cartographer data:', error);
    // Return mock data on error
    return json<LoaderData>({
      kpis: {
        circularDepsCount: 0,
        averagePackageHealth: 82,
        architectureDriftCount: 2,
        largestBundleSize: 384000,
        orphanPackagesCount: 1,
        outdatedDepsCount: 5,
        criticalIssuesCount: 0,
      },
      kpiStatus: { status: {}, overallStatus: 'healthy' },
      packageHealth: [],
      circularDeps: [],
      drifts: [],
      graph: { nodes: [], edges: [], mermaidDiagram: '' },
      lastUpdate: new Date().toISOString(),
    });
  }
}

// ============================================
// Component
// ============================================

export default function CartographerDashboard() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'health' | 'issues'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetcher.load('/admin/ai-cos/cartographer');
    setTimeout(() => setIsRefreshing(false), 2000);
  }, [fetcher]);

  const getStatusColor = (status: 'ok' | 'warning' | 'critical' | string) => {
    switch (status) {
      case 'ok': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBg = (status: 'ok' | 'warning' | 'critical' | string) => {
    switch (status) {
      case 'ok': return 'bg-green-500/10 border-green-500/30';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
      case 'critical': return 'bg-red-500/10 border-red-500/30';
      default: return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'degrading': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Network className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                🗺️ Agent Cartographe Monorepo
              </h1>
              <p className="text-gray-400 mt-1">
                AI-COS v2.31.0 • Tech Squad (T) • A-CARTO
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              <Clock className="w-4 h-4 inline mr-1" />
              Dernière MAJ: {new Date(data.lastUpdate).toLocaleTimeString('fr-FR')}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-6">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
            { id: 'graph', label: 'Graphe', icon: GitBranch },
            { id: 'health', label: 'Santé Packages', icon: Activity },
            { id: 'issues', label: 'Problèmes', icon: AlertTriangle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Circular Deps */}
            <div className={`p-6 rounded-xl border ${
              data.kpis.circularDepsCount === 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <GitBranch className={`w-8 h-8 ${data.kpis.circularDepsCount === 0 ? 'text-green-400' : 'text-red-400'}`} />
                <span className={`text-xs px-2 py-1 rounded ${
                  data.kpis.circularDepsCount === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  Target: 0
                </span>
              </div>
              <div className="text-3xl font-bold">{data.kpis.circularDepsCount}</div>
              <div className="text-sm text-gray-400">Dépendances Circulaires</div>
            </div>

            {/* Package Health */}
            <div className={`p-6 rounded-xl border ${
              data.kpis.averagePackageHealth >= 80 ? 'bg-green-500/10 border-green-500/30' : 
              data.kpis.averagePackageHealth >= 60 ? 'bg-yellow-500/10 border-yellow-500/30' : 
              'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <Activity className={`w-8 h-8 ${
                  data.kpis.averagePackageHealth >= 80 ? 'text-green-400' : 
                  data.kpis.averagePackageHealth >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">Target: &gt;80%</span>
              </div>
              <div className="text-3xl font-bold">{data.kpis.averagePackageHealth}%</div>
              <div className="text-sm text-gray-400">Santé Moyenne Packages</div>
            </div>

            {/* Architecture Drifts */}
            <div className={`p-6 rounded-xl border ${
              data.kpis.architectureDriftCount === 0 ? 'bg-green-500/10 border-green-500/30' : 
              data.kpis.architectureDriftCount <= 3 ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <Layers className={`w-8 h-8 ${
                  data.kpis.architectureDriftCount === 0 ? 'text-green-400' :
                  data.kpis.architectureDriftCount <= 3 ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">Target: 0</span>
              </div>
              <div className="text-3xl font-bold">{data.kpis.architectureDriftCount}</div>
              <div className="text-sm text-gray-400">Dérives Architecturales</div>
            </div>

            {/* Bundle Size */}
            <div className={`p-6 rounded-xl border ${
              data.kpis.largestBundleSize <= 500000 ? 'bg-green-500/10 border-green-500/30' : 
              data.kpis.largestBundleSize <= 600000 ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <Box className={`w-8 h-8 ${
                  data.kpis.largestBundleSize <= 500000 ? 'text-green-400' :
                  data.kpis.largestBundleSize <= 600000 ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">Target: &lt;500KB</span>
              </div>
              <div className="text-3xl font-bold">{formatBytes(data.kpis.largestBundleSize)}</div>
              <div className="text-sm text-gray-400">Plus Gros Bundle</div>
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-purple-400" />
                <div>
                  <div className="text-xl font-bold">{data.kpis.orphanPackagesCount}</div>
                  <div className="text-sm text-gray-400">Packages Orphelins</div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <div className="flex items-center gap-3">
                <FileCode className="w-6 h-6 text-orange-400" />
                <div>
                  <div className="text-xl font-bold">{data.kpis.outdatedDepsCount}</div>
                  <div className="text-sm text-gray-400">Deps Obsolètes</div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-6 h-6 ${data.kpis.criticalIssuesCount > 0 ? 'text-red-400' : 'text-green-400'}`} />
                <div>
                  <div className="text-xl font-bold">{data.kpis.criticalIssuesCount}</div>
                  <div className="text-sm text-gray-400">Issues Critiques</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Actions Rapides
              </h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors">
                  <span>Lancer Scan Quotidien</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors">
                  <span>Générer Rapport Complet</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors">
                  <span>Analyser Bundles</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-400" />
                Statut Global
              </h3>
              <div className={`p-4 rounded-lg ${getStatusBg(data.kpiStatus.overallStatus)}`}>
                <div className="flex items-center gap-3">
                  {data.kpiStatus.overallStatus === 'healthy' ? (
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  ) : data.kpiStatus.overallStatus === 'warning' ? (
                    <AlertTriangle className="w-8 h-8 text-yellow-400" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-400" />
                  )}
                  <div>
                    <div className="text-lg font-bold capitalize">{data.kpiStatus.overallStatus}</div>
                    <div className="text-sm text-gray-400">
                      Architecture {data.kpiStatus.overallStatus === 'healthy' ? 'saine' : 'à surveiller'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graph Tab */}
      {activeTab === 'graph' && (
        <div className="space-y-6">
          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-blue-400" />
              Graphe des Dépendances
            </h3>
            
            {/* Mermaid Diagram Display */}
            <div className="bg-gray-900 p-6 rounded-lg overflow-auto">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {data.graph.mermaidDiagram || 'Aucun graphe disponible'}
              </pre>
            </div>

            {/* Nodes List */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.graph.nodes.map((node) => (
                <div key={node.name} className="p-4 bg-gray-700/30 rounded-lg">
                  <div className="font-medium text-blue-300">{node.name}</div>
                  <div className="text-sm text-gray-400 mt-1">{node.path}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {node.dependencies.length} dépendances internes
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edges/Connections */}
          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <h3 className="text-lg font-semibold mb-4">Connexions ({data.graph.edges.length})</h3>
            <div className="space-y-2">
              {data.graph.edges.map((edge, i) => (
                <div 
                  key={i} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    edge.isCircular ? 'bg-red-500/10 border border-red-500/30' : 'bg-gray-700/30'
                  }`}
                >
                  <span className="text-sm font-mono">{edge.from}</span>
                  <ArrowRight className={`w-4 h-4 ${edge.isCircular ? 'text-red-400' : 'text-gray-500'}`} />
                  <span className="text-sm font-mono">{edge.to}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    edge.type === 'dependency' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {edge.type}
                  </span>
                  {edge.isCircular && (
                    <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                      ⚠️ Circulaire
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.packageHealth.map((pkg) => (
              <div 
                key={pkg.packageName} 
                className={`p-6 rounded-xl border ${
                  pkg.overallScore >= 80 ? 'bg-green-500/5 border-green-500/20' :
                  pkg.overallScore >= 60 ? 'bg-yellow-500/5 border-yellow-500/20' :
                  'bg-red-500/5 border-red-500/20'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Package className={`w-6 h-6 ${
                      pkg.overallScore >= 80 ? 'text-green-400' :
                      pkg.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`} />
                    <div>
                      <div className="font-semibold">{pkg.packageName}</div>
                      <div className="text-sm text-gray-400 flex items-center gap-2">
                        {getTrendIcon(pkg.trend)}
                        <span className="capitalize">{pkg.trend}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-3xl font-bold ${
                    pkg.overallScore >= 80 ? 'text-green-400' :
                    pkg.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {pkg.overallScore}%
                  </div>
                </div>

                {/* Health Bar */}
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-4">
                  <div 
                    className={`h-full transition-all ${
                      pkg.overallScore >= 80 ? 'bg-green-500' :
                      pkg.overallScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pkg.overallScore}%` }}
                  />
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Dépendances:</span>
                    <span>{pkg.metrics.dependencyCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Circulaires:</span>
                    <span className={pkg.metrics.circularDeps > 0 ? 'text-red-400' : ''}>
                      {pkg.metrics.circularDeps}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Obsolètes:</span>
                    <span className={pkg.metrics.outdatedDeps > 3 ? 'text-yellow-400' : ''}>
                      {pkg.metrics.outdatedDeps}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Couverture:</span>
                    <span>{pkg.metrics.testCoverage}%</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-gray-400">Taille Bundle:</span>
                    <span>{formatBytes(pkg.metrics.bundleSize)}</span>
                  </div>
                </div>

                {/* Issues */}
                {pkg.issues.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    {pkg.issues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-yellow-400">
                        <AlertTriangle className="w-4 h-4" />
                        {issue.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && (
        <div className="space-y-6">
          {/* Circular Dependencies */}
          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-red-400" />
              Dépendances Circulaires ({data.circularDeps.length})
            </h3>
            
            {data.circularDeps.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <span>Aucune dépendance circulaire détectée ✓</span>
              </div>
            ) : (
              <div className="space-y-3">
                {data.circularDeps.map((dep) => (
                  <div 
                    key={dep.id} 
                    className={`p-4 rounded-lg border ${
                      dep.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                      dep.severity === 'error' ? 'bg-orange-500/10 border-orange-500/30' :
                      'bg-yellow-500/10 border-yellow-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded uppercase font-bold ${
                        dep.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        dep.severity === 'error' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {dep.severity}
                      </span>
                    </div>
                    <div className="font-mono text-sm">
                      {dep.cycle.join(' → ')} → {dep.cycle[0]}
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                      💡 {dep.suggestedFix}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Architecture Drifts */}
          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-yellow-400" />
              Dérives Architecturales ({data.drifts.length})
            </h3>
            
            {data.drifts.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <span>Aucune dérive architecturale détectée ✓</span>
              </div>
            ) : (
              <div className="space-y-3">
                {data.drifts.map((drift) => (
                  <div 
                    key={drift.id} 
                    className={`p-4 rounded-lg border ${
                      drift.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                      drift.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                      drift.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                      'bg-blue-500/10 border-blue-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded uppercase font-bold ${
                        drift.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        drift.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        drift.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {drift.severity}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                        {drift.driftType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="font-medium">{drift.description}</div>
                    <div className="text-sm text-gray-400 mt-2">
                      💡 {drift.suggestedAction}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Agent Cartographe Monorepo • AI-COS v2.31.0 • Tech Squad</p>
        <p className="mt-1">
          <Link to="/admin/ai-cos" className="text-blue-400 hover:underline">
            ← Retour au Dashboard AI-COS
          </Link>
        </p>
      </div>
    </div>
  );
}
