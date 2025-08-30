/**
 * Interface d'Administration des Performances
 * Dashboard complet pour surveiller et optimiser les performances du blog
 * @route /admin/performances
 */

import { json, type LoaderFunctionArgs, type MetaFunction, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";

// Icons
const ChartBarIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const ClockIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CacheIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-.9h7.126c.967 0 1.843.421 2.449 1.15L19.325 7.4a4.5 4.5 0 01.9 2.7m0 0H5.25m0 0h13.5" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

// Types
interface PerformanceData {
  metrics: {
    queryTime: number;
    cacheHitRate: number;
    totalQueries: number;
    avgResponseTime: number;
    slowQueries: Array<{
      query: string;
      time: number;
      timestamp: string;
    }>;
  };
  optimization: {
    cacheEfficiency: number;
    recommendedActions: string[];
    performanceScore: number;
    bottlenecks: string[];
  };
  cacheStats: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    cacheSize: number;
    lastInvalidation: string;
  };
}

interface LoaderData {
  performance: PerformanceData;
  isError: boolean;
  errorMessage?: string;
  lastUpdate: string;
}

// Loader pour récupérer les données de performance
export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  
  try {
    // Appel API pour récupérer les métriques de performance
    const response = await fetch(`${backendUrl}/api/admin/performance`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Données de démonstration si l'API n'est pas disponible
      return json<LoaderData>({
        performance: {
          metrics: {
            queryTime: 245,
            cacheHitRate: 78.5,
            totalQueries: 1547,
            avgResponseTime: 187,
            slowQueries: [
              {
                query: "BlogService.getPopularArticles",
                time: 1250,
                timestamp: new Date(Date.now() - 300000).toISOString()
              },
              {
                query: "BlogService.getDashboard",
                time: 980,
                timestamp: new Date(Date.now() - 600000).toISOString()
              }
            ]
          },
          optimization: {
            cacheEfficiency: 78.5,
            recommendedActions: [
              "Augmenter la durée de cache pour les articles populaires",
              "Optimiser la requête des statistiques dashboard",
              "Implémenter un cache de second niveau pour les recherches"
            ],
            performanceScore: 82,
            bottlenecks: [
              "Requêtes de statistiques complexes",
              "Cache hit rate sous-optimal"
            ]
          },
          cacheStats: {
            hitRate: 78.5,
            missRate: 21.5,
            totalRequests: 1547,
            cacheSize: 2048576, // 2MB
            lastInvalidation: new Date(Date.now() - 3600000).toISOString()
          }
        },
        isError: false,
        lastUpdate: new Date().toISOString()
      });
    }

    const data = await response.json();
    
    return json<LoaderData>({
      performance: data.data || data, // Utiliser data.data si disponible, sinon data directement
      isError: false,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erreur lors du chargement des performances:', error);
    
    return json<LoaderData>({
      performance: {
        metrics: {
          queryTime: 0,
          cacheHitRate: 0,
          totalQueries: 0,
          avgResponseTime: 0,
          slowQueries: []
        },
        optimization: {
          cacheEfficiency: 0,
          recommendedActions: [],
          performanceScore: 0,
          bottlenecks: []
        },
        cacheStats: {
          hitRate: 0,
          missRate: 0,
          totalRequests: 0,
          cacheSize: 0,
          lastInvalidation: new Date().toISOString()
        }
      },
      isError: true,
      errorMessage: error instanceof Error ? error.message : "Erreur inconnue",
      lastUpdate: new Date().toISOString()
    });
  }
}

// Action pour les opérations d'optimisation
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action');
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  try {
    if (action === 'optimize-cache') {
      const response = await fetch(`${backendUrl}/api/admin/performance/optimize-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        return json({ success: true, message: 'Cache optimisé avec succès' });
      }
    }
    
    if (action === 'clear-cache') {
      const response = await fetch(`${backendUrl}/api/admin/performance/clear-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        return json({ success: true, message: 'Cache vidé avec succès' });
      }
    }

    return json({ success: false, message: 'Action non reconnue' });

  } catch (error) {
    return json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Erreur lors de l\'action'
    });
  }
}

// Métadonnées
export const meta: MetaFunction = () => {
  return [
    { title: "Administration - Performances Blog" },
    { name: "description", content: "Dashboard de surveillance et optimisation des performances." },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

// Composant principal
export default function AdminPerformancePage() {
  const { performance, isError, errorMessage, lastUpdate } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const navigation = useNavigation();
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh toutes les 30 secondes
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      if (navigation.state === "idle") {
        window.location.reload();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, navigation.state]);

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCacheColor = (hitRate: number) => {
    if (hitRate >= 80) return 'text-green-600';
    if (hitRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Performances Blog</h1>
              <p className="text-gray-600 mt-2">Surveillance et optimisation en temps réel</p>
              <p className="text-sm text-gray-500 mt-1">
                Dernière mise à jour: {new Date(lastUpdate).toLocaleString('fr-FR')}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-gray-700">Auto-refresh (30s)</span>
              </label>
              
              <Link
                to="/admin/blog"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retour au Dashboard
              </Link>
            </div>
          </div>

          {/* Message d'erreur */}
          {isError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Erreur de chargement</h3>
                  <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score de performance global */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Score de Performance</h3>
                <p className="text-sm text-gray-600">Évaluation globale des performances</p>
              </div>
              <div className={`text-6xl font-bold px-6 py-3 rounded-lg ${getPerformanceColor(performance.optimization.performanceScore)}`}>
                {performance.optimization.performanceScore}/100
              </div>
            </div>
          </div>
        </div>

        {/* Métriques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Temps Moyen</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatTime(performance.metrics.avgResponseTime)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <CacheIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Cache Hit Rate</p>
                <p className={`text-2xl font-semibold ${getCacheColor(performance.cacheStats.hitRate)}`}>
                  {performance.cacheStats.hitRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Requêtes</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {performance.metrics.totalQueries.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 font-bold">MB</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Taille Cache</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatBytes(performance.cacheStats.cacheSize)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions d'optimisation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recommandations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recommandations</h3>
            <div className="space-y-3">
              {performance.optimization.recommendedActions.length > 0 ? (
                performance.optimization.recommendedActions.map((action, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                    <p className="ml-3 text-sm text-gray-700">{action}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Aucune recommandation pour le moment</p>
              )}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Actions Rapides</h3>
            <div className="space-y-3">
              <fetcher.Form method="post" className="w-full">
                <input type="hidden" name="action" value="optimize-cache" />
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
                >
                  {fetcher.state !== "idle" ? "Optimisation..." : "Optimiser le Cache"}
                </button>
              </fetcher.Form>

              <fetcher.Form method="post" className="w-full">
                <input type="hidden" name="action" value="clear-cache" />
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors"
                >
                  {fetcher.state !== "idle" ? "Vidange..." : "Vider le Cache"}
                </button>
              </fetcher.Form>
            </div>

            {fetcher.data && (
              <div className={`mt-4 p-3 rounded-lg ${
                fetcher.data.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <p className="text-sm">{fetcher.data.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Requêtes lentes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Requêtes Lentes</h3>
          {performance.metrics.slowQueries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opération
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Temps
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Horodatage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {performance.metrics.slowQueries.slice(0, 10).map((query, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {query.query}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {formatTime(query.time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(query.timestamp).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune requête lente détectée</p>
          )}
        </div>

        {/* Goulots d'étranglement */}
        {performance.optimization.bottlenecks.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Goulots d'Étranglement</h3>
            <div className="space-y-2">
              {performance.optimization.bottlenecks.map((bottleneck, index) => (
                <div key={index} className="flex items-center p-3 bg-yellow-50 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-3" />
                  <p className="text-sm text-yellow-800">{bottleneck}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
