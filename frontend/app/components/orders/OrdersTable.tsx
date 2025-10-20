/**
 * 📋 Table Commandes
 * Composant extrait de routes/orders._index.tsx
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { type OrdersTableProps } from '../../types/orders.types';
import { formatDate, formatOrderId, formatPrice, getPaymentBadgeColor, getPaymentLabel, getStatusBadgeColor, getStatusLabel } from '../../utils/orders.utils';
import { OrderActions } from './OrderActions';

export function OrdersTable({ 
  orders, 
  permissions, 
  currentPage, 
  totalPages, 
  onPageChange, 
  onViewOrder,
  onEditOrder,
  onMarkPaid,
  onValidate,
  onStartProcessing,
  onMarkReady,
  onShip,
  onDeliver,
  onCancel,
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center mx-6 my-6">
        <p className="text-gray-500 text-lg">Aucune commande trouvée</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Table */}
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paiement
                </th>
                {permissions.canValidate && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.ord_id} className="hover:bg-gray-50 transition-colors">
                  {/* ID */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatOrderId(order.ord_id)}
                    </div>
                  </td>

                  {/* Client */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{order.customerName || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{order.customerEmail || order.customer?.cst_mail || ''}</div>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(order.ord_date)}</div>
                  </td>

                  {/* Montant */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrice(order.ord_total_ttc)}
                    </div>
                  </td>

                  {/* Statut */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(order.ord_ords_id)}`}>
                      {getStatusLabel(order.ord_ords_id)}
                    </span>
                  </td>

                  {/* Paiement */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPaymentBadgeColor(order.ord_is_pay)}`}>
                      {getPaymentLabel(order.ord_is_pay)}
                    </span>
                  </td>

                  {/* Actions */}
                  {permissions.canValidate && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium"
                          onClick={() => onViewOrder?.(order.ord_id)}
                        >
                          Voir
                        </button>
                        <button
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium"
                          onClick={() => onEditOrder?.(order.ord_id)}
                        >
                          Modifier
                        </button>
                        <OrderActions
                          order={order}
                          permissions={permissions}
                          onMarkPaid={onMarkPaid}
                          onValidate={onValidate}
                          onStartProcessing={onStartProcessing}
                          onMarkReady={onMarkReady}
                          onShip={onShip}
                          onDeliver={onDeliver}
                          onCancel={onCancel}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Page {currentPage} sur {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
