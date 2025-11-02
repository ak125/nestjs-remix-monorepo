import { Alert } from '@fafa/ui';
import { Form, useFetcher } from '@remix-run/react';
import { Save, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { type ActionData, type Order } from '../../types/orders.types';

interface OrderEditFormProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OrderEditForm({
  order,
  isOpen,
  onClose,
  onSuccess,
}: OrderEditFormProps) {
  const fetcher = useFetcher<ActionData>();

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Gérer le succès
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onSuccess?.();
      onClose();
    }
  }, [fetcher.state, fetcher.data, onSuccess, onClose]);

  if (!isOpen) return null;

  const isSubmitting = fetcher.state === 'submitting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Modifier la commande #{order.ord_id}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <Form method="post" className="p-6">
          <input type="hidden" name="intent" value="updateOrder" />
          <input type="hidden" name="orderId" value={order.ord_id} />

          <div className="space-y-4">
            {/* Statut */}
            <div>
              <label
                htmlFor="orderStatus"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Statut de la commande
              </label>
              <select
                id="orderStatus"
                name="orderStatus"
                defaultValue={order.ord_ords_id}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              >
                <option value="1">En attente</option>
                <option value="2">Validée</option>
                <option value="3">En préparation</option>
                <option value="4">Prête</option>
                <option value="5">Expédiée</option>
                <option value="6">Livrée</option>
                <option value="7">Annulée</option>
              </select>
            </div>

            {/* Paiement */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPaid"
                name="isPaid"
                defaultChecked={order.ord_is_pay === '1'}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <label htmlFor="isPaid" className="text-sm font-medium text-gray-700">
                Commande payée
              </label>
            </div>

            {/* Montant total TTC */}
            <div>
              <label
                htmlFor="totalAmount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Montant total TTC (€)
              </label>
              <input
                type="number"
                id="totalAmount"
                name="totalAmount"
                step="0.01"
                min="0"
                defaultValue={order.ord_total_ttc}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Informations */}
            <div>
              <label
                htmlFor="orderInfo"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Informations / Notes
              </label>
              <textarea
                id="orderInfo"
                name="orderInfo"
                rows={4}
                defaultValue={order.ord_info || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Ajoutez des notes ou informations..."
                disabled={isSubmitting}
              />
            </div>

            {/* Email client */}
            <div>
              <label
                htmlFor="customerEmail"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email du client
              </label>
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                defaultValue={order.customerEmail || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Error message */}
          {fetcher.data?.error && (
            <Alert intent="error"><p>{fetcher.data.error}</p></Alert>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-muted/50 transition-colors"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <Button className="flex items-center gap-2 px-4 py-2  rounded-lg  disabled:opacity-50 disabled:cursor-not-allowed" variant="blue" type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
