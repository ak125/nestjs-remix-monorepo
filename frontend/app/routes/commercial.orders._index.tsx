/**
 * 📦 GESTION DES COMMANDES COMMERCIALES
 * 
 * Interface dédiée à l'équipe commerciale pour gérer les commandes
 * Utilise les APIs existantes legacy-orders et dashboard
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { 
  ShoppingCart, TrendingUp, AlertCircle,
  Eye, Download, Filter
} from "lucide-react";
import { requireUser } from "../auth/unified.server";

// Types
interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  isPaid: boolean;
  customerEmail?: string;
  itemCount: number;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Vérifier l'accès commercial (niveau 3+)
  const user = await requireUser({ context });
  if (!user || (user.level && user.level < 3)) {
    throw new Response("Accès commercial requis", { status: 403 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const status = url.searchParams.get('status') || '';
  const search = url.searchParams.get('search') || '';

  try {
    // Utiliser l'API legacy-orders existante
    const ordersUrl = `http://localhost:3000/api/legacy-orders?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    // Récupérer les statistiques via l'API dashboard
    const statsResponse = await fetch('http://localhost:3000/api/dashboard/stats', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    const ordersData = await ordersResponse.json();
    const statsData = await statsResponse.json();

    return json({
      orders: ordersData.data || [],
      total: ordersData.pagination?.total || ordersData.total || 0,
      page,
      totalPages: Math.ceil((ordersData.pagination?.total || ordersData.total || 0) / limit),
      statistics: {
        totalOrders: statsData.totalOrders || 0,
        completedOrders: statsData.completedOrders || 0,
        pendingOrders: statsData.pendingOrders || 0,
        totalRevenue: statsData.totalRevenue || 0,
      },
      filters: { search, status },
    });
  } catch (error) {
    console.error('Erreur chargement données commerciales:', error);
    return json({
      orders: [],
      total: 0,
      page: 1,
      totalPages: 0,
      statistics: {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
      },
      filters: { search: '', status: '' },
    });
  }
}

export default function CommercialOrders() {
  const data = useLoaderData<typeof loader>() as any;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: any) => {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const getStatusBadge = (isPaid: boolean) => {
    if (isPaid) {
      return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">✅ Payée</span>;
    }
    return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">⏳ En attente</span>;
  };

  return (
    <div className="container mx-auto p-6">
      {/* Bandeau d'information */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              📋 Interface Commerciale - Vue Consultation
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Pour gérer les commandes (validation, expédition, emails), utilisez l'interface admin : <a href="/admin/orders" className="underline font-semibold hover:text-blue-900">→ Aller vers Admin Orders</a>
            </p>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <ShoppingCart className="mr-3 h-8 w-8 text-blue-600" />
            Commandes - Vue Commerciale
          </h1>
          <p className="text-gray-600 mt-1">
            Interface en consultation - {data.total} commandes
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/commercial">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              ← Retour Dashboard
            </button>
          </Link>
          <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Commandes</p>
              <p className="text-2xl font-bold text-gray-900">{data.statistics.totalOrders}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-green-600">
                {formatAmount(data.statistics.totalRevenue)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Commandes Payées</p>
              <p className="text-2xl font-bold text-blue-600">{data.statistics.completedOrders}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              ✅
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En Attente</p>
              <p className="text-2xl font-bold text-orange-600">{data.statistics.pendingOrders}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <form method="get" className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              name="search"
              placeholder="🔍 Rechercher par numéro, client..."
              defaultValue={data.filters.search}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <select
              name="status"
              defaultValue={data.filters.status}
              className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">📊 Tous les statuts</option>
              <option value="paid">✅ Payées</option>
              <option value="pending">⏳ En attente</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtrer
          </button>
        </form>
      </div>

      {/* Tableau des commandes */}
      {data.orders.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Aucune commande trouvée</h3>
          <p className="text-yellow-700">Modifiez vos filtres ou créez une nouvelle commande.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.orders.map((order: any) => (
                <tr key={order.id || order.ord_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{order.ord_num || `CMD-${order.id || order.ord_id}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {order.id || order.ord_id}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer?.cst_fname} {order.customer?.cst_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customer?.cst_mail}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(order.date || order.ord_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatAmount(order.totalTtc || order.ord_total_ttc || order.total)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(
                      order.ord_is_pay === '1' || order.ord_is_pay === 1
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link 
                        to={`/admin/orders/${order.id || order.ord_id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-6">
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              {data.page > 1 && (
                <Link
                  to={`/commercial/orders?page=${data.page - 1}&search=${data.filters.search}&status=${data.filters.status}`}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Précédent
                </Link>
              )}
              {data.page < data.totalPages && (
                <Link
                  to={`/commercial/orders?page=${data.page + 1}&search=${data.filters.search}&status=${data.filters.status}`}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Suivant
                </Link>
              )}
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{data.page}</span> sur{' '}
                  <span className="font-medium">{data.totalPages}</span> -{' '}
                  <span className="font-medium">{data.total}</span> commandes au total
                </p>
              </div>
              <div className="flex space-x-2">
                {data.page > 1 && (
                  <Link
                    to={`/commercial/orders?page=${data.page - 1}&search=${data.filters.search}&status=${data.filters.status}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    ← Précédent
                  </Link>
                )}
                {data.page < data.totalPages && (
                  <Link
                    to={`/commercial/orders?page=${data.page + 1}&search=${data.filters.search}&status=${data.filters.status}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Suivant →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
