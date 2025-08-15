import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "../auth/unified.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  
  // Vérifier le niveau admin
  if (!user.isAdmin || parseInt(user.level) < 7) {
    throw new Response("Non autorisé", { status: 403 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  try {
    // Récupérer les commandes avec relations
    const ordersResponse = await fetch(
      `http://localhost:3000/api/legacy-orders?page=${page}&limit=${limit}`,
      {
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
        },
      }
    );
    
    if (!ordersResponse.ok) {
      throw new Error(`HTTP ${ordersResponse.status}`);
    }
    
    const ordersData = await ordersResponse.json();

    return json({
      orders: ordersData.orders || [],
      total: ordersData.total || 0,
      page: ordersData.page || page,
      user: user,
    });
  } catch (error) {
    console.error('Erreur chargement commandes:', error);
    return json({
      orders: [],
      total: 0,
      page: 1,
      user: user,
      error: error.message
    });
  }
}

export default function AdminOrdersSimple() {
  const data = useLoaderData<typeof loader>();

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
        <p>Utilisateur: {data.user.email} (niveau {data.user.level})</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">📦 Commandes - Test Simple</h1>
        <p className="text-gray-600">
          ✅ Connecté: {data.user.email} (niveau {data.user.level})
        </p>
        <p className="text-gray-600">
          📊 {data.total} commandes trouvées
        </p>
      </div>

      {/* Formulaire de recherche et filtres */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <form method="get" className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              name="search"
              placeholder="🔍 Rechercher par ID, client, email..."
              defaultValue={new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost').searchParams.get('search') || ''}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <select
              name="status"
              defaultValue={new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost').searchParams.get('status') || ''}
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
              defaultValue="10"
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="10">10 par page</option>
              <option value="25">25 par page</option>
              <option value="50">50 par page</option>
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.orders.map((order: any) => (
                <tr key={order.ord_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{order.ord_num || order.ord_id}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {order.ord_id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.customer ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {order.customer.cst_fname} {order.customer.cst_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.customer.cst_mail}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Client #{order.ord_cst_id}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(order.ord_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatAmount(order.ord_total || order.ord_total_ttc || order.ord_total_ht)}
                    </div>
                    {order.ord_total_ht && (
                      <div className="text-sm text-gray-500">
                        HT: {formatAmount(order.ord_total_ht)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      order.ord_is_pay === '1' || order.ord_is_pay === 1
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.ord_is_pay === '1' || order.ord_is_pay === 1 ? '✅ Payée' : '⏳ En attente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        {/* Pagination fonctionnelle */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            {data.page > 1 && (
              <a
                href={`/admin/orders-simple?page=${data.page - 1}`}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Précédent
              </a>
            )}
            {data.page < Math.ceil(data.total / 10) && (
              <a
                href={`/admin/orders-simple?page=${data.page + 1}`}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Suivant
              </a>
            )}
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Affichage de <span className="font-medium">{((data.page - 1) * 10) + 1}</span> à{' '}
                <span className="font-medium">{Math.min(data.page * 10, data.total)}</span> sur{' '}
                <span className="font-medium">{data.total}</span> résultats
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                {/* Bouton Précédent */}
                {data.page > 1 ? (
                  <a
                    href={`/admin/orders-simple?page=${data.page - 1}`}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    <span className="sr-only">Précédent</span>
                    ←
                  </a>
                ) : (
                  <span className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-300 ring-1 ring-inset ring-gray-300">
                    <span className="sr-only">Précédent</span>
                    ←
                  </span>
                )}

                {/* Numéros de page */}
                {Array.from({ length: Math.min(5, Math.ceil(data.total / 10)) }, (_, i) => {
                  const pageNum = i + 1;
                  const isCurrentPage = pageNum === data.page;
                  return (
                    <a
                      key={pageNum}
                      href={`/admin/orders-simple?page=${pageNum}`}
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
                {data.page < Math.ceil(data.total / 10) ? (
                  <a
                    href={`/admin/orders-simple?page=${data.page + 1}`}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    <span className="sr-only">Suivant</span>
                    →
                  </a>
                ) : (
                  <span className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-300 ring-1 ring-inset ring-gray-300">
                    <span className="sr-only">Suivant</span>
                    →
                  </span>
                )}
              </nav>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 text-center mt-4">
          Page {data.page} | {data.orders.length} commandes affichées sur {data.total}
        </p>
      </div>
    </div>
  );
}
