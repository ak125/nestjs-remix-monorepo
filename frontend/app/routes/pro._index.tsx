// app/routes/pro._index.tsx
// Tableau de bord professionnel appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { 
  Building2, 
  ShoppingCart, 
  TrendingUp, 
  Users,
  Package,
  CreditCard,
  BarChart3,
  Target,
  Clock,
  Star,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { requireAuth } from '../auth/unified.server';

// Interfaces TypeScript
interface ProDashboardStats {
  ordersThisMonth: number;
  revenueThisMonth: number;
  activeCatalog: number;
  customersServed: number;
  averageOrderValue: number;
  conversionRate: number;
  topCategories: Array<{
    name: string;
    sales: number;
    growth: number;
  }>;
  recentOrders: Array<{
    id: string;
    customer: string;
    total: number;
    status: string;
    date: string;
  }>;
  performanceMetrics: {
    satisfaction: number;
    deliveryTime: number;
    returnRate: number;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  // Vérifier permissions professionnelles (niveau 3+)
  if (!user.level || user.level < 3) {
    throw new Response('Accès refusé - Compte professionnel requis', { status: 403 });
  }

  // En production, récupérer les vraies données depuis l'API
  const stats: ProDashboardStats = {
    ordersThisMonth: 147,
    revenueThisMonth: 42380.50,
    activeCatalog: 12847,
    customersServed: 892,
    averageOrderValue: 288.30,
    conversionRate: 12.8,
    topCategories: [
      { name: 'Freinage', sales: 156, growth: 23.5 },
      { name: 'Lubrification', sales: 134, growth: 18.2 },
      { name: 'Filtration', sales: 98, growth: 31.7 },
      { name: 'Distribution', sales: 87, growth: -5.3 },
      { name: 'Amortissement', sales: 76, growth: 15.8 }
    ],
    recentOrders: [
      {
        id: 'ORD-2025-001247',
        customer: 'Garage Central SARL',
        total: 456.80,
        status: 'Expédiée',
        date: '2025-08-22'
      },
      {
        id: 'ORD-2025-001246',
        customer: 'Auto Services Plus',
        total: 234.50,
        status: 'Préparation',
        date: '2025-08-22'
      },
      {
        id: 'ORD-2025-001245',
        customer: 'Méca Pro Expertise',
        total: 789.20,
        status: 'Livrée',
        date: '2025-08-21'
      },
      {
        id: 'ORD-2025-001244',
        customer: 'Rapid Auto 67',
        total: 167.90,
        status: 'Confirmée',
        date: '2025-08-21'
      }
    ],
    performanceMetrics: {
      satisfaction: 4.7,
      deliveryTime: 1.8,
      returnRate: 2.1
    }
  };

  return json({ user, stats });
}

export default function ProIndex() {
  const { user, stats } = useLoaderData<typeof loader>();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Livrée': return 'bg-green-100 text-green-800';
      case 'Expédiée': return 'bg-blue-100 text-blue-800';
      case 'Préparation': return 'bg-yellow-100 text-yellow-800';
      case 'Confirmée': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Building2 className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Tableau de bord PRO</h1>
              <p className="text-indigo-100 text-lg mt-1">
                Bienvenue {user.firstName} - Niveau {user.level}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold">{formatPrice(stats.revenueThisMonth)}</div>
            <div className="text-indigo-200">Chiffre d'affaires ce mois</div>
          </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Commandes</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.ordersThisMonth)}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            +12.5% vs mois dernier
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Catalogue</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.activeCatalog)}</p>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            +234 nouveaux produits
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clients</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.customersServed)}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            +5.8% nouveaux clients
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Panier Moyen</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.averageOrderValue)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            +8.3% vs mois dernier
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top catégories */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Top Catégories
          </h2>
          
          <div className="space-y-3">
            {stats.topCategories.map((category, index) => (
              <div key={category.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="font-medium text-gray-900">{category.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-600">{category.sales} ventes</span>
                  <span className={`text-sm font-medium ${getGrowthColor(category.growth)}`}>
                    {formatPercentage(category.growth)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Métriques de performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" />
            Performance
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-gray-700">Satisfaction client</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{stats.performanceMetrics.satisfaction}/5</div>
                <div className="text-sm text-green-600">Excellent</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="text-gray-700">Délai de livraison</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{stats.performanceMetrics.deliveryTime}j</div>
                <div className="text-sm text-green-600">Très bon</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <span className="text-gray-700">Taux de retour</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{stats.performanceMetrics.returnRate}%</div>
                <div className="text-sm text-green-600">Faible</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Commandes récentes */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-500" />
              Commandes Récentes
            </h2>
            <Link 
              to="/pro/orders" 
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Voir toutes
            </Link>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link 
                      to={`/pro/orders/${order.id}`}
                      className="text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                      {order.id}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.customer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatPrice(order.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status === 'Livrée' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.date).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/pro/products"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-center group"
        >
          <Package className="h-8 w-8 text-blue-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 mb-2">Catalogue Produits</h3>
          <p className="text-sm text-gray-600">Gérer vos {formatNumber(stats.activeCatalog)} références</p>
        </Link>

        <Link
          to="/pro/orders"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-center group"
        >
          <ShoppingCart className="h-8 w-8 text-green-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 mb-2">Gestion Commandes</h3>
          <p className="text-sm text-gray-600">{formatNumber(stats.ordersThisMonth)} commandes ce mois</p>
        </Link>

        <Link
          to="/pro/analytics"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-center group"
        >
          <BarChart3 className="h-8 w-8 text-purple-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 mb-2">Analytics Avancées</h3>
          <p className="text-sm text-gray-600">Taux de conversion : {stats.conversionRate}%</p>
        </Link>
      </div>
    </div>
  );
}
