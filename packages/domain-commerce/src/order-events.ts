/**
 * Canonical order event types written to ___xtr_order_history.event_type.
 *
 * V1 uses: ORDER_CREATED, STATUS_CHANGED, ORDER_CANCELLED.
 * Schema permits NOTE_UPDATED, ADDRESS_UPDATED, PAYMENT_CONFIRMED for V1.5+
 * (extension via ALTER TABLE CHECK additive, idempotent migration).
 *
 * Single entry point for writes: RPC append_order_event (idempotent, RLS-safe,
 * called from inside cancel_order_atomic / create_order_atomic transactions
 * for atomic audit trail).
 */

export const OrderEventType = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  NOTE_UPDATED: 'NOTE_UPDATED',
  ADDRESS_UPDATED: 'ADDRESS_UPDATED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
} as const;

export type OrderEventTypeCode =
  (typeof OrderEventType)[keyof typeof OrderEventType];

export function isOrderEventType(value: unknown): value is OrderEventTypeCode {
  return (
    typeof value === 'string' &&
    Object.values(OrderEventType).includes(value as OrderEventTypeCode)
  );
}
