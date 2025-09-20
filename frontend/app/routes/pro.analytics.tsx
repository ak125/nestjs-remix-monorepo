// app/routes/pro.analytics.tsx
// Interface analytics professionnelle appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { 
  BarChart3, 
  TrendingUp, 
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Calendar,
  Target,
  Eye,
  MousePointer,
  Clock,
  Zap
} from 'lucide-react';
import { requireAuth } from '../auth/unified.server';

// Interfaces TypeScript
interface AnalyticsData {
  businessMetrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    customerCount: number;
    growthRate: number;
    conversionRate: number;
  };
  salesTrends: Array<{
    month: string;
    revenue: number;
    orders: number;
    customers: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
    revenue: number;
    growth: number;
  }>;
  customerSegments: Array<{
    segment: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
  performanceMetrics: {
    pageViews: number;
    sessionDuration: number;
    bounceRate: number;
    clickThroughRate: number;
  };
  forecasting: {
    nextMonthPrediction: number;
    confidenceLevel: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  // Vérifier permissions professionnelles (niveau 3+)
  if (!user.level || user.level < 3) {
    throw new Response('Accès refusé - Compte professionnel requis', { status: 403 });
  }

  // En production, récupérer les vraies données depuis l'API analytics
  const analytics: AnalyticsData = {
    businessMetrics: {
      totalRevenue: 486750.80,
      totalOrders: 1892,
      averageOrderValue: 257.30,
      customerCount: 1247,
      growthRate: 18.7,
      conversionRate: 11.3
    },
    salesTrends: [
      { month: 'Jan', revenue: 38420, orders: 156, customers: 89 },
      { month: 'Fév', revenue: 42380, orders: 167, customers: 94 },
      { month: 'Mar', revenue: 39870, orders: 161, customers: 91 },
      { month: 'Avr', revenue: 45230, orders: 178, customers: 102 },
      { month: 'Mai', revenue: 48650, orders: 186, customers: 108 },
      { month: 'Jun', revenue: 52380, orders: 198, customers: 115 },
      { month: 'Jul', revenue: 49870, orders: 189, customers: 110 },
      { month: 'Aoû', revenue: 51420, orders: 194, customers: 112 }
    ],
    topProducts: [
      { 
        id: 'prod-001', 
        name: 'Plaquettes de frein Brembo Sport', 
        sales: 234, 
        revenue: 30420, 
        growth: 23.5 
      },
      { 
        id: 'prod-002', 
        name: 'Huile moteur Castrol GTX', 
        sales: 189, 
        revenue: 4710, 
        growth: 18.2 
      },
      { 
        id: 'prod-003', 
        name: 'Kit distribution Gates', 
        sales: 87, 
        revenue: 21330, 
        growth: 31.7 
      },
      { 
        id: 'prod-004', 
        name: 'Filtre à air K&N', 
        sales: 156, 
        revenue: 10584, 
        growth: 25.1 
      },
      { 
        id: 'prod-005', 
        name: 'Amortisseurs Bilstein', 
        sales: 76, 
        revenue: 13572, 
        growth: 15.8 
      }
    ],
    customerSegments: [
      { segment: 'Garages Pro', count: 456, revenue: 234850, percentage: 48.3 },
      { segment: 'Concessionnaires', count: 123, revenue: 145760, percentage: 29.9 },
      { segment: 'Particuliers Premium', count: 398, revenue: 78430, percentage: 16.1 },
      { segment: 'Flottes', count: 67, revenue: 27710, percentage: 5.7 }
    ],
    performanceMetrics: {
      pageViews: 47832,
      sessionDuration: 8.4,
      bounceRate: 23.7,
      clickThroughRate: 4.8
    },
    forecasting: {
      nextMonthPrediction: 54870,
      confidenceLevel: 87.3,
      trendDirection: 'up'
    }
  };

  return json({ user, analytics });
}

export default function ProAnalytics() {
  const { user, analytics } = useLoaderData<typeof loader>();

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

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'down': return <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />;
      default: return <Target className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BarChart3 className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Analytics Professionnelles</h1>
              <p className="text-purple-100 text-lg mt-1">
                Tableau de bord avancé pour {user.firstName} - Niveau {user.level}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold">{formatPrice(analytics.businessMetrics.totalRevenue)}</div>
            <div className="text-purple-200">Chiffre d'affaires total</div>
            <div className="flex items-center justify-end gap-2 mt-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">{formatPercentage(analytics.businessMetrics.growthRate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Commandes</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.businessMetrics.totalOrders)}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            +{analytics.businessMetrics.growthRate.toFixed(1)}% vs période précédente
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Panier Moyen</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(analytics.businessMetrics.averageOrderValue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            Performance excellente
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clients Actifs</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.businessMetrics.customerCount)}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
          <div className="mt-2 text-sm text-blue-600">
            Base client solide
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.businessMetrics.conversionRate}%</p>
            </div>
            <Target className="h-8 w-8 text-orange-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            Au-dessus de la moyenne
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Évolution des ventes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Évolution des Ventes
          </h2>
          
          <div className="space-y-3">
            {analytics.salesTrends.slice(-6).map((trend, index) => (
              <div key={trend.month} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{trend.month}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrice(trend.revenue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {trend.orders} commandes
                    </div>
                  </div>
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(trend.revenue / 60000) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top produits */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-green-500" />
            Top Produits
          </h2>
          
          <div className="space-y-3">
            {analytics.topProducts.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <span className="font-medium text-gray-900 text-sm">{product.name}</span>
                    <div className="text-xs text-gray-500">{product.sales} ventes</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatPrice(product.revenue)}
                  </div>
                  <div className={`text-xs font-medium ${
                    product.growth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercentage(product.growth)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Segments clients et prévisions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Segments clients */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Segments Clients
          </h2>
          
          <div className="space-y-4">
            {analytics.customerSegments.map((segment) => (
              <div key={segment.segment} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{segment.count}</div>
                    <div className="text-xs text-gray-500">clients</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{segment.segment}</div>
                    <div className="text-sm text-gray-600">
                      {formatPrice(segment.revenue)} ({segment.percentage}%)
                    </div>
                  </div>
                </div>
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${segment.percentage * 2}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prévisions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Prévisions
          </h2>
          
          <div className="space-y-4">
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 border">
              <div className="flex items-center justify-center gap-2 mb-2">
                {getTrendIcon(analytics.forecasting.trendDirection)}
                <span className="font-medium text-gray-700">Mois Prochain</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {formatPrice(analytics.forecasting.nextMonthPrediction)}
              </div>
              <div className="text-sm text-gray-600">
                Confiance: {analytics.forecasting.confidenceLevel}%
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Pages vues
                </span>
                <span className="font-medium">{formatNumber(analytics.performanceMetrics.pageViews)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Durée session
                </span>
                <span className="font-medium">{analytics.performanceMetrics.sessionDuration}min</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <MousePointer className="h-4 w-4" />
                  Taux de clic
                </span>
                <span className="font-medium">{analytics.performanceMetrics.clickThroughRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions Recommandées</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Optimiser Top Produits</span>
            </div>
            <p className="text-sm text-green-700">
              Augmenter le stock des produits en forte croissance (+31.7%)
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800">Fidéliser Clients</span>
            </div>
            <p className="text-sm text-blue-700">
              Lancer campagne pour les 398 particuliers premium
            </p>
          </div>
          
          <div className="p-4 rounded-lg border border-purple-200 bg-purple-50">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-800">Améliorer Conversion</span>
            </div>
            <p className="text-sm text-purple-700">
              Optimiser les pages avec 23.7% de taux de rebond
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
