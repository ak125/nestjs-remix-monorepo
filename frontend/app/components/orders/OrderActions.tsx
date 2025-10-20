import {
  CheckCircle,
  CreditCard,
  Package,
  PlayCircle,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { type Order } from '../../types/orders.types';
import { type UserPermissions } from '../../utils/permissions';

interface OrderActionsProps {
  order: Order;
  permissions: UserPermissions;
  onMarkPaid?: (orderId: string) => void;
  onValidate?: (orderId: string) => void;
  onStartProcessing?: (orderId: string) => void;
  onMarkReady?: (orderId: string) => void;
  onShip?: (orderId: string) => void;
  onDeliver?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
  onDelete?: (orderId: string) => void;
}

export function OrderActions({
  order,
  permissions,
  onMarkPaid,
  onValidate,
  onStartProcessing,
  onMarkReady,
  onShip,
  onDeliver,
  onCancel,
  onDelete,
}: OrderActionsProps) {
  const isProcessing = false; // Géré par les handlers parent
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
      {canMarkPaid && onMarkPaid && (
        <button
          onClick={() => onMarkPaid(order.ord_id)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CreditCard className="w-4 h-4" />
          Marquer payé
        </button>
      )}

      {/* Valider */}
      {canValidate && onValidate && (
        <button
          onClick={() => onValidate(order.ord_id)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          Valider
        </button>
      )}

      {/* Démarrer préparation */}
      {canStartProcessing && onStartProcessing && (
        <button
          onClick={() => onStartProcessing(order.ord_id)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlayCircle className="w-4 h-4" />
          Préparer
        </button>
      )}

      {/* Marquer prête */}
      {canMarkReady && onMarkReady && (
        <button
          onClick={() => onMarkReady(order.ord_id)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Package className="w-4 h-4" />
          Prête
        </button>
      )}

      {/* Expédier */}
      {canShip && onShip && (
        <button
          onClick={() => onShip(order.ord_id)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Truck className="w-4 h-4" />
          Expédier
        </button>
      )}

      {/* Livrer */}
      {canDeliver && onDeliver && (
        <button
          onClick={() => onDeliver(order.ord_id)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          Livrer
        </button>
      )}

      {/* Annuler */}
      {canCancel && onCancel && (
        <button
          onClick={() => onCancel(order.ord_id)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <XCircle className="w-4 h-4" />
          Annuler
        </button>
      )}

      {/* Supprimer (admin seulement) */}
      {permissions.canCancel && order.ord_ords_id === '7' && onDelete && (
        <button
          onClick={() => {
            if (
              confirm(
                'Êtes-vous sûr de vouloir supprimer définitivement cette commande ? Cette action est irréversible.',
              )
            ) {
              onDelete(order.ord_id);
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
