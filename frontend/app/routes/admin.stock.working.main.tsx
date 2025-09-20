import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, Form, Link } from '@remix-run/react';
import { useState } from 'react';

interface StockItem {
  pri_piece_id: string;
  pri_ref: string;
  pri_des: string;
  pri_dispo: string;
  pri_vente_ttc: string;
  pri_marge: string;
}

interface LoaderData {
  success: boolean;
  stats?: {
    availableItems: number;
    unavailableItems: number;
    lowStockItems: number;
  };
  items?: StockItem[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const search = url.searchParams.get('search') || '';
  const availability = url.searchParams.get('availability') || '';

  try {
    console.log('🔧 Stock loader - fetching data...');
    
    // Récupérer les statistiques
    const statsResponse = await fetch('http://localhost:3000/api/admin/working-stock/stats');
    const statsData = await statsResponse.json();
    
    // Construire l'URL pour le dashboard/recherche
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) {
      searchParams.append('search', search);
    }
    
    if (availability) {
      searchParams.append('availability', availability);
    }
    
    // Récupérer les articles
    const endpoint = search || availability 
      ? 'search' 
      : 'dashboard';
      
    const itemsResponse = await fetch(
      `http://localhost:3000/api/admin/working-stock/${endpoint}?${searchParams}`
    );
    const itemsData = await itemsResponse.json();
    
    console.log('✅ API responses received successfully');
    
    return json({
      success: true,
      stats: statsData.data,
      items: itemsData.success ? itemsData.data.items : [],
      total: itemsData.success ? itemsData.data.total : 0,
      currentPage: page,
      totalPages: itemsData.success ? itemsData.data.totalPages : 1,
    });
  } catch (error) {
    console.error('❌ Erreur loader stock:', error);
    return json({
      success: false,
      error: (error as Error).message,
      stats: { availableItems: 0, unavailableItems: 0, lowStockItems: 0 },
      items: [],
      total: 0,
      currentPage: 1,
      totalPages: 1,
    });
  }
}

export default function AdminStock() {
  const data = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(parseFloat(price || '0'));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const generatePageNumbers = () => {
    const pages = [];
    const current = data.currentPage || 1;
    const total = data.totalPages || 1;
    
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      pages.push(i);
    }
    
    return pages;
  };

  if (!data.success) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h1 className="text-xl font-bold text-red-800">❌ Erreur de Chargement</h1>
          <p className="text-red-600 mt-2">{data.error}</p>
          <div className="mt-4 space-x-2">
            <Link 
              to="/admin/stock/test"
              className="inline-block text-blue-600 hover:text-blue-800 underline"
            >
              → Page de test API
            </Link>
            <Link 
              to="/admin/stock/working/test"
              className="inline-block text-blue-600 hover:text-blue-800 underline"
            >
              → Test Working Stock
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            📦 Gestion du Stock
          </h1>
          <div className="space-x-2">
            <Link
              to="/admin/stock/working/reports"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              📊 Rapports
            </Link>
            <Link
              to="/api/admin/working-stock/export?format=csv&limit=1000"
              target="_blank"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              📥 Export CSV
            </Link>
            <Link
              to="/admin/stock/test"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              🧪 Test API
            </Link>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      {data.stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-green-600 text-2xl mr-3">✅</div>
              <div>
                <h3 className="font-semibold text-green-800">Articles Disponibles</h3>
                <p className="text-2xl font-bold text-green-900">
                  {formatNumber(data.stats.availableItems)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-red-600 text-2xl mr-3">❌</div>
              <div>
                <h3 className="font-semibold text-red-800">Indisponibles</h3>
                <p className="text-2xl font-bold text-red-900">
                  {formatNumber(data.stats.unavailableItems)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
              <div>
                <h3 className="font-semibold text-yellow-800">Stock Faible</h3>
                <p className="text-2xl font-bold text-yellow-900">
                  {formatNumber(data.stats.lowStockItems)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-blue-600 text-2xl mr-3">📦</div>
              <div>
                <h3 className="font-semibold text-blue-800">Total Articles</h3>
                <p className="text-2xl font-bold text-blue-900">
                  {formatNumber((data.stats.availableItems || 0) + (data.stats.unavailableItems || 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">🔍 Recherche et Filtres</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showFilters ? 'Masquer' : 'Afficher'} filtres avancés
          </button>
        </div>
        
        <Form method="get">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recherche
              </label>
              <input
                type="text"
                name="search"
                defaultValue={searchParams.get('search') || ''}
                placeholder="Référence, description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Disponibilité
              </label>
              <select
                name="availability"
                defaultValue={searchParams.get('availability') || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                <option value="1">Disponible</option>
                <option value="0">Indisponible</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Articles par page
              </label>
              <select
                name="limit"
                defaultValue={searchParams.get('limit') || '20'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
              >
                🔍 Rechercher
              </button>
            </div>
          </div>
          
          {/* Garder la page cachée lors de nouvelle recherche */}
          <input type="hidden" name="page" value="1" />
        </Form>
      </div>

      {/* Résultats */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              📋 Articles ({formatNumber(data.total || 0)} trouvés)
            </h2>
            <div className="text-sm text-gray-600">
              Page {data.currentPage} / {data.totalPages}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
              {data.items && data.items.length > 0 ? (
                data.items.map((item) => (
                  <tr key={item.pri_piece_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.pri_ref}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {item.pri_piece_id}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={item.pri_des}>
                          {item.pri_des}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.pri_dispo === '1'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.pri_dispo === '1' ? '✓ Disponible' : '✗ Indisponible'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(item.pri_vente_ttc)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {parseFloat(item.pri_marge || '0').toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Modifier la disponibilité"
                      >
                        ✏️
                      </button>
                      <button
                        className="text-green-600 hover:text-green-800"
                        title="Voir détails"
                      >
                        👁️
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-4">📦</div>
                    <p className="text-lg">Aucun article trouvé</p>
                    <p className="text-sm mt-2">Essayez de modifier vos critères de recherche</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data.totalPages && data.totalPages > 1 && (
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Page {data.currentPage} sur {data.totalPages}
              </div>
              
              <div className="flex space-x-1">
                {/* Page précédente */}
                {data.currentPage && data.currentPage > 1 && (
                  <Link
                    to={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams),
                      page: (data.currentPage - 1).toString(),
                    })}`}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded"
                  >
                    ← Précédent
                  </Link>
                )}
                
                {/* Numéros de page */}
                {generatePageNumbers().map((pageNum) => (
                  <Link
                    key={pageNum}
                    to={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams),
                      page: pageNum.toString(),
                    })}`}
                    className={`px-3 py-1 text-sm border rounded ${
                      pageNum === data.currentPage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </Link>
                ))}
                
                {/* Page suivante */}
                {data.currentPage && data.totalPages && data.currentPage < data.totalPages && (
                  <Link
                    to={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams),
                      page: (data.currentPage + 1).toString(),
                    })}`}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded"
                  >
                    Suivant →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
