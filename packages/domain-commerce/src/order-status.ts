/**
 * Canonical order status (___xtr_order.ord_ords_id, FK ___xtr_order_status.ords_id).
 *
 * Source of truth: DB lookup ___xtr_order_status (5 rows, verified live 2026-05-23
 * project cxpojprgwgubzjyqzmoq). Vault #301 audit — canonical values.
 * Mandat BN (2026-11-17, décision de Marwane à 22:01) : 3 renommé « Payée, à
 * traiter », 7 « Expédiée » et 8 « Livrée » ajoutés par la migration
 * 20261117_order_status_3_label.sql (préparée, appliquée par l'owner). '6' est
 * hors canon : porté en base par l'ancienne annulation admin, il n'est pas repris.
 * Les boutons expédier / livrer et les transitions vers 7 sont branchés par la
 * session BM ; ici, 7 et 8 sont seulement connus et libellés.
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
  SHIPPED: '7',
  DELIVERED: '8',
} as const;

export type OrderStatusCode = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_LABEL: Record<OrderStatusCode, string> = {
  '1': 'Commande en cours de traitement',
  '2': 'Commande annulée',
  // Mandat BN (2026-11-17) : libellés alignés sur la migration
  // 20261117_order_status_3_label.sql (préparée, appliquée par l'owner).
  '3': 'Payée, à traiter',
  '4': 'Rajout de frais de port reçu',
  '5': 'Payée — En préparation',
  '7': 'Expédiée',
  '8': 'Livrée',
};

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  '1': ['2', '3', '5'],
  '2': [],
  '3': ['4', '2'],
  '4': ['5', '2'],
  '5': [],
  // Aucune transition entrante vers 7 ici : elle vient avec le branchement BM.
  '7': ['8'],
  '8': [],
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
