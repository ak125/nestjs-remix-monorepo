/**
 * 📦 ORDERS INDEX - Route moderne utilisant remixService.getOrdersForRemix
 * 
 * Exemple d'implémentation moderne alignée sur les autres modules
 * Utilise context.remixService.getOrdersForRemix() comme attendu
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Plus, Edit, Trash, Eye, Package, Clock, CheckCircle, DollarSign } from "lucide-react";
import { Button } from "../components/ui/button";
import { requireUser } from "../server/auth.server";
import { getRemixApiService } from "../server/remix-api.server";

// Interface pour les données orders modernes
interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  shippingAddress?: any;
  billingAddress?: any;
}

interface OrderStatistics {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  totalRevenue: number;
}

interface OrderData {
  orders: Order[];
  statistics: OrderStatistics;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
  };
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  await requireUser({ context });
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  
  try {
    const remixService = await getRemixApiService(context);
    
    // ✅ Utilisation de la méthode moderne getOrdersForRemix comme dans les autres modules
    const ordersResult = await remixService.getOrdersForRemix({ 
      page, 
      limit, 
      status, 
      search 
    });
    
    // Récupération des statistiques (pour cet exemple, on simule)
    const statistics = {
      total: ordersResult.total || 0,
      pending: Math.floor((ordersResult.total || 0) * 0.3),
      processing: Math.floor((ordersResult.total || 0) * 0.4),
      completed: Math.floor((ordersResult.total || 0) * 0.3),
      totalRevenue: (ordersResult.orders || []).reduce((sum: number, order: any) => {
        return sum + (parseFloat(order.ord_total_ttc || order.totalAmount || 0));
      }, 0)
    };
    
    if (!ordersResult.success) {
      throw new Error(ordersResult.error || 'Erreur lors du chargement des commandes');
    }
    
    // Transform des données si nécessaire
    const orders = (ordersResult.orders || []).map((order: any) => ({
      id: order.ord_id || order.id,
      orderNumber: order.ord_num || `ORD-${order.ord_id || order.id}`,
      customerId: order.ord_cst_id || order.customerId,
      customerName: order.customer ? `${order.customer.cst_fname} ${order.customer.cst_name}` : order.customerName,
      customerEmail: order.customer?.cst_mail || order.customerEmail,
      status: order.ord_status || order.status || 'pending',
      totalAmount: parseFloat(order.ord_total_ttc || order.totalAmount || 0),
      createdAt: order.ord_date || order.createdAt,
      items: order.items || [],
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress
    }));
    
    return json({
      orders,
      statistics,
      pagination: ordersResult.pagination,
      success: true,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Erreur loader orders:', error);
    
    return json({
      orders: [],
      statistics: {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        totalRevenue: 0
      },
      pagination: { page: 1, totalPages: 1, total: 0 },
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      timestamp: new Date().toISOString(),
    });
  }
};

export default function OrdersIndex() {
  const { orders, statistics, error } = useLoaderData<OrderData & { error?: string; success?: boolean }>();
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
      case 'shipping':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
      case 'payment_pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Commandes</h1>
          <p className="text-gray-600 mt-1">Administration et suivi des commandes</p>
        </div>
        <Link to="/orders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle commande
          </Button>
        </Link>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <span className="font-medium">Erreur : {error}</span>
          </div>
        </div>
      )}
      
      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
              <p className="text-xs text-gray-500">Commandes</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{statistics.pending}</p>
              <p className="text-xs text-gray-500">À traiter</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En cours</p>
              <p className="text-2xl font-bold text-blue-600">{statistics.processing}</p>
              <p className="text-xs text-gray-500">Traitement</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Terminées</p>
              <p className="text-2xl font-bold text-green-600">{statistics.completed}</p>
              <p className="text-xs text-gray-500">Livrées</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chiffre d'affaires</p>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(statistics.totalRevenue)}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>
      
      {/* Liste des commandes */}
      <div className="bg-white rounded-lg shadow overflow-hidden border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Commandes Récentes</h3>
          <p className="text-sm text-gray-500 mt-1">
            {orders.length} commande{orders.length > 1 ? 's' : ''} affichée{orders.length > 1 ? 's' : ''}
          </p>
        </div>
        
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
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Montant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <Package className="h-12 w-12 text-gray-300" />
                    <span className="text-lg font-medium">Aucune commande trouvée</span>
                    <span className="text-sm">Aucune commande n'a été passée pour le moment</span>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {order.orderNumber}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {order.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.customerName || 'Client inconnu'}</div>
                    <div className="text-sm text-gray-500">{order.customerEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(order.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link to={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm" className="hover:bg-blue-50">
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </Link>
                      <Link to={`/orders/${order.id}/edit`}>
                        <Button variant="outline" size="sm" className="hover:bg-yellow-50">
                          <Edit className="h-4 w-4 text-yellow-600" />
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" className="hover:bg-red-50">
                        <Trash className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Message informatif */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700">
          <Package className="h-5 w-5" />
          <span className="font-medium">Interface Orders Moderne</span>
          <span className="text-blue-600 text-sm">
            - Utilise remixService.getOrdersForRemix() comme les autres modules
          </span>
        </div>
      </div>
    </div>
  );
}
