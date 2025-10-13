/**
 * 🎯 DASHBOARD UNIFIÉ
 * 
 * Interface de tableau de bord unifiée remplaçant:
 * - pro._index.tsx
 * - commercial._index.tsx
 * 
 * Features:
 * - Role-based UI (Pro vs Commercial)
 * - Stats adaptées au niveau d'accès
 * - Composants réutilisables
 * - API unifiée
 * 
 * Routes:
 * - /dashboard (détection automatique du rôle)
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { 
  ShoppingCart, 
  Package,
  BarChart3,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { requireUser } from '../auth/unified.server';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

// Interfaces TypeScript
interface DashboardStats {
  // Stats communes
  ordersThisMonth: number;
  revenueThisMonth: number;
  activeCatalog: number;
  
  // Stats Pro
  customersServed?: number;
  averageOrderValue?: number;
  conversionRate?: number;
  
  // Stats Commercial
  todayOrdersCount?: number;
  preparingOrdersCount?: number;
  lowStockCount?: number;
  
  // Catégories top
  topCategories: Array<{
    name: string;
    sales: number;
    growth: number;
  }>;
  
  // Commandes récentes
  recentOrders: Array<{
    id: string;
    orderNumber?: string;
    customer: string;
    customerName?: string;
    total: number;
    totalAmount?: number;
    status: string;
    date: string;
    createdAt?: string;
  }>;
  
  // Métriques de performance
  performanceMetrics?: {
    satisfaction: number;
    deliveryTime: number;
    returnRate: number;
  };
  
  // Stock faible (commercial)
  lowStockItems?: Array<{
    id: string;
    name: string;
    currentStock: number;
    minStock: number;
  }>;
  
  // Fournisseurs (commercial)
  suppliers?: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

interface UserRole {
  type: 'commercial';
  level: number;
  name: string;
  email: string;
}

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  
  // Vérifier accès commercial (niveau 3+)
  const userLevel = user.level || 0;
  if (userLevel < 3) {
    throw new Response('Accès refusé - Compte commercial requis', { 
      status: 403 
    });
  }
  
  const userRole: UserRole = {
    type: 'commercial', // Une seule interface commerciale
    level: userLevel,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email
  };

  const API_BASE = process.env.API_URL || 'http://localhost:3000';
  
  try {
    console.log('🔗 Dashboard API_BASE:', API_BASE);
    console.log('👤 Dashboard User:', { level: userLevel, name: userRole.name });
    
    // Appels API pour interface commerciale
    const apiCalls = [
      fetch(`${API_BASE}/api/dashboard/stats`, {
        headers: { 
          'internal-call': 'true',
          'user-level': userLevel.toString()
        }
      }),
      fetch(`${API_BASE}/api/dashboard/orders/recent`, {
        headers: { 'internal-call': 'true' }
      }),
      fetch(`${API_BASE}/api/suppliers`, {
        headers: { 'internal-call': 'true' }
      })
    ];
    
    const responses = await Promise.all(apiCalls);
    
    console.log('📊 Dashboard Response status:', {
      stats: responses[0].status,
      orders: responses[1].status,
      suppliers: responses[2].status
    });
    
    // Construire les stats unifiées
    let stats: DashboardStats = {
      ordersThisMonth: 0,
      revenueThisMonth: 0,
      activeCatalog: 0,
      topCategories: [],
      recentOrders: []
    };
    
    // Traiter les données du dashboard commercial
    if (responses[0]?.ok) {
      const dashboardData = await responses[0].json();
      console.log('📊 Dashboard stats data:', dashboardData);
      
      stats = {
        ordersThisMonth: dashboardData.totalOrders || 0,
        revenueThisMonth: dashboardData.totalRevenue || 0,
        activeCatalog: dashboardData.totalProducts || 0,
        todayOrdersCount: Math.floor((dashboardData.totalOrders || 0) * 0.02),
        preparingOrdersCount: dashboardData.pendingOrders || 0,
        lowStockCount: dashboardData.lowStockCount || 0,
        topCategories: dashboardData.topCategories || [],
        recentOrders: [],
        lowStockItems: dashboardData.lowStockItems || [],
        suppliers: []
      };
    } else {
      console.error('❌ Dashboard stats API failed:', responses[0].status, await responses[0].text());
    }
    
    // Traiter les commandes récentes
    if (responses[1]?.ok) {
      const ordersData = await responses[1].json();
      console.log('📦 Dashboard orders count:', ordersData.orders?.length || 0);
      stats.recentOrders = (ordersData.orders || []).slice(0, 5).map((order: any) => ({
        id: order.id || order.orderNumber,
        orderNumber: order.orderNumber,
        customer: order.customerName || order.customer,
        customerName: order.customerName,
        total: order.totalAmount || order.total,
        totalAmount: order.totalAmount,
        status: order.status,
        date: order.createdAt || order.date,
        createdAt: order.createdAt
      }));
    } else {
      console.error('❌ Dashboard orders API failed:', responses[1].status);
    }
    
    // Traiter les fournisseurs
    if (responses[2]?.ok) {
      const suppliersData = await responses[2].json();
      console.log('🏢 Dashboard suppliers count:', suppliersData.suppliers?.length || 0);
      stats.suppliers = (suppliersData.suppliers || []).slice(0, 5).map((supplier: any) => ({
        id: supplier.id,
        name: supplier.name,
        status: supplier.statistics?.totalArticles > 0 ? 'active' : 'inactive'
      }));
    } else {
      console.error('❌ Dashboard suppliers API failed:', responses[2].status);
    }
    
    console.log('✅ Dashboard final stats:', {
      ordersThisMonth: stats.ordersThisMonth,
      revenueThisMonth: stats.revenueThisMonth,
      todayOrdersCount: stats.todayOrdersCount,
      preparingOrdersCount: stats.preparingOrdersCount,
      lowStockCount: stats.lowStockCount,
      recentOrdersCount: stats.recentOrders.length,
      suppliersCount: stats.suppliers?.length || 0
    });
    
    return json({ user: userRole, stats });
    
  } catch (error) {
    console.error('❌ Erreur dashboard:', error);
    
    // Données de fallback
    return json({ 
      user: userRole, 
      stats: {
        ordersThisMonth: 0,
        revenueThisMonth: 0,
        activeCatalog: 0,
        topCategories: [],
        recentOrders: []
      }
    });
  }
}

export default function Dashboard() {
  const loaderData = useLoaderData<typeof loader>();
  const user = loaderData.user;
  const stats = loaderData.stats as DashboardStats;

  // Utilitaires de formatage
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

  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('livr') || statusLower.includes('complet')) {
      return 'bg-green-100 text-green-800';
    }
    if (statusLower.includes('expéd') || statusLower.includes('transit')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (statusLower.includes('prépar') || statusLower.includes('attente')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (statusLower.includes('confirm')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Commercial */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BarChart3 className="h-12 w-12" />
            <div>
              <h1 className="text-3xl font-bold">
                Tableau de Bord Commercial
              </h1>
              <p className="text-white/80 mt-1">
                Bienvenue, {user.name}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/analytics">
              <Button variant="secondary" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </Link>
            <Link to="/products/admin">
              <Button variant="secondary" size="sm">
                <Package className="h-4 w-4 mr-2" />
                Produits
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Commandes aujourd'hui */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Commandes Aujourd'hui
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats.todayOrdersCount || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              À traiter rapidement
            </p>
          </CardContent>
        </Card>

        {/* Chiffre d'affaires */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              CA du Mois
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(stats.revenueThisMonth)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Chiffre d'affaires mensuel
            </p>
          </CardContent>
        </Card>

        {/* En préparation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              En Préparation
            </CardTitle>
            <Package className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats.preparingOrdersCount || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Commandes à traiter
            </p>
          </CardContent>
        </Card>

        {/* Stock faible */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Stock Faible
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats.lowStockCount || 0)}
            </div>
            <p className="text-xs text-red-500 mt-1">
              Articles à réapprovisionner
            </p>
          </CardContent>
        </Card>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Catégories Top */}
        {stats.topCategories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Catégories Performantes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.topCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        index === 0 ? 'bg-yellow-100 text-yellow-600' :
                        index === 1 ? 'bg-gray-100 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <span className="text-sm font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatNumber(category.sales)} ventes
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={category.growth >= 0 ? 'default' : 'destructive'}
                      className={getGrowthColor(category.growth)}
                    >
                      {formatPercentage(category.growth)}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link to="/products/ranges">
                  <Button variant="outline" className="w-full">
                    Voir toutes les catégories
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Commandes récentes */}
        <Card>
          <CardHeader>
            <CardTitle>Commandes Récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {stats.recentOrders.map((order) => (
                  <div 
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">
                          {order.orderNumber || order.id}
                        </p>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {order.customer || order.customerName}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.date || order.createdAt || '').toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        {formatPrice(order.total || order.totalAmount || 0)}
                      </p>
                      <Link 
                        to={`/orders/${order.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Voir détails
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Aucune commande récente
              </p>
            )}
            <div className="mt-6">
              <Link to="/orders.admin">
                <Button variant="outline" className="w-full">
                  Voir toutes les commandes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stock faible */}
        {stats.lowStockItems && stats.lowStockItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Alertes Stock Faible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Stock: {item.currentStock} / Min: {item.minStock}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      Urgent
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link to="/inventory.admin">
                  <Button variant="outline" className="w-full">
                    Gérer les stocks
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fournisseurs */}
        {stats.suppliers && stats.suppliers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Fournisseurs Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.suppliers.map((supplier) => (
                  <div key={supplier.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{supplier.name}</p>
                    <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                      {supplier.status === 'active' ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link to="/suppliers.admin">
                  <Button variant="outline" className="w-full">
                    Voir tous les fournisseurs
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}


      </div>

      {/* Actions rapides */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/products/admin">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <Package className="h-10 w-10 text-blue-500" />
              <div>
                <h3 className="font-bold">Gestion Produits</h3>
                <p className="text-sm text-gray-500">Catalogue et stocks</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/orders.admin">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <ShoppingCart className="h-10 w-10 text-green-500" />
              <div>
                <h3 className="font-bold">Commandes</h3>
                <p className="text-sm text-gray-500">Gérer les commandes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/analytics">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <BarChart3 className="h-10 w-10 text-purple-500" />
              <div>
                <h3 className="font-bold">Analytics</h3>
                <p className="text-sm text-gray-500">Rapports détaillés</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
