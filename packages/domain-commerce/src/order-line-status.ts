/**
 * Canonical order line status (___xtr_order_line.orl_orls_id, FK ___xtr_order_line_status.orls_id).
 *
 * Source of truth: DB lookup ___xtr_order_line_status (10 rows, verified live
 * 2026-05-23 project cxpojprgwgubzjyqzmoq). Vault #301 F3 confirmed SoT.
 *
 * Managed by OrderActionsService (backend/src/modules/orders/services/order-actions.service.ts).
 * Direct writes on orl_orls_id from other services are forbidden by ast-grep rule
 * commerce-no-direct-line-status-write.
 */

export const OrderLineStatus = {
  PENDING: '1',
  CANCELLED: '2',
  NOT_COMPATIBLE: '3',
  NOT_AVAILABLE: '4',
  AVAILABLE: '5',
  ORDERED_FROM_SUPPLIER: '6',
  EQUIV_PROPOSED: '91',
  EQUIV_ACCEPTED: '92',
  EQUIV_REFUSED: '93',
  EQUIV_VALIDATED: '94',
} as const;

export type OrderLineStatusCode =
  (typeof OrderLineStatus)[keyof typeof OrderLineStatus];

export const ORDER_LINE_STATUS_LABEL: Record<OrderLineStatusCode, string> = {
  '1': 'Pièce en attente de traitement',
  '2': 'Pièce annulée',
  '3': 'Pièce non compatible',
  '4': 'Pièce non disponible',
  '5': 'Pièce disponible',
  '6': 'Pièce commandée chez fournisseur',
  '91': "Proposition d'équivalence",
  '92': 'Equivalence acceptée',
  '93': 'Equivalence refusée',
  '94': "Valider l'équivalence",
};

export function isOrderLineStatusCode(
  value: unknown,
): value is OrderLineStatusCode {
  return typeof value === 'string' && value in ORDER_LINE_STATUS_LABEL;
}

export function getOrderLineStatusLabel(status: OrderLineStatusCode): string {
  return ORDER_LINE_STATUS_LABEL[status];
}
