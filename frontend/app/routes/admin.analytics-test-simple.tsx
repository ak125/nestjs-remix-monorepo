// app/routes/admin.analytics-test-simple.tsx
// Interface analytics simple optimisée appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  ShoppingBag,
  DollarSign,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { getOptionalUser } from '../auth/unified.server';

interface DashboardStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalUsers: number;
  activeUsers: number;
  totalSuppliers: number;
  success: boolean;
}

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  
  // Vérifier authentification
  if (!user) {
    throw new Response('Non autorisé', { status: 401 });
  }
  
  // Vérifier permissions admin (niveau 7+)
  if (!user.level || user.level < 7) {
    throw new Response('Accès refusé - Permissions administrateur requises', { status: 403 });
  }

  // Valeurs par défaut si l'API échoue
  let stats: DashboardStats = {
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalSuppliers: 0,
    success: false
  };

  try {
    const response = await fetch('http://localhost:3000/api/dashboard/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      stats = await response.json();
    }
  } catch (error) {
    console.warn('Impossible de récupérer les statistiques dashboard:', error);
  }

  return json({ 
    stats,
    user,
    timestamp: new Date().toISOString()
  });
};

export default function AdminAnalyticsTestSimple() {
  const { stats, user, timestamp } = useLoaderData<typeof loader>();

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const calculateOrdersCompletion = () => {
    if (stats.totalOrders === 0) return 0;
    return Math.round((stats.completedOrders / stats.totalOrders) * 100);
  };

  const calculateUserActivity = () => {
    if (stats.totalUsers === 0) return 0;
    return Math.round((stats.activeUsers / stats.totalUsers) * 100);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BarChart3 className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Analytics Simplifiées</h1>
              <p className="text-purple-100 text-lg mt-1">
                Tableau de bord administrateur - Vue d'ensemble
              </p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur px-6 py-3 rounded-lg">
            <div className="flex items-center gap-2 text-purple-200">
              <Activity className="h-5 w-5" />
              <span className="font-semibold">
                {stats.success ? 'Données en temps réel' : 'Mode dégradé'}
              </span>
            </div>
            <div className="text-sm text-purple-100 mt-1">
              Dernière mise à jour: {new Date(timestamp).toLocaleTimeString('fr-FR')}
            </div>
          </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Commandes totales */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Commandes</h2>
            </div>
            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
              TOTAL
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(stats.totalOrders)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              {formatNumber(stats.completedOrders)} complétées
            </div>
            <div className="text-orange-600">
              {calculateOrdersCompletion()}%
            </div>
          </div>
        </div>

        {/* Revenus */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Revenus</h2>
            </div>
            <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
              TOTAL
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatCurrency(stats.totalRevenue)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Chiffre d'affaires</span>
            <div className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-4 w-4" />
              En croissance
            </div>
          </div>
        </div>

        {/* Utilisateurs */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Utilisateurs</h2>
            </div>
            <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium">
              TOTAL
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(stats.totalUsers)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-green-600">
              <Activity className="h-4 w-4" />
              {formatNumber(stats.activeUsers)} actifs
            </div>
            <div className="text-purple-600">
              {calculateUserActivity()}%
            </div>
          </div>
        </div>

        {/* Commandes en attente */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">En Attente</h2>
            </div>
            <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">
              PENDING
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(stats.pendingOrders)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">À traiter</span>
            <div className="flex items-center gap-1 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              Priorité
            </div>
          </div>
        </div>
      </div>

      {/* Graphique et insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Analytics simplifié */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Vue d'ensemble
          </h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
              <span className="font-medium text-blue-900">Taux de conversion</span>
              <span className="text-2xl font-bold text-blue-600">
                {calculateOrdersCompletion()}%
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
              <span className="font-medium text-purple-900">Utilisateurs actifs</span>
              <span className="text-2xl font-bold text-purple-600">
                {calculateUserActivity()}%
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <span className="font-medium text-green-900">Revenus par commande</span>
              <span className="text-2xl font-bold text-green-600">
                {stats.totalOrders > 0 ? formatCurrency(stats.totalRevenue / stats.totalOrders) : formatCurrency(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Statut système */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Statut Système
          </h2>
          
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${stats.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-3">
                {stats.success ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <h3 className={`font-medium ${stats.success ? 'text-green-900' : 'text-red-900'}`}>
                    API Dashboard
                  </h3>
                  <p className={`text-sm ${stats.success ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.success ? 'Connexion réussie' : 'Mode dégradé - Données par défaut'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-600" />
                <div>
                  <h3 className="font-medium text-blue-900">
                    Session Utilisateur
                  </h3>
                  <p className="text-sm text-blue-600">
                    {user.firstName} {user.lastName} - Niveau {user.level}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-purple-600" />
                <div>
                  <h3 className="font-medium text-purple-900">
                    Analytics Système
                  </h3>
                  <p className="text-sm text-purple-600">
                    Interface simplifiée active
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
