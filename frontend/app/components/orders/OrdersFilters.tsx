/**
 * 🔍 Filtres - Commandes
 * Composant extrait de routes/orders._index.tsx
 */

import { Search, X } from "lucide-react";

import { type OrdersFiltersProps } from "../../types/orders.types";

export function OrdersFilters({
  filters,
  onFilterChange,
  onReset,
}: OrdersFiltersProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.orderStatus !== "all" ||
    filters.paymentStatus !== "all" ||
    filters.dateRange !== "all";

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-wrap gap-4">
        {/* Recherche */}
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par ID, client, email..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Statut commande */}
        <select
          value={filters.orderStatus}
          onChange={(e) => onFilterChange({ orderStatus: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="1">En attente</option>
          <option value="2">Validée</option>
          <option value="3">En préparation</option>
          <option value="4">Prête</option>
          <option value="5">Expédiée</option>
          <option value="6">Livrée</option>
          <option value="7">Annulée</option>
        </select>

        {/* Statut paiement */}
        <select
          value={filters.paymentStatus}
          onChange={(e) => onFilterChange({ paymentStatus: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Tous les paiements</option>
          <option value="1">Payée</option>
          <option value="0">Impayée</option>
        </select>

        {/* Période */}
        <select
          value={filters.dateRange}
          onChange={(e) => onFilterChange({ dateRange: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Toutes les périodes</option>
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
          <option value="year">Cette année</option>
        </select>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
