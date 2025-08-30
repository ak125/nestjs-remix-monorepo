/**
 * Interface de démonstration pour la gestion du blog
 * Version accessible sans authentification pour les tests
 * @route /blog/admin-demo
 */

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

const UserGroupIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const CogIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PencilIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

// Types pour les données
interface DashboardStats {
  totalArticles: number;
  totalViews: number;
  monthlyViews: number;
  totalComments: number;
  publishedArticles: number;
  draftArticles: number;
}

interface LoaderData {
  stats: DashboardStats;
  recentArticles: Array<{
    id: string;
    title: string;
    type: string;
    views: number;
    status: string;
    lastModified: string;
  }>;
  topArticles: Array<{
    id: string;
    title: string;
    views: number;
    type: string;
  }>;
}

// Loader avec données de démonstration
export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[DEMO ADMIN] Chargement des statistiques blog');

  // Données de démonstration
  const stats: DashboardStats = {
    totalArticles: 91, // 85 conseils + 6 constructeurs
    totalViews: 245680,
    monthlyViews: 32450,
    totalComments: 1247,
    publishedArticles: 91,
    draftArticles: 3
  };

  const recentArticles = [
    {
      id: "recent_1",
      title: "Guide complet de l'entretien automobile",
      type: "advice",
      views: 2450,
      status: "published",
      lastModified: "2024-01-28T14:30:00.000Z"
    },
    {
      id: "recent_2", 
      title: "BMW Série 3 : Innovation et Performance",
      type: "constructeur",
      views: 1890,
      status: "published",
      lastModified: "2024-01-27T16:20:00.000Z"
    },
    {
      id: "recent_3",
      title: "Nouveautés technologiques 2024",
      type: "advice",
      views: 1650,
      status: "draft",
      lastModified: "2024-01-26T09:15:00.000Z"
    }
  ];

  const topArticles = [
    {
      id: "top_1",
      title: "Comment choisir ses pneus ?",
      views: 12450,
      type: "advice"
    },
    {
      id: "top_2",
      title: "Mercedes-AMG : Puissance et Luxe",
      views: 9870,
      type: "constructeur"
    },
    {
      id: "top_3",
      title: "Diagnostic automobile moderne",
      views: 8750,
      type: "advice"
    }
  ];

  return json<LoaderData>({
    stats,
    recentArticles,
    topArticles
  });
}

// Métadonnées SEO
export const meta: MetaFunction = () => {
  return [
    { title: "Administration Blog - Démonstration" },
    { name: "description", content: "Interface de démonstration pour la gestion du blog automobile." },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

// Composant principal
export default function BlogAdminDemoPage() {
  const { stats, recentArticles, topArticles } = useLoaderData<LoaderData>();
  const [selectedTab, setSelectedTab] = useState("dashboard");

  // Formatage de date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Badge de statut
  const getStatusBadge = (status: string) => {
    const colors = {
      published: "bg-green-100 text-green-800",
      draft: "bg-yellow-100 text-yellow-800",
      archived: "bg-gray-100 text-gray-800"
    };

    const labels = {
      published: "Publié",
      draft: "Brouillon",
      archived: "Archivé"
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Administration Blog</h1>
              <p className="text-gray-600">Interface de démonstration - Gestion complète du contenu</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/blog"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <EyeIcon className="w-4 h-4 mr-2" />
                Voir le blog
              </Link>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                🟢 DÉMO
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="border-t border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setSelectedTab("dashboard")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === "dashboard"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <ChartBarIcon className="w-4 h-4 inline mr-2" />
                Tableau de bord
              </button>
              <button
                onClick={() => setSelectedTab("articles")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === "articles"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <DocumentTextIcon className="w-4 h-4 inline mr-2" />
                Articles
              </button>
              <button
                onClick={() => setSelectedTab("analytics")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === "analytics"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <ChartBarIcon className="w-4 h-4 inline mr-2" />
                Analytics
              </button>
              <button
                onClick={() => setSelectedTab("settings")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === "settings"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <CogIcon className="w-4 h-4 inline mr-2" />
                Paramètres
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedTab === "dashboard" && (
          <div className="space-y-8">
            {/* Statistiques principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
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

              <div className="bg-white rounded-lg shadow p-6">
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

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Vues ce mois</dt>
                      <dd className="text-3xl font-semibold text-gray-900">{stats.monthlyViews.toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserGroupIcon className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Commentaires</dt>
                      <dd className="text-3xl font-semibold text-gray-900">{stats.totalComments.toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Articles récents et top articles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Articles récents */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Articles récents</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {recentArticles.map((article, index) => (
                    <div key={index} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {article.title}
                          </h4>
                          <div className="mt-1 flex items-center space-x-3 text-sm text-gray-500">
                            <span className="capitalize">{article.type}</span>
                            <span>•</span>
                            <span>{article.views.toLocaleString()} vues</span>
                            <span>•</span>
                            <span>{formatDate(article.lastModified)}</span>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center space-x-3">
                          {getStatusBadge(article.status)}
                          <button className="text-gray-400 hover:text-gray-600">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top articles */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Articles les plus vus</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {topArticles.map((article, index) => (
                    <div key={index} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <span className="text-lg font-bold text-gray-400 mr-3">#{index + 1}</span>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {article.title}
                              </h4>
                              <div className="mt-1 text-sm text-gray-500">
                                <span className="capitalize">{article.type}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {article.views.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">vues</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actions rapides</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                  to="/blog/advice"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentTextIcon className="w-4 h-4 mr-2" />
                  Voir conseils ({stats.publishedArticles - 6})
                </Link>
                <Link
                  to="/blog/constructeurs"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <UserGroupIcon className="w-4 h-4 mr-2" />
                  Voir constructeurs (6)
                </Link>
                <Link
                  to="/blog/glossaire"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentTextIcon className="w-4 h-4 mr-2" />
                  Voir glossaire (6)
                </Link>
                <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Nouvel article
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedTab === "articles" && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Gestion des articles</h3>
                <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Nouvel article
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="text-center py-12">
                <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Interface de gestion des articles</h4>
                <p className="text-gray-600">
                  Cette section permettrait de créer, modifier et organiser tous les articles du blog.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                  <Link
                    to="/blog/advice"
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="text-2xl font-bold text-blue-600">85</div>
                    <div className="text-sm text-gray-600">Conseils</div>
                  </Link>
                  <Link
                    to="/blog/constructeurs"
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="text-2xl font-bold text-green-600">6</div>
                    <div className="text-sm text-gray-600">Constructeurs</div>
                  </Link>
                  <Link
                    to="/blog/glossaire"
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="text-2xl font-bold text-purple-600">6</div>
                    <div className="text-sm text-gray-600">Termes glossaire</div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === "analytics" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Analytics et statistiques</h3>
            <div className="text-center py-12">
              <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Analyse des performances</h4>
              <p className="text-gray-600 mb-6">
                Interface d'analyse complète des performances du blog avec graphiques et métriques détaillées.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <div className="p-6 border border-gray-200 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">245K</div>
                  <div className="text-sm text-gray-600">Vues totales</div>
                  <div className="text-xs text-green-600 mt-1">+15% ce mois</div>
                </div>
                <div className="p-6 border border-gray-200 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">91</div>
                  <div className="text-sm text-gray-600">Articles publiés</div>
                  <div className="text-xs text-blue-600 mt-1">3 brouillons</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === "settings" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres du blog</h3>
            <div className="text-center py-12">
              <CogIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Configuration du blog</h4>
              <p className="text-gray-600 mb-6">
                Paramètres généraux, SEO, catégories, et configuration avancée du blog.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">SEO</div>
                  <div className="text-xs text-gray-600 mt-1">Métadonnées et optimisation</div>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">Catégories</div>
                  <div className="text-xs text-gray-600 mt-1">Organisation du contenu</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
