/**
 * Canonical order status (___xtr_order.ord_ords_id, FK ___xtr_order_status.ords_id).
 *
 * Source of truth: DB lookup ___xtr_order_status (5 rows, verified live 2026-05-23
 * project cxpojprgwgubzjyqzmoq). Vault #301 audit — canonical values.
 *
 * IMPORTANT V1: transition 5 → 2 (cancel paid order) is FORBIDDEN.
 *   Reason: refund requires the payments/ module (Paybox/SystemPay) which is
 *   STRICTLY off-limits (cf. feedback_no_payment_module_changes_ever). Without
 *   refund gate, status='2' DB + money kept = customer dispute + accounting drift.
 *   V1.7+: the transition can be reopened via Human Override Authority
 *   (admin double-auth, TTL <= 4h) coupled with a manual refund workflow.
 */

export const OrderStatus = {
  PROCESSING: '1',
  CANCELLED: '2',
  AWAITING_SHIPPING_FEE: '3',
  SHIPPING_FEE_RECEIVED: '4',
  PAID: '5',
} as const;

export type OrderStatusCode = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_LABEL: Record<OrderStatusCode, string> = {
  '1': 'Commande en cours de traitement',
  '2': 'Commande annulée',
  '3': 'En attente de rajout de frais de port',
  '4': 'Rajout de frais de port reçu',
  '5': 'Payée — En préparation',
};

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  '1': ['2', '3', '5'],
  '2': [],
  '3': ['4', '2'],
  '4': ['5', '2'],
  '5': [],
};

export function isOrderStatusCode(value: unknown): value is OrderStatusCode {
  return typeof value === 'string' && value in ORDER_STATUS_LABEL;
}

export function isValidTransition(
  from: OrderStatusCode,
  to: OrderStatusCode,
): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getOrderStatusLabel(status: OrderStatusCode): string {
  return ORDER_STATUS_LABEL[status];
}
