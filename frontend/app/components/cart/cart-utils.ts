/**
 * Cart shared utilities — constants and formatters
 */

export const FREE_SHIPPING_THRESHOLD = 150;
export const MAX_CART_QUANTITY = 99;

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}
