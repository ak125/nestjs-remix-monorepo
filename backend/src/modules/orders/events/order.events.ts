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
} as const;

export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  totalTtc: number;
  linesCount: number;
  timestamp: string;
}

export interface OrderPaidEvent {
  orderId: string;
  customerId: string;
  amount: number;
  paymentRef: string;
  gateway: string;
  timestamp: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
  comment?: string;
  timestamp: string;
}

export interface OrderShippedEvent {
  orderId: string;
  customerId: string;
  trackingNumber: string;
  changedBy?: string;
  timestamp: string;
}

export interface OrderDeliveredEvent {
  orderId: string;
  customerId: string;
  changedBy?: string;
  timestamp: string;
}

export interface OrderCancelledEvent {
  orderId: string;
  customerId: string;
  reason: string;
  changedBy?: string;
  timestamp: string;
}

export interface OrderRefundedEvent {
  orderId: string;
  refundId: string;
  amount: number;
  reason: string;
  initiatedBy: string;
  timestamp: string;
}

export interface OrderLineStatusChangedEvent {
  orderId: number;
  lineId: number;
  previousStatus: number;
  newStatus: number;
  changedBy?: number;
  comment?: string;
  timestamp: string;
}
