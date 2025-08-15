import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireAdmin } from "../server/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Utilisation de requireAdmin qui gère déjà les vérifications
  const user = await requireAdmin({ context });

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const _search = url.searchParams.get('search') || '';
  const _status = url.searchParams.get('status') || '';

  try {
    // Utiliser l'API legacy orders avec les vraies données
    const apiUrl = `http://localhost:3000/api/legacy-orders?page=${page}&limit=${limit}${_search ? `&search=${encodeURIComponent(_search)}` : ''}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log(`✅ ${result.data?.length || 0} commandes chargées (total: ${result.pagination?.total || result.total || 0})`);

    return json({
      user,
      orders: result.data || [],
      total: result.pagination?.total || result.total || 0,
      page,
      limit,
      totalPages: Math.ceil((result.pagination?.total || result.total || 0) / limit),
      search: _search,
      status: _status,
    });
  } catch (error) {
    console.error('Erreur chargement commandes:', error);
    
    // Retour par défaut en cas d'erreur
    return json({
      user,
      orders: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      search: '',
      status: '',
    });
  }
}

export default function AdminOrders() {
  const data = useLoaderData<typeof loader>() as any;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
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

  if (data.error) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold text-red-600">❌ Erreur</h1>
        <p>Erreur de chargement: {data.error}</p>
        <p>Utilisateur: {data.user?.email || 'Utilisateur'} (niveau {data.user?.level || 0})</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">📦 Gestion des Commandes - AVANCÉ</h1>
        <p className="text-gray-600">
          ✅ Connecté: {data.user?.email || 'Utilisateur'} (niveau {data.user?.level || 0})
        </p>
        <p className="text-gray-600">
          📊 {data.total} commandes trouvées | Page {data.page}/{data.totalPages}
        </p>
      </div>

      {/* Formulaire de recherche et filtres */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <form method="get" className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              name="search"
              placeholder="🔍 Rechercher par ID, client, email, véhicule..."
              defaultValue={data.search}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <select
              name="status"
              defaultValue={data.status}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">📊 Tous les statuts</option>
              <option value="PAID">✅ Payées</option>
              <option value="PENDING">⏳ En attente</option>
            </select>
          </div>
          <div>
            <select
              name="limit"
              defaultValue={data.limit.toString()}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="10">10 par page</option>
              <option value="25">25 par page</option>
              <option value="50">50 par page</option>
              <option value="100">100 par page</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            🔍 Filtrer
          </button>
        </form>
      </div>

      {data.orders.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">⚠️ Aucune commande trouvée</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Véhicule
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Articles
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.customer ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          👤 {order.customer.cst_fname} {order.customer.cst_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          📧 {order.customer.cst_mail}
                        </div>
                        {order.customer.cst_tel && (
                          <div className="text-sm text-gray-500">
                            📞 {order.customer.cst_tel}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Client #{order.customerId || order.ord_cst_id}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.vehicle ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          🚗 {order.vehicle.veh_brand} {order.vehicle.veh_model}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.vehicle.veh_year} - {order.vehicle.veh_license_plate}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">❌ Aucun véhicule</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    📅 {formatDate(order.date || order.ord_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatAmount(order.totalTtc || order.ord_total_ttc || order.total || order.ord_total)}
                    </div>
                    {(order.totalHt || order.ord_total_ht) && (
                      <div className="text-sm text-gray-500">
                        HT: {formatAmount(order.totalHt || order.ord_total_ht)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      order.isPaid === true || order.status === 'paid' || order.ord_is_pay === '1' || order.ord_is_pay === 1
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.isPaid === true || order.status === 'paid' || order.ord_is_pay === '1' || order.ord_is_pay === 1 ? '✅ Payée' : '⏳ En attente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        📦 1 article
                      </div>
                      <div className="text-gray-500">
                        {order.info ? 'Commande avec infos' : 'Commande standard'}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6">
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            {data.page > 1 && (
              <a
                href={`/admin/orders?page=${data.page - 1}&search=${data.search}&status=${data.status}&limit=${data.limit}`}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Précédent
              </a>
            )}
            {data.page < data.totalPages && (
              <a
                href={`/admin/orders?page=${data.page + 1}&search=${data.search}&status=${data.status}&limit=${data.limit}`}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Suivant
              </a>
            )}
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Affichage de <span className="font-medium">{((data.page - 1) * data.limit) + 1}</span> à{' '}
                <span className="font-medium">{Math.min(data.page * data.limit, data.total)}</span> sur{' '}
                <span className="font-medium">{data.total}</span> résultats
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                {/* Bouton Précédent */}
                {data.page > 1 ? (
                  <a
                    href={`/admin/orders?page=${data.page - 1}&search=${data.search}&status=${data.status}&limit=${data.limit}`}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    ←
                  </a>
                ) : (
                  <span className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-300 ring-1 ring-inset ring-gray-300">
                    ←
                  </span>
                )}

                {/* Numéros de page */}
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  const isCurrentPage = pageNum === data.page;
                  return (
                    <a
                      key={pageNum}
                      href={`/admin/orders?page=${pageNum}&search=${data.search}&status=${data.status}&limit=${data.limit}`}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        isCurrentPage
                          ? 'z-10 bg-indigo-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                      }`}
                    >
                      {pageNum}
                    </a>
                  );
                })}

                {/* Bouton Suivant */}
                {data.page < data.totalPages ? (
                  <a
                    href={`/admin/orders?page=${data.page + 1}&search=${data.search}&status=${data.status}&limit=${data.limit}`}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    →
                  </a>
                ) : (
                  <span className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-300 ring-1 ring-inset ring-gray-300">
                    →
                  </span>
                )}
              </nav>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 text-center mt-4">
          Page {data.page}/{data.totalPages} | {data.orders.length} commandes affichées sur {data.total}
        </p>
      </div>
    </div>
  );
}
