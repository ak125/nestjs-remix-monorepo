/**
 * Page Commandes - Gestion des commandes avec vraies données
 * Utilise Zustand pour la gestion d'état et Zod pour la validation
 */

import { type LoaderFunction, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ShoppingCart, Plus, CheckCircle, Clock, Download, Euro, Filter, Eye, User, Mail, Calendar, Edit } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "~/components/ui/select";
// import { OrderSearchSchema, useZodValidation } from "~/lib/schemas/validation";
// import { useAdminStore } from "~/lib/stores/admin-store";
import { requireUser } from "~/server/auth.server";
import { getRemixApiService } from "~/server/remix-api.server";
import { safeJsonParse } from "~/utils/api";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Commandes - Admin" },
    { name: "description", content: "Interface d'administration pour la gestion des commandes" },
  ];
};

export const loader: LoaderFunction = async ({ request, context }) => {
  // Vérifier que l'utilisateur est connecté et admin
  await requireUser({ context });

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Utiliser le service Remix API comme les autres routes admin
    const remixService = await getRemixApiService(context);
    const data: any = await remixService.getOrdersForRemix({
      page,
      limit
    });

    const orders = data.orders || [];

    // Utiliser les vraies statistiques du total retourné par l'API
    const stats = {
      total: data.total || data.totalOrders || orders.length,
      paid: orders.filter((o: any) => o.ord_is_pay === '1' || o.ord_is_pay === 1).length,
      pending: orders.filter((o: any) => o.ord_is_pay === '0' || o.ord_is_pay === 0).length,
      revenue: orders.reduce((sum: number, o: any) => sum + (parseFloat(o.ord_total_ttc) || 0), 0),
      averageCart: 0
    };
    
    stats.averageCart = stats.total > 0 ? stats.revenue / stats.total : 0;

    // Formater les commandes pour l'affichage avec les vraies données
    const formattedOrders = orders.map((order: any) => ({
      id: order.ord_id,
      orderNumber: order.ord_no || `ORD-${order.ord_id}`,
      customer: {
        name: order.customer?.cst_name && order.customer?.cst_fname 
          ? `${order.customer.cst_fname} ${order.customer.cst_name}`
          : order.customer?.cst_mail || 'Client inconnu',
        email: order.customer?.cst_mail || 'Email non disponible'
      },
      total: parseFloat(order.ord_total_ttc) || 0,
      status: order.ord_is_pay === '1' || order.ord_is_pay === 1 ? 'PAID' : 'PENDING',
      date: order.ord_date || new Date().toISOString(),
      paymentMethod: order.ord_payment_method || 'Non spécifié',
      transactionId: order.ord_transaction_id || null,
      // Ajouter plus de détails pour l'affichage
      amountHT: parseFloat(order.ord_amount_ht) || 0,
      depositTTC: parseFloat(order.ord_deposit_ttc) || 0,
      shippingFee: parseFloat(order.ord_shipping_fee_ttc) || 0,
      tva: parseFloat(order.ord_tva) || 0,
      paymentDate: order.ord_date_pay,
      info: safeJsonParse(order.ord_info)
    }));

    return json({
      orders: formattedOrders,
      stats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil((data.total || data.totalOrders || 0) / limit),
        totalOrders: data.total || data.totalOrders || 0,
        limit: limit,
        hasNextPage: page < Math.ceil((data.total || data.totalOrders || 0) / limit),
        hasPreviousPage: page > 1
      },
      // Informations de debug
      debug: {
        dataKeys: Object.keys(data),
        orderCount: orders.length,
        totalFromAPI: data.total || data.totalOrders
      }
    });

  } catch (error) {
    console.error('Erreur lors du chargement des commandes:', error);
    
    return json({
      orders: [],
      stats: {
        total: 0,
        paid: 0,
        pending: 0,
        revenue: 0,
        averageCart: 0
      },
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalOrders: 0
      }
    });
  }
};

type LoaderData = {
  orders: Array<{
    id: string;
    orderNumber: string;
    customer: {
      name: string;
      email: string;
    };
    total: number;
    status: string;
    date: string;
    paymentMethod: string;
    transactionId?: string;
  }>;
  stats: {
    total: number;
    paid: number;
    pending: number;
    revenue: number;
    averageCart: number;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
  };
};

export default function AdminOrders() {
  const { orders, stats, pagination } = useLoaderData<LoaderData>();
  const [_selectedOrder, _setSelectedOrder] = useState<any>(null);

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Commandes</h1>
          <p className="text-gray-600">Gérez toutes les commandes et transactions de votre plateforme</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              ✅ Données réelles
            </Badge>
            <span className="text-sm text-gray-500">
              {pagination.totalOrders.toLocaleString('fr-FR')} commandes au total
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle Commande
          </Button>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Commandes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-gray-500 mt-1">Depuis la base de données</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Commandes Payées</p>
                <p className="text-2xl font-bold">{stats.paid}</p>
                <p className="text-xs text-gray-500 mt-1">Transactions confirmées</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En Attente</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-gray-500 mt-1">À traiter</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'EUR' 
                  }).format(stats.revenue)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Panier moyen: {new Intl.NumberFormat('fr-FR', { 
                    style: 'currency', 
                    currency: 'EUR' 
                  }).format(stats.averageCart)}
                </p>
              </div>
              <Euro className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input 
                placeholder="Rechercher une commande..." 
                className="w-full"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="paid">Payées</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Plus de filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des commandes */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Commandes</CardTitle>
          <p className="text-sm text-gray-600">
            Toutes les commandes depuis la base de données - {orders.length} commandes
          </p>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune commande trouvée</p>
              <p className="text-sm text-gray-400 mt-2">
                Les commandes apparaîtront ici une fois créées
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div 
                  key={order.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-semibold text-lg">
                        {order.orderNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        <User className="inline h-3 w-3 mr-1" />
                        {order.customer?.name || 'Client inconnu'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <Mail className="inline h-3 w-3 mr-1" />
                        {order.customer?.email || 'Email non disponible'}
                      </p>
                      {order.transactionId && (
                        <p className="text-xs text-gray-500">
                          TX: {order.transactionId.substring(0, 15)}...
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right space-y-2">
                      <p className="text-xl font-bold">
                        {new Intl.NumberFormat('fr-FR', { 
                          style: 'currency', 
                          currency: 'EUR' 
                        }).format(order.total)}
                      </p>
                      <Badge 
                        variant={order.status === 'PAID' ? 'default' : 'secondary'}
                        className={
                          order.status === 'PAID' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {order.status === 'PAID' ? 'Payée' : 'En attente'}
                      </Badge>
                      <p className="text-xs text-gray-500">
                        {order.paymentMethod}
                      </p>
                      <p className="text-xs text-gray-500">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        {new Date(order.date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => _setSelectedOrder(order)}
                    >
                      <Eye className="mr-2 h-3 w-3" />
                      Détails
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-3 w-3" />
                      Modifier
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            Affichage {((pagination.currentPage - 1) * 10) + 1} à {Math.min(pagination.currentPage * 10, pagination.totalOrders)} sur {pagination.totalOrders.toLocaleString('fr-FR')} commandes réelles
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              disabled={pagination.currentPage === 1}
              onClick={() => {
                // Navigation vers page précédente
                const url = new URL(window.location.href);
                url.searchParams.set('page', (pagination.currentPage - 1).toString());
                window.location.href = url.toString();
              }}
            >
              Précédent
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => {
                // Navigation vers page suivante
                const url = new URL(window.location.href);
                url.searchParams.set('page', (pagination.currentPage + 1).toString());
                window.location.href = url.toString();
              }}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
