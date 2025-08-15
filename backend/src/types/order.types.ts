/**
 * Types centralisés pour le système de commandes
 * ✅ Interface unique et cohérente
 * ✅ Enums typés pour les statuts
 * ✅ Documentation complète
 * ✅ Compatible avec la base de données existante
 */

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  taxRate: number;
  shippingFee: number;
  discount: number;
  total: number;
  currency: string;

  // Adresses
  shippingAddressId?: number;
  billingAddressId?: number;

  // Méthodes
  shippingMethodId?: number;
  paymentMethodId?: number;

  // Notes
  customerNotes?: string;
  internalNotes?: string;

  // Dates
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface OrderLine {
  id: number;
  orderId: number;
  productId: number;
  productReference: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: OrderLineStatus;
  supplierOrderRef?: string;
  trackingNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderStatusHistory {
  id: number;
  orderId: number;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  comment?: string;
  userId?: number;
  createdAt: Date;
}

export enum OrderStatus {
  DRAFT = 0, // Brouillon
  PENDING = 1, // En attente
  CONFIRMED = 2, // Confirmée
  PROCESSING = 3, // En traitement
  PREPARING = 4, // En préparation
  SHIPPED = 5, // Expédiée
  DELIVERED = 6, // Livrée

  // Statuts d'annulation/retour (91-94)
  CANCELLED = 91, // Annulée
  REFUND_REQUESTED = 92, // Remboursement demandé
  RETURNED = 93, // Retournée
  REFUNDED = 94, // Remboursée
}

export enum OrderLineStatus {
  PENDING = 1,
  CONFIRMED = 2,
  PREPARING = 3,
  READY = 4,
  SHIPPED = 5,
  DELIVERED = 6,
  CANCELLED = 91,
  RETURNED = 92,
  OUT_OF_STOCK = 93,
  REFUNDED = 94,
}

// Types pour la création de commandes
export interface CreateOrderDto {
  customerId: number;
  orderNumber?: string;
  status?: OrderStatus;
  subtotal?: number;
  tax?: number;
  taxRate?: number;
  shippingFee?: number;
  discount?: number;
  total?: number;
  currency?: string;
  orderLines?: CreateOrderLineDto[];
  shippingAddressId?: number;
  billingAddressId?: number;
  shippingMethodId?: number;
  paymentMethodId?: number;
  customerNotes?: string;
  internalNotes?: string;
}

export interface CreateOrderLineDto {
  productId: number;
  productReference: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
}

// Types pour les mises à jour
export interface UpdateOrderDto {
  status?: OrderStatus;
  shippingAddressId?: number;
  billingAddressId?: number;
  shippingMethodId?: number;
  paymentMethodId?: number;
  customerNotes?: string;
  internalNotes?: string;
  trackingNumber?: string;
}

export interface UpdateOrderLineDto {
  quantity?: number;
  unitPrice?: number;
  status?: OrderLineStatus;
  supplierOrderRef?: string;
  trackingNumber?: string;
}

// Types pour les réponses API
export interface OrderWithDetails extends Order {
  orderLines: OrderLine[];
  customer?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
  shippingAddress?: any;
  billingAddress?: any;
  statusHistory?: OrderStatusHistory[];
}

export interface OrderSummary {
  id: number;
  orderNumber: string;
  customerId: number;
  status: OrderStatus;
  total: number;
  currency: string;
  createdAt: Date;
  itemCount: number;
}

// Types pour les recherches et filtres
export interface OrderSearchFilters {
  customerId?: number;
  status?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export class OrderLineStatusUtils {
  static getStatusLabel(status: OrderLineStatus): string {
    const labels = {
      [OrderLineStatus.PENDING]: 'En attente',
      [OrderLineStatus.CONFIRMED]: 'Confirmé',
      [OrderLineStatus.PREPARING]: 'En préparation',
      [OrderLineStatus.READY]: 'Prêt',
      [OrderLineStatus.SHIPPED]: 'Expédié',
      [OrderLineStatus.DELIVERED]: 'Livré',
      [OrderLineStatus.CANCELLED]: 'Annulé',
      [OrderLineStatus.RETURNED]: 'Retourné',
      [OrderLineStatus.OUT_OF_STOCK]: 'Rupture de stock',
      [OrderLineStatus.REFUNDED]: 'Remboursé',
    };
    return labels[status] || 'Statut inconnu';
  }
}

// Types pour la compatibilité avec la base de données existante
export interface OrderDbEntity {
  order_id: number;
  customer_id: string;
  order_number: string;
  status: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  payment_method?: string;
  payment_status?: string;
  shipping_address_id?: number;
  billing_address_id?: number;
  tracking_number?: string;
  notes?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface OrderLineDbEntity {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  status?: string;
  supplier_id?: number;
}

// Fonctions de mapping entre les types
export class OrderMapper {
  static fromDb(dbOrder: OrderDbEntity): Order {
    return {
      id: dbOrder.order_id,
      orderNumber: dbOrder.order_number,
      customerId: parseInt(dbOrder.customer_id),
      status: dbOrder.status as OrderStatus,
      subtotal: dbOrder.subtotal,
      tax: dbOrder.tax,
      taxRate:
        dbOrder.subtotal > 0 ? (dbOrder.tax / dbOrder.subtotal) * 100 : 0,
      shippingFee: dbOrder.shipping,
      discount: dbOrder.discount,
      total: dbOrder.total,
      currency: '€', // Default currency
      shippingAddressId: dbOrder.shipping_address_id,
      billingAddressId: dbOrder.billing_address_id,
      customerNotes: dbOrder.notes,
      createdAt: dbOrder.created_at,
      updatedAt: dbOrder.updated_at || dbOrder.created_at,
      // Les autres champs seront définis par d'autres services
    };
  }

  static toDb(order: Partial<Order>): Partial<OrderDbEntity> {
    return {
      customer_id: order.customerId?.toString(),
      order_number: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shippingFee,
      discount: order.discount,
      total: order.total,
      shipping_address_id: order.shippingAddressId,
      billing_address_id: order.billingAddressId,
      notes: order.customerNotes,
      updated_at: new Date(),
    };
  }

  static orderLineFromDb(dbLine: any): OrderLine {
    return {
      id: dbLine.id,
      orderId: dbLine.order_id,
      productId: dbLine.product_id,
      productReference: dbLine.product_reference,
      productName: dbLine.product_name,
      productSku: dbLine.product_sku,
      quantity: dbLine.quantity,
      unitPrice: dbLine.unit_price,
      totalPrice: dbLine.total_price,
      status: dbLine.status as OrderLineStatus,
      supplierOrderRef: dbLine.supplier_order_ref,
      trackingNumber: dbLine.tracking_number,
      createdAt: new Date(dbLine.created_at),
      updatedAt: new Date(dbLine.updated_at),
    };
  }

  static statusHistoryFromDb(dbHistory: any): OrderStatusHistory {
    return {
      id: dbHistory.id,
      orderId: dbHistory.order_id,
      previousStatus: dbHistory.previous_status as OrderStatus,
      newStatus: dbHistory.new_status as OrderStatus,
      comment: dbHistory.comment,
      userId: dbHistory.user_id,
      createdAt: new Date(dbHistory.created_at),
    };
  }
}

/**
 * Utilitaires pour la validation des commandes
 */
export class OrderValidator {
  static isValidCustomerId(customerId: number): boolean {
    return Boolean(customerId && customerId > 0);
  }

  static isValidOrderId(orderId: number): boolean {
    return Boolean(orderId && orderId > 0);
  }

  static isValidOrderLineId(lineId: number): boolean {
    return Boolean(lineId && lineId > 0);
  }

  static isValidQuantity(quantity: number): boolean {
    return Boolean(quantity && quantity > 0);
  }

  static isValidPrice(price: number): boolean {
    return Boolean(price !== undefined && price >= 0);
  }

  static isValidTotal(total: number): boolean {
    return total >= 0;
  }
}

/**
 * Utilitaires pour la gestion des statuts de commandes
 */
export class OrderStatusUtils {
  static getStatusLabel(status: OrderStatus): string {
    const labels = {
      [OrderStatus.DRAFT]: 'Brouillon',
      [OrderStatus.PENDING]: 'En attente',
      [OrderStatus.CONFIRMED]: 'Confirmée',
      [OrderStatus.PROCESSING]: 'En traitement',
      [OrderStatus.PREPARING]: 'En préparation',
      [OrderStatus.SHIPPED]: 'Expédiée',
      [OrderStatus.DELIVERED]: 'Livrée',
      [OrderStatus.CANCELLED]: 'Annulée',
      [OrderStatus.REFUND_REQUESTED]: 'Remboursement demandé',
      [OrderStatus.RETURNED]: 'Retournée',
      [OrderStatus.REFUNDED]: 'Remboursée',
    };
    return labels[status] || 'Statut inconnu';
  }

  static canTransitionTo(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): boolean {
    // Règles de transition simplifiées
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
      [OrderStatus.DELIVERED]: [
        OrderStatus.RETURNED,
        OrderStatus.REFUND_REQUESTED,
      ],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
      [OrderStatus.REFUND_REQUESTED]: [
        OrderStatus.REFUNDED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.REFUNDED]: [],
    };

    return allowedTransitions[currentStatus]?.includes(newStatus) || false;
  }

  static isCancelled(status: OrderStatus): boolean {
    return [
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
      OrderStatus.RETURNED,
    ].includes(status);
  }

  static canBeCancelled(status: OrderStatus): boolean {
    return ![
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
      OrderStatus.RETURNED,
    ].includes(status);
  }

  static getArchivedStatuses(): OrderStatus[] {
    return [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.RETURNED];
  }

  static isCompleted(status: OrderStatus): boolean {
    return [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
    ].includes(status);
  }

  static canDelete(status: OrderStatus): boolean {
    // Seules les commandes en draft ou annulées peuvent être supprimées
    return [OrderStatus.DRAFT, OrderStatus.CANCELLED].includes(status);
  }

  static canModify(status: OrderStatus): boolean {
    // Une commande peut être modifiée seulement si elle est en draft ou en attente
    return [OrderStatus.DRAFT, OrderStatus.PENDING].includes(status);
  }
}

/**
 * Constantes pour les commandes
 */
export const ORDER_CONSTANTS = {
  DEFAULT_STATUS: OrderStatus.DRAFT,
  DEFAULT_LINE_STATUS: OrderLineStatus.PENDING,
  DEFAULT_CURRENCY: 'EUR',
  DEFAULT_TAX_RATE: 20.0,
  FREE_SHIPPING_THRESHOLD: 100.0,
  MAX_QUANTITY_PER_LINE: 999,
  MIN_ORDER_AMOUNT: 0.01,
  DEFAULT_SHIPPING_FEE: 5.0,
  WEIGHT_MULTIPLIER: 0.5,
} as const;
