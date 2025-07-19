/**
 * Composant OrderManagement - Interface complète de gestion des commandes
 * Basé sur l'analyse legacy PHP et aligné avec le backend NestJS
 */

import React, { useState, useEffect } from 'react';
import { 
  useOrders, 
  useOrderActions, 
  useOrdersByCustomer, 
  useAutomotiveActions,
  useVehicleValidation,
  useCalculations 
} from '~/hooks/api-hooks';

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  createdAt: string;
  updatedAt: string;
  orderLines: OrderLine[];
  shippingAddress: Address;
  billingAddress: Address;
  vehicleData?: VehicleData;
  isAutomotive: boolean;
}

interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  oemCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
}

interface Address {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  tel: string;
}

interface VehicleData {
  vin?: string;
  registrationNumber?: string;
  brand: string;
  model: string;
  year: number;
  engine: string;
  fuelType: string;
}

export default function OrderManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [showAutomotiveOnly, setShowAutomotiveOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  // Hooks pour les données
  const { 
    data: ordersData, 
    loading: ordersLoading, 
    error: ordersError, 
    refetch: refetchOrders 
  } = useOrders({
    page: currentPage,
    limit: 20,
    status: statusFilter || undefined,
    customerId: customerFilter || undefined,
    dateFrom: dateFromFilter || undefined,
    dateTo: dateToFilter || undefined,
  });

  // Hooks pour les actions
  const { updateOrderStatus, loading: orderActionLoading, error: orderActionError } = useOrderActions();
  const { 
    updateAutomotiveOrderStatus, 
    validateVehicleData, 
    loading: automotiveActionLoading 
  } = useAutomotiveActions();
  const { validateVIN, validateRegistration } = useVehicleValidation();
  const { calculateOrderTax, calculateShippingFee } = useCalculations();

  const orders = ordersData?.orders || [];

  const handleStatusChange = async (orderId: string, newStatus: string, reason?: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (order?.isAutomotive) {
        await updateAutomotiveOrderStatus(orderId, newStatus, reason);
      } else {
        await updateOrderStatus(orderId, newStatus, reason);
      }
      refetchOrders();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    }
  };

  const handleVehicleValidation = async (orderId: string, vehicleData: VehicleData) => {
    try {
      if (vehicleData.vin) {
        await validateVIN(vehicleData.vin);
      }
      if (vehicleData.registrationNumber) {
        await validateRegistration(vehicleData.registrationNumber);
      }
      await validateVehicleData(orderId, vehicleData);
      refetchOrders();
    } catch (error) {
      console.error('Erreur lors de la validation véhicule:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'processing': 'bg-purple-100 text-purple-800',
      'shipped': 'bg-indigo-100 text-indigo-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'refunded': 'bg-gray-100 text-gray-800',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const statusLabels = {
      'pending': 'En attente',
      'confirmed': 'Confirmée',
      'processing': 'En traitement',
      'shipped': 'Expédiée',
      'delivered': 'Livrée',
      'cancelled': 'Annulée',
      'refunded': 'Remboursée',
    };
    return statusLabels[status as keyof typeof statusLabels] || status;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Commandes</h1>
        <p className="text-gray-600">
          Gestion complète des commandes incluant les commandes automobiles
        </p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Filtre par statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmées</option>
              <option value="processing">En traitement</option>
              <option value="shipped">Expédiées</option>
              <option value="delivered">Livrées</option>
              <option value="cancelled">Annulées</option>
              <option value="refunded">Remboursées</option>
            </select>
          </div>

          {/* Filtre par client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <input
              type="text"
              placeholder="ID ou email client"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date de début */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date de fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtre automobile */}
          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showAutomotiveOnly}
                onChange={(e) => setShowAutomotiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Automobile uniquement</span>
            </label>
          </div>
        </div>
      </div>

      {/* Messages d'erreur */}
      {(ordersError || orderActionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800">
            {ordersError || orderActionError}
          </div>
        </div>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm text-gray-500">Total commandes</div>
              <div className="text-2xl font-semibold text-gray-900">{ordersData?.total || 0}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm text-gray-500">Chiffre d'affaires</div>
              <div className="text-2xl font-semibold text-gray-900">
                {formatCurrency(orders.reduce((sum, order) => sum + order.totalAmount, 0))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm text-gray-500">Commandes automobile</div>
              <div className="text-2xl font-semibold text-gray-900">
                {orders.filter(order => order.isAutomotive).length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm text-gray-500">En attente</div>
              <div className="text-2xl font-semibold text-gray-900">
                {orders.filter(order => order.status === 'pending').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau des commandes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ordersLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Aucune commande trouvée
                  </td>
                </tr>
              ) : (
                orders
                  .filter(order => !showAutomotiveOnly || order.isAutomotive)
                  .map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{order.id.slice(-8)}</div>
                        <div className="text-sm text-gray-500">{order.orderLines.length} article(s)</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                        <div className="text-sm text-gray-500">{order.customerEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-blue-500 ${getStatusColor(order.status)}`}
                          disabled={orderActionLoading || automotiveActionLoading}
                        >
                          <option value="pending">En attente</option>
                          <option value="confirmed">Confirmée</option>
                          <option value="processing">En traitement</option>
                          <option value="shipped">Expédiée</option>
                          <option value="delivered">Livrée</option>
                          <option value="cancelled">Annulée</option>
                          <option value="refunded">Remboursée</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.isAutomotive ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            🚗 Automobile
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Standard
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</div>
                        {order.taxAmount > 0 && (
                          <div className="text-xs text-gray-500">
                            dont {formatCurrency(order.taxAmount)} de taxes
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderDetail(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Détails
                        </button>
                        {order.isAutomotive && order.vehicleData && (
                          <button
                            onClick={() => handleVehicleValidation(order.id, order.vehicleData!)}
                            className="text-purple-600 hover:text-purple-900"
                            disabled={automotiveActionLoading}
                          >
                            Valider véhicule
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {ordersData && ordersData.total > 20 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage * 20 >= ordersData.total}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{((currentPage - 1) * 20) + 1}</span> à{' '}
                  <span className="font-medium">{Math.min(currentPage * 20, ordersData.total)}</span> sur{' '}
                  <span className="font-medium">{ordersData.total}</span> commandes
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage * 20 >= ordersData.total}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Suivant
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de détails de commande */}
      {showOrderDetail && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Détails de la commande #{selectedOrder.id.slice(-8)}
                </h3>
                <button
                  onClick={() => setShowOrderDetail(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Informations générales */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-2">Informations générales</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Statut:</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(selectedOrder.status)}`}>
                          {getStatusLabel(selectedOrder.status)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Type:</span>
                        <span className="text-sm font-medium">
                          {selectedOrder.isAutomotive ? '🚗 Automobile' : 'Standard'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Date de création:</span>
                        <span className="text-sm font-medium">{formatDate(selectedOrder.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Dernière mise à jour:</span>
                        <span className="text-sm font-medium">{formatDate(selectedOrder.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Informations client */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-2">Client</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Nom:</span>
                        <span className="text-sm font-medium">{selectedOrder.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Email:</span>
                        <span className="text-sm font-medium">{selectedOrder.customerEmail}</span>
                      </div>
                    </div>
                  </div>

                  {/* Données véhicule */}
                  {selectedOrder.isAutomotive && selectedOrder.vehicleData && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Données véhicule</h4>
                      <div className="bg-purple-50 p-4 rounded-lg space-y-2">
                        {selectedOrder.vehicleData.vin && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">VIN:</span>
                            <span className="text-sm font-medium font-mono">{selectedOrder.vehicleData.vin}</span>
                          </div>
                        )}
                        {selectedOrder.vehicleData.registrationNumber && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Immatriculation:</span>
                            <span className="text-sm font-medium">{selectedOrder.vehicleData.registrationNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Marque/Modèle:</span>
                          <span className="text-sm font-medium">
                            {selectedOrder.vehicleData.brand} {selectedOrder.vehicleData.model}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Année:</span>
                          <span className="text-sm font-medium">{selectedOrder.vehicleData.year}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Moteur:</span>
                          <span className="text-sm font-medium">
                            {selectedOrder.vehicleData.engine} ({selectedOrder.vehicleData.fuelType})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Adresses */}
                <div className="space-y-4">
                  {/* Adresse de livraison */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-2">Adresse de livraison</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm">
                        <div className="font-medium">
                          {selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}
                        </div>
                        <div>{selectedOrder.shippingAddress.address}</div>
                        <div>
                          {selectedOrder.shippingAddress.zipCode} {selectedOrder.shippingAddress.city}
                        </div>
                        <div>{selectedOrder.shippingAddress.country}</div>
                        <div className="mt-1 text-gray-600">
                          Tél: {selectedOrder.shippingAddress.tel}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Adresse de facturation */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-2">Adresse de facturation</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm">
                        <div className="font-medium">
                          {selectedOrder.billingAddress.firstName} {selectedOrder.billingAddress.lastName}
                        </div>
                        <div>{selectedOrder.billingAddress.address}</div>
                        <div>
                          {selectedOrder.billingAddress.zipCode} {selectedOrder.billingAddress.city}
                        </div>
                        <div>{selectedOrder.billingAddress.country}</div>
                        <div className="mt-1 text-gray-600">
                          Tél: {selectedOrder.billingAddress.tel}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Résumé financier */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-2">Résumé financier</h4>
                    <div className="bg-green-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Sous-total:</span>
                        <span className="text-sm font-medium">
                          {formatCurrency(selectedOrder.totalAmount - selectedOrder.taxAmount - selectedOrder.shippingAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Livraison:</span>
                        <span className="text-sm font-medium">{formatCurrency(selectedOrder.shippingAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Taxes:</span>
                        <span className="text-sm font-medium">{formatCurrency(selectedOrder.taxAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-base font-semibold text-gray-900">Total:</span>
                        <span className="text-base font-semibold text-gray-900">
                          {formatCurrency(selectedOrder.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lignes de commande */}
              <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Articles commandés</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produit
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Code OEM
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Qté
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Prix unitaire
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedOrder.orderLines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{line.productName}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 font-mono">
                            {line.oemCode || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">{line.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(line.unitPrice)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(line.totalPrice)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(line.status)}`}>
                              {getStatusLabel(line.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
