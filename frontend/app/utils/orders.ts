/**
 * Utilitaires pour les commandes - Côté client et serveur
 */

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
  /** Code ___xtr_order_line_status, `null` si absent */
  status?: string | null;
}

export interface Order {
  id: string;
  /** Legacy order ID from the database */
  ord_id?: string | number;
  orderNumber: string;
  /** Code ___xtr_order_status tel qu'en base (`ord_ords_id`), `null` si absent */
  status: string | null;
  /** Commande payée (`ord_is_pay = '1'`) */
  isPaid?: boolean;
  /** Date de paiement (`ord_date_pay`) */
  datePay?: string | null;
  totalTTC: number;
  createdAt: string;
  lines: OrderLine[];
  trackingNumber?: string;
  trackingUrl?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  transactionId?: string;
  deliveryMethod?: string;
  hasReview?: boolean;
  canReturn?: boolean;
  /** Annulation client autorisée (drapeau `customer_can_cancel` du backend) */
  canCancel?: boolean;
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
