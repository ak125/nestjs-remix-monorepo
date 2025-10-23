/**
 * 📋 Composant OrdersOverview - Aperçu des commandes
 * Compatible avec l'architecture Remix existante
 */

import { Link } from "@remix-run/react";

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
  estimatedDelivery?: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
}

interface OrdersOverviewProps {
  orders: Order[];
  title?: string;
  showFilters?: boolean;
}

export function OrdersOverview({ 
  orders, 
  title = "📋 Commandes Récentes",
  showFilters = false 
}: OrdersOverviewProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-600">Aucune commande récente</p>
          <p className="text-sm text-gray-500 mt-1">
            Les nouvelles commandes apparaîtront ici
          </p>
        </div>
      </div>
    );
  }

  const priorityOrders = orders.filter(order => order.priority !== 'NORMAL');
  const pendingOrders = orders.filter(order => order.status === 'PENDING');

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <Link 
          to="/admin/orders" 
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Voir toutes
        </Link>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
          <div className="text-xs text-blue-600 uppercase tracking-wide">Total</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</div>
          <div className="text-xs text-yellow-600 uppercase tracking-wide">En attente</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{priorityOrders.length}</div>
          <div className="text-xs text-red-600 uppercase tracking-wide">Priorité</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}€
          </div>
          <div className="text-xs text-green-600 uppercase tracking-wide">Valeur</div>
        </div>
      </div>

      {/* Filtres rapides */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
          <button className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
            Toutes ({orders.length})
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200">
            En attente ({pendingOrders.length})
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200">
            Priorité ({priorityOrders.length})
          </button>
        </div>
      )}

      {/* Liste des commandes */}
      <div className="space-y-3">
        {orders.slice(0, 8).map((order) => (
          <div 
            key={order.id}
            className={`p-4 rounded-lg border ${getOrderBorderColor(order.status)} hover:shadow-md transition-shadow`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getStatusIcon(order.status)}</span>
                  <Link 
                    to={`/admin/orders/${order.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    #{order.id.slice(-8)}
                  </Link>
                  {order.priority !== 'NORMAL' && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeStyles(order.priority)}`}>
                      {order.priority}
                    </span>
                  )}
                </div>
                
                <div className="mt-1">
                  <p className="text-sm text-gray-900">{order.customerName}</p>
                  <p className="text-xs text-gray-500">{order.customerEmail}</p>
                </div>
                
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <span>{order.itemsCount} article{order.itemsCount > 1 ? 's' : ''}</span>
                  <span>{formatRelativeTime(order.createdAt)}</span>
                  {order.estimatedDelivery && (
                    <span>Livraison: {formatDate(order.estimatedDelivery)}</span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeStyles(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
                <div className="text-lg font-bold text-gray-900">
                  {order.totalAmount.toFixed(2)}€
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lien vers toutes les commandes */}
      {orders.length > 8 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Link 
            to="/admin/orders" 
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voir {orders.length - 8} commandes supplémentaires
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Icônes pour les statuts de commande
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'PENDING':
      return '⏳';
    case 'PROCESSING':
      return '⚙️';
    case 'SHIPPED':
      return '🚚';
    case 'DELIVERED':
      return '✅';
    case 'CANCELLED':
      return '❌';
    default:
      return '📋';
  }
}

/**
 * Couleurs de bordure pour les statuts
 */
function getOrderBorderColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'border-yellow-200';
    case 'PROCESSING':
      return 'border-blue-200';
    case 'SHIPPED':
      return 'border-purple-200';
    case 'DELIVERED':
      return 'border-green-200';
    case 'CANCELLED':
      return 'border-red-200';
    default:
      return 'border-gray-200';
  }
}

/**
 * Styles pour les badges de statut
 */
function getStatusBadgeStyles(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'PROCESSING':
      return 'info';
    case 'SHIPPED':
      return 'purple';
    case 'DELIVERED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Styles pour les badges de priorité
 */
function getPriorityBadgeStyles(priority: string): string {
  switch (priority) {
    case 'URGENT':
      return 'error';
    case 'HIGH':
      return 'orange';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Textes pour les statuts
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'En attente';
    case 'PROCESSING':
      return 'Traitement';
    case 'SHIPPED':
      return 'Expédiée';
    case 'DELIVERED':
      return 'Livrée';
    case 'CANCELLED':
      return 'Annulée';
    default:
      return status;
  }
}

/**
 * Formate une date en temps relatif
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return 'À l\'instant';
  } else if (diffInMinutes < 60) {
    return `Il y a ${diffInMinutes} min`;
  } else if (diffInHours < 24) {
    return `Il y a ${diffInHours}h`;
  } else if (diffInDays < 7) {
    return `Il y a ${diffInDays}j`;
  } else {
    return date.toLocaleDateString('fr-FR');
  }
}

/**
 * Formate une date
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  });
}
