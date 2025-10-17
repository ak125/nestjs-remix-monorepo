import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 📊 Types pour les métriques business
interface BusinessMetrics {
  revenue: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
  customers: {
    total: number;
    new: number;
    returning: number;
    churnRate: number;
  };
  orders: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    averageValue: number;
  };
  performance: {
    conversionRate: number;
    avgOrderValue: number;
    customerLifetimeValue: number;
    returnOnInvestment: number;
  };
}

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
}

interface ProductData {
  name: string;
  sales: number;
  revenue: number;
  margin: number;
}

interface CustomerSegment {
  name: string;
  count: number;
  value: number;
  color: string;
}

// 📈 Composant principal du tableau de bord analytics
export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [productData, setProductData] = useState<ProductData[]>([]);
  const [customerSegments, setCustomerSegments] = useState<CustomerSegment[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [isLoading, setIsLoading] = useState(true);

  // 🔄 Simulation de données en temps réel
  useEffect(() => {
    const generateMockData = () => {
      // Métriques principales
      const mockMetrics: BusinessMetrics = {
        revenue: {
          current: 125430 + Math.random() * 1000,
          previous: 118500,
          growth: 5.8 + Math.random() * 2,
          trend: Math.random() > 0.3 ? 'up' : 'down',
        },
        customers: {
          total: 5678 + Math.floor(Math.random() * 10),
          new: 234 + Math.floor(Math.random() * 20),
          returning: 1456,
          churnRate: 2.3 + Math.random() * 0.5,
        },
        orders: {
          total: 1234 + Math.floor(Math.random() * 50),
          pending: 45 + Math.floor(Math.random() * 10),
          completed: 1189,
          cancelled: 23,
          averageValue: 98.50 + Math.random() * 20,
        },
        performance: {
          conversionRate: 3.2 + Math.random() * 0.5,
          avgOrderValue: 98.50 + Math.random() * 20,
          customerLifetimeValue: 450 + Math.random() * 100,
          returnOnInvestment: 285 + Math.random() * 50,
        },
      };

      // Données de revenus (7 derniers jours)
      const mockRevenueData: RevenueData[] = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        revenue: 3000 + Math.random() * 2000 + Math.sin(i / 7) * 1000,
        orders: 30 + Math.random() * 20 + Math.sin(i / 7) * 10,
        customers: 25 + Math.random() * 15 + Math.sin(i / 7) * 8,
      }));

      // Données produits
      const mockProductData: ProductData[] = [
        { name: 'Filtres à huile', sales: 245, revenue: 12250, margin: 35.2 },
        { name: 'Plaquettes de frein', sales: 189, revenue: 18900, margin: 42.1 },
        { name: 'Bougies d\'allumage', sales: 156, revenue: 7800, margin: 28.5 },
        { name: 'Amortisseurs', sales: 89, revenue: 22250, margin: 38.7 },
        { name: 'Batteries', sales: 134, revenue: 16750, margin: 31.8 },
      ];

      // Segments clients
      const mockCustomerSegments: CustomerSegment[] = [
        { name: 'Clients VIP', count: 156, value: 45200, color: '#3b82f6' },
        { name: 'Clients fidèles', count: 892, value: 67800, color: '#10b981' },
        { name: 'Nouveaux clients', count: 445, value: 23400, color: '#f59e0b' },
        { name: 'Clients occasionnels', count: 1234, value: 34500, color: '#8b5cf6' },
      ];

      setMetrics(mockMetrics);
      setRevenueData(mockRevenueData);
      setProductData(mockProductData);
      setCustomerSegments(mockCustomerSegments);
      setIsLoading(false);
    };

    // Génération initiale
    generateMockData();

    // Mise à jour en temps réel toutes les 30 secondes
    const interval = setInterval(generateMockData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // 📊 Composant métrique avec tendance
  const MetricCard = ({ 
    title, 
    value, 
    previousValue, 
    format = 'number',
    icon,
    trend
  }: {
    title: string;
    value: number;
    previousValue?: number;
    format?: 'number' | 'currency' | 'percentage';
    icon: string;
    trend?: 'up' | 'down' | 'stable';
  }) => {
    const formatValue = (val: number) => {
      switch (format) {
        case 'currency':
          return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);
        case 'percentage':
          return `${val.toFixed(1)}%`;
        default:
          return new Intl.NumberFormat('fr-FR').format(val);
      }
    };

    const growth = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
    const isPositive = growth > 0;

    return (
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-gray-600">{title}</div>
          <div className="text-2xl">{icon}</div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">{formatValue(value)}</div>
            {previousValue && (
              <div className={`text-sm flex items-center mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <span className="mr-1">
                  {isPositive ? '↗️' : '↘️'}
                </span>
                {Math.abs(growth).toFixed(1)}% vs période précédente
              </div>
            )}
          </div>
          {trend && (
            <div className={`text-xs px-2 py-1 rounded-full ${
              trend === 'up' ? 'bg-green-100 text-green-800' :
              trend === 'down' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {trend === 'up' ? '📈 En hausse' : trend === 'down' ? '📉 En baisse' : '➡️ Stable'}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des données analytics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header du dashboard */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
              <p className="text-gray-600 mt-1">Tableau de bord business intelligence</p>
            </div>
            <div className="flex items-center space-x-4">
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">7 derniers jours</option>
                <option value="30d">30 derniers jours</option>
                <option value="90d">90 derniers jours</option>
                <option value="1y">1 année</option>
              </select>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors">
                📊 Exporter
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Métriques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Chiffre d'affaires"
            value={metrics.revenue.current}
            previousValue={metrics.revenue.previous}
            format="currency"
            icon="💰"
            trend={metrics.revenue.trend}
          />
          <MetricCard
            title="Clients total"
            value={metrics.customers.total}
            previousValue={metrics.customers.total - metrics.customers.new}
            icon="👥"
          />
          <MetricCard
            title="Commandes"
            value={metrics.orders.total}
            icon="📦"
          />
          <MetricCard
            title="Taux de conversion"
            value={metrics.performance.conversionRate}
            format="percentage"
            icon="🎯"
          />
        </div>

        {/* Graphiques principaux */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Évolution du chiffre d'affaires */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Évolution du chiffre d'affaires</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}€`, 'Revenus']} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f680" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Performance des produits */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Top produits</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}€`, 'Revenus']} />
                <Bar dataKey="revenue" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Analyses détaillées */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Segments clients */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Segments clients</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={customerSegments}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="count"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {customerSegments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Métriques détaillées */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Métriques clés</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Panier moyen</span>
                <span className="font-semibold">{metrics.orders.averageValue.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">CLV</span>
                <span className="font-semibold">{metrics.performance.customerLifetimeValue.toFixed(0)}€</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Taux d'attrition</span>
                <span className="font-semibold text-red-600">{metrics.customers.churnRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">ROI</span>
                <span className="font-semibold text-green-600">{metrics.performance.returnOnInvestment.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Alertes et insights */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🚨 Insights & Alertes</h3>
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <span className="text-green-600 mr-2">✅</span>
                  <span className="text-sm text-green-800">Les ventes sont en hausse de 12% cette semaine</span>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center">
                  <span className="text-yellow-600 mr-2">⚠️</span>
                  <span className="text-sm text-yellow-800">Stock faible sur 3 produits populaires</span>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <span className="text-blue-600 mr-2">💡</span>
                  <span className="text-sm text-blue-800">Opportunité: Clients VIP sous-sollicités</span>
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center">
                  <span className="text-purple-600 mr-2">🔮</span>
                  <span className="text-sm text-purple-800">Prédiction: +8% de ventes le mois prochain</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
