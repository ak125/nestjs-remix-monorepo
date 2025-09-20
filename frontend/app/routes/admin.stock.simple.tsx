import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, Form, Link } from '@remix-run/react';

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
  stats?: any;
  items?: StockItem[];
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);

  try {
    console.log('🔧 Simple loader - fetching data...');
    
    // Test simple avec les stats
    const statsResponse = await fetch('http://localhost:3000/api/admin/working-stock/stats');
    const statsData = await statsResponse.json();
    
    // Test simple avec le dashboard
    const dashboardResponse = await fetch(
      `http://localhost:3000/api/admin/working-stock/dashboard?page=${page}&limit=${limit}`
    );
    const dashboardData = await dashboardResponse.json();
    
    console.log('✅ Both APIs responded successfully');
    
    return json({
      success: true,
      stats: statsData.data,
      items: dashboardData.success ? dashboardData.data.items : [],
    });
  } catch (error) {
    console.error('❌ Erreur loader simple:', error);
    return json({
      success: false,
      error: (error as Error).message,
      stats: {},
      items: [],
    });
  }
}

export default function SimpleStockWorking() {
  const data = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(parseFloat(price));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  if (!data.success) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h1 className="text-xl font-bold text-red-800">❌ Erreur de Chargement</h1>
          <p className="text-red-600 mt-2">{data.error}</p>
          <Link 
            to="/admin/stock/working/test"
            className="inline-block mt-4 text-blue-600 hover:text-blue-800 underline"
          >
            → Page de test API
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            📦 Gestion Stock (Simple)
          </h1>
          <div className="space-x-2">
            <Link
              to="/admin/stock/working/reports"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >
              📊 Rapports
            </Link>
            <Link
              to="/admin/stock/working/test"
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm"
            >
              🧪 Test
            </Link>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      {data.stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800">Disponibles</h3>
            <p className="text-2xl font-bold text-green-900">
              {formatNumber(data.stats.availableItems || 0)}
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800">Indisponibles</h3>
            <p className="text-2xl font-bold text-red-900">
              {formatNumber(data.stats.unavailableItems || 0)}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800">Alertes</h3>
            <p className="text-2xl font-bold text-yellow-900">
              {formatNumber(data.stats.lowStockItems || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Filtres simples */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <Form method="get">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Page
              </label>
              <input
                type="number"
                name="page"
                defaultValue={searchParams.get('page') || '1'}
                min="1"
                className="px-3 py-2 border border-gray-300 rounded-md w-20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limite
              </label>
              <select
                name="limit"
                defaultValue={searchParams.get('limit') || '10'}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Actualiser
            </button>
          </div>
        </Form>
      </div>

      {/* Tableau des articles */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">
            Articles ({data.items?.length || 0} affichés)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Référence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Prix TTC
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Marge
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.items && data.items.length > 0 ? (
                data.items.map((item) => (
                  <tr key={item.pri_piece_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {item.pri_ref}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {item.pri_piece_id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {item.pri_des}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          item.pri_dispo === '1'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.pri_dispo === '1' ? '✓ Dispo' : '✗ Indispo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatPrice(item.pri_vente_ttc)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {parseFloat(item.pri_marge).toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Aucun article trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
