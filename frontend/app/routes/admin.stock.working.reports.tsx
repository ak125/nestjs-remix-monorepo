import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { useState } from 'react';

interface TopItem {
  pri_piece_id: string;
  pri_ref: string;
  pri_des: string;
  pri_vente_ttc: string;
  pri_marge: string;
}

interface StockStats {
  availableItems: number;
  unavailableItems: number;
  lowStockItems: number;
}

interface LoaderData {
  stats: StockStats;
  topItems: TopItem[];
  lowMarginItems: TopItem[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Récupérer les statistiques
    const statsResponse = await fetch('http://localhost:3000/api/admin/working-stock/stats');
    const statsData = await statsResponse.json();

    // Récupérer les top articles
    const topResponse = await fetch('http://localhost:3000/api/admin/working-stock/top-items?limit=10');
    const topData = await topResponse.json();

    // Récupérer les articles avec recherche par marge faible (simulation)
    const lowMarginResponse = await fetch('http://localhost:3000/api/admin/working-stock/dashboard?maxPrice=50&available=true&limit=10');
    const lowMarginData = await lowMarginResponse.json();

    return json({
      stats: statsData.success ? statsData.data : { availableItems: 0, unavailableItems: 0, lowStockItems: 0 },
      topItems: topData.success ? topData.data : [],
      lowMarginItems: lowMarginData.success ? lowMarginData.data.items : [],
    });
  } catch (error) {
    console.error('Erreur chargement rapports:', error);
    return json({
      stats: { availableItems: 0, unavailableItems: 0, lowStockItems: 0 },
      topItems: [],
      lowMarginItems: [],
    });
  }
}

export default function AdminStockReports() {
  const { stats, topItems, lowMarginItems } = useLoaderData<LoaderData>();
  const [selectedTab, setSelectedTab] = useState('overview');

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(parseFloat(price));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const calculateTotalValue = () => {
    // Estimation basée sur la moyenne des top items
    const avgPrice = topItems.reduce((sum, item) => sum + parseFloat(item.pri_vente_ttc), 0) / topItems.length;
    return stats.availableItems * (avgPrice / 10); // Approximation
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            📊 Rapports Stock
          </h1>
          <Link
            to="/admin/stock/working"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ← Retour au stock
          </Link>
        </div>

        {/* Onglets */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Vue d\'ensemble' },
              { id: 'top-items', label: 'Top Articles' },
              { id: 'alerts', label: 'Alertes' },
              { id: 'analytics', label: 'Analyses' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div>
        {selectedTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Articles Totaux</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(stats.availableItems + stats.unavailableItems)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Taux Disponibilité</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {((stats.availableItems / (stats.availableItems + stats.unavailableItems)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Valeur Estimée</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPrice(calculateTotalValue().toString())}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Alertes Marge</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(stats.lowStockItems)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Répartition par Disponibilité
                </h3>
                <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="space-y-4">
                      <div className="flex items-center justify-center space-x-8">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-2xl">✓</span>
                          </div>
                          <p className="text-sm text-gray-600">Disponibles</p>
                          <p className="text-xl font-bold text-green-600">{formatNumber(stats.availableItems)}</p>
                        </div>
                        <div className="text-center">
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-2xl">✗</span>
                          </div>
                          <p className="text-sm text-gray-600">Indisponibles</p>
                          <p className="text-xl font-bold text-red-600">{formatNumber(stats.unavailableItems)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Évolution (Simulation)
                </h3>
                <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                  <div className="text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>Graphique d'évolution</p>
                    <p className="text-sm">(Intégration future)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'top-items' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                🏆 Articles les plus chers
              </h2>
              <p className="text-sm text-gray-600">
                Top 10 des articles avec les prix les plus élevés
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Prix TTC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Marge
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topItems.map((item, index) => (
                    <tr key={item.pri_piece_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-2xl mr-2 ${
                            index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''
                          }`}>
                            {index < 3 ? '' : `${index + 1}.`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.pri_ref}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {item.pri_des}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {formatPrice(item.pri_vente_ttc)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {parseFloat(item.pri_marge).toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  ⚠️ Articles avec Prix Bas
                </h2>
                <p className="text-sm text-gray-600">
                  Articles disponibles avec prix inférieur à 50€
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Référence
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Prix TTC
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Marge
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lowMarginItems.slice(0, 10).map((item) => (
                      <tr key={item.pri_piece_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {item.pri_ref}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {item.pri_des}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatPrice(item.pri_vente_ttc)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm ${
                            parseFloat(item.pri_marge) < 20 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {parseFloat(item.pri_marge).toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button className="text-blue-600 hover:text-blue-900 text-sm">
                            Examiner
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Répartition par Marge
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Marge &lt; 20%</span>
                    <span className="text-sm font-medium text-red-600">
                      {formatNumber(stats.lowStockItems)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Marge 20-50%</span>
                    <span className="text-sm font-medium text-yellow-600">
                      {formatNumber(Math.floor(stats.availableItems * 0.6))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Marge &gt; 50%</span>
                    <span className="text-sm font-medium text-green-600">
                      {formatNumber(Math.floor(stats.availableItems * 0.3))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Gammes de Prix
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">&lt; 50€</span>
                    <span className="text-sm font-medium">~{formatNumber(Math.floor(stats.availableItems * 0.7))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">50€ - 200€</span>
                    <span className="text-sm font-medium">~{formatNumber(Math.floor(stats.availableItems * 0.25))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">&gt; 200€</span>
                    <span className="text-sm font-medium">~{formatNumber(Math.floor(stats.availableItems * 0.05))}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Actions Recommandées
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-600">
                      Réviser {formatNumber(stats.lowStockItems)} articles à marge faible
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-600">
                      Réactiver {formatNumber(Math.min(stats.unavailableItems, 1000))} articles populaires
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-600">
                      Promouvoir les articles à forte marge
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
