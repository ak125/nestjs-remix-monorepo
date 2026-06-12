/**
 * @repo/domain-commerce
 *
 * Canon enums and transitions for the commerce domain.
 * Consumed by backend services, admin frontend, BullMQ workers, analytics.
 *
 * Resolves the divergence between '2' (DB) / 'cancelled' (label) / ORDER_CANCELLED
 * (event) / status=2 (legacy code) that motivated the package creation (Vault #301).
 *
 * See .spec/00-canon/commerce-runtime/authority-graph.yaml for the runtime
 * authority canon this package types.
 */

export {
  OrderStatus,
  type OrderStatusCode,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TRANSITIONS,
  isOrderStatusCode,
  isValidTransition,
  getOrderStatusLabel,
} from './order-status';

export {
  OrderLineStatus,
  type OrderLineStatusCode,
  ORDER_LINE_STATUS_LABEL,
  isOrderLineStatusCode,
  getOrderLineStatusLabel,
} from './order-line-status';

export {
  OrderEventType,
  type OrderEventTypeCode,
  isOrderEventType,
} from './order-events';
