/**
 * 📦 Types pour Gestion des Commandes
 * Extrait de routes/orders._index.tsx
 */

import { type getUserRole, type UserPermissions } from '../utils/permissions';

// ========================================
// 🛒 COMMANDE (Format BDD Supabase)
// ========================================

export interface Customer {
  cst_id?: string;
  cst_fname?: string;
  cst_name?: string;
  cst_mail?: string;
  cst_tel?: string;
  cst_gsm?: string;
  cst_city?: string;
  cst_zip_code?: string;
  cst_country?: string;
  cst_address?: string;
}

export interface StatusDetails {
  ords_id: string;
  ords_named: string;
  ords_color: string;
}

export interface Order {
  ord_id: string;
  ord_cst_id: string;
  ord_date: string;
  ord_amount_ht?: string;
  ord_total_ht?: string;
  ord_amount_ttc?: string;
  ord_total_ttc: string;
  ord_deposit_ht?: string;
  ord_deposit_ttc?: string;
  ord_shipping_fee_ht?: string;
  ord_shipping_fee_ttc?: string;
  ord_tva?: string;
  ord_is_pay: string; // "0" ou "1"
  ord_ords_id: string; // ID statut commande
  ord_info?: string;
  customerName?: string;
  customerEmail?: string;
  customer?: Customer;
  statusDetails?: StatusDetails;
}

// ========================================
// 📊 STATISTIQUES
// ========================================

export interface OrdersStats {
  totalOrders: number;
  totalRevenue: number;
  monthRevenue: number;
  averageBasket: number;
  unpaidAmount: number;
  pendingOrders: number;
}

// ========================================
// 🔍 FILTRES
// ========================================

export interface OrderFilters {
  search: string;
  orderStatus: string;
  paymentStatus: string;
  dateRange: string;
}

// ========================================
// 🎯 LOADER & ACTION DATA
// ========================================

export interface LoaderData {
  orders: Order[];
  stats: OrdersStats;
  filters: OrderFilters;
  error?: string;
  total: number;
  currentPage: number;
  totalPages: number;
  permissions: UserPermissions;
  user: {
    level: number;
    email: string;
    role: ReturnType<typeof getUserRole>;
  };
}

export interface ActionData {
  success?: boolean;
  message?: string;
  error?: string;
}

// ========================================
// 🎨 COMPOSANTS UI
// ========================================

export interface OrdersHeaderProps {
  permissions: UserPermissions;
  userRole: ReturnType<typeof getUserRole>;
  totalOrders: number;
}

export interface OrdersStatsProps {
  stats: OrdersStats;
}

export interface OrdersFiltersProps {
  filters: OrderFilters;
  onFilterChange: (filters: Partial<OrderFilters>) => void;
  onReset: () => void;
}

export interface OrdersTableProps {
  orders: Order[];
  permissions: UserPermissions;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onViewOrder?: (orderId: string) => void;
  onEditOrder?: (orderId: string) => void;
  onMarkPaid?: (orderId: string) => void;
  onValidate?: (orderId: string) => void;
  onStartProcessing?: (orderId: string) => void;
  onMarkReady?: (orderId: string) => void;
  onShip?: (orderId: string) => void;
  onDeliver?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
}

export interface OrderRowProps {
  order: Order;
  permissions: UserPermissions;
  onViewDetails: (orderId: string) => void;
  onEdit: (orderId: string) => void;
  onDelete: (orderId: string) => void;
}

export interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  permissions: UserPermissions;
}

export interface OrderActionsProps {
  order: Order;
  permissions: UserPermissions;
  onActionComplete: () => void;
}

export interface OrderWorkflowButtonsProps {
  order: Order;
  permissions: UserPermissions;
  onStatusChange: (newStatus: string) => void;
}

export interface OrderExportButtonsProps {
  filters: OrderFilters;
  selectedOrders: string[];
}
