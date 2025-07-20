import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { getPaymentStats, LegacyPayment, PaymentStats } from "~/utils/api";

/**
 * Interface étendue pour les données du loader
 */
interface LoaderData {
  payments?: LegacyPayment[];
  stats?: PaymentStats;
  error?: string;
}

/**
 * Loader Remix - utilise le service direct comme pour orders
 */
export async function loader({ context }: LoaderFunctionArgs): Promise<Response> {
  try {
    console.log('🔄 Chargement des paiements via loader Remix...');
    
    // Utilisation du service NestJS direct via le contexte (même pattern que orders)
    const [statsResult, paymentsResult] = await Promise.all([
      getPaymentStats(context),
      context.remixService?.integration?.getPaymentsForRemix?.({
        page: 1,
        limit: 100 // Récupérer plus de paiements pour l'interface
      })
    ]);
    
    const payments = paymentsResult?.success ? paymentsResult.payments : [];
    
    return json<LoaderData>({ 
      stats: statsResult,
      payments,
    });
  } catch (error) {
    console.error('❌ Erreur dans le loader des paiements:', error);
    return json<LoaderData>({ 
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      payments: [],
      stats: {
        total_orders: 0,
        paid_orders: 0,
        pending_orders: 0,
        total_amount: 0,
        currency: 'EUR'
      }
    });
  }
}

/**
 * Composant Admin des Paiements - même structure que admin.orders._index.tsx
 */
export default function AdminPayments() {
  const { payments = [], stats, error } = useLoaderData<LoaderData>();
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Filtrage des paiements
  const filteredPayments = payments.filter(payment => {
    switch (filter) {
      case 'paid':
        return payment.statutPaiement === '1';
      case 'pending':
        return payment.statutPaiement === '0';
      default:
        return true;
    }
  });

  // Calcul du taux de paiement
  const paymentRate = stats ? 
    (stats.total_orders > 0 ? (stats.paid_orders / stats.total_orders * 100).toFixed(1) : '0') 
    : '0';

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h1 className="text-xl font-bold text-red-800 mb-2">
            Erreur de chargement des paiements
          </h1>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Gestion des Paiements Legacy
        </h1>
        <p className="mt-2 text-gray-600">
          Administration des paiements basée sur les vraies tables legacy (___xtr_order, ic_postback)
        </p>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Commandes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_orders.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Paiements Réussis</p>
                <p className="text-2xl font-bold text-green-600">{stats.paid_orders.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">En Attente</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending_orders.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Montant Total</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.total_amount.toLocaleString()} {stats.currency}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Taux de réussite */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Taux de Réussite des Paiements
          </h3>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-3">
              <div 
                className="bg-green-500 h-3 rounded-full" 
                style={{ width: `${paymentRate}%` }}
              ></div>
            </div>
            <span className="ml-4 text-lg font-bold text-gray-900">{paymentRate}%</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {stats.paid_orders} paiements réussis sur {stats.total_orders} commandes
          </p>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tous ({payments.length})
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'paid'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Payés ({payments.filter(p => p.statutPaiement === '1').length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            En Attente ({payments.filter(p => p.statutPaiement === '0').length})
          </button>
        </div>
      </div>

      {/* Liste des paiements */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Paiements Récents
          </h3>
        </div>
        
        {filteredPayments.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun paiement</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' 
                ? 'Aucun paiement trouvé dans le système.'
                : `Aucun paiement ${filter === 'paid' ? 'payé' : 'en attente'} trouvé.`
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Méthode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{payment.orderId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Client #{payment.customerId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.montantTotal.toLocaleString()} {payment.devise}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.methodePaiement || 'Non définie'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.statutPaiement === '1'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.statutPaiement === '1' ? 'Payé' : 'En Attente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(payment.dateCreation).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
