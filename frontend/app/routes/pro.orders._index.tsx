// app/routes/pro.orders._index.tsx
// Interface gestion commandes professionnelles appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, Form } from '@remix-run/react';
import { 
  Package, 
  Search, 
  Filter, 
  Download,
  Eye,
  Edit,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  MapPin
} from 'lucide-react';
import { requireAuth } from '../auth/unified.server';

// Interfaces TypeScript
interface Order {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    company?: string;
  };
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
  updatedAt: string;
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
  };
  trackingNumber?: string;
  expectedDelivery?: string;
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  shippedOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  topCustomers: Array<{
    name: string;
    ordersCount: number;
    totalSpent: number;
  }>;
  monthlyGrowth: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  // Vérifier permissions professionnelles (niveau 3+)
  if (!user.level || user.level < 3) {
    throw new Response('Accès refusé - Compte professionnel requis', { status: 403 });
  }

  // Pagination et filtres
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const status = url.searchParams.get('status') || '';
  const search = url.searchParams.get('search') || '';

  // En production, récupérer les vraies commandes depuis l'API
  const orders: Order[] = [
    {
      id: 'ord-001',
      orderNumber: 'ORD-2025-001247',
      customer: {
        name: 'Garage Central SARL',
        email: 'contact@garagecentral.fr',
        company: 'Garage Central SARL'
      },
      total: 456.80,
      status: 'shipped',
      items: [
        { id: '1', name: 'Plaquettes frein avant Brembo', quantity: 2, price: 129.99 },
        { id: '2', name: 'Disques frein arrière OEM', quantity: 2, price: 98.41 }
      ],
      createdAt: '2025-08-20T10:30:00Z',
      updatedAt: '2025-08-22T14:15:00Z',
      shippingAddress: {
        street: '45 Avenue des Réparations',
        city: 'Strasbourg',
        postalCode: '67000'
      },
      trackingNumber: 'FR123456789',
      expectedDelivery: '2025-08-23'
    },
    {
      id: 'ord-002',
      orderNumber: 'ORD-2025-001246',
      customer: {
        name: 'Auto Services Plus',
        email: 'commandes@autoservices.fr',
        company: 'Auto Services Plus'
      },
      total: 234.50,
      status: 'preparing',
      items: [
        { id: '3', name: 'Huile moteur Castrol 5L', quantity: 3, price: 34.50 },
        { id: '4', name: 'Filtre à huile OEM', quantity: 2, price: 15.75 }
      ],
      createdAt: '2025-08-22T08:45:00Z',
      updatedAt: '2025-08-22T08:45:00Z',
      shippingAddress: {
        street: '12 Rue de la Mécanique',
        city: 'Lyon',
        postalCode: '69000'
      }
    },
    {
      id: 'ord-003',
      orderNumber: 'ORD-2025-001245',
      customer: {
        name: 'Méca Pro Expertise',
        email: 'achat@mecapro.fr',
        company: 'Méca Pro Expertise'
      },
      total: 789.20,
      status: 'delivered',
      items: [
        { id: '5', name: 'Kit distribution Gates complet', quantity: 1, price: 245.00 },
        { id: '6', name: 'Pompe à eau Gates', quantity: 1, price: 187.50 },
        { id: '7', name: 'Courroie accessoire Gates', quantity: 2, price: 67.85 }
      ],
      createdAt: '2025-08-19T16:20:00Z',
      updatedAt: '2025-08-21T11:30:00Z',
      shippingAddress: {
        street: '78 Boulevard Industriel',
        city: 'Marseille',
        postalCode: '13000'
      },
      trackingNumber: 'FR987654321',
      expectedDelivery: '2025-08-21'
    },
    {
      id: 'ord-004',
      orderNumber: 'ORD-2025-001244',
      customer: {
        name: 'Rapid Auto 67',
        email: 'info@rapidauto67.fr',
        company: 'Rapid Auto 67'
      },
      total: 167.90,
      status: 'confirmed',
      items: [
        { id: '8', name: 'Filtre à air K&N Performance', quantity: 1, price: 89.90 },
        { id: '9', name: 'Bougies NGK Iridium x4', quantity: 1, price: 78.00 }
      ],
      createdAt: '2025-08-21T14:10:00Z',
      updatedAt: '2025-08-22T09:20:00Z',
      shippingAddress: {
        street: '34 Rue Rapide',
        city: 'Strasbourg',
        postalCode: '67100'
      }
    },
    {
      id: 'ord-005',
      orderNumber: 'ORD-2025-001243',
      customer: {
        name: 'Atelier Moderne',
        email: 'commande@ateliermoderne.fr'
      },
      total: 345.60,
      status: 'pending',
      items: [
        { id: '10', name: 'Amortisseurs Bilstein B4 x2', quantity: 1, price: 267.80 },
        { id: '11', name: 'Coupelles amortisseur avant', quantity: 2, price: 38.90 }
      ],
      createdAt: '2025-08-22T15:30:00Z',
      updatedAt: '2025-08-22T15:30:00Z',
      shippingAddress: {
        street: '56 Avenue Moderne',
        city: 'Toulouse',
        postalCode: '31000'
      }
    }
  ];

  const stats: OrderStats = {
    totalOrders: 147,
    pendingOrders: 12,
    confirmedOrders: 23,
    shippedOrders: 34,
    totalRevenue: 42380.50,
    averageOrderValue: 288.30,
    topCustomers: [
      { name: 'Garage Central SARL', ordersCount: 23, totalSpent: 6789.45 },
      { name: 'Auto Services Plus', ordersCount: 18, totalSpent: 5234.20 },
      { name: 'Méca Pro Expertise', ordersCount: 15, totalSpent: 8967.80 }
    ],
    monthlyGrowth: 12.8
  };

  return json({ user, orders, stats, filters: { page, status, search } });
}

export default function ProOrdersIndex() {
  const { orders, stats, filters } = useLoaderData<typeof loader>();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'preparing': return <Package className="h-4 w-4 text-purple-500" />;
      case 'shipped': return <Truck className="h-4 w-4 text-orange-500" />;
      case 'delivered': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      preparing: 'Préparation',
      shipped: 'Expédiée',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Package className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Gestion Commandes PRO</h1>
              <p className="text-blue-100 text-lg mt-1">
                Interface de gestion complète pour professionnels
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold">{formatNumber(stats.totalOrders)}</div>
            <div className="text-blue-200">Commandes totales</div>
            <div className="text-sm text-blue-300 mt-1">
              +{stats.monthlyGrowth}% ce mois
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{formatNumber(stats.pendingOrders)}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Confirmées</p>
              <p className="text-2xl font-bold text-blue-600">{formatNumber(stats.confirmedOrders)}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expédiées</p>
              <p className="text-2xl font-bold text-orange-600">{formatNumber(stats.shippedOrders)}</p>
            </div>
            <Truck className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CA Total</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(stats.totalRevenue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <Form method="get" className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                name="search"
                placeholder="Rechercher par numéro, client..."
                defaultValue={filters.search}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            name="status"
            defaultValue={filters.status}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="confirmed">Confirmées</option>
            <option value="preparing">Préparation</option>
            <option value="shipped">Expédiées</option>
            <option value="delivered">Livrées</option>
            <option value="cancelled">Annulées</option>
          </select>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filtrer
            </button>
            
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </Form>
      </div>

      {/* Liste des commandes */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Liste des commandes ({formatNumber(orders.length)})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
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
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <Link 
                        to={`/pro/orders/${order.id}`}
                        className="text-indigo-600 hover:text-indigo-500 font-medium"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.trackingNumber && (
                        <div className="text-sm text-gray-500">
                          Suivi: {order.trackingNumber}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {order.customer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.customer.email}
                        </div>
                        {order.customer.company && (
                          <div className="text-xs text-gray-400">
                            {order.customer.company}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrice(order.total)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.items.length} article{order.items.length > 1 ? 's' : ''}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1">{getStatusText(order.status)}</span>
                    </span>
                    {order.expectedDelivery && order.status === 'shipped' && (
                      <div className="text-xs text-gray-500 mt-1">
                        Livraison: {new Date(order.expectedDelivery).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(order.createdAt)}
                    </div>
                    <div className="flex items-center mt-1 text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {order.shippingAddress.city}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link
                        to={`/pro/orders/${order.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Voir détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/pro/orders/${order.id}/edit`}
                        className="text-gray-600 hover:text-gray-900"
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Affichage de <span className="font-medium">1</span> à <span className="font-medium">{orders.length}</span> sur <span className="font-medium">{stats.totalOrders}</span> résultats
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Précédent
              </button>
              <button className="px-3 py-2 text-sm text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700">
                1
              </button>
              <button className="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                2
              </button>
              <button className="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Suivant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
