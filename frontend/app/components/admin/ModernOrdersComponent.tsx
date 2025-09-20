/**
 * Exemple d'utilisation des patterns modernes : Zustand + Zod + API hooks
 * Ce composant démontre l'utilisation des nouvelles fonctionnalités
 */

import React, { useState } from 'react';
import { z } from 'zod';
import { useNotifications } from '~/components/notifications/NotificationContainer';
import { useCrud } from '~/hooks/useApi';
import { OrderSearchSchema, useZodValidation, type OrderSearchData } from '~/lib/schemas/validation';

// Schéma de réponse pour les commandes
const OrderResponseSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    customer_name: z.string(),
    total: z.number(),
    status: z.string(),
    created_at: z.string(),
  })),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const ModernOrdersComponent: React.FC = () => {
  // État local avec validation Zod
  const [searchForm, setSearchForm] = useState<OrderSearchData>({
    search: '',
    limit: 20,
    offset: 0,
  });

  // Local state pour remplacer le store
  const [currentPage] = useState(1);
  const [ordersCache, setOrdersCache] = useState<any[]>([]);
  
  // Notifications
  const { showSuccess, showError, showInfo } = useNotifications();
  
  // Validation Zod
  const { validate } = useZodValidation(OrderSearchSchema);
  
  // API avec Zod validation
  const ordersApi = useCrud('/api/admin/orders', OrderResponseSchema);

  // Charger les commandes
  const loadOrders = async () => {
    const validation = validate(searchForm);
    
    if (!validation.success) {
      showError('Paramètres de recherche invalides');
      return;
    }

    try {
      const response = await ordersApi.list(validation.data);
      setOrdersCache(response?.orders || []);
      showInfo(`${response?.orders?.length || 0} commandes trouvées`);
    } catch (error) {
      showError('Erreur lors du chargement des commandes');
    }
  };

  const handleSearchChange = (field: keyof OrderSearchData, value: any) => {
    setSearchForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Gestion des Commandes (Moderne)
        </h1>
        <div className="text-sm text-gray-500">
          Page actuelle: {currentPage}
        </div>
      </div>

      {/* Formulaire de recherche avec validation Zod */}
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recherche
            </label>
            <input
              type="text"
              value={searchForm.search || ''}
              onChange={(e) => handleSearchChange('search', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom du client, numéro de commande..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statut
            </label>
            <select
              value={searchForm.status || ''}
              onChange={(e) => handleSearchChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="shipped">Expédiée</option>
              <option value="delivered">Livrée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limite
            </label>
            <select
              value={searchForm.limit}
              onChange={(e) => handleSearchChange('limit', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={ordersApi.isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {ordersApi.isLoading ? 'Recherche...' : 'Rechercher'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setSearchForm({ search: '', limit: 20, offset: 0 });
              setOrdersCache([]);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Réinitialiser
          </button>

          <button
            type="button"
            onClick={() => showSuccess('Exemple de notification de succès')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Test Notification
          </button>
        </div>
      </form>

      {/* Affichage des erreurs de validation */}
      {ordersApi.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <strong>Erreur:</strong> {ordersApi.error}
        </div>
      )}

      {/* Liste des commandes depuis le cache Zustand */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Commandes ({ordersCache.length})
          </h3>
        </div>

        {ordersCache.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucune commande trouvée. Utilisez le formulaire de recherche ci-dessus.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {ordersCache.map((order) => (
              <div key={order.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {order.customer_name || 'Client non défini'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Commande #{order.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-medium text-gray-900">
                      {order.total ? `${order.total}€` : 'N/A'}
                    </p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status || 'unknown'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informations de débogage (développement) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Debug Info (dev only)
          </summary>
          <pre className="mt-2 p-4 bg-gray-100 text-xs overflow-x-auto">
            {JSON.stringify({
              searchForm,
              apiState: {
                isLoading: ordersApi.isLoading,
                error: ordersApi.error,
                dataLength: ordersApi.data?.orders?.length || 0,
              },
              cacheLength: ordersCache.length,
              currentPage,
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};
