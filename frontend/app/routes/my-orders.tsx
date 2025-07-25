/**
 * Page de suivi des commandes pour les utilisateurs finaux
 * Permet aux utilisateurs de voir uniquement leurs propres commandes
 */

import { json, type LoaderFunction, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Package, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireUser } from "~/server/auth.server";
import { getRemixIntegrationService } from "~/server/remix-integration.server";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  createdAt: string;
  customerId?: string; // Ajout de customerId optionnel
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  deliveryAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

interface LoaderData {
  orders: Order[];
  user: any;
}

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });
  
  // Rediriger les admins vers leur interface dédiée
  const userLevel = parseInt(user.level?.toString() || '0', 10);
  if (user.isAdmin && userLevel >= 7) {
    return redirect('/admin/orders');
  }

  try {
    console.log('🛒 Chargement des commandes utilisateur via Context7...');
    
    const remixService = await getRemixIntegrationService(context);
    
    // Récupérer les commandes de l'utilisateur connecté
    const ordersResult = await remixService.getOrdersForRemix({
      page: 1,
      limit: 100
    });
    
    let userOrders: Order[] = [];
    
    if (ordersResult.success && ordersResult.orders?.length > 0) {
      // Filtrer les commandes pour ne garder que celles de l'utilisateur
      // En attendant d'avoir un vrai système de filtrage côté API
      userOrders = ordersResult.orders
        .filter((order: any) => order.ord_cst_id === user.id)
        .map((order: any) => ({
          id: order.ord_id,
          orderNumber: `ORD-${order.ord_id}`,
          status: order.ord_is_pay === "1" ? 'delivered' : 'pending',
          paymentStatus: order.ord_is_pay === "1" ? 'paid' : 'pending',
          totalPrice: parseFloat(order.ord_total_ttc || order.ord_amount_ttc || '0'),
          createdAt: order.ord_date || new Date().toISOString(),
          customerId: order.ord_cst_id,
          items: [
            {
              productName: "Produit commande",
              quantity: 1,
              unitPrice: parseFloat(order.ord_total_ttc || order.ord_amount_ttc || '0')
            }
          ],
          deliveryAddress: {
            street: "Adresse non spécifiée",
            city: "Ville",
            postalCode: "00000",
            country: "France"
          }
        }));
    } else {
      // Données de fallback pour l'utilisateur
      userOrders = [];
    }

    return json<LoaderData>({ orders: userOrders, user });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return json<LoaderData>({ orders: [], user });
  }
};

export default function MyOrders() {
  const { orders, user } = useLoaderData<LoaderData>();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <Package className="w-4 h-4" />;
      case 'shipped': return <Package className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return "bg-yellow-100 text-yellow-800";
      case 'processing': return "bg-blue-100 text-blue-800";
      case 'shipped': return "bg-purple-100 text-purple-800";
      case 'delivered': return "bg-green-100 text-green-800";
      case 'cancelled': return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'processing': return 'En cours';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête utilisateur */}
      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <h1 className="text-2xl font-bold text-gray-900">Mes Commandes</h1>
        <p className="text-gray-600 mt-2">
          Bonjour {user.firstName} {user.lastName}, voici le suivi de vos commandes
        </p>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total commandes</p>
                <p className="text-xl font-bold">{orders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">En cours</p>
                <p className="text-xl font-bold">
                  {orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Livrées</p>
                <p className="text-xl font-bold">
                  {orders.filter(o => o.status === 'delivered').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Annulées</p>
                <p className="text-xl font-bold">
                  {orders.filter(o => o.status === 'cancelled').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des commandes */}
      <div className="space-y-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune commande trouvée
              </h3>
              <p className="text-gray-600">
                Vous n'avez pas encore passé de commande.
              </p>
              <Button asChild className="mt-4">
                <Link to="/orders/new">Passer une commande</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {order.orderNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'Date non disponible'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(order.status)}
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Articles ({order.items?.length || 0})
                    </h4>
                    <div className="space-y-1">
                      {order.items?.slice(0, 2).map((item, index) => (
                        <p key={index} className="text-sm text-gray-600">
                          {item.quantity}x {item.productName}
                        </p>
                      )) || <p className="text-sm text-gray-500">Aucun article</p>}
                      {(order.items?.length || 0) > 2 && (
                        <p className="text-sm text-gray-500">
                          ... et {(order.items?.length || 0) - 2} autres articles
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Adresse de livraison
                    </h4>
                    {order.deliveryAddress ? (
                      <p className="text-sm text-gray-600">
                        {order.deliveryAddress.street}<br />
                        {order.deliveryAddress.postalCode} {order.deliveryAddress.city}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Adresse non spécifiée</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-lg font-semibold text-gray-900">
                    Total: {order.totalPrice ? order.totalPrice.toFixed(2) : '0.00'}€
                  </div>
                  <Button variant="outline" asChild>
                    <Link to={`/orders/${order.id}`}>
                      Voir les détails
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
