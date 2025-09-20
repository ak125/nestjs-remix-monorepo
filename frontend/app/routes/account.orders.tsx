import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, Form } from "@remix-run/react";
import { Package, Clock, CheckCircle, XCircle, Truck, ShoppingBag } from "lucide-react";

import { OrderSummaryWidget } from "../components/orders/OrderSummaryWidget";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { requireAuth } from "../auth/unified.server";
import { getUserOrders } from "../services/orders.server";
import { getOrderStatusLabel, formatPrice } from "../utils/orders";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ✅ Utilisation de requireAuth au lieu de requireUser  
    const user = await requireAuth(request);
    
    // ✅ Vérification et adaptation de la structure utilisateur
    const userId = user?.id || (user as any)?.cst_id;
    if (!user || !userId) {
      console.error("User or user.id is undefined:", user);
      throw new Response("Utilisateur non trouvé", { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const status = url.searchParams.get("status") || "all";
    const year = url.searchParams.get("year") || undefined;

    console.log("Fetching orders for user:", userId);

    const { orders, pagination } = await getUserOrders({
      userId: userId,
      page,
      status,
      year,
      request, // Transmission de la requête pour les cookies
    });

    // Calcul des statistiques pour le widget de résumé
    const stats = {
      totalOrders: pagination.totalCount,
      pendingOrders: orders.filter(order => [1, 2, 3, 4, 5].includes(order.status)).length,
      completedOrders: orders.filter(order => order.status === 6).length,
      totalSpent: orders.reduce((sum, order) => sum + order.totalTTC, 0),
    };

    return json({ orders, pagination, user, stats });
  } catch (error) {
    console.error("Error in loader:", error);
    
    // Retour avec des données vides en cas d'erreur
    return json({
      orders: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
      },
      user: null,
      stats: {
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        totalSpent: 0,
      },
      error: "Impossible de charger les commandes"
    });
  }
}

export default function OrdersListPage() {
  const { orders, pagination, stats } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const getStatusIcon = (status: number) => {
    switch (status) {
      case 1:
      case 2:
        return <Clock className="h-4 w-4" />;
      case 3:
      case 4:
        return <Package className="h-4 w-4" />;
      case 5:
        return <Truck className="h-4 w-4" />;
      case 6:
        return <CheckCircle className="h-4 w-4" />;
      case 7:
      case 8:
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: number): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 6:
        return "default"; // Vert pour livrée
      case 7:
      case 8:
        return "destructive"; // Rouge pour annulée/remboursée
      case 4:
      case 5:
        return "secondary"; // Bleu pour expédiée/en livraison
      default:
        return "outline"; // Gris pour en attente
    }
  };

  return (
    <div className="space-y-6">
      {/* Widget de résumé */}
      <OrderSummaryWidget 
        totalOrders={stats.totalOrders}
        pendingOrders={stats.pendingOrders}
        completedOrders={stats.completedOrders}
        totalSpent={stats.totalSpent}
      />

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes commandes</h1>
          <p className="text-muted-foreground">
            Suivez l'état de vos commandes et téléchargez vos factures
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          <span className="text-sm text-muted-foreground">
            {pagination.totalCount} commande{pagination.totalCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtrer les commandes</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="get" className="flex flex-wrap gap-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Statut
              </label>
              <select
                id="status"
                name="status"
                defaultValue={searchParams.get("status") || "all"}
                className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">Tous les statuts</option>
                <option value="1">En attente</option>
                <option value="2">Confirmée</option>
                <option value="3">En préparation</option>
                <option value="4">Expédiée</option>
                <option value="5">En livraison</option>
                <option value="6">Livrée</option>
                <option value="7">Annulée</option>
              </select>
            </div>

            <div className="flex flex-col space-y-2">
              <label htmlFor="year" className="text-sm font-medium">
                Année
              </label>
              <select
                id="year"
                name="year"
                defaultValue={searchParams.get("year") || ""}
                className="flex h-10 w-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Toutes</option>
                {[2023, 2024, 2025].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button type="submit" variant="outline">
                Filtrer
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Liste des commandes */}
      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Commande #{order.orderNumber}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Passée le {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(order.status)} className="flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    {getOrderStatusLabel(order.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Articles de la commande */}
                <div className="space-y-3">
                  {order.lines.slice(0, 3).map(line => (
                    <div key={line.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <img 
                        src={line.productImage} 
                        alt={line.productName}
                        className="h-12 w-12 rounded-md object-cover bg-background"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{line.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {line.quantity} × {formatPrice(line.unitPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {order.lines.length > 3 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      + {order.lines.length - 3} autre{order.lines.length - 3 > 1 ? 's' : ''} article{order.lines.length - 3 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Total et actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-lg font-semibold">
                    Total: {formatPrice(order.totalTTC)}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <Link to={`/account/orders/${order.id}`}>
                        Voir le détail
                      </Link>
                    </Button>
                    
                    {order.status === 6 && (
                      <Button variant="secondary" asChild>
                        <Link to={`/account/orders/${order.id}/invoice`}>
                          Facture
                        </Link>
                      </Button>
                    )}
                    
                    {[1, 2, 3, 4, 5].includes(order.status) && (
                      <Button asChild>
                        <Link to={`/account/orders/${order.id}/track`}>
                          Suivre
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune commande trouvée</h3>
            <p className="text-muted-foreground mb-6 text-center">
              Vous n'avez pas encore passé de commande ou aucune commande ne correspond à vos filtres.
            </p>
            <Button asChild>
              <Link to="/products">
                Découvrir nos produits
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Card>
          <CardContent className="flex justify-center py-4">
            <div className="flex gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={page === pagination.currentPage ? "default" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link
                    to={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams.entries()),
                      page: page.toString(),
                    })}`}
                  >
                    {page}
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
