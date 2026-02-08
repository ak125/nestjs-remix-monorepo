/**
 * 📊 Stats Dashboard - Commandes
 * Composant extrait de routes/orders._index.tsx
 */

import { CheckCircle, Clock, DollarSign, Package } from "lucide-react";
import { memo } from "react";

import { type OrdersStatsProps } from "../../types/orders.types";
import { formatPrice } from "../../utils/orders.utils";

export const OrdersStats = memo(function OrdersStats({
  stats,
}: OrdersStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 py-6">
      {/* Total Commandes */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-muted rounded-lg">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">Total</span>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
        <p className="text-sm text-gray-600 mt-1">Commandes</p>
      </div>

      {/* Chiffre d'affaires */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-success/10 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">CA Total</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {formatPrice(stats.totalRevenue)}
        </p>
        <p className="text-sm text-green-600 mt-1">
          +{formatPrice(stats.monthRevenue)} ce mois
        </p>
      </div>

      {/* Panier moyen */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-muted rounded-lg">
            <CheckCircle className="w-6 h-6 text-purple-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">
            Panier moyen
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {formatPrice(stats.averageBasket)}
        </p>
        <p className="text-sm text-gray-600 mt-1">Par commande</p>
      </div>

      {/* Impayés */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-destructive/10 rounded-lg">
            <Clock className="w-6 h-6 text-red-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">Impayés</span>
        </div>
        <p className="text-2xl font-bold text-red-600">
          {formatPrice(stats.unpaidAmount)}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {stats.pendingOrders} en attente
        </p>
      </div>
    </div>
  );
});
