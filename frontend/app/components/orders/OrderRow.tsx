import { Check } from "lucide-react";
import { memo } from "react";
import { type Order } from "../../types/orders.types";
import {
  formatDate,
  formatOrderId,
  formatPrice,
  getPaymentBadgeColor,
  getPaymentLabel,
  getStatusBadgeColor,
} from "../../utils/orders.utils";
import { type UserPermissions } from "../../utils/permissions";

interface OrderRowProps {
  order: Order;
  permissions: UserPermissions;
  isSelected: boolean;
  onSelect: (orderId: string) => void;
  onView: (orderId: string) => void;
  onEdit?: (orderId: string) => void;
}

export const OrderRow = memo(function OrderRow({
  order,
  permissions,
  isSelected,
  onSelect,
  onView,
  onEdit,
}: OrderRowProps) {
  return (
    <tr
      className={`hover:bg-gray-50 transition-colors ${
        isSelected ? "bg-primary/5" : ""
      }`}
    >
      {/* Checkbox */}
      <td className="px-4 py-3 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(order.ord_id)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          aria-label={`Sélectionner commande ${formatOrderId(order.ord_id)}`}
        />
      </td>

      {/* Order ID */}
      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
        {formatOrderId(order.ord_id)}
      </td>

      {/* Customer */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">
            {order.customerName}
          </span>
          <span className="text-sm text-gray-500">{order.customerEmail}</span>
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
        {formatDate(order.ord_date)}
      </td>

      {/* Amount */}
      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
        {formatPrice(order.ord_total_ttc)}
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
            order.ord_ords_id,
          )}`}
        >
          {order.statusDetails?.ords_named || "Inconnu"}
        </span>
      </td>

      {/* Payment */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentBadgeColor(
            order.ord_is_pay,
          )}`}
        >
          {order.ord_is_pay && (
            <Check className="w-3 h-3 mr-1" strokeWidth={2.5} />
          )}
          {getPaymentLabel(order.ord_is_pay)}
        </span>
      </td>

      {/* Actions */}
      {permissions.canValidate && (
        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onView(order.ord_id)}
              className="text-blue-600 hover:text-blue-900 transition-colors"
            >
              Voir
            </button>
            {onEdit && permissions.canValidate && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => onEdit(order.ord_id)}
                  className="text-blue-600 hover:text-blue-900 transition-colors"
                >
                  Modifier
                </button>
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
});
