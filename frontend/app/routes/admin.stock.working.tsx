import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, Form, Link } from '@remix-run/react';
import { useState, useEffect } from 'react';

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
  const { stats, items, totalItems, currentPage, limit } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [availabilityFilter, setAvailabilityFilter] = useState(searchParams.get('available') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const newParams = new URLSearchParams();
    newParams.set('page', '1'); // Reset à la page 1 lors d'une recherche
    if (searchQuery) newParams.set('search', searchQuery);
    if (availabilityFilter) newParams.set('available', availabilityFilter);
    if (minPrice) newParams.set('minPrice', minPrice);
    if (maxPrice) newParams.set('maxPrice', maxPrice);
    
    setSearchParams(newParams);
    setIsLoading(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setAvailabilityFilter('');
    setMinPrice('');
    setMaxPrice('');
    setSearchParams({});
  };

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

        {/* Filtres */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <Form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recherche
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Référence ou description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Disponibilité
                </label>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous</option>
                  <option value="true">Disponibles</option>
                  <option value="false">Indisponibles</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prix min (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prix max (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="999.99"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md transition-colors"
              >
                {isLoading ? 'Recherche...' : 'Filtrer'}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Effacer
              </button>
            </div>
          </Form>
        </div>
      </div>

      {/* Tableau des articles */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Articles ({formatNumber(totalItems)} résultats)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Disponibilité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix TTC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.pri_piece_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.pri_ref}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {item.pri_piece_id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
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
                        {item.pri_dispo === '1' ? 'Disponible' : 'Indisponible'}
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
                          ? 'Faible'
                          : parseFloat(item.pri_marge) > 50
                          ? 'Élevée'
                          : 'Normale'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">
                        Détails
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucun article trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalItems > limit && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Affichage de {(currentPage - 1) * limit + 1} à{' '}
              {Math.min(currentPage * limit, totalItems)} sur {formatNumber(totalItems)} résultats
            </div>
            
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: (currentPage - 1).toString() })}`}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Précédent
                </Link>
              )}
              
              <span className="px-3 py-1 bg-blue-600 text-white rounded-md">
                {currentPage}
              </span>
              
              {currentPage * limit < totalItems && (
                <Link
                  to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: (currentPage + 1).toString() })}`}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Suivant
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
