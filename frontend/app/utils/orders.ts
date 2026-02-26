/**
 * Utilitaires pour les commandes - Côté client et serveur
 */

/**
 * Utilitaires pour les statuts de commandes
 */
export function getOrderStatusLabel(status: number): string {
  const statusMap: Record<number, string> = {
    1: "En attente",
    2: "Confirmée",
    3: "En préparation",
    4: "Prête à expédier",
    5: "Expédiée",
    6: "Livrée",
    91: "Annulée",
    92: "En rupture",
    93: "Retournée",
    94: "Remboursée",
  };

  return statusMap[status] || "Statut inconnu";
}

export { formatPrice } from "./format";

/**
 * Types d'interfaces partagées
 */
export interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  /** Legacy order ID from the database */
  ord_id?: string | number;
  orderNumber: string;
  status: number;
  totalTTC: number;
  createdAt: string;
  lines: OrderLine[];
  trackingNumber?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  transactionId?: string;
  deliveryMethod?: string;
  hasReview?: boolean;
  canReturn?: boolean;
  statusHistory?: Array<{ status: number; date: string; comment?: string }>;
  subtotalHT?: number;
  subtotalPrice?: number;
  tva?: number;
  shippingFee?: number;
  deliveryPrice?: number;
  discountAmount?: number;
  totalPrice?: number;
  shippingAddress?: Record<string, string | undefined>;
  deliveryAddress?: Record<string, string | undefined>;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
}
