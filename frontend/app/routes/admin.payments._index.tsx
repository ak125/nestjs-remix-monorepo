import  { type LoaderFunctionArgs , json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { CreditCard, Clock, CheckCircle, DollarSign, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import  { type LegacyPayment, type PaymentStats , getPaymentStats } from "~/utils/api";

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
    if (context.remixIntegration) {
      console.log('✅ Utilisation du service de paiements direct');
      const [statsResult, paymentsResult] = await Promise.all([
        context.remixIntegration.getPaymentStatsForRemix(),
        context.remixIntegration.getPaymentsForRemix({
          page: 1,
          limit: 20 // Limite réduite pour de meilleures performances
        })
      ]);
      
      const payments = paymentsResult?.success ? paymentsResult.payments : [];
      const stats = statsResult?.success ? statsResult.stats : {
        total_orders: 0,
        paid_orders: 0,
        pending_orders: 0,
        total_amount: 0,
        currency: 'EUR'
      };
      
      return json<LoaderData>({ 
        stats,
        payments,
      });
    }
    
    // Fallback si le service direct n'est pas disponible
    console.log('⚠️ Service direct non disponible, utilisation fallback');
    const [statsResult] = await Promise.all([
      getPaymentStats(context)
    ]);
    
    return json<LoaderData>({ 
      stats: statsResult,
      payments: [],
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
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Erreur de chargement des paiements:</strong> {error}
          </AlertDescription>
        </Alert>
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

      {/* Statistiques avec shadcn/ui Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_orders.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paiements Réussis</CardTitle>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.paid_orders.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Attente</CardTitle>
              <Clock className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_orders.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
              <DollarSign className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.total_amount.toLocaleString()} {stats.currency}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Taux de réussite avec shadcn/ui Card */}
      {stats && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Taux de Réussite des Paiements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full" 
                  style={{ width: `${paymentRate}%` }}
                ></div>
              </div>
              <span className="ml-4 text-lg font-bold">{paymentRate}%</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats.paid_orders} paiements réussis sur {stats.total_orders} commandes
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filtres avec shadcn/ui Tabs */}
      <Tabs defaultValue="all" value={filter} onValueChange={(value) => setFilter(value as 'all' | 'paid' | 'pending')} className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">
            Tous ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="paid">
            Payés ({payments.filter(p => p.statutPaiement === '1').length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            En Attente ({payments.filter(p => p.statutPaiement === '0').length})
          </TabsTrigger>
        </TabsList>

        {/* Liste des paiements avec shadcn/ui Card */}
        <TabsContent value={filter} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Paiements Récents</CardTitle>
              <CardDescription>
                Administration des paiements basée sur les vraies tables legacy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium">Aucun paiement</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            #{payment.orderId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            Client #{payment.customerId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {payment.montantTotal.toLocaleString()} {payment.devise}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {payment.methodePaiement || 'Non définie'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={payment.statutPaiement === '1' ? 'default' : 'secondary'}>
                              {payment.statutPaiement === '1' ? 'Payé' : 'En Attente'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(payment.dateCreation).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
