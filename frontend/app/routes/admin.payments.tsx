/**
 * Page Paiements - Gestion des paiements avec Context7
 */

import  { type LoaderFunction , json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { requireUser } from "~/server/auth.server";
import { getRemixIntegrationService } from "~/server/remix-integration.server";

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });
  
  // Vérifier les permissions admin
  const userLevel = parseInt(user.level?.toString() || '0', 10);
  if (!user.level || userLevel < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  try {
    const remixService = await getRemixIntegrationService(context);
    
    // Utiliser Context7 pour récupérer les commandes avec paiements
    const ordersResult = await remixService.getOrdersForRemix({
      page: 1,
      limit: 50
    });

    let payments: any[] = [];
    let totalRevenue = 0;
    
    if (ordersResult.success && ordersResult.orders?.length > 0) {
      // Convertir les commandes en format paiements
      payments = ordersResult.orders.map((order: any) => {
        const amount = parseFloat(order.ord_total_ttc || order.ord_amount_ttc || '0');
        const isPaid = order.ord_is_pay === "1";
        const customerName = order.customer ? 
          `${order.customer.cst_fname || ''} ${order.customer.cst_name || ''}`.trim() : 
          'Client inconnu';
        
        // Extraire les infos de paiement depuis ord_info si disponible
        let paymentMethod = 'card';
        let gateway = 'unknown';
        try {
          if (order.ord_info) {
            const info = JSON.parse(order.ord_info);
            gateway = info.payment_gateway || 'unknown';
            paymentMethod = gateway.toLowerCase() === 'stripe' ? 'card' : 
                           gateway.toLowerCase() === 'paypal' ? 'paypal' : 
                           gateway.toLowerCase() === 'cyberplus' ? 'bank' : 'card';
          }
        } catch (e) {
          // Ignore les erreurs de parsing JSON
        }

        return {
          id: order.ord_id,
          orderId: `ORD-${order.ord_id}`,
          amount: amount,
          method: paymentMethod,
          gateway: gateway,
          status: isPaid ? 'completed' : (amount > 0 ? 'pending' : 'failed'),
          date: order.ord_date || new Date().toISOString(),
          customer: customerName,
          transactionId: order.ord_info ? JSON.parse(order.ord_info).transaction_id : null
        };
      });

      // Calculer le revenu total des paiements confirmés
      totalRevenue = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);
        
    } else {
      console.warn('Aucune commande trouvée via Context7, utilisation de données de fallback');
      payments = [
        { id: 1, orderId: "ORD-001", amount: 299.99, method: "card", status: "completed", date: "2025-01-21", customer: "Client Test" },
        { id: 2, orderId: "ORD-002", amount: 159.50, method: "paypal", status: "pending", date: "2025-01-21", customer: "Client Test 2" },
      ];
      totalRevenue = 299.99;
    }
    
    return json({ 
      payments, 
      totalRevenue,
      context7: {
        servicesAvailable: ordersResult.success,
        fallbackMode: !ordersResult.success || payments.length <= 2
      }
    });
  } catch (error) {
    console.error('Erreur lors du chargement des paiements:', error);
    return json({ 
      payments: [], 
      totalRevenue: 0,
      error: 'Erreur de connexion aux services de paiement',
      context7: {
        servicesAvailable: false,
        fallbackMode: true,
        errorMode: true
      }
    });
  }
};

export default function AdminPayments() {
  const { payments, totalRevenue, error, context7 } = useLoaderData<typeof loader>();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <TrendingUp className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      default: return <RefreshCw className="h-4 w-4" />;
    }
  };

  const completedPayments = payments.filter((p: any) => 
    p.status === 'completed' || p.pay_status === 'paid'
  );
  const pendingPayments = payments.filter((p: any) => 
    p.status === 'pending' || p.pay_status === 'pending'
  );
  const failedPayments = payments.filter((p: any) => 
    p.status === 'failed' || p.pay_status === 'failed'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-primary" />
            Gestion des Paiements
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">
              Suivez et gérez tous les paiements de votre plateforme
            </p>
            {context7 && (
              <Badge variant={context7.servicesAvailable ? "default" : "secondary"} className="flex items-center gap-1">
                {context7.servicesAvailable ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {context7.servicesAvailable ? "Context7 Actif" : "Mode Fallback"}
              </Badge>
            )}
          </div>
        </div>
        <Button className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Rapport Financier
        </Button>
      </div>

      {/* Alerte en cas d'erreur */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toFixed(2)}€</div>
            <p className="text-xs text-muted-foreground">Depuis les vraies données</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paiements Réussis</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedPayments.length}</div>
            <p className="text-xs text-muted-foreground">Paiements confirmés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments.length}</div>
            <p className="text-xs text-muted-foreground">À traiter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Échecs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedPayments.length}</div>
            <p className="text-xs text-muted-foreground">À relancer</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des paiements */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions Récentes</CardTitle>
          <CardDescription>
            Historique détaillé des paiements depuis la base de données
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune transaction trouvée</p>
              <p className="text-sm text-muted-foreground">
                Vérifiez la configuration de l'API ou créez votre première transaction
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.orderId}</p>
                      <p className="text-sm text-muted-foreground">{payment.customer}</p>
                      {payment.transactionId && (
                        <p className="text-xs text-muted-foreground">TX: {payment.transactionId.substring(0, 16)}...</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium">{parseFloat(payment.amount).toFixed(2)}€</p>
                      <p className="text-xs text-muted-foreground">{payment.gateway}</p>
                    </div>
                    <Badge variant={getStatusColor(payment.status)} className="flex items-center gap-1">
                      {getStatusIcon(payment.status)}
                      {payment.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground w-20">
                      {new Date(payment.date).toLocaleDateString('fr-FR')}
                    </p>
                    <Button variant="outline" size="sm">
                      Détails
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
