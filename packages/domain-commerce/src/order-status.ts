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

/**
 * Statuts « Expédiée » et « Livrée » — décision de Marwane du 2026-11-17
 * (22:01, Paris) : les libellés 1, 2, 4 et 5 décrivent l'historique et ne
 * changent pas ; les boutons Expédier et Livrer écrivent deux statuts
 * nouveaux, créés par la migration du mandat BN (PR #2147).
 *
 * SEUL ENDROIT À CHANGER. Identifiants donnés par BN : « Expédiée » = '7',
 * « Livrée » = '8' (OrderStatus.SHIPPED / DELIVERED de #2147, tête
 * 39ebb28ef ; '6' est déjà porté par d'anciennes annulations admin).
 * Préalable : la migration BN `20261117_order_status_3_label.sql` appliquée
 * AVANT le déploiement de ce code — `ord_ords_id` et l'historique référencent
 * `___xtr_order_status`, écrire 7 ou 8 absent échoue (erreur rendue, rien
 * écrit, aucun mail). Repli : remettre `null` ici ; Expédier et Livrer
 * écrivent alors le code antérieur (4 et 5), signalé `legacy: true` et
 * journalisé, et l'étape se lit sur les dates.
 */
export const ORDER_FULFILMENT_STATUS: Readonly<{
  SHIPPED: string | null;
  DELIVERED: string | null;
}> = Object.freeze({ SHIPPED: '7', DELIVERED: '8' });

export type OrderFulfilmentStep = keyof typeof ORDER_FULFILMENT_STATUS;

/** Codes écrits par Expédier et Livrer avant les statuts nouveaux. */
const LEGACY_FULFILMENT_WRITE: Readonly<
  Record<OrderFulfilmentStep, OrderStatusCode>
> = Object.freeze({
  SHIPPED: OrderStatus.SHIPPING_FEE_RECEIVED,
  DELIVERED: OrderStatus.PAID,
});

/** Code de statut à écrire par Expédier (`SHIPPED`) ou Livrer (`DELIVERED`). */
export function fulfilmentStatusToWrite(
  step: OrderFulfilmentStep,
  table: Readonly<Record<OrderFulfilmentStep, string | null>> = ORDER_FULFILMENT_STATUS,
): { code: string; legacy: boolean } {
  const id = table[step];
  return id
    ? { code: id, legacy: false }
    : { code: LEGACY_FULFILMENT_WRITE[step], legacy: true };
}

export type OrderFulfilment = 'shipped' | 'delivered';

/**
 * Étape d'expédition lue sur la commande : le statut nouveau quand il est
 * connu, sinon les dates posées par les mêmes boutons (commandes écrites
 * avant les statuts nouveaux). Une commande annulée n'a pas d'étape.
 */
export function orderFulfilment(
  order: {
    ord_ords_id?: string | number | null;
    ord_date_ship?: string | null;
    ord_date_deliv?: string | null;
  },
  table: Readonly<Record<OrderFulfilmentStep, string | null>> = ORDER_FULFILMENT_STATUS,
): OrderFulfilment | null {
  const code = order.ord_ords_id == null ? '' : String(order.ord_ords_id).trim();
  if (table.DELIVERED && code === table.DELIVERED) return 'delivered';
  if (table.SHIPPED && code === table.SHIPPED) return 'shipped';
  if (code === OrderStatus.CANCELLED || !order.ord_date_ship) return null;
  return order.ord_date_deliv ? 'delivered' : 'shipped';
}
