/**
 * Order Events — EventEmitter2 Event Definitions
 */

export const ORDER_EVENTS = {
  CREATED: 'order.created',
  PAID: 'order.paid',
  STATUS_CHANGED: 'order.status_changed',
  VALIDATED: 'order.validated',
  SHIPPED: 'order.shipped',
  DELIVERED: 'order.delivered',
  CANCELLED: 'order.cancelled',
  REFUNDED: 'order.refunded',
  LINE_STATUS_CHANGED: 'order.line.status_changed',
  LINE_SUPPLIER_CONFIRMED: 'order.line.supplier_confirmed',
} as const;

/** Base event with optional correlation ID for request tracing */
export interface OrderEventBase {
  timestamp: string;
  correlationId?: string;
}

/** F1 attribution : source d'ajout par-ligne propagée sur l'event de création */
export interface OrderLineSource {
  lineId: string;
  productId: string | null;
  websiteUrl: string | null;
}

export interface OrderCreatedEvent extends OrderEventBase {
  orderId: string;
  customerId: string;
  totalTtc: number;
  linesCount: number;
  /** F1 : attribution add-to-cart par-ligne (source d'ajout). Vide si non capturée. */
  lines?: OrderLineSource[];
}

export interface OrderPaidEvent extends OrderEventBase {
  orderId: string;
  customerId: string;
  amount: number;
  paymentRef: string;
  gateway: string;
}

export interface OrderStatusChangedEvent extends OrderEventBase {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
  comment?: string;
}

export interface OrderShippedEvent extends OrderEventBase {
  orderId: string;
  customerId: string;
  trackingNumber: string;
  changedBy?: string;
}

export interface OrderDeliveredEvent extends OrderEventBase {
  orderId: string;
  customerId: string;
  changedBy?: string;
}

export interface OrderCancelledEvent extends OrderEventBase {
  orderId: string;
  customerId: string;
  reason: string;
  changedBy?: string;
}

export interface OrderRefundedEvent extends OrderEventBase {
  orderId: string;
  refundId: string;
  amount: number;
  reason: string;
  initiatedBy: string;
}

export interface OrderLineStatusChangedEvent extends OrderEventBase {
  /** Identifiants texte en base (`orl_id` mixte : numérique ou « <ord>-L001 »). */
  orderId: number | string;
  lineId: number | string;
  previousStatus: number | string | null;
  newStatus: number;
  changedBy?: number | string;
  comment?: string;
}

/** Décision 50 : fournisseur et prix d'achat confirmés sur une ligne. */
export interface OrderLineSupplierConfirmedEvent extends OrderEventBase {
  orderId: string;
  lineId: string;
  pieceId: number;
  splId: string;
  supplierName: string;
  unitPurchaseHt: number;
  quantity: number;
  purchaseHt: number;
  confirmedBy?: string;
}
