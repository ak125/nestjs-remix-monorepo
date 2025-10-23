/**
 * Interface d'Administration du Blog - Version Simplifiée
 * Interface robuste avec gestion d'erreurs améliorée
 * @route /admin/blog-simple
 */

import { Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";

// Icons simplifiés
const ChartBarIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const DocumentTextIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const EyeIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const UserGroupIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

// Types pour les données
interface BlogStats {
  totalArticles: number;
  totalViews: number;
  totalAdvice: number;
  totalGuides: number;
}

interface LoaderData {
  stats: BlogStats;
  isError: boolean;
  errorMessage?: string;
  apiStatus: "success" | "error" | "timeout";
  debugInfo?: any;
}

// Loader avec gestion d'erreurs robuste
export async function loader({ request }: LoaderFunctionArgs) {
  // Utiliser l'URL correcte - port 3000 pour l'API
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const apiUrl = `${backendUrl}/api/blog/dashboard`;
  
  console.log('[ADMIN BLOG SIMPLE] Début du chargement');
  console.log(`[ADMIN BLOG SIMPLE] Backend URL: ${backendUrl}`);
  
  try {
    // Test de connectivité avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

    console.log(`[ADMIN BLOG SIMPLE] Appel API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    console.log(`[ADMIN BLOG SIMPLE] Réponse API: Status ${response.status}`);

    if (!response.ok) {
      console.error(`[ADMIN BLOG SIMPLE] Erreur HTTP: ${response.status} ${response.statusText}`);
      
      // Données de fallback si API en erreur
      return json<LoaderData>({
        stats: {
          totalArticles: 91, // Valeurs de démonstration
          totalViews: 245680,
          totalAdvice: 85,
          totalGuides: 6
        },
        isError: true,
        errorMessage: `Erreur API: ${response.status} - ${response.statusText}`,
        apiStatus: "error",
        debugInfo: {
          url: apiUrl,
          status: response.status,
          statusText: response.statusText
        }
      });
    }

    const data = await response.json();
    console.log(`[ADMIN BLOG SIMPLE] Données reçues:`, JSON.stringify(data).substring(0, 200) + '...');

    // Extraction des statistiques avec validation des données
    const overview = data?.data?.overview;
    const stats: BlogStats = {
      totalArticles: overview?.totalArticles || data?.data?.byType?.advice?.total || 0,
      totalViews: overview?.totalViews || data?.data?.byType?.advice?.views || 0,
      totalAdvice: overview?.totalAdvice || data?.data?.byType?.advice?.total || 0,
      totalGuides: overview?.totalGuides || data?.data?.byType?.guide?.total || 0
    };

    return json<LoaderData>({
      stats,
      isError: false,
      apiStatus: "success",
      debugInfo: {
        url: apiUrl,
        status: response.status,
        dataKeys: Object.keys(data)
      }
    });

  } catch (error) {
    console.error('[ADMIN BLOG SIMPLE] Erreur loader:', error);
    
    // Fallback complet en cas d'erreur
    return json<LoaderData>({
      stats: {
        totalArticles: 91,
        totalViews: 245680,
        totalAdvice: 85,
        totalGuides: 6
      },
      isError: true,
      errorMessage: error instanceof Error ? error.message : "Erreur de connexion inconnue",
      apiStatus: error instanceof Error && error.name === 'AbortError' ? "timeout" : "error",
      debugInfo: {
        url: apiUrl,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Métadonnées SEO
export const meta: MetaFunction = () => {
  return [
    { title: "Administration Blog - Dashboard Principal" },
    { name: "description", content: "Interface d'administration complète pour la gestion du blog automobile." },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

// Composant principal
export default function AdminBlogSimplePage() {
  const { stats, isError, errorMessage, apiStatus, debugInfo } = useLoaderData<LoaderData>();
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Administration Blog</h1>
              <p className="text-gray-600 mt-2">Interface complète de gestion du blog automobile</p>
              
              {/* Indicateur de statut */}
              <div className="mt-4 flex items-center space-x-4">
                <Badge 
                  variant={
                    apiStatus === 'success' ? 'success' :
                    apiStatus === 'timeout' ? 'warning' :
                    'error'
                  }
                  size="sm"
                >
                  {apiStatus === 'success' ? '✅ API Opérationnelle' :
                   apiStatus === 'timeout' ? '⏱️ API Lente' :
                   '❌ API Indisponible'}
                </Badge>
                
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                >
                  {showDebug ? 'Masquer' : 'Afficher'} Debug
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                to="/blog"
                className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
              >
                <EyeIcon className="w-4 h-4 mr-2" />
                Voir le blog
              </Link>
              <Link
                to="/admin/performances"
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                <ChartBarIcon className="w-4 h-4 mr-2" />
                Performances
              </Link>
              <Link
                to="/admin/articles"
                className="inline-flex items-center px-4 py-2 bg-success hover:bg-success/90 text-success-foreground font-medium rounded-lg transition-colors"
              >
                <DocumentTextIcon className="w-4 h-4 mr-2" />
                Gestion Articles
              </Link>
            </div>
          </div>

          {/* Message d'erreur si nécessaire */}
          {isError && (
<Alert className="mt-6    rounded-lg p-4" variant="warning">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Attention</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    {errorMessage} - Affichage des données de démonstration.
                  </p>
                </div>
              </div>
            </Alert>
          )}

          {/* Informations de debug */}
          {showDebug && debugInfo && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Informations de debug</h4>
              <pre className="text-xs text-gray-600 overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentTextIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Articles</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{stats.totalArticles}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <EyeIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Vues</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{stats.totalViews.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Articles Conseils</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{stats.totalAdvice}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Guides / Constructeurs</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{stats.totalGuides}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Actions rapides</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/blog/advice"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-info/20 transition-colors group"
            >
              <DocumentTextIcon className="w-8 h-8 text-blue-600 mr-4" />
              <div>
                <h4 className="font-medium text-gray-900 group-hover:text-blue-700">Articles Conseils</h4>
                <p className="text-sm text-gray-600">{stats.totalAdvice} articles publiés</p>
              </div>
            </Link>

            <Link
              to="/blog/constructeurs"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-success/20 transition-colors group"
            >
              <UserGroupIcon className="w-8 h-8 text-green-600 mr-4" />
              <div>
                <h4 className="font-medium text-gray-900 group-hover:text-green-700">Constructeurs</h4>
                <p className="text-sm text-gray-600">6 marques disponibles</p>
              </div>
            </Link>

            <Link
              to="/blog/glossaire"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
            >
              <ChartBarIcon className="w-8 h-8 text-purple-600 mr-4" />
              <div>
                <h4 className="font-medium text-gray-900 group-hover:text-purple-700">Glossaire</h4>
                <p className="text-sm text-gray-600">6 termes techniques</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Informations système */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">État du système</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`text-2xl font-bold mb-2 ${
                apiStatus === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                {apiStatus === 'success' ? '✅' : '❌'}
              </div>
              <div className="text-sm text-gray-600">API Blog</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-2">🚀</div>
              <div className="text-sm text-gray-600">Interface Active</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-2">📊</div>
              <div className="text-sm text-gray-600">Données Chargées</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
