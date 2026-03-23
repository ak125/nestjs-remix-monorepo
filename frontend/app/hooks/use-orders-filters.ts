/**
 * 🪝 Hook Custom - Filtres Commandes
 * Extrait de routes/orders._index.tsx
 */

import { useMemo, useState } from "react";
import { type Order, type OrderFilters } from "../types/orders.types";
import { filterOrders, sortOrders } from "../utils/orders.utils";

export interface UseOrdersFiltersReturn {
  // État
  activeFilters: OrderFilters;
  sortBy: string;
  selectedOrders: string[];

  // Données calculées
  filteredOrders: Order[];
  totalFiltered: number;

  // Actions
  setActiveFilters: (filters: Partial<OrderFilters>) => void;
  setSortBy: (sort: string) => void;
  toggleOrderSelection: (orderId: string) => void;
  selectAllOrders: () => void;
  clearSelection: () => void;
  resetAllFilters: () => void;
}

const DEFAULT_FILTERS: OrderFilters = {
  search: "",
  orderStatus: "all",
  paymentStatus: "all",
  paymentMethod: "all",
  dateRange: "all",
};

/**
 * Hook pour gérer les filtres, tri et sélection des commandes
 */
export function useOrdersFilters(orders: Order[]): UseOrdersFiltersReturn {
  // État des filtres
  const [activeFilters, setFilters] = useState<OrderFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortByState] = useState<string>("date-desc");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Commandes filtrées et triées
  const filteredOrders = useMemo(() => {
    const filtered = filterOrders(
      orders,
      activeFilters.search,
      activeFilters.orderStatus,
      activeFilters.paymentStatus,
      activeFilters.dateRange,
      activeFilters.paymentMethod,
    );

    return sortOrders(filtered, sortBy);
  }, [orders, activeFilters, sortBy]);

  // Actions
  const setActiveFilters = (updates: Partial<OrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const setSortBy = (sort: string) => {
    setSortByState(sort);
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  const selectAllOrders = () => {
    setSelectedOrders(filteredOrders.map((order) => order.ord_id));
  };

  const clearSelection = () => {
    setSelectedOrders([]);
  };

  const resetAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSortByState("date-desc");
    setSelectedOrders([]);
  };

  return {
    // État
    activeFilters,
    sortBy,
    selectedOrders,

    // Données calculées
    filteredOrders,
    totalFiltered: filteredOrders.length,

    // Actions
    setActiveFilters,
    setSortBy,
    toggleOrderSelection,
    selectAllOrders,
    clearSelection,
    resetAllFilters,
  };
}
