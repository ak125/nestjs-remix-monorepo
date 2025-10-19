import {
  Calendar,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Phone,
  User,
  X,
} from 'lucide-react';
import { type MouseEvent, useEffect } from 'react';
import { type Order } from '../../types/orders.types';
import {
  formatDate,
  formatDateTime,
  formatOrderId,
  formatPrice,
  getPaymentBadgeColor,
  getPaymentLabel,
  getStatusBadgeColor,
} from '../../utils/orders.utils';
import { type UserPermissions } from '../../utils/permissions';

interface OrderDetailsModalProps {
  order: Order | null;
  permissions: UserPermissions;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaid?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
}

export function OrderDetailsModal({
  order,
  permissions,
  isOpen,
  onClose,
  onMarkPaid,
  onCancel,
}: OrderDetailsModalProps) {
  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Commande {formatOrderId(order.ord_id)}
              </h2>
              <p className="text-sm text-gray-500">
                {formatDateTime(order.ord_date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status & Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Statut de la commande
              </h3>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(
                  order.ord_ords_id,
                )}`}
              >
                {order.statusDetails?.ords_named || 'Inconnu'}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Paiement
              </h3>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPaymentBadgeColor(
                  order.ord_is_pay,
                )}`}
              >
                {getPaymentLabel(order.ord_is_pay)}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              Informations client
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Nom</p>
                  <p className="font-medium text-gray-900">
                    {order.customerName}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">
                    {order.customerEmail}
                  </p>
                </div>
              </div>
              {(order.customer?.cst_tel || order.customer?.cst_gsm) && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Téléphone</p>
                    <p className="font-medium text-gray-900">
                      {order.customer?.cst_tel || order.customer?.cst_gsm}
                    </p>
                  </div>
                </div>
              )}
              {order.customer?.cst_address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Adresse</p>
                    <p className="font-medium text-gray-900">
                      {order.customer.cst_address}
                      {order.customer.cst_zip_code && `, ${order.customer.cst_zip_code}`}
                      {order.customer.cst_city && ` ${order.customer.cst_city}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Info */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              Détails de la commande
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Date de commande</span>
                <span className="font-medium text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(order.ord_date)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Montant total TTC</span>
                <span className="font-semibold text-lg text-gray-900">
                  {formatPrice(order.ord_total_ttc)}
                </span>
              </div>
              {order.ord_info && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Informations</p>
                  <p className="text-gray-900">{order.ord_info}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-end gap-3">
          {!order.ord_is_pay && permissions.canMarkPaid && onMarkPaid && (
            <button
              onClick={() => onMarkPaid(order.ord_id)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Marquer comme payé
            </button>
          )}
          {order.ord_ords_id !== '7' && permissions.canCancel && onCancel && (
            <button
              onClick={() => onCancel(order.ord_id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Annuler la commande
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
