import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { OptimizedPagination } from '../components/ui/OptimizedPagination';
import { OptimizedSearchBar } from '../components/ui/OptimizedSearchBar';
import { PerformanceMetrics } from '../components/ui/PerformanceMetrics';
import { useOptimizedTable } from '../hooks/useOptimizedTable';

interface StockItem {
  pri_piece_id: string;
  pri_ref: string;
  pri_des: string;
  pri_dispo: string;
  pri_vente_ttc: string;
  pri_vente_ht: string;
  pri_qte_vente: string;
  pri_marge: string;
}

interface StockStats {
  availableItems: number;
  unavailableItems: number;
  lowStockItems: number;
}

interface LoaderData {
  stats: StockStats;
  items: StockItem[];
  totalItems: number;
  currentPage: number;
  limit: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const search = url.searchParams.get('search') || '';
  const available = url.searchParams.get('available');
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');

  try {
    // Récupérer les statistiques
    const statsResponse = await fetch('http://localhost:3000/api/admin/working-stock/stats');
    const statsData = await statsResponse.json();

    // Construire l'URL pour le dashboard avec filtres
    const dashboardUrl = new URL('http://localhost:3000/api/admin/working-stock/dashboard');
    dashboardUrl.searchParams.set('page', page.toString());
    dashboardUrl.searchParams.set('limit', limit.toString());
    if (search) dashboardUrl.searchParams.set('search', search);
    if (available) dashboardUrl.searchParams.set('available', available);
    if (minPrice) dashboardUrl.searchParams.set('minPrice', minPrice);
    if (maxPrice) dashboardUrl.searchParams.set('maxPrice', maxPrice);

    const dashboardResponse = await fetch(dashboardUrl.toString());
    const dashboardData = await dashboardResponse.json();

    return json({
      stats: statsData.success ? statsData.data : { availableItems: 0, unavailableItems: 0, lowStockItems: 0 },
      items: dashboardData.success ? dashboardData.data.items : [],
      totalItems: dashboardData.success ? dashboardData.data.totalItems : 0,
      currentPage: page,
      limit,
    });
  } catch (error) {
    console.error('Erreur chargement stock:', error);
    return json({
      stats: { availableItems: 0, unavailableItems: 0, lowStockItems: 0 },
      items: [],
      totalItems: 0,
      currentPage: 1,
      limit: 20,
    });
  }
}

export default function AdminStockWorking() {
  const { stats, items, totalItems } = useLoaderData<LoaderData>();

  // 🚀 HOOKS OPTIMISÉS POUR PERFORMANCE MAXIMALE
  const optimizedTable = useOptimizedTable({
    data: items,
    itemsPerPage: 20,
    searchFields: ['pri_ref', 'pri_des'],
    sortField: 'pri_ref',
    sortDirection: 'asc'
  });

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(parseFloat(price));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Gestion du Stock
          </h1>
          <Link
            to="/admin/stock/working/reports"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            📊 Rapports
          </Link>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Articles Disponibles</p>
                <p className="text-2xl font-bold text-green-900">{formatNumber(stats.availableItems)}</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Articles Indisponibles</p>
                <p className="text-2xl font-bold text-red-900">{formatNumber(stats.unavailableItems)}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600">Marge Faible (&lt;20%)</p>
                <p className="text-2xl font-bold text-yellow-900">{formatNumber(stats.lowStockItems)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 🚀 MÉTRIQUES DE PERFORMANCE TEMPS RÉEL */}
        <PerformanceMetrics
          loadTime={optimizedTable.loadTime}
          totalItems={totalItems}
          filteredItems={optimizedTable.filteredItems}
          currentPage={optimizedTable.currentPage}
          totalPages={optimizedTable.totalPages}
          showDetailed={true}
          className="mb-6"
        />

        {/* 🔍 RECHERCHE OPTIMISÉE AVEC DEBOUNCING */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔍 Recherche Intelligente
              </label>
              <OptimizedSearchBar
                value={optimizedTable.searchTerm}
                onChange={optimizedTable.setSearchTerm}
                placeholder="Rechercher référence ou description..."
                showResults={true}
                resultCount={optimizedTable.filteredItems}
                totalCount={totalItems}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actions rapides
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => optimizedTable.setSearchTerm('CONDENSATEUR')}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm rounded-md transition-colors"
                  >
                    🔋 Condensateurs
                  </button>
                  <button
                    onClick={() => optimizedTable.setSearchTerm('ECROU')}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm rounded-md transition-colors"
                  >
                    🔩 Vis & Écrous
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tri rapide
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => optimizedTable.handleSort('pri_vente_ttc')}
                    className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-sm rounded-md transition-colors"
                  >
                    � Prix TTC
                  </button>
                  <button
                    onClick={() => optimizedTable.handleSort('pri_marge')}
                    className="px-3 py-2 bg-green-100 hover:bg-green-200 text-sm rounded-md transition-colors"
                  >
                    � Marge
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 TABLEAU OPTIMISÉ AVEC TRI INTELLIGENT */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            📦 Articles ({formatNumber(optimizedTable.filteredItems)} résultats {optimizedTable.filteredItems !== totalItems && `sur ${formatNumber(totalItems)}`})
          </h2>
          {optimizedTable.isLoading && (
            <div className="flex items-center text-blue-600">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Optimisation en cours...</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => optimizedTable.handleSort('pri_ref')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Référence</span>
                    {optimizedTable.sortField === 'pri_ref' && (
                      <span className="text-blue-500">
                        {optimizedTable.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => optimizedTable.handleSort('pri_des')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Description</span>
                    {optimizedTable.sortField === 'pri_des' && (
                      <span className="text-blue-500">
                        {optimizedTable.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Disponibilité
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => optimizedTable.handleSort('pri_vente_ht')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Prix HT</span>
                    {optimizedTable.sortField === 'pri_vente_ht' && (
                      <span className="text-blue-500">
                        {optimizedTable.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => optimizedTable.handleSort('pri_vente_ttc')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Prix TTC</span>
                    {optimizedTable.sortField === 'pri_vente_ttc' && (
                      <span className="text-blue-500">
                        {optimizedTable.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => optimizedTable.handleSort('pri_marge')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Marge</span>
                    {optimizedTable.sortField === 'pri_marge' && (
                      <span className="text-blue-500">
                        {optimizedTable.sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {optimizedTable.displayedData.length > 0 ? (
                optimizedTable.displayedData.map((item) => (
                  <tr key={item.pri_piece_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.pri_ref}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {item.pri_piece_id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={item.pri_des}>
                        {item.pri_des}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.pri_dispo === '1'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.pri_dispo === '1' ? '✅ Disponible' : '❌ Indisponible'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPrice(item.pri_vente_ht)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(item.pri_vente_ttc)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {parseFloat(item.pri_marge).toFixed(1)}%
                      </div>
                      <div
                        className={`text-xs ${
                          parseFloat(item.pri_marge) < 20
                            ? 'text-red-600'
                            : parseFloat(item.pri_marge) > 50
                            ? 'text-green-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {parseFloat(item.pri_marge) < 20
                          ? '⚠️ Faible'
                          : parseFloat(item.pri_marge) > 50
                          ? '🎯 Élevée'
                          : '📊 Normale'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3 transition-colors">
                        👁️ Détails
                      </button>
                      <button className="text-green-600 hover:text-green-900 transition-colors">
                        ✏️ Modifier
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {optimizedTable.isLoading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Chargement des données...
                      </div>
                    ) : (
                      <div>
                        🔍 Aucun article trouvé
                        <p className="text-xs text-gray-400 mt-1">Essayez de modifier vos critères de recherche</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 🚀 PAGINATION OPTIMISÉE */}
        <OptimizedPagination
          currentPage={optimizedTable.currentPage}
          totalPages={optimizedTable.totalPages}
          visiblePages={optimizedTable.visiblePages}
          hasNextPage={optimizedTable.hasNextPage}
          hasPrevPage={optimizedTable.hasPrevPage}
          onPageChange={optimizedTable.goToPage}
          onNext={optimizedTable.goToNext}
          onPrev={optimizedTable.goToPrev}
          className="px-6 py-4 border-t border-gray-200"
          showInfo={true}
        />
      </div>
    </div>
  );
}
