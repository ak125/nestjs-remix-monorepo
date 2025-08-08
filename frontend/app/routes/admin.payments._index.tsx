import  { type LoaderFunctionArgs , json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Clock, CheckCircle, DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

/**
 * Interface simplifiée pour les données du loader
 */
interface LoaderData {
  payments: any[];
  stats: any;
  error?: string;
}

/**
 * Loader Remix - utilise des données simplifiées pour les paiements
 */
export async function loader({ context }: LoaderFunctionArgs): Promise<Response> {
  try {
    console.log('🔄 Chargement des paiements via loader Remix...');
    
    // Appel à l'API réelle des paiements
    const paymentsResponse = await fetch('http://localhost:3000/api/payments?page=1&limit=10');
    const paymentsData = await paymentsResponse.json();
    
    // Appel aux statistiques
    const statsResponse = await fetch('http://localhost:3000/api/payments/stats');
    const statsData = await statsResponse.json();
    
    if (!paymentsResponse.ok) {
      throw new Error(`Erreur API paiements: ${paymentsResponse.status}`);
    }
    
    console.log('✅ Données paiements récupérées:', {
      count: paymentsData.payments?.length || 0,
      enriched: paymentsData._enriched,
      source: paymentsData._source,
      firstPayment: paymentsData.payments?.[0] // Debug: voir le premier paiement
    });
    
    return json({
      payments: paymentsData.payments || [],
      stats: statsData || { total_amount: 0, paid_orders: 0, pending_orders: 0, currency: 'EUR' },
      enriched: paymentsData._enriched
    } as LoaderData);
    
  } catch (error) {
    console.error('❌ Erreur dans le loader des paiements:', error);
    return json({
      payments: [],
      stats: { total_amount: 0, paid_orders: 0, pending_orders: 0, currency: 'EUR' },
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    } as LoaderData);
  }
}

/**
 * Composant principal des paiements admin
 */
export default function AdminPayments() {
  const { payments, stats, error } = useLoaderData<LoaderData>();

  // Debug: voir les données reçues
  console.log('🔍 COMPOSANT PAYMENTS - Données dans le composant:', {
    paymentsCount: payments?.length || 0,
    firstPayment: payments?.[0],
    firstPaymentId: payments?.[0]?.id,
    firstPaymentAmount: payments?.[0]?.montantTotal,
    error
  });

  // ALERT POUR FORCER LE DEBUG
  if (typeof window !== 'undefined' && payments?.[0]) {
    console.log('🚨 PREMIER PAIEMENT:', payments[0]);
  }
  // UI state non utilisé pour le moment

  if (error) {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    // Conversion des statuts numériques vers des libellés
    switch (status) {
      case '1':
      case 'completed':
        return <span className={`${baseClass} bg-green-100 text-green-800`}>Payé</span>;
      case '0':
      case 'pending':
        return <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>En attente</span>;
      case '-1':
      case 'failed':
        return <span className={`${baseClass} bg-red-100 text-red-800`}>Échoué</span>;
      case '2':
        return <span className={`${baseClass} bg-blue-100 text-blue-800`}>Remboursé</span>;
      default:
        return <span className={`${baseClass} bg-gray-100 text-gray-800`}>Statut ${status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">💳 Gestion des Paiements</h1>
              <p className="text-gray-600">Suivi des transactions et revenus</p>
              <p className="text-xs text-blue-600">🔍 DEBUG: {payments?.length || 0} paiements chargés - {new Date().toLocaleTimeString()}</p>
              <p className="text-xs text-green-600">✅ Source: Vraies données ic_postback</p>
              {payments?.[0] && (
                <p className="text-xs text-red-600">🚨 PREMIER PAIEMENT: ID {payments[0].id}, Montant {payments[0].montantTotal}, Transaction {payments[0].transactionId}</p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">
                Dernière mise à jour: {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenus Totaux</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.total_amount)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.paid_orders} paiements complétés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paiements Complétés</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paid_orders}</div>
              <p className="text-xs text-muted-foreground">
                Sur {payments.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Attente</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending_orders}</div>
              <p className="text-xs text-muted-foreground">
                Paiements à traiter
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tableau des paiements */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions Récentes</CardTitle>
            <CardDescription>
              Liste des dernières transactions effectuées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">ID</th>
                    <th className="text-left py-3 px-4 font-medium">Commande</th>
                    <th className="text-left py-3 px-4 font-medium">Client</th>
                    <th className="text-left py-3 px-4 font-medium">Montant</th>
                    <th className="text-left py-3 px-4 font-medium">Statut</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="py-3 px-4">{payment.id}</td>
                      <td className="py-3 px-4">ORD-{payment.orderId}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{payment.customerName || 'Client inconnu'}</div>
                          <div className="text-sm text-gray-500">{payment.customerEmail || 'Email non disponible'}</div>
                          {payment.customerCity && (
                            <div className="text-xs text-gray-400">{payment.customerCity}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{formatCurrency(payment.montantTotal)}</td>
                      <td className="py-3 px-4">{getStatusBadge(payment.statutPaiement)}</td>
                      <td className="py-3 px-4">
                        {new Date(payment.dateCreation).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Module Paiements - AutoParts Admin</p>
        </div>
      </div>
    </div>
  );
}
