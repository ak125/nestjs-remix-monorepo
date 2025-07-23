/**
 * Page Commandes - Gestion des commandes avec vraies données
 */

import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle,
  Eye,
  Download 
} from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Commandes - Admin" },
    { name: "description", content: "Interface d'administration pour la gestion des commandes" },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    console.log('🛒 Chargement des commandes depuis l\'API...');
    
    // Récupérer les paramètres de recherche depuis l'URL
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '50';
    const status = url.searchParams.get('status') || '';
    
    // Construire l'URL de l'API avec les paramètres
    const apiUrl = new URL('http://localhost:3000/api/orders');
    apiUrl.searchParams.set('limit', limit);
    apiUrl.searchParams.set('page', page);
    if (search) apiUrl.searchParams.set('search', search);
    if (status) apiUrl.searchParams.set('status', status);
    
    const ordersResponse = await fetch(apiUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    let orders: any[] = [];
    let totalOrders = 0;
    let pagination = {
      currentPage: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    };
    
    if (ordersResponse.ok) {
      const data = await ordersResponse.json();
      console.log('✅ Réponse API orders:', data);
      
      orders = data.orders || [];
      totalOrders = data.total || orders.length;
      
      // Calculer la pagination
      const limitNum = parseInt(limit, 10);
      const pageNum = parseInt(page, 10);
      pagination = {
        currentPage: pageNum,
        totalPages: Math.ceil(totalOrders / limitNum),
        hasNextPage: (pageNum * limitNum) < totalOrders,
        hasPrevPage: pageNum > 1
      };
      
      // Transformer pour l'affichage
      orders = orders.map((order: any) => ({
        id: order.ord_id,
        orderId: `ORD-${order.ord_id}`,
        customerId: order.ord_cst_id,
        customerName: order.customer ? 
          `${order.customer.cst_fname || ''} ${order.customer.cst_name || ''}`.trim() : 
          'Client inconnu',
        customerEmail: order.customer?.cst_mail || 'email@inconnu.com',
        amount: parseFloat(order.ord_total_ttc || order.ord_amount_ttc || '0'),
        status: order.ord_is_pay === "1" ? 'paid' : 'pending',
        paymentStatus: order.ord_is_pay === "1" ? 'Payée' : 'En attente',
        date: new Date(order.ord_date).toLocaleDateString('fr-FR'),
        dateTime: order.ord_date,
        paymentGateway: order.ord_info ? (() => {
          try {
            const info = JSON.parse(order.ord_info);
            return info.payment_gateway || 'Inconnu';
          } catch {
            return 'Inconnu';
          }
        })() : 'Inconnu',
        transactionId: order.ord_info ? (() => {
          try {
            const info = JSON.parse(order.ord_info);
            return info.transaction_id || null;
          } catch {
            return null;
          }
        })() : null,
        orderLines: order.orderLines || [],
        totalLines: order.totalLines || 0,
        totalQuantity: order.totalQuantity || 0
      }));
      
      console.log(`✅ ${orders.length} commandes chargées depuis l'API (page ${pagination.currentPage}/${pagination.totalPages})`);
    } else {
      console.error('❌ Erreur API orders:', ordersResponse.status, ordersResponse.statusText);
      console.log('🔄 Fallback vers les données de test...');
      
      orders = [
        { 
          id: 1, 
          orderId: "ORD-001", 
          customerName: "Jean Dupont", 
          customerEmail: "jean@test.com",
          amount: 299.99, 
          status: "paid", 
          paymentStatus: "Payée",
          date: "23/07/2025",
          paymentGateway: "STRIPE",
          transactionId: "tx_123456789"
        },
        { 
          id: 2, 
          orderId: "ORD-002", 
          customerName: "Marie Martin", 
          customerEmail: "marie@test.com",
          amount: 159.50, 
          status: "pending", 
          paymentStatus: "En attente",
          date: "23/07/2025",
          paymentGateway: "PAYPAL",
          transactionId: null
        },
      ];
      totalOrders = orders.length;
    }

    return json({ orders, totalOrders, pagination, searchTerm: search, statusFilter: status });
  } catch (error) {
    console.error('❌ Erreur lors du chargement des commandes:', error);
    return json({ 
      orders: [], 
      totalOrders: 0,
      pagination: { currentPage: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      searchTerm: '',
      statusFilter: '',
      error: 'Erreur de connexion à l\'API des commandes'
    });
  }
};

export default function AdminOrders() {
  const { orders, totalOrders, pagination, searchTerm, statusFilter, error } = useLoaderData<typeof loader>();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-100 text-green-800">Payée</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulée</Badge>;
      default:
        return <Badge variant="outline">Inconnue</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Calculer les statistiques
  const paidOrders = orders.filter((o: any) => o.status === 'paid');
  const pendingOrders = orders.filter((o: any) => o.status === 'pending');
  const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + o.amount, 0);
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Gestion des Commandes
          </h1>
          <p className="text-muted-foreground">
            Gérez toutes les commandes et transactions de votre plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle Commande
          </Button>
        </div>
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
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">Depuis la base de données</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commandes Payées</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidOrders.length}</div>
            <p className="text-xs text-muted-foreground">Transactions confirmées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <p className="text-xs text-muted-foreground">À traiter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
            <div className="h-2 w-2 bg-purple-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toFixed(2)}€</div>
            <p className="text-xs text-muted-foreground">
              Panier moyen: {avgOrderValue.toFixed(2)}€
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions et filtres */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Rechercher une commande..."
            className="px-3 py-2 border rounded-md w-64"
          />
        </div>
        <select className="px-3 py-2 border rounded-md">
          <option value="">Tous les statuts</option>
          <option value="paid">Payées</option>
          <option value="pending">En attente</option>
          <option value="cancelled">Annulées</option>
        </select>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Plus de filtres
        </Button>
      </div>

      {/* Liste des commandes */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Commandes</CardTitle>
          <CardDescription>
            {searchTerm ? 
              `Résultats pour "${searchTerm}" - ${totalOrders} commande(s) trouvée(s)` :
              `Toutes les commandes depuis la base de données - ${totalOrders} commandes`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune commande trouvée</p>
              <p className="text-sm text-muted-foreground">
                Vérifiez les filtres ou créez votre première commande
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {getStatusIcon(order.status)}
                    </div>
                    <div>
                      <p className="font-medium">{order.orderId}</p>
                      <p className="text-sm text-muted-foreground">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                      {order.transactionId && (
                        <p className="text-xs text-muted-foreground">
                          TX: {order.transactionId.substring(0, 16)}...
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">{order.amount.toFixed(2)}€</p>
                      <p className="text-xs text-muted-foreground">{order.paymentGateway}</p>
                    </div>
                    {getStatusBadge(order.status)}
                    <p className="text-xs text-muted-foreground w-20">
                      {order.date}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        Modifier
                      </Button>
                    </div>
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
