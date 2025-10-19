import { useFetcher } from '@remix-run/react';
import {
  CheckCircle,
  CreditCard,
  Package,
  PlayCircle,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { type ActionData, type Order } from '../../types/orders.types';
import { type UserPermissions } from '../../utils/permissions';

interface OrderActionsProps {
  order: Order;
  permissions: UserPermissions;
  onActionComplete?: () => void;
}

export function OrderActions({
  order,
  permissions,
  onActionComplete,
}: OrderActionsProps) {
  const fetcher = useFetcher<ActionData>();

  const handleAction = (intent: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir effectuer cette action ?`)) {
      return;
    }

    fetcher.submit(
      { intent, orderId: order.ord_id },
      { method: 'post' }
    );
  };

  // Notifier le parent quand l'action est terminée
  if (fetcher.state === 'idle' && fetcher.data?.success && onActionComplete) {
    onActionComplete();
  }

  const isProcessing = fetcher.state !== 'idle';
  const canMarkPaid = !order.ord_is_pay && permissions.canMarkPaid;
  const canValidate = order.ord_ords_id === '1' && permissions.canValidate;
  const canStartProcessing = order.ord_ords_id === '2' && permissions.canValidate;
  const canMarkReady = order.ord_ords_id === '3' && permissions.canShip;
  const canShip = order.ord_ords_id === '4' && permissions.canShip;
  const canDeliver = order.ord_ords_id === '5' && permissions.canDeliver;
  const canCancel = order.ord_ords_id !== '7' && permissions.canCancel;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Marquer comme payé */}
      {canMarkPaid && (
        <button
          onClick={() => handleAction('markPaid')}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CreditCard className="w-4 h-4" />
          Marquer payé
        </button>
      )}

      {/* Valider */}
      {canValidate && (
        <button
          onClick={() => handleAction('validate')}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          Valider
        </button>
      )}

      {/* Démarrer préparation */}
      {canStartProcessing && (
        <button
          onClick={() => handleAction('startProcessing')}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlayCircle className="w-4 h-4" />
          Préparer
        </button>
      )}

      {/* Marquer prête */}
      {canMarkReady && (
        <button
          onClick={() => handleAction('markReady')}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Package className="w-4 h-4" />
          Prête
        </button>
      )}

      {/* Expédier */}
      {canShip && (
        <button
          onClick={() => handleAction('ship')}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Truck className="w-4 h-4" />
          Expédier
        </button>
      )}

      {/* Livrer */}
      {canDeliver && (
        <button
          onClick={() => handleAction('deliver')}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          Livrer
        </button>
      )}

      {/* Annuler */}
      {canCancel && (
        <button
          onClick={() => handleAction('cancel')}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <XCircle className="w-4 h-4" />
          Annuler
        </button>
      )}

      {/* Supprimer (admin seulement) */}
      {permissions.canCancel && order.ord_ords_id === '7' && (
        <button
          onClick={() => {
            if (
              confirm(
                'Êtes-vous sûr de vouloir supprimer définitivement cette commande ? Cette action est irréversible.',
              )
            ) {
              handleAction('delete');
            }
          }}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          Supprimer
        </button>
      )}
    </div>
  );
}
