import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "~/server/auth.server";
import { BarChart, Users, Package, TrendingUp, DollarSign, Calendar, Activity } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard Admin - AutoParts" },
    { name: "description", content: "Tableau de bord administrateur avec statistiques temps réel" },
  ];
};

import { getRemixIntegrationService } from "~/server/remix-integration.server";

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });
  
  // Vérifier les permissions admin
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  try {
    const remixService = await getRemixIntegrationService(context);
    const dashboardResult = await remixService.getDashboardStats();

    if (!dashboardResult.success) {
      throw new Error(dashboardResult.error || "Erreur API pour les stats du dashboard");
    }

    // Pour l'instant, les métriques peuvent rester en fallback
    const fallbackMetrics = {
      onlineUsers: 42,
      activeOrders: 15,
      systemHealth: 'good' as const
    };

    return json({ 
      user, 
      dashboard: dashboardResult.stats,
      metrics: fallbackMetrics, // Utiliser les données de fallback pour les métriques
      isApiConnected: true
    });

  } catch (error) {
    console.error('Erreur lors du chargement du dashboard admin:', error);
    
    // Données de fallback en cas d'échec
    return json({ 
      user, 
      dashboard: {
        totalUsers: 0,
        totalOrders: 0,
      },
      metrics: {
        onlineUsers: 0,
        activeOrders: 0,
        systemHealth: 'error' as const
      },
      isApiConnected: false
    });
  }
};

export default function AdminDashboard() {
  const { user, dashboard, metrics, isApiConnected } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec statut API */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🚗 Dashboard Admin AutoParts</h1>
              <p className="text-gray-600">Vue d'ensemble système et métriques</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                isApiConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isApiConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span>{isApiConnected ? 'API Connectée' : 'Mode Fallback'}</span>
              </div>
              <div className="text-sm text-gray-500">
                Admin: {user.firstName} {user.name} (Niveau {user.level})
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Métriques temps réel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Utilisateurs en ligne</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.onlineUsers}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Commandes actives</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.activeOrders}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Santé système</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">{metrics.systemHealth}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Total Utilisateurs</h3>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-gray-900">{dashboard.totalUsers.toLocaleString()}</div>
              <p className="text-sm text-green-600">{dashboard.activeUsers.toLocaleString()} actifs</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Total Commandes</h3>
              <Package className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-gray-900">{dashboard.totalOrders.toLocaleString()}</div>
              <p className="text-sm text-orange-600">{dashboard.pendingOrders} en attente</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Chiffre d'Affaires</h3>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-gray-900">{dashboard.totalRevenue.toLocaleString()}€</div>
              <p className="text-sm text-green-600">Total TTC</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Stock Faible</h3>
              <BarChart className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-gray-900">{dashboard.lowStockItems.toLocaleString()}</div>
              <p className="text-sm text-red-600">Pièces à réapprovisionner</p>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a 
            href="/admin/orders" 
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-3">
              <Package className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-medium text-gray-900">Gestion Commandes</h3>
                <p className="text-sm text-gray-600">Voir toutes les commandes</p>
              </div>
            </div>
          </a>

          <a 
            href="/admin/staff" 
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="font-medium text-gray-900">Gestion Staff</h3>
                <p className="text-sm text-gray-600">Administrer les utilisateurs</p>
              </div>
            </div>
          </a>

          <a 
            href="/admin/reports" 
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-3">
              <BarChart className="h-8 w-8 text-purple-600" />
              <div>
                <h3 className="font-medium text-gray-900">Rapports</h3>
                <p className="text-sm text-gray-600">Statistiques détaillées</p>
              </div>
            </div>
          </a>

          <a 
            href="/admin/payments" 
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-3">
              <DollarSign className="h-8 w-8 text-orange-600" />
              <div>
                <h3 className="font-medium text-gray-900">Paiements</h3>
                <p className="text-sm text-gray-600">Suivi des transactions</p>
              </div>
            </div>
          </a>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Module Admin - Migration PHP vers NestJS-Remix Monorepo</p>
          <p>Dernière mise à jour: {new Date().toLocaleString()}</p>
        </div>

      </div>
    </div>
  );
}
